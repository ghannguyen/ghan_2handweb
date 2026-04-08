const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const OTP_STORE_PATH = path.join(DATA_DIR, "otp-store.json");
const ENV_PATH = path.join(ROOT, ".env");

loadDotEnv(ENV_PATH);

const PORT = Number(process.env.PORT || 4173);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_SEND_WINDOW_MINUTES = Number(process.env.OTP_SEND_WINDOW_MINUTES || 15);
const OTP_MAX_SENDS_PER_WINDOW = Number(process.env.OTP_MAX_SENDS_PER_WINDOW || 3);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

async function ensureStore() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(OTP_STORE_PATH);
  } catch {
    await fsp.writeFile(OTP_STORE_PATH, JSON.stringify({ requests: [] }, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  try {
    const raw = await fsp.readFile(OTP_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!Array.isArray(parsed.requests)) parsed.requests = [];
    return parsed;
  } catch {
    return { requests: [] };
  }
}

async function writeStore(store) {
  await ensureStore();
  await fsp.writeFile(OTP_STORE_PATH, JSON.stringify(store, null, 2));
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+${digits}`;
}

function validatePhone(phone) {
  return /^\+\d{10,15}$/.test(phone);
}

function requestId() {
  return crypto.randomBytes(12).toString("hex");
}

function cleanupRequests(requests) {
  const now = Date.now();
  return requests.filter((item) => (item.lastSentAt || 0) > now - (24 * 60 * 60 * 1000));
}

async function parseBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload quá lớn"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON không hợp lệ"));
      }
    });
    request.on("error", reject);
  });
}

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error("Thiếu cấu hình Twilio Verify. Kiểm tra TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN và TWILIO_VERIFY_SERVICE_SID.");
  }
  return { accountSid, authToken, verifyServiceSid };
}

function maskedSid(value = "") {
  const raw = String(value || "");
  if (raw.length < 8) return raw;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

async function parseTwilioResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function mapTwilioError(action, payload, fallbackStatus) {
  const rawMessage = String(payload?.message || payload?.detail || fallbackStatus || "Twilio error");
  const messageLower = rawMessage.toLowerCase();
  const code = Number(payload?.code || 0);
  if (messageLower.includes("unverified") || messageLower.includes("trial accounts cannot send messages to unverified numbers")) {
    return {
      statusCode: 403,
      message: "Số điện thoại này chưa được xác minh trong tài khoản Twilio Trial hiện tại. Hãy thêm đúng số nhận OTP vào Verified Caller IDs hoặc nâng cấp tài khoản Twilio.",
      providerCode: code || 20003,
      providerMessage: rawMessage,
      reason: "trial-unverified-number"
    };
  }
  if (messageLower.includes("authenticate") || code === 20003) {
    return {
      statusCode: 401,
      message: "Twilio từ chối xác thực. Kiểm tra lại TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN và bảo đảm server đã restart sau khi sửa .env.",
      providerCode: code || 20003,
      providerMessage: rawMessage,
      reason: "twilio-auth"
    };
  }
  if (messageLower.includes("max check attempts reached")) {
    return {
      statusCode: 429,
      message: "Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi lại mã mới.",
      providerCode: code,
      providerMessage: rawMessage,
      reason: "max-check-attempts"
    };
  }
  if (messageLower.includes("expired") || messageLower.includes("invalid verification code")) {
    return {
      statusCode: 400,
      message: action === "verify" ? "Mã OTP không đúng hoặc đã hết hạn." : "Không gửi được OTP do yêu cầu Twilio không hợp lệ.",
      providerCode: code,
      providerMessage: rawMessage,
      reason: "invalid-otp"
    };
  }
  return {
    statusCode: 502,
    message: action === "send" ? `Twilio Verify từ chối gửi OTP: ${rawMessage}` : `Twilio Verify từ chối xác minh OTP: ${rawMessage}`,
    providerCode: code,
    providerMessage: rawMessage,
    reason: "twilio-error"
  };
}

async function sendVerifyOtpWithTwilio({ to }) {
  const { accountSid, authToken, verifyServiceSid } = twilioConfig();
  const body = new URLSearchParams();
  body.set("To", to);
  body.set("Channel", "sms");

  const response = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await parseTwilioResponse(response);
  if (!response.ok) {
    const mapped = mapTwilioError("send", payload, response.statusText);
    const error = new Error(mapped.message);
    error.statusCode = mapped.statusCode;
    error.providerCode = mapped.providerCode;
    error.providerMessage = mapped.providerMessage;
    error.reason = mapped.reason;
    throw error;
  }
  return payload;
}

async function verifyOtpWithTwilio({ to, code }) {
  const { accountSid, authToken, verifyServiceSid } = twilioConfig();
  const body = new URLSearchParams();
  body.set("To", to);
  body.set("Code", code);

  const response = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await parseTwilioResponse(response);
  if (!response.ok) {
    const mapped = mapTwilioError("verify", payload, response.statusText);
    const error = new Error(mapped.message);
    error.statusCode = mapped.statusCode;
    error.providerCode = mapped.providerCode;
    error.providerMessage = mapped.providerMessage;
    error.reason = mapped.reason;
    throw error;
  }
  return payload;
}

async function handleSendOtp(request, response) {
  try {
    const body = await parseBody(request);
    const phone = normalizePhone(body.phone);
    const purpose = String(body.purpose || "seller-ekyc");
    if (!validatePhone(phone)) return json(response, 400, { ok: false, message: "Số điện thoại không hợp lệ. Hãy nhập đúng định dạng Việt Nam." });

    const store = await readStore();
    store.requests = cleanupRequests(store.requests || []);
    const now = Date.now();
    const windowStart = Date.now() - (OTP_SEND_WINDOW_MINUTES * 60 * 1000);
    const recentSends = store.requests.filter((item) => item.phone === phone && item.createdAt >= windowStart);
    if (recentSends.length >= OTP_MAX_SENDS_PER_WINDOW) {
      return json(response, 429, { ok: false, message: `Bạn đã gửi OTP quá nhiều lần. Thử lại sau ${OTP_SEND_WINDOW_MINUTES} phút.` });
    }

    const lastSession = [...store.requests].reverse().find((item) => item.phone === phone && item.purpose === purpose);
    if (lastSession && lastSession.status === "sent" && lastSession.lastSentAt + (OTP_RESEND_COOLDOWN_SECONDS * 1000) > now) {
      const retryAfterSeconds = Math.ceil((lastSession.lastSentAt + (OTP_RESEND_COOLDOWN_SECONDS * 1000) - now) / 1000);
      return json(response, 429, { ok: false, message: `Vui lòng chờ ${retryAfterSeconds}s trước khi gửi lại OTP.`, retryAfterSeconds });
    }

    const verifyPayload = await sendVerifyOtpWithTwilio({ to: phone });
    const otpRequest = {
      id: requestId(),
      phone,
      purpose,
      createdAt: now,
      lastSentAt: now,
      attempts: 0,
      sendAttempts: recentSends.length + 1,
      status: "sent",
      providerSid: verifyPayload.sid,
      channel: verifyPayload.channel || "sms"
    };

    store.requests.push(otpRequest);
    await writeStore(store);
    return json(response, 200, {
      ok: true,
      requestId: otpRequest.id,
      phone,
      status: verifyPayload.status || "pending",
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS
    });
  } catch (error) {
    return json(response, Number(error.statusCode || 503), {
      ok: false,
      message: error.message || "Không gửi được OTP.",
      reason: error.reason || "send-failed",
      providerCode: error.providerCode || null
    });
  }
}

async function handleVerifyOtp(request, response) {
  try {
    const body = await parseBody(request);
    const phone = normalizePhone(body.phone);
    const code = String(body.code || "").trim();
    const reqId = String(body.requestId || "");
    if (!validatePhone(phone) || !/^\d{4,10}$/.test(code) || !reqId) {
      return json(response, 400, { ok: false, message: "Thiếu thông tin xác minh OTP." });
    }

    const store = await readStore();
    store.requests = cleanupRequests(store.requests || []);
    const otpRequest = store.requests.find((item) => item.id === reqId && item.phone === phone && item.purpose === "seller-ekyc");
    if (!otpRequest) return json(response, 404, { ok: false, message: "Không tìm thấy phiên OTP. Vui lòng gửi lại mã mới." });
    if (otpRequest.status === "verified") return json(response, 200, { ok: true, message: "OTP đã được xác minh trước đó.", phone, verifiedAt: otpRequest.verifiedAt });
    if (otpRequest.attempts >= OTP_MAX_ATTEMPTS) {
      otpRequest.status = "locked";
      await writeStore(store);
      return json(response, 429, { ok: false, message: "Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại OTP." });
    }

    otpRequest.attempts += 1;
    let verifyPayload;
    try {
      verifyPayload = await verifyOtpWithTwilio({ to: phone, code });
    } catch (error) {
      await writeStore(store);
      return json(response, Number(error.statusCode || 400), {
        ok: false,
        message: error.message || `Mã OTP không đúng. Bạn còn ${Math.max(0, OTP_MAX_ATTEMPTS - otpRequest.attempts)} lần thử.`,
        reason: error.reason || "verify-failed",
        providerCode: error.providerCode || null
      });
    }

    if (String(verifyPayload.status).toLowerCase() !== "approved") {
      await writeStore(store);
      return json(response, 400, { ok: false, message: `Mã OTP không đúng hoặc đã hết hạn. Bạn còn ${Math.max(0, OTP_MAX_ATTEMPTS - otpRequest.attempts)} lần thử.` });
    }

    otpRequest.status = "verified";
    otpRequest.verifiedAt = Date.now();
    otpRequest.checkSid = verifyPayload.sid;
    await writeStore(store);
    return json(response, 200, { ok: true, phone, verifiedAt: otpRequest.verifiedAt, status: verifyPayload.status });
  } catch (error) {
    return json(response, Number(error.statusCode || 503), {
      ok: false,
      message: error.message || "Không xác minh được OTP.",
      reason: error.reason || "verify-failed",
      providerCode: error.providerCode || null
    });
  }
}

async function handleApi(request, response) {
  if (request.method === "POST" && request.url === "/api/otp/send") return handleSendOtp(request, response);
  if (request.method === "POST" && request.url === "/api/otp/verify") return handleVerifyOtp(request, response);
  if (request.method === "GET" && request.url === "/api/health") {
    return json(response, 200, {
      ok: true,
      smsProvider: "twilio-verify",
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID),
      envFilePresent: fs.existsSync(ENV_PATH),
      accountSid: maskedSid(process.env.TWILIO_ACCOUNT_SID),
      verifyServiceSid: maskedSid(process.env.TWILIO_VERIFY_SERVICE_SID),
      port: PORT
    });
  }
  return json(response, 404, { ok: false, message: "Không tìm thấy API." });
}

async function serveStatic(request, response) {
  let pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  const safePath = path.normalize(path.join(ROOT, pathname));
  if (!safePath.startsWith(ROOT)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  let filePath = safePath;
  try {
    const stats = await fsp.stat(filePath);
    if (stats.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fsp.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if ((request.url || "").startsWith("/api/")) return await handleApi(request, response);
    return await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    return json(response, 500, { ok: false, message: error.message || "Lỗi máy chủ." });
  }
});

ensureStore()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`ARCHIVE server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Không khởi tạo được server:", error);
    process.exit(1);
  });
