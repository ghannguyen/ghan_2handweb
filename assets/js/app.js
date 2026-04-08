const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = "archive_marketplace_vi_v6";

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowLabel = () => new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}₫`;
const moneyNegative = (value) => `<span class="amount-negative">-${money(Math.abs(Number(value || 0)))}</span>`;
const parseMoney = (value) => Number(String(value || "").replace(/[^\d]/g, ""));
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const fullTime = (value) => {
  if (!value) return nowLabel();
  const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
};

const rootPrefix = () => {
  const path = window.location.pathname;
  if (!path.includes("/pages/")) return "";
  const rest = path.split("/pages/")[1] || "";
  return rest.includes("/") ? "../../" : "../";
};
const href = (path) => `${rootPrefix()}${path}`;
const productUrl = (id) => href(`pages/product/detail.html?id=${id}`);
const apiUrl = (path) => new URL(path, window.location.origin).toString();
let otpCooldownTimer = null;

let state = loadState();

function seedState() {
  return {
    version: 6,
    users: clone(SEED_USERS),
    products: clone(SEED_PRODUCTS),
    bids: clone(SEED_BIDS),
    asks: clone(SEED_ASKS),
    orders: clone(SEED_ORDERS),
    promotions: clone(typeof SEED_PROMOTIONS !== "undefined" ? SEED_PROMOTIONS : []),
    withdrawals: clone(typeof SEED_WITHDRAWALS !== "undefined" ? SEED_WITHDRAWALS : []),
    complaints: clone(typeof SEED_COMPLAINTS !== "undefined" ? SEED_COMPLAINTS : []),
    cart: [],
    wishlist: ["celine-triomphe-ava", "chanel-coco-crush"],
    sessionUserId: null,
    shipping: {},
    lastOrderId: null
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 6) return saved;
  } catch (error) {
    /* localStorage có thể chứa dữ liệu cũ; seed lại để demo chạy ổn định. */
  }
  const seeded = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetDemo() {
  state = seedState();
  saveState();
  toast("Đã đặt lại dữ liệu demo.");
  route();
}

const currentUser = () => state.users.find((user) => user.id === state.sessionUserId) || null;
const approvedProducts = () => state.products.filter((product) => product.status === "approved");
const productById = (id) => state.products.find((product) => product.id === id) || approvedProducts()[0] || state.products[0];
const userById = (id) => state.users.find((user) => user.id === id);
const shippingFee = () => (typeof SHIPPING_FEE !== "undefined" ? SHIPPING_FEE : 350000);
const commissionRate = () => (typeof SELLER_COMMISSION_RATE !== "undefined" ? SELLER_COMMISSION_RATE : 0.12);
const commissionFee = (amount) => Math.round(Number(amount || 0) * commissionRate());
const sellerNet = (amount) => Math.max(0, Number(amount || 0) - commissionFee(amount));
const isExternalUrl = (value) => /^https?:\/\//.test(String(value || ""));
const assetUrl = (value) => (isExternalUrl(value) ? String(value) : href(value || "assets/products/celine-triomphe-marieclaire.jpg"));
const realImageFallback = () => assetUrl("assets/products/celine-triomphe-marieclaire.jpg");
const productImage = (product) => assetUrl(product?.image || "assets/products/celine-triomphe-marieclaire.jpg");
const productGallery = (product) => {
  const gallery = (product?.gallery && product.gallery.length ? product.gallery : [product?.image]).filter(Boolean);
  return gallery.length ? gallery.map(assetUrl) : [productImage(product)];
};
const roleLabel = (role) => ({ buyer: "Người mua", seller: "Người bán", admin: "Quản trị" }[role] || "Tài khoản");
const statusLabel = (status) => ({
  approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Từ chối", revision: "Cần chỉnh sửa",
  active: "Đang mở", matched: "Đã khớp", flagged: "AI gắn cờ", "auto-reject": "AI tự động từ chối",
  escrow: "Escrow tạm giữ", shipped: "Đang vận chuyển", fulfilled: "Đã hoàn tất", complaint: "Đang khiếu nại"
}[status] || status);

function sellerMetrics(sellerId) {
  const products = state.products.filter((p) => p.sellerId === sellerId);
  const orders = state.orders.filter((o) => products.some((p) => p.id === o.productId));
  const gross = orders.reduce((sum, order) => sum + Number(order.subtotal || Math.max(0, order.total - (order.shippingFee || 0))), 0);
  const commission = orders.reduce((sum, order) => sum + Number(order.commissionFee || commissionFee(order.subtotal || order.total)), 0);
  const net = orders.reduce((sum, order) => sum + Number(order.sellerNet || sellerNet(order.subtotal || order.total)), 0);
  const adCost = (state.promotions || []).filter((p) => p.sellerId === sellerId).reduce((sum, promo) => sum + Number(promo.cost || 0), 0);
  const withdrawn = state.withdrawals.filter((w) => w.sellerId === sellerId).reduce((sum, w) => sum + Number(w.amount || 0), 0);
  return { products, orders, gross, commission, net, adCost, withdrawn, payoutPending: Math.max(0, net - withdrawn - adCost) };
}

function verificationSummary(user) {
  if (!user || user.role !== "seller") return { items: [], done: 0, total: 0, progress: 0, complete: false, status: "na", nextKey: null };
  const verification = user?.verification || {};
  const items = [
    ["OTP số điện thoại", verification.phoneOtp],
    ["CCCD mặt trước", verification.idFront],
    ["CCCD mặt sau", verification.idBack],
    ["Quét khuôn mặt", verification.faceScan],
    ["Tài khoản ngân hàng chính chủ", verification.bankAccount]
  ];
  const done = items.filter((item) => item[1] === "verified").length;
  const total = items.length;
  const complete = done === total && verification.payoutEligible;
  const status = complete ? "complete" : done > 0 ? "processing" : "pending";
  const keys = ["phoneOtp", "idFront", "idBack", "faceScan", "bankAccount"];
  const nextKey = keys.find((key) => verification[key] !== "verified") || null;
  return { items, done, total, progress: total ? Math.round((done / total) * 100) : 0, complete, status, nextKey };
}

function ensureSellerVerification(user) {
  if (!user || user.role !== "seller") return user;
  user.verification = user.verification || {};
  user.verificationMeta = user.verificationMeta || {};
  ["phoneOtp", "idFront", "idBack", "faceScan", "bankAccount"].forEach((key) => {
    if (!user.verification[key]) user.verification[key] = "pending";
  });
  user.verification.payoutEligible = verificationSummary(user).done === 5;
  return user;
}

function verificationSteps(user) {
  ensureSellerVerification(user);
  const verification = user?.verification || {};
  const meta = user?.verificationMeta || {};
  return [
    {
      key: "phoneOtp",
      index: 1,
      title: "Xác thực OTP số điện thoại",
      action: "Xác thực ngay",
      status: verification.phoneOtp,
      description: "Bước đầu xác minh người bán là chủ tài khoản và dùng để bảo vệ đăng nhập, giao nhận và các thay đổi payout.",
      hint: verification.phoneOtp === "verified" && meta.phoneVerifiedAt ? `Số đã dùng: ${meta.phone} · Xác thực lúc ${meta.phoneVerifiedAt}` : meta.phone ? `Số đã dùng: ${meta.phone}` : `Số hiện tại: ${user?.phone || "Chưa cập nhật"}`
    },
    {
      key: "idFront",
      index: 2,
      title: "Tải CCCD mặt trước",
      action: "Tải lên",
      status: verification.idFront,
      description: "Mặt trước CCCD dùng để xác minh danh tính người bán, họ tên và số giấy tờ trong hồ sơ eKYC.",
      hint: meta.idFrontName ? `Tệp đã lưu: ${meta.idFrontName}` : "Yêu cầu ảnh rõ, đủ góc và không bị che thông tin chính."
    },
    {
      key: "idBack",
      index: 3,
      title: "Tải CCCD mặt sau",
      action: "Tải lên",
      status: verification.idBack,
      description: "Mặt sau CCCD giúp hoàn tất đối chiếu định danh và hỗ trợ admin kiểm tra hồ sơ seller khi cần.",
      hint: meta.idBackName ? `Tệp đã lưu: ${meta.idBackName}` : "Ảnh nên đủ sáng, không lóa và hiển thị trọn vẹn mã/chi tiết in."
    },
    {
      key: "faceScan",
      index: 4,
      title: "Quét khuôn mặt",
      action: "Bắt đầu quét",
      status: verification.faceScan,
      description: "Quét khuôn mặt dùng để đối chiếu người đăng ký với giấy tờ đã tải lên, giảm rủi ro giả mạo tài khoản seller.",
      hint: meta.faceScanAt ? `Hoàn tất lúc: ${meta.faceScanAt}` : "Cần ánh sáng tốt, nhìn thẳng vào camera và làm theo hướng dẫn."
    },
    {
      key: "bankAccount",
      index: 5,
      title: "Liên kết tài khoản ngân hàng chính chủ",
      action: "Liên kết tài khoản",
      status: verification.bankAccount,
      description: "Tài khoản ngân hàng chính chủ là điều kiện để seller đủ điều kiện nhận giải ngân sau khi escrow được xác nhận.",
      hint: meta.bankMasked ? `${meta.bankName || "Ngân hàng"} · ${meta.bankMasked}` : "Tên chủ tài khoản phải trùng với danh tính seller."
    }
  ];
}

function verificationStatusBadge(status) {
  const map = {
    verified: ["Đã xác thực", ""],
    pending: ["Chưa xong", "warn"],
    processing: ["Đang xử lý", "warn"]
  };
  const [label, cls] = map[status] || [statusLabel(status), "warn"];
  return `<span class="badge ${cls}">${label}</span>`;
}

function verificationFlowStatus(summary) {
  if (summary.complete) return ["Đủ điều kiện nhận thanh toán", "Hồ sơ đã xác thực đầy đủ. Seller có thể nhận giải ngân khi escrow hoàn tất."];
  if (summary.done > 0) return ["Đang xử lý eKYC", `Đã hoàn tất ${summary.done}/${summary.total} bước. Tiếp tục các bước còn lại để mở khóa payout.`];
  return ["Chưa hoàn tất eKYC", "Seller chưa thể nhận thanh toán cho đến khi hoàn thành đầy đủ xác thực danh tính và tài khoản nhận tiền."];
}

function isVerificationStepUnlocked(user, key) {
  const order = ["phoneOtp", "idFront", "idBack", "faceScan", "bankAccount"];
  const index = order.indexOf(key);
  if (index <= 0) return true;
  return order.slice(0, index).every((item) => user?.verification?.[item] === "verified");
}

function promotionPackages() {
  return {
    "home-24h": ["Ưu tiên trang chủ 24h", "Gói cố định theo thời gian", 390000],
    "category-top": ["Đầu danh mục 24h", "Trả theo lượt hiển thị", 240000],
    "search-click": ["Ưu tiên tìm kiếm", "Trả theo lượt click", 180000],
    "push-demo": ["Push notification mock", "Gói cố định", 520000]
  };
}

function fulfillmentStep(order) {
  const text = `${order.fulfillmentStatus || ""} ${order.status || ""}`.toLowerCase();
  if (text.includes("khiếu nại")) return 99;
  if (text.includes("hoàn tất") || text.includes("giải ngân")) return 4;
  if (text.includes("đang vận chuyển")) return 3;
  if (text.includes("đã đóng gói") || text.includes("chờ bàn giao")) return 2;
  if (text.includes("seller đã xác nhận")) return 1;
  return 0;
}

function roleDashboardPath(role, user = currentUser()) {
  return {
    buyer: "pages/buyer/account.html",
    seller: verificationSummary(user).complete ? "pages/seller/dashboard.html" : "pages/seller/verification.html",
    admin: "pages/admin/dashboard.html"
  }[role] || "pages/auth/sign-in.html";
}

function gradeBadge(grade) {
  const key = String(grade || "A").toLowerCase();
  return `<span class="badge grade grade-${key}" title="${GRADE_GUIDE[grade]}">Hạng ${grade}</span>`;
}

function appLink(path, text, className = "") {
  return `<a class="${className}" href="${href(path)}">${text}</a>`;
}

function header() {
  const user = currentUser();
  const cartCount = state.cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  const authBlock = user
    ? `<a href="${href(roleDashboardPath(user.role))}">□ <span>${roleLabel(user.role)}</span></a><button class="nav-button" data-action="logout">Đăng xuất</button>`
    : `<a href="${href("pages/auth/sign-in.html")}">□ <span>Đăng nhập</span></a>`;

  return `
    <header class="site-header">
      <div class="topline">Đồ hiệu second-hand đã kiểm duyệt · Mua ngay hoặc đặt Bid/Ask minh bạch</div>
      <nav class="nav">
        <a class="logo" href="${href("index.html")}">ARCHIVE</a>
        <div class="nav-links">
          ${appLink("index.html", "Trang chủ")}
          ${appLink("pages/shop.html", "Sàn giao dịch")}
          ${appLink("pages/brands.html", "Thương hiệu")}
          ${appLink("pages/sell.html", "Đăng bán")}
          ${appLink("pages/trust.html", "Xác thực")}
          ${appLink("pages/about.html", "Câu chuyện")}
        </div>
        <div class="nav-actions">
          <form class="search" data-search-form>
            <span>⌕</span><input name="q" placeholder="Tìm thương hiệu, túi, giày">
          </form>
          <a href="${href("pages/buyer/wishlist.html")}">♡ <span>Yêu thích</span></a>
          ${authBlock}
          <a href="${href("pages/buyer/cart.html")}">▱ <span>Giỏ (${cartCount})</span></a>
          <a class="mobile-toggle" href="${href("pages/shop.html")}">Menu</a>
        </div>
      </nav>
    </header>
  `;
}

function footer() {
  const groups = [
    ["Mua sắm", ["Sàn giao dịch", "Túi xách", "Giày", "Quần áo"]],
    ["Đăng bán", ["Bảng người bán", "Tạo bài đăng", "Ask của tôi", "Doanh số"]],
    ["Niềm tin", ["Xác thực", "Vận chuyển", "Đổi trả", "FAQ"]],
    ["Công ty", ["Câu chuyện", "Liên hệ", "Điều khoản", "Quyền riêng tư"]]
  ];
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div>
          <a class="logo" href="${href("index.html")}">ARCHIVE</a>
          <p class="muted">Nền tảng mua bán lại đồ hiệu tối giản, kết hợp mua ngay, Bid/Ask và kiểm duyệt chất lượng trước khi lên sàn.</p>
          <button class="chip" data-action="reset-demo">Đặt lại dữ liệu demo</button>
        </div>
        ${groups.map(([title, links]) => `<div><h4>${title}</h4>${links.map((label) => `<a href="${footerLink(label)}">${label}</a>`).join("")}</div>`).join("")}
      </div>
      <div class="footer-bottom"><span>© 2026 ARCHIVE · Demo sàn đồ hiệu second-hand</span><span>Dữ liệu demo được lưu trong trình duyệt để thao tác liền mạch.</span></div>
    </footer>
  `;
}

function footerLink(label) {
  const map = {
    "Sàn giao dịch": "pages/shop.html", "Túi xách": "pages/shop.html?category=Túi xách", Giày: "pages/shop.html?category=Giày", "Quần áo": "pages/shop.html?category=Quần áo",
    "Bảng người bán": "pages/seller/dashboard.html", "Tạo bài đăng": "pages/seller/add-listing.html", "Ask của tôi": "pages/seller/asks.html", "Doanh số": "pages/seller/sales.html",
    "Xác thực": "pages/trust.html", "Vận chuyển": "pages/trust.html#shipping", "Đổi trả": "pages/trust.html#returns", FAQ: "pages/trust.html#faq",
    "Câu chuyện": "pages/about.html", "Liên hệ": "pages/about.html#contact", "Điều khoản": "pages/trust.html", "Quyền riêng tư": "pages/trust.html"
  };
  return href(map[label] || "pages/shop.html");
}

function shell(content) {
  qs("#app").innerHTML = `${header()}<main class="page">${content}</main>${footer()}${tradeModal()}${promoModal()}${verificationModal()}<div class="toast-root" id="toast-root"></div>`;
  bindGlobal();
}

function toast(message, type = "success") {
  const root = qs("#toast-root");
  if (!root) return;
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function setLoading(button, label = "Đang xử lý...") {
  if (!button) return;
  button.dataset.originalText = button.textContent;
  button.textContent = label;
  button.disabled = true;
}

function clearLoading(button) {
  if (!button) return;
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function emptyState(title, copy, cta = "") {
  return `<div class="card empty"><h3>${title}</h3><p class="muted">${copy}</p>${cta}</div>`;
}

function mediaFrame(src, label, className = "media-frame") {
  return `<div class="${className}"><img src="${src}" alt="${label}" loading="lazy" onerror="this.onerror=null;this.src='${realImageFallback()}'"><span>${label}</span></div>`;
}

function galleryLayout(product, compact = false) {
  const gallery = productGallery(product);
  const first = gallery[0] || productImage(product);
  const sourceLabels = product.imageSources || [];
  const sourceChip = sourceLabels.length ? `<span class="badge subtle">${compact ? "Bộ ảnh đúng item" : `Ảnh chính: ${sourceLabels[0]}`}</span>` : "";
  return `
    <div class="product-gallery-ui ${compact ? "compact" : ""}">
      <div class="gallery-img gallery-main-frame" data-gallery-main-frame>
        <img data-gallery-main-img src="${first}" alt="${product.brand} ${product.name}" loading="eager" onerror="this.onerror=null;this.src='${realImageFallback()}'">
        <span>${compact ? `${product.brand} · ${product.name}` : `${product.brand} ${product.name}`}</span>
      </div>
      <div class="gallery-thumb-grid">
        ${gallery.map((src, index) => `<button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-thumb data-src="${src}" data-label="${product.brand} ${product.name} ${index + 1}" aria-label="Xem ảnh ${index + 1}"><img src="${src}" alt="${product.brand} ${product.name} ${index + 1}" loading="lazy" onerror="this.onerror=null;this.src='${realImageFallback()}'"></button>`).join("")}
      </div>
      ${compact ? "" : `<div class="gallery-caption"><p class="muted">Ảnh đầu là ảnh chuẩn sản phẩm. Các ảnh sau là ảnh thực tế/resale của đúng item để buyer xem rõ tình trạng, chất liệu và chi tiết.</p>${sourceChip}</div>`}
    </div>
  `;
}

function categoryImage(category) {
  return productImage(approvedProducts().find((product) => product.category === category) || approvedProducts()[0]);
}

function featuredProductForBrand(brand) {
  return approvedProducts().find((product) => product.brand === brand) || null;
}

function productCard(product) {
  const saved = state.wishlist.includes(product.id);
  return `
    <article class="card product-card">
      <a href="${productUrl(product.id)}">${mediaFrame(productImage(product), product.brand, "product-img")}</a>
      <div class="product-body">
        <div class="product-title-row">
          <div><p class="eyebrow">${product.brand}</p><h3><a href="${productUrl(product.id)}">${product.name}</a></h3></div>
          ${gradeBadge(product.grade)}
        </div>
        <div class="product-meta"><span>${product.size} · ${product.color}</span><span>${(product.badges || [])[0] || "Đã niêm yết"}</span></div>
        <div class="price-row">
          <div><span>Mua ngay</span><strong>${money(product.lowestAsk || product.buyNow)}</strong></div>
          <div><span>Bid cao nhất</span><strong>${money(product.highestBid)}</strong></div>
          <div><span>Ask thấp nhất</span><strong>${money(product.lowestAsk)}</strong></div>
        </div>
        <div class="card-actions">
          <button class="btn small-btn" data-action="add-cart" data-id="${product.id}">Thêm giỏ</button>
          <button class="btn ghost small-btn" data-action="toggle-wishlist" data-id="${product.id}">${saved ? "Đã lưu" : "Yêu thích"}</button>
        </div>
      </div>
    </article>
  `;
}

function pageHero(title, copy, eyebrow = "ARCHIVE") {
  return `<section><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lead" style="color:var(--muted)">${copy}</p></section>`;
}

function section(title, copy, body) {
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">${title}</p><h2>${title}</h2></div><p>${copy}</p></div>${body}</section>`;
}

function tradeExplainers() {
  return [
    ["Mua ngay", "Thanh toán ngay theo mức ask thấp nhất hoặc giá niêm yết hiện tại."],
    ["Đặt Bid", "Người mua đưa ra mức giá mong muốn. Nếu đủ tốt, người bán có thể chấp nhận."],
    ["Đặt Ask", "Người bán đặt mức giá sẵn sàng bán. Ask thấp nhất là giá mua ngay."],
    ["Bán ngay", "Người bán chấp nhận bid cao nhất để khớp giao dịch nhanh."]
  ].map((item) => `<div class="card dark"><h3>${item[0]}</h3><p class="muted">${item[1]}</p></div>`);
}

function gradeGuideCards() {
  return Object.entries(GRADE_GUIDE).map(([grade, copy]) => `<div class="card">${gradeBadge(grade)}<h3 style="margin-top:18px">Hạng ${grade}</h3><p class="muted">${copy}</p></div>`).join("");
}

function homePage() {
  const featured = approvedProducts().slice(0, 4);
  const heroProduct = featured[0] || approvedProducts()[0];
  shell(`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Resale đồ hiệu · Định giá theo thị trường</p>
        <h1>Tủ đồ hiệu, được giao dịch minh bạch.</h1>
        <p class="lead">ARCHIVE giúp mua bán đồ hiệu second-hand với kiểm duyệt, phân hạng S/A/B/C và cơ chế Mua ngay hoặc Bid/Ask dễ hiểu.</p>
        <div class="actions">
          <a class="btn" href="${href("pages/shop.html")}">Mua sắm ngay</a>
          <a class="btn secondary" href="${href("pages/sell.html")}">Đăng bán sản phẩm</a>
          <a class="btn secondary" href="${href("pages/brands.html")}">Khám phá thương hiệu</a>
        </div>
      </div>
      <div class="hero-art">
        ${mediaFrame(productImage(heroProduct), `${heroProduct?.brand || "ARCHIVE"} tuyển chọn`, "editorial-img")}
        <div class="hero-strip"><div><strong>${approvedProducts().length}</strong><span>Đang public</span></div><div><strong>24h</strong><span>Mục tiêu duyệt</span></div><div><strong>S/A/B/C</strong><span>Phân hạng</span></div></div>
      </div>
    </section>
    ${section("Danh mục nổi bật", "Mua theo cấu trúc tủ đồ, không theo những banner ồn ào.", `
      <div class="grid cols-4">${[
        "Túi xách", "Quần áo", "Giày", "Phụ kiện"
      ].map((cat) => `<a class="card category-card image-card" href="${href(`pages/shop.html?category=${encodeURIComponent(cat)}`)}">${mediaFrame(categoryImage(cat), cat, "category-img")}<span class="badge">${cat}</span><h3>${cat}</h3><p class="muted">Đồ hiệu đã kiểm duyệt từ seller đạt chuẩn.</p></a>`).join("")}</div>
    `)}
    ${section("Sản phẩm đang được chú ý", "Các bài đăng có Bid, Ask và giao dịch gần nhất rõ ràng để người mua hiểu giá trị thị trường.", `<div class="grid cols-4">${featured.map(productCard).join("")}</div>`)}
    ${section("Cách hoạt động", "Luồng thao tác được thiết kế để người mua, người bán và quản trị viên cùng hiểu trạng thái giao dịch.", `
      <div class="grid cols-4">${[
        ["Định danh seller", "Seller xác thực OTP, CCCD, khuôn mặt và ngân hàng để đủ điều kiện nhận payout."],
        ["AI scan + Admin", "Bài đăng được AI sàng lọc trước khi quản trị viên kiểm duyệt thủ công."],
        ["Mua hoặc Bid", "Người mua mua ngay theo Ask thấp nhất hoặc đặt Bid theo giá mong muốn."],
        ["Escrow & hậu mãi", "Buyer thanh toán vào escrow, theo dõi đơn và có 72 giờ kiểm tra/khiếu nại."]
      ].map((item, i) => `<div class="card"><p class="eyebrow">0${i + 1}</p><h3>${item[0]}</h3><p class="muted">${item[1]}</p></div>`).join("")}</div>
    `)}
    ${section("Bid / Ask dành cho đồ hiệu second-hand", "Minh bạch như thị trường giao dịch, nhưng được viết lại cho thời trang cao cấp.", `<div class="grid cols-4">${tradeExplainers().join("")}</div>`)}
    ${section("Phân hạng tình trạng", "Hạng S/A/B/C là điểm chạm quan trọng trên thẻ sản phẩm, trang chi tiết, form người bán và panel quản trị.", `<div class="grid cols-4">${gradeGuideCards()}</div>`)}
    ${section("Thương hiệu nổi bật", "Các nhà mốt luxury và nhãn thiết kế đang có nhu cầu mua bán lại mạnh tại Việt Nam.", `<div class="grid cols-4">${BRANDS.slice(0, 12).map((brand) => `<a class="card compact brand-card" href="${href(`pages/shop.html?brand=${encodeURIComponent(brand)}`)}"><p class="eyebrow">Thương hiệu</p><h3>${brand}</h3><p class="muted">Xem bài đăng đã xác thực</p></a>`).join("")}</div>`)}
    ${newsletter()}
  `);
}

function newsletter() {
  return section("Bản tin riêng", "Nhận thông tin drop mới, biến động giá và các seller slot tuyển chọn.", `
    <form class="card newsletter-card" data-newsletter>
      <div><h3>Nhận bản tuyển chọn hằng tuần.</h3><p class="muted">Không ồn ào. Chỉ gồm bài đăng mới, tín hiệu giá và thông báo xác thực.</p></div>
      <div class="inline-form"><input class="input" name="email" type="email" placeholder="email@domain.com" required><button class="btn">Đăng ký</button></div>
    </form>
  `);
}

function filterProducts() {
  const params = new URLSearchParams(window.location.search);
  let products = approvedProducts();
  const q = (params.get("q") || "").toLowerCase();
  const category = params.get("category") || "";
  const brand = params.get("brand") || "";
  const grade = params.get("grade") || "";
  const size = (params.get("size") || "").toLowerCase();
  const minPrice = parseMoney(params.get("minPrice"));
  const maxPrice = parseMoney(params.get("maxPrice"));
  const sort = params.get("sort") || "trending";
  if (q) products = products.filter((p) => `${p.brand} ${p.name} ${p.category}`.toLowerCase().includes(q));
  if (category) products = products.filter((p) => p.category === category);
  if (brand) products = products.filter((p) => p.brand === brand);
  if (grade) products = products.filter((p) => p.grade === grade);
  if (size) products = products.filter((p) => String(p.size || "").toLowerCase().includes(size));
  if (minPrice) products = products.filter((p) => (p.lowestAsk || p.buyNow) >= minPrice);
  if (maxPrice) products = products.filter((p) => (p.lowestAsk || p.buyNow) <= maxPrice);
  products.sort((a, b) => ({
    "price-asc": (a.lowestAsk || a.buyNow) - (b.lowestAsk || b.buyNow),
    "price-desc": (b.lowestAsk || b.buyNow) - (a.lowestAsk || a.buyNow),
    "highest-bid": b.highestBid - a.highestBid,
    newest: new Date(b.listedAt) - new Date(a.listedAt),
    trending: b.trend - a.trend
  }[sort] || (b.trend - a.trend)));
  return { products, params };
}

function shopPage() {
  const { products, params } = filterProducts();
  shell(`
    ${pageHero("Sàn giao dịch", "Duyệt đồ hiệu đã duyệt với giá mua ngay, Bid cao nhất và Ask thấp nhất.", "Bài đăng đã kiểm duyệt")}
    <div class="shop-layout section">
      <aside class="filters card">
        <h3>Bộ lọc</h3>
        <form data-filter-form>
          <label>Từ khóa<input class="input" name="q" value="${params.get("q") || ""}" placeholder="Celine, túi, blazer"></label>
          <label>Danh mục<select name="category"><option value="">Tất cả</option>${["Túi xách", "Quần áo", "Giày", "Phụ kiện"].map((v) => `<option ${params.get("category") === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Thương hiệu<select name="brand"><option value="">Tất cả</option>${BRANDS.map((v) => `<option ${params.get("brand") === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Size<input class="input" name="size" value="${params.get("size") || ""}" placeholder="M, 42, Small"></label>
          <label>Hạng<select name="grade"><option value="">Tất cả</option>${Object.keys(GRADE_GUIDE).map((v) => `<option ${params.get("grade") === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Giá từ<input class="input" name="minPrice" inputmode="numeric" value="${params.get("minPrice") || ""}" placeholder="10000000"></label>
          <label>Giá đến<input class="input" name="maxPrice" inputmode="numeric" value="${params.get("maxPrice") || ""}" placeholder="60000000"></label>
          <label>Sắp xếp<select name="sort"><option value="trending">Đang được quan tâm</option><option value="newest">Mới nhất</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option><option value="highest-bid">Bid cao nhất</option></select></label>
          <div class="actions"><button class="btn full">Áp dụng lọc</button><a class="btn ghost full" href="${href("pages/shop.html")}">Xóa lọc</a></div>
        </form>
        <div class="filter-group"><h4>Hướng dẫn grade</h4>${Object.entries(GRADE_GUIDE).map(([g, c]) => `<p class="small">${gradeBadge(g)} <span class="muted">${c}</span></p>`).join("")}</div>
      </aside>
      <section>
        <div class="section-head" style="margin-top:0"><div><p class="eyebrow">Bài đăng đã duyệt</p><h2>${products.length} sản phẩm</h2></div><p>Người bán không thể public trực tiếp. Chỉ bài đăng đã được quản trị viên duyệt mới xuất hiện tại đây.</p></div>
        ${products.length ? `<div class="grid cols-3">${products.map(productCard).join("")}</div>` : emptyState("Chưa có sản phẩm phù hợp", "Hãy thử bỏ bớt bộ lọc hoặc tìm bằng tên thương hiệu khác.", `<a class="btn" href="${href("pages/shop.html")}">Xem tất cả</a>`)}
      </section>
    </div>
  `);
  const sortSelect = qs('[name="sort"]');
  if (sortSelect) sortSelect.value = params.get("sort") || "trending";
}

function productDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const product = productById(params.get("id"));
  const seller = userById(product.sellerId);
  const events = marketEvents(product.id);
  shell(`
    <section class="product-detail">
      ${galleryLayout(product)}
      <aside class="detail-panel">
        <p class="eyebrow">${product.brand} · ${product.category}</p>
        <h1 style="font-size:clamp(44px,5vw,80px)">${product.name}</h1>
        <div class="actions" style="margin-top:18px">${gradeBadge(product.grade)} ${(product.badges || []).map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>
        <p class="muted">${product.condition}</p>
        <div class="stat-grid" id="market-stats">
          ${marketStat("Bid cao nhất", product.highestBid)}
          ${marketStat("Ask thấp nhất", product.lowestAsk)}
          ${marketStat("Giao dịch gần nhất", product.lastSale)}
        </div>
        <div class="grid cols-2">
          <button class="btn" data-action="buy-now" data-id="${product.id}">Mua ngay</button>
          <button class="btn secondary" data-trade="bid" data-id="${product.id}">Đặt Bid</button>
          <button class="btn ghost" data-trade="ask" data-id="${product.id}">Đặt Ask</button>
          <button class="btn ghost" data-trade="sell-now" data-id="${product.id}">Bán ngay</button>
          <button class="btn ghost" data-action="toggle-wishlist" data-id="${product.id}">${state.wishlist.includes(product.id) ? "Đã lưu yêu thích" : "Thêm yêu thích"}</button>
          <button class="btn ghost" data-action="add-cart" data-id="${product.id}">Thêm vào giỏ</button>
          <button class="btn ghost" data-action="chat-seller" data-id="${product.id}">Chat với seller</button>
        </div>
        <div class="card section" style="margin-top:26px">
          <h3>Tóm tắt thị trường</h3>
          <p class="muted">Nhu cầu hiện tại ở mức ${product.trend}% dựa trên độ sâu bid, ask gần nhất và lịch sử giao dịch.</p>
          <div class="market-bars"><div class="bar"><i style="width:${product.trend}%"></i></div></div>
        </div>
        <div class="card compact" style="margin-top:14px"><h3>Tình trạng & phân hạng</h3><p>${gradeBadge(product.grade)}</p><p class="muted">${GRADE_GUIDE[product.grade]}</p><p class="small muted">Thông số thực tế: ${product.measurements || "Seller sẽ bổ sung khi kiểm duyệt."}</p></div>
        <div class="card compact" style="margin-top:14px"><h3>Minh bạch sản phẩm</h3><p class="muted">Kích cỡ ${product.size} · ${product.color} · ${product.material}</p><p>Phụ kiện đi kèm: ${product.includedItems || "Đang cập nhật"}</p><p>Lỗi thực tế: ${product.flaws || "Không ghi nhận lỗi đáng kể"}</p><p>Trạng thái listing: <strong>${statusLabel(product.status)}</strong></p></div>
        <div class="card compact" style="margin-top:14px"><h3>Seller</h3><p><strong>${seller?.name || "Seller đã xác thực"}</strong></p><p class="muted">Điểm tín nhiệm ${seller?.sellerScore || 4.8}/5 · ${seller?.completedSales || 12} giao dịch hoàn tất · Thanh toán nhận qua escrow.</p></div>
        <div class="card compact" style="margin-top:14px"><h3>Kiểm duyệt</h3><p>${aiReviewBadge(product.aiReview)}</p><p class="muted">${(product.aiReview?.notes || ["Đã qua kiểm tra ảnh, mô tả, giá và từ khóa rủi ro."]).join(" · ")}</p><p class="small muted">Admin: ${product.adminReview?.note || "Chỉ bài đã duyệt mới public trên sàn."}</p></div>
        <div class="accordion" style="margin-top:18px">
          <details open><summary>Bid / Ask là gì?</summary><p class="muted">Bid là giá người mua muốn trả. Ask là giá người bán muốn nhận. Khi hai mức giá khớp hoặc được chấp nhận, giao dịch được tạo.</p></details>
          <details><summary>Vận chuyển và bảo vệ người mua</summary><p class="muted">Buyer chỉ thanh toán giá sản phẩm và phí vận chuyển. Khoản tiền được tạm giữ trong escrow mock, buyer có 72 giờ kiểm tra trước khi giải ngân cho seller.</p></details>
        </div>
      </aside>
    </section>
    ${section("Hoạt động thị trường", "Lịch sử demo được cập nhật ngay sau khi đặt Bid/Ask hoặc khớp giao dịch.", marketActivityTable(events))}
    ${section("Sản phẩm liên quan", "Các bài đăng đã duyệt khác có cùng tinh thần mua bán lại cao cấp.", `<div class="grid cols-4">${approvedProducts().filter((item) => item.id !== product.id).slice(0, 4).map(productCard).join("")}</div>`)}
  `);
}

function marketStat(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${money(value)}</strong></div>`;
}

function aiReviewBadge(review = {}) {
  const label = review.status || "Passed";
  const cls = label === "Auto-Reject" ? "danger" : label === "Flagged" ? "warn" : "";
  return `<span class="badge ${cls}">AI scan: ${label}${review.score ? ` · ${review.score}/100` : ""}</span>`;
}

function marketEvents(productId) {
  const bids = state.bids.filter((b) => b.productId === productId).map((b) => ({ time: b.createdAt, type: "Bid", person: b.buyer || userById(b.userId)?.name || "Người mua", amount: b.amount, status: statusLabel(b.status) }));
  const asks = state.asks.filter((a) => a.productId === productId).map((a) => ({ time: a.createdAt, type: "Ask", person: a.seller || userById(a.sellerId)?.name || "Người bán", amount: a.amount, status: statusLabel(a.status) }));
  const orders = state.orders.filter((o) => o.productId === productId).map((o) => ({ time: o.date, type: "Giao dịch", person: o.buyer, amount: o.total, status: o.status }));
  return [...bids, ...asks, ...orders].sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 8);
}

function marketActivityTable(events) {
  if (!events.length) return emptyState("Chưa có hoạt động", "Sản phẩm này chưa có bid/ask mới trong phiên demo.");
  return `<table class="table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Người dùng</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>${events.map((e) => `<tr><td>${e.time}</td><td>${e.type}</td><td>${e.person}</td><td>${money(e.amount)}</td><td>${e.status}</td></tr>`).join("")}</tbody></table>`;
}

function brandsPage() {
  shell(`${pageHero("Danh mục thương hiệu", "Một chỉ mục gọn gàng cho các nhà mốt và nhãn archival đang có nhu cầu mua bán lại.", "Thương hiệu")}<section class="section grid cols-4">${BRANDS.map((brand) => {
    const product = featuredProductForBrand(brand);
    return `<a class="card brand-card image-card" href="${href(`pages/shop.html?brand=${encodeURIComponent(brand)}`)}">${product ? mediaFrame(productImage(product), brand, "category-img") : ""}<p class="eyebrow">${product ? "Đang có bài đăng" : "Sắp cập nhật"}</p><h3>${brand}</h3><p class="muted">${product ? `Xem ${product.category.toLowerCase()} và bài đăng đã xác thực.` : "Thương hiệu đang được theo dõi để mở rộng nguồn hàng."}</p></a>`;
  }).join("")}</section>`);
}

function sellPage() {
  shell(`${pageHero("Đăng bán cùng ARCHIVE", "Gửi sản phẩm vào quy trình kiểm duyệt để bài đăng có hạng, giá và thông tin đủ tin cậy.", "Hướng dẫn người bán")}
    ${section("Quy trình người bán", "Bài đăng không hiển thị công khai ngay. Quản trị viên duyệt trước khi sản phẩm xuất hiện ngoài sàn.", `<div class="grid cols-5">${["Gửi sản phẩm", "Sàng lọc", "Đặt Ask", "Xác thực", "Nhận thanh toán"].map((x, i) => `<div class="card"><p class="eyebrow">0${i + 1}</p><h3>${x}</h3><p class="muted">${["Tải ảnh và nhập thông tin chi tiết.", "Quản trị viên kiểm tra mô tả, ảnh, thương hiệu và hạng.", "Chọn giá mua ngay hoặc Ask mong muốn.", "Khi có đơn, hàng đi qua bước kiểm tra.", "Khoản nhận demo được ghi nhận sau khi đơn hoàn tất."][i]}</p></div>`).join("")}</div>`)}
    ${section("Luồng vận hành seller", "Demo mô phỏng đủ các điểm nghiệp vụ chính: eKYC, AI scan, admin review, escrow, payout và quảng cáo.", `<div class="grid cols-4">${[
      ["eKYC payout", "OTP, CCCD hai mặt, quét khuôn mặt và tài khoản ngân hàng chính chủ."],
      ["Bộ ảnh bắt buộc", "Ảnh tham chiếu, tổng thể, chi tiết, nhãn mác, chất liệu và lỗi thực tế."],
      ["Khớp lệnh", "Seller có thể Hold Ask hoặc Sell Now theo Highest Bid hiện tại."],
      ["Hoa hồng & quảng cáo", "Seller chịu phí hoa hồng trên đơn bán và có thể mua gói đẩy bài."]
    ].map(([title, copy]) => `<div class="card"><h3>${title}</h3><p class="muted">${copy}</p></div>`).join("")}</div>`)}
    <section class="section grid cols-2"><div class="card dark"><h2>Sẵn sàng gửi bài?</h2><p class="muted">Đăng nhập người bán và tạo bài đăng đầu tiên để quản trị viên duyệt.</p><div class="actions"><a class="btn secondary" href="${href("pages/seller/add-listing.html")}">Tạo bài đăng</a></div></div>${mediaFrame(productImage(productById("prada-re-nylon-jacket")), "Hướng dẫn người bán", "editorial-img")}</section>`);
}

function trustPage() {
  shell(`${pageHero("Xác thực & niềm tin", "Một lớp trust rõ ràng cho buyer, seller và admin trong từng trạng thái giao dịch.", "Tiêu chuẩn nền tảng")}
    ${section("Bảo vệ giao dịch", "Thông tin đủ rõ nhưng không làm UI nặng nề.", `<div class="grid cols-4">${[
      ["AI scan trước duyệt", "Mô phỏng quét ảnh không hợp lệ, ảnh trùng, từ khóa cấm và giá bất thường."],
      ["Admin review thủ công", "Kiểm tra ảnh, logo/tag/serial, hao mòn, form dáng, vệ sinh và grade."],
      ["Escrow mock", "Buyer thanh toán vào tài khoản tạm giữ; seller nhận tiền sau khi hoàn tất hoặc hết hạn khiếu nại."],
      ["72 giờ kiểm tra", "Buyer có thể xác nhận nhận hàng hoặc gửi khiếu nại/hoàn tiền trong thời gian ân hạn."]
    ].map(([x, c]) => `<div class="card"><h3>${x}</h3><p class="muted">${c}</p></div>`).join("")}</div>`)}
    ${section("Bảng phân hạng S/A/B/C", "Ngôn ngữ điều kiện được dùng xuyên suốt card, detail, form seller và admin review.", `<div class="grid cols-4">${gradeGuideCards()}</div>`)}
    <section id="faq" class="section"><div class="section-head"><div><p class="eyebrow">FAQ</p><h2>Câu hỏi thường gặp</h2></div></div><div class="accordion">${["Mua ngay hoạt động thế nào?", "Khi Bid khớp Ask thì sao?", "Vì sao quản trị viên phải duyệt bài đăng?", "Quản trị viên có thể đổi hạng người bán đề xuất không?"].map((q) => `<details><summary>${q}</summary><p class="muted">ARCHIVE giữ giao dịch có cấu trúc: giá rõ, trạng thái rõ, kiểm duyệt trước khi bài đăng hiển thị công khai và xác thực trước khi giao hàng.</p></details>`).join("")}</div></section>`);
}

function aboutPage() {
  shell(`${pageHero("Câu chuyện của ARCHIVE", "Một demo đồ án/startup concept cho sàn mua bán lại đồ hiệu thông minh hơn tại Việt Nam.", "Về chúng tôi")}
    <section class="section grid cols-2"><div class="card"><h2>Ít nhiễu hơn. Nhiều tín hiệu hơn.</h2><p class="muted">Chúng tôi kết hợp curation, định giá theo thị trường và kiểm duyệt admin để buyer hiểu giá trị, seller đăng bán có kỷ luật và hệ thống tạo được niềm tin.</p></div>${mediaFrame(productImage(productById("chanel-coco-crush")), "Archive editorial", "editorial-img")}</section>`);
}

function authPage(type) {
  const signUp = type === "sign-up";
  const forgot = type === "forgot";
  shell(`<section class="auth-shell">
    <div class="auth-art"><p class="eyebrow">Tài khoản</p><h2>${signUp ? "Tạo hồ sơ ARCHIVE." : forgot ? "Khôi phục quyền truy cập." : "Đăng nhập vào sàn giao dịch."}</h2><p class="muted">Tài khoản demo: buyer@archive.vn / seller@archive.vn / admin@archive.vn, mật khẩu 123456.</p>${signUp ? `<p class="muted">Seller sau khi đăng ký sẽ đi qua quy trình eKYC 5 bước: OTP số điện thoại, CCCD hai mặt, quét khuôn mặt và liên kết tài khoản ngân hàng chính chủ.</p>` : ""}</div>
    <form class="auth-form" data-auth-form="${type}">
      <p class="eyebrow">${signUp ? "Đăng ký" : forgot ? "Quên mật khẩu" : "Đăng nhập"}</p><h2>${signUp ? "Tạo tài khoản" : forgot ? "Nhận liên kết đặt lại" : "Chào mừng trở lại"}</h2>
      <div class="form-grid" style="margin-top:24px">
        ${signUp ? '<label class="wide">Họ tên<input class="input" name="name" placeholder="Nguyễn Minh Anh" required></label>' : ""}
        <label class="wide">Email<input class="input" name="email" type="email" placeholder="buyer@archive.vn" required></label>
        ${forgot ? "" : '<label class="wide">Mật khẩu<input class="input" name="password" type="password" placeholder="123456" required></label>'}
        ${signUp ? '<label class="wide">Vai trò<select name="role"><option value="buyer">Người mua</option><option value="seller">Người bán</option></select><span class="field-note">Nếu chọn người bán, hệ thống sẽ yêu cầu hoàn tất eKYC trước khi đủ điều kiện nhận giải ngân.</span></label>' : ""}
      </div>
      <div class="actions"><button class="btn">${forgot ? "Gửi liên kết" : "Tiếp tục"}</button><a class="btn ghost" href="${href(signUp ? "pages/auth/sign-in.html" : "pages/auth/sign-up.html")}">${signUp ? "Tôi đã có tài khoản" : "Tạo tài khoản"}</a></div>
      ${!signUp && !forgot ? `<div class="demo-logins"><button type="button" class="chip" data-demo-login="buyer@archive.vn">Người mua</button><button type="button" class="chip" data-demo-login="seller@archive.vn">Người bán</button><button type="button" class="chip" data-demo-login="admin@archive.vn">Quản trị</button></div>` : ""}
    </form>
  </section>`);
}

function requireRole(role, render) {
  const user = currentUser();
  if (!user) return authRequired(`Bạn cần đăng nhập để vào khu vực ${roleLabel(role)}.`);
  if (user.role !== role) return shell(pageHero("Không đúng quyền truy cập", `Tài khoản hiện tại là ${roleLabel(user.role)}. Hãy đăng xuất hoặc vào bảng điều khiển phù hợp.`, "Phân quyền") + `<div class="actions"><a class="btn" href="${href(roleDashboardPath(user.role))}">Vào bảng của tôi</a><button class="btn ghost" data-action="logout">Đăng xuất</button></div>`);
  return render(user);
}

function authRequired(copy) {
  shell(pageHero("Cần đăng nhập", copy, "Tài khoản") + `<div class="actions"><a class="btn" href="${href("pages/auth/sign-in.html")}">Đăng nhập</a><a class="btn ghost" href="${href("pages/auth/sign-up.html")}">Đăng ký</a></div>`);
}

function accountPage(kind) {
  return requireRole("buyer", (user) => {
    if (kind === "checkout") return shell(checkoutContent(true));
    if (kind === "confirmation") return shell(orderConfirmation());
    const content = {
      account: buyerOverview(user),
      orders: ordersTable(state.orders.filter((o) => o.buyerId === user.id)),
      bids: bidsTable(state.bids.filter((b) => b.userId === user.id)),
      wishlist: wishlistContent(),
      saved: wishlistContent(true),
      cart: cartContent(),
      complaint: buyerComplaintContent(user.id)
    }[kind] || buyerOverview(user);
    shell(`<section class="dashboard"><aside class="side-nav">${buyerNav()}</aside><div>${pageHero(buyerTitle(kind), "Khu vực theo dõi đơn hàng, Bid, sản phẩm lưu và cài đặt người mua.", "Người mua")}${content}</div></section>`);
  });
}

function buyerNav() {
  return [["Tổng quan", "account"], ["Đơn hàng", "orders"], ["Bid của tôi", "bids"], ["Yêu thích", "wishlist"], ["Đã lưu", "saved-items"], ["Giỏ hàng", "cart"], ["Thanh toán", "checkout"], ["Khiếu nại", "complaint"]].map(([label, key]) => `<a href="${href(`pages/buyer/${key}.html`)}">${label}</a>`).join("");
}

function buyerTitle(kind) {
  return ({ account: "Tài khoản của tôi", orders: "Đơn hàng", bids: "Bid của tôi", wishlist: "Yêu thích", saved: "Đã lưu", cart: "Giỏ hàng", complaint: "Khiếu nại / Hoàn tiền" }[kind] || "Người mua");
}

function buyerOverview(user) {
  const activeBids = state.bids.filter((b) => b.userId === user.id && b.status === "active").length;
  return `<section class="section grid cols-4">${[
    ["Đơn hàng", state.orders.filter((o) => o.buyerId === user.id).length], ["Bid đang mở", activeBids], ["Đã lưu", state.wishlist.length], ["Hồ sơ", "98%"]
  ].map((m) => `<div class="card metric"><span class="eyebrow">${m[0]}</span><strong>${m[1]}</strong></div>`).join("")}</section><section class="section"><h2>Gợi ý cho bạn</h2><div class="grid cols-3" style="margin-top:20px">${approvedProducts().slice(0, 3).map(productCard).join("")}</div></section>`;
}

function ordersTable(orders) {
  if (!orders.length) return emptyState("Chưa có đơn hàng", "Khi bạn mua ngay hoặc thanh toán thành công, đơn hàng sẽ xuất hiện ở đây.", `<a class="btn" href="${href("pages/shop.html")}">Mua sắm</a>`);
  return table("Danh sách đơn hàng", ["Mã đơn", "Sản phẩm", "Tổng buyer trả", "Escrow", "Trạng thái", "Thao tác"], orders.map((o) => [o.id, o.item, money(o.total), o.escrowStatus || "Tạm giữ", o.status, `<button class="btn ghost small-btn" data-action="confirm-received" data-id="${o.id}">Đã nhận</button> <button class="btn ghost small-btn" data-action="open-complaint" data-id="${o.id}">Khiếu nại</button>`]));
}

function buyerComplaintContent(buyerId) {
  const complaints = (state.complaints || []).filter((c) => c.buyerId === buyerId);
  const orders = state.orders.filter((o) => o.buyerId === buyerId);
  return `<section class="section grid cols-2"><form class="card" data-complaint-form><h3>Tạo khiếu nại trong 72 giờ</h3><p class="muted">Dùng khi sản phẩm sai mô tả, nghi vấn xác thực hoặc cần hoàn tiền. Escrow sẽ bị đóng băng trong demo.</p><div class="form-grid"><label class="wide">Đơn hàng<select name="orderId" required>${orders.map((o) => `<option value="${o.id}">${o.id} · ${o.item}</option>`).join("")}</select></label><label class="wide">Lý do<textarea name="reason" placeholder="Mô tả vấn đề và bằng chứng bạn có." required></textarea></label></div><div class="actions"><button class="btn">Gửi khiếu nại</button></div></form><div class="card"><h3>Hồ sơ khiếu nại</h3>${complaints.length ? complaints.map((c) => `<div class="summary-row"><span>${c.orderId}</span><strong>${c.status}</strong></div><p class="muted">${c.reason}</p>`).join("") : `<p class="muted">Chưa có khiếu nại nào.</p>`}</div></section>`;
}

function bidsTable(bids) {
  if (!bids.length) return emptyState("Chưa có bid", "Vào trang chi tiết sản phẩm để đặt bid theo mức giá mong muốn.");
  return table("Bid đang theo dõi", ["Mã", "Sản phẩm", "Giá bid", "Trạng thái", "Thời gian"], bids.map((b) => [b.id, productById(b.productId).name, money(b.amount), statusLabel(b.status), b.createdAt]));
}

function wishlistContent(offset = false) {
  const products = state.wishlist.map(productById).filter(Boolean).slice(offset ? 1 : 0);
  return products.length ? `<section class="section grid cols-3">${products.map(productCard).join("")}</section>` : emptyState("Chưa lưu sản phẩm", "Hãy lưu những món bạn muốn theo dõi giá.", `<a class="btn" href="${href("pages/shop.html")}">Khám phá sàn giao dịch</a>`);
}

function cartItems() {
  return state.cart.map((item) => ({ ...item, product: productById(item.productId) })).filter((item) => item.product);
}

function totals(items = cartItems()) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = subtotal ? shippingFee() : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

function cartContent() {
  const items = cartItems();
  if (!items.length) return emptyState("Giỏ hàng đang trống", "Thêm một bài đăng đã duyệt để tiếp tục thanh toán.", `<a class="btn" href="${href("pages/shop.html")}">Mua sắm ngay</a>`);
  const sum = totals(items);
  return `<section class="section checkout"><div class="card"><h3>Sản phẩm trong giỏ</h3>${items.map((item) => `<div class="cart-line"><img src="${productImage(item.product)}" alt="${item.product.name}"><div><h3>${item.product.brand} ${item.product.name}</h3><p class="muted">${item.product.size} · ${gradeBadge(item.product.grade)}</p><label>Số lượng<input class="input qty-input" type="number" min="1" max="2" value="${item.qty}" data-action="update-qty" data-id="${item.productId}"></label></div><div><strong>${money(item.price * item.qty)}</strong><button class="btn ghost small-btn" data-action="remove-cart" data-id="${item.productId}">Xóa</button></div></div>`).join("")}</div>${orderSummary(sum, `<a class="btn full" href="${href("pages/buyer/checkout.html")}">Tiếp tục thanh toán</a>`)}</section>`;
}

function orderSummary(sum, action = "") {
  return `<aside class="card summary"><h3>Tóm tắt đơn hàng</h3><div class="summary-row"><span>Giá sản phẩm</span><span>${money(sum.subtotal)}</span></div><div class="summary-row"><span>Phí vận chuyển</span><span>${money(sum.shipping)}</span></div><div class="summary-row total"><span>Tổng thanh toán</span><span>${money(sum.total)}</span></div><p class="small muted">Buyer chỉ thanh toán giá sản phẩm và phí vận chuyển. Khoản thanh toán được tạm giữ bằng escrow mock đến khi hoàn tất nhận hàng.</p>${action ? `<div class="actions">${action}</div>` : ""}</aside>`;
}

function checkoutContent(full = false) {
  const items = cartItems();
  if (!items.length) return pageHero("Thanh toán", "Giỏ hàng đang trống, chưa thể thanh toán.", "Thanh toán") + `<div class="actions"><a class="btn" href="${href("pages/shop.html")}">Quay lại sàn giao dịch</a></div>`;
  const sum = totals(items);
  const shipping = state.shipping || {};
  return `${full ? pageHero("Thanh toán", "Buyer thanh toán vào escrow mock. Phía người mua chỉ thấy giá sản phẩm và phí vận chuyển.", "Thanh toán an toàn") : ""}
    <section class="checkout ${full ? "section" : ""}">
      <form class="card" data-checkout-form>
        <h3>Thông tin giao hàng</h3>
        <div class="form-grid" style="margin-top:18px">
          <label>Họ tên<input class="input" name="name" value="${shipping.name || currentUser()?.name || ""}" required></label>
          <label>Số điện thoại<input class="input" name="phone" value="${shipping.phone || currentUser()?.phone || ""}" required></label>
          <label class="wide">Email<input class="input" type="email" name="email" value="${shipping.email || currentUser()?.email || ""}" required></label>
          <label class="wide">Địa chỉ<input class="input" name="address" value="${shipping.address || "Quận 1, TP. Hồ Chí Minh"}" required></label>
          <label>Thành phố<select name="city"><option>TP. Hồ Chí Minh</option><option>Hà Nội</option><option>Đà Nẵng</option></select></label>
          <label>Phương thức thanh toán<select name="method"><option>Thẻ ngân hàng</option><option>Ví điện tử</option><option>Chuyển khoản</option><option>COD khi nhận hàng</option></select></label>
          <label class="wide">Mã ưu đãi<input class="input" name="promo" placeholder="ARCHIVEVIP"></label>
          <label class="wide check-row"><input type="checkbox" name="contract" required> Tôi xác nhận hợp đồng điện tử demo: tiền được tạm giữ trong escrow và người mua có 72 giờ kiểm tra sau khi nhận hàng.</label>
        </div>
        <div class="actions"><button class="btn">Xác nhận đặt hàng</button><a class="btn ghost" href="${href("pages/buyer/cart.html")}">Quay lại giỏ</a></div>
      </form>
      ${orderSummary(sum)}
    </section>`;
}

function orderConfirmation() {
  const order = state.orders.find((item) => item.id === state.lastOrderId) || state.orders[state.orders.length - 1];
  return pageHero("Đặt hàng thành công", "Đơn hàng đã được tạo trong hệ thống demo và lưu vào lịch sử của người mua.", "Xác nhận") + `<section class="section card"><h3>${order?.id || "Đơn hàng mới"}</h3><p class="muted">${order?.item || ""}</p><p>Trạng thái: <strong>${order?.status || "Đang xử lý"}</strong></p><div class="actions"><a class="btn" href="${href("pages/buyer/orders.html")}">Xem đơn hàng</a><a class="btn ghost" href="${href("pages/shop.html")}">Tiếp tục mua sắm</a></div></section>`;
}

function sellerPage(kind) {
  return requireRole("seller", (user) => {
    ensureSellerVerification(user);
    const sellerProducts = state.products.filter((p) => p.sellerId === user.id);
    const content = {
      verification: sellerVerificationPage(user),
      dashboard: sellerDashboard(sellerProducts),
      "add-listing": addListingForm(),
      listings: listingsTable(sellerProducts),
      status: listingsTable(sellerProducts, true),
      sales: sellerOrdersContent(user.id),
      orders: sellerOrdersContent(user.id),
      revenue: sellerRevenueContent(user.id),
      advertising: sellerAdvertisingContent(user.id),
      asks: sellerAsks()
    }[kind] || sellerDashboard(sellerProducts);
    shell(`<section class="dashboard"><aside class="side-nav">${sellerNav()}</aside><div>${pageHero(sellerTitle(kind), "Người bán gửi bài đăng vào hàng chờ duyệt trước khi sản phẩm hiển thị công khai.", "Người bán")}${content}</div></section>`);
  });
}

function sellerNav() {
  return [["Xác thực eKYC", "verification"], ["Tổng quan", "dashboard"], ["Tạo bài đăng", "add-listing"], ["Bài đăng của tôi", "listings"], ["Trạng thái", "status"], ["Đơn xử lý", "orders"], ["Doanh thu", "revenue"], ["Quảng cáo", "advertising"], ["Ask của tôi", "asks"]].map(([l, k]) => `<a href="${href(`pages/seller/${k}.html`)}">${l}</a>`).join("");
}

function sellerTitle(kind) {
  return ({ verification: "Xác thực người bán (eKYC)", dashboard: "Bảng điều khiển người bán", "add-listing": "Tạo bài đăng mới", listings: "Bài đăng của tôi", status: "Trạng thái bài đăng", sales: "Doanh số", orders: "Đơn xử lý", revenue: "Doanh thu & ví", advertising: "Quảng cáo / Đẩy bài", asks: "Ask của tôi" }[kind] || "Người bán");
}

function sellerVerificationBanner(user, compact = false) {
  const verify = verificationSummary(user);
  const [title, copy] = verificationFlowStatus(verify);
  const nextStep = verificationSteps(user).find((step) => step.key === verify.nextKey);
  return `<section class="section"><div class="card ${verify.complete ? "" : "card-alert"}"><div class="ekyc-summary"><div><p class="eyebrow">Xác thực người bán</p><h2>${title}</h2><p class="muted">${copy}</p></div><div class="ekyc-progress-panel"><div class="progress-copy"><strong>${verify.done}/${verify.total || 5} bước</strong><span>${verify.progress}%</span></div><div class="progress-bar"><i style="width:${verify.progress}%"></i></div>${verify.complete ? `<p class="small muted">Tài khoản đã mở khóa điều kiện nhận giải ngân.</p>` : `<p class="small muted">Bước tiếp theo: <strong>${nextStep?.title || "Hoàn tất hồ sơ"}</strong></p>`}</div></div>${compact ? "" : `<div class="actions"><a class="btn" href="${href("pages/seller/verification.html")}">${verify.complete ? "Xem hồ sơ eKYC" : "Tiếp tục xác thực"}</a></div>`}</div></section>`;
}

function sellerVerificationPage(user) {
  const verify = verificationSummary(user);
  const [title, copy] = verificationFlowStatus(verify);
  const steps = verificationSteps(user);
  return `${sellerVerificationBanner(user, true)}
  <section class="section"><div class="stepper">${steps.map((step) => `<div class="step ${step.status === "verified" ? "done" : verify.nextKey === step.key ? "current" : ""} ${isVerificationStepUnlocked(user, step.key) ? "" : "locked"}"><span>${step.index}</span><div><strong>${step.title}</strong><p>${step.status === "verified" ? "Đã hoàn tất" : verify.nextKey === step.key ? "Bước hiện tại" : "Chờ mở khóa"}</p></div></div>`).join("")}</div></section>
  <section class="section grid cols-2">${steps.map((step) => `<article class="card ekyc-step-card ${step.status === "verified" ? "is-verified" : ""}"><div class="step-head"><div><p class="eyebrow">Bước ${step.index}</p><h3>${step.title}</h3></div>${verificationStatusBadge(step.status)}</div><p class="muted">${step.description}</p><p class="small muted">${step.hint}</p><div class="actions"><button class="btn ${step.status === "verified" ? "ghost" : ""}" data-action="open-kyc" data-step="${step.key}" ${isVerificationStepUnlocked(user, step.key) ? "" : "disabled title=\"Hoàn tất bước trước để tiếp tục\""}>${step.status === "verified" ? "Xem lại" : step.action}</button></div></article>`).join("")}</section>
  <section class="section grid cols-2"><div class="card"><h3>Vì sao cần eKYC?</h3><p class="muted">Quy trình này dùng để xác minh danh tính người bán, đảm bảo tài khoản nhận tiền là chính chủ và giảm rủi ro tranh chấp khi giao dịch đồ hiệu có giá trị cao.</p><div class="checklist"><p>• Xác minh đúng chủ tài khoản seller</p><p>• Giảm rủi ro giả mạo, takeover hoặc payout sai người</p><p>• Là điều kiện để hệ thống mở khóa giải ngân sau escrow</p></div></div><div class="card"><h3>Trạng thái payout</h3><p class="muted">${copy}</p><div class="summary-row"><span>Tình trạng hồ sơ</span><strong>${title}</strong></div><div class="summary-row"><span>Điều kiện nhận thanh toán</span><strong>${verify.complete ? "Đã mở khóa" : "Tạm khóa"}</strong></div><div class="summary-row"><span>Tiến độ</span><strong>${verify.done}/${verify.total || 5}</strong></div></div></section>`;
}

function sellerDashboard(products) {
  const user = currentUser();
  ensureSellerVerification(user);
  const metrics = sellerMetrics(user.id);
  const verify = verificationSummary(user);
  return `<section class="section grid cols-4">${[
    ["Tổng bài đăng", products.length],
    ["Chờ duyệt / AI flag", products.filter((p) => p.status === "pending" || p.status === "flagged").length],
    ["Đã duyệt", products.filter((p) => p.status === "approved").length],
    ["Ví chờ rút", money(metrics.payoutPending)]
  ].map((m) => `<div class="card metric"><span class="eyebrow">${m[0]}</span><strong>${m[1]}</strong></div>`).join("")}</section>
  ${!verify.complete ? `<section class="section"><div class="card card-alert"><h3>Seller chưa đủ điều kiện nhận thanh toán</h3><p class="muted">Bạn vẫn có thể đăng bài và xử lý đơn, nhưng phần giải ngân cho seller sẽ bị tạm giữ cho đến khi hoàn tất đầy đủ eKYC.</p><div class="actions"><a class="btn" href="${href("pages/seller/verification.html")}">Hoàn tất eKYC</a></div></div></section>` : ""}
  <section class="section grid cols-2">
    <div class="card"><h3>Xác thực seller</h3><p class="muted">eKYC gồm 5 bước: OTP, CCCD hai mặt, quét khuôn mặt và liên kết tài khoản ngân hàng chính chủ.</p><div class="summary-row"><span>Tiến độ</span><strong>${verify.done}/${verify.total || 5}</strong></div><div class="progress-bar" style="margin:14px 0 18px"><i style="width:${verify.progress}%"></i></div><div class="checklist">${verify.items.map(([label, status]) => `<p>${status === "verified" ? "✓" : "○"} ${label} ${verificationStatusBadge(status)}</p>`).join("")}</div><p><strong>${verify.complete ? "Đủ điều kiện nhận thanh toán" : "Chưa đủ điều kiện nhận thanh toán"}</strong></p><div class="actions"><a class="btn ghost" href="${href("pages/seller/verification.html")}">${verify.complete ? "Xem hồ sơ eKYC" : "Tiếp tục xác thực"}</a></div></div>
    <div class="card"><h3>Tóm tắt tài chính</h3><div class="summary-row"><span>Tổng doanh số</span><strong>${money(metrics.gross)}</strong></div><div class="summary-row"><span>Phí hoa hồng seller</span><span>${moneyNegative(metrics.commission)}</span></div><div class="summary-row"><span>Chi phí quảng cáo</span><span>${moneyNegative(metrics.adCost)}</span></div><div class="summary-row"><span>Doanh thu ròng</span><strong>${money(metrics.net)}</strong></div><div class="summary-row total"><span>Số dư chờ rút</span><strong>${money(metrics.payoutPending)}</strong></div></div>
  </section>
  <section class="section"><div class="actions"><a class="btn" href="${href("pages/seller/add-listing.html")}">Tạo bài đăng mới</a><a class="btn ghost" href="${href("pages/seller/advertising.html")}">Mua gói đẩy bài</a><a class="btn ghost" href="${href("pages/seller/orders.html")}">Xử lý đơn</a></div></section>
  ${sellerAsks(true)}`;
}

function addListingForm() {
  const user = currentUser();
  ensureSellerVerification(user);
  const verify = verificationSummary(user);
  return `<section class="section grid cols-2"><form class="card" data-listing-form><h3>Thông tin sản phẩm</h3><p class="muted">Bài đăng sẽ chạy AI scan mock trước, sau đó vào hàng chờ admin duyệt thủ công. Chỉ bài đã duyệt mới public.</p><div class="form-grid" style="margin-top:18px"><label>Tên sản phẩm<input class="input" name="name" placeholder="Túi Mini Jodie" required></label><label>Thương hiệu<select name="brand">${BRANDS.map((b) => `<option>${b}</option>`).join("")}</select></label><label>Loại sản phẩm<select name="category"><option>Túi xách</option><option>Quần áo</option><option>Giày</option><option>Phụ kiện</option></select></label><label>Hình thức giá<select name="pricingMode"><option value="fixed_bid_ask">Giá cố định + Bid/Ask</option><option value="fixed">Chỉ giá niêm yết</option><option value="bid_ask">Chỉ Bid/Ask</option></select></label><label>Size theo nhãn<input class="input" name="size" placeholder="Một cỡ / EU 42 / M" required></label><label>Thông số thực tế<input class="input" name="measurements" placeholder="24 x 14 x 7 cm / vai 42 cm" required></label><label>Màu sắc<input class="input" name="color" placeholder="Đen" required></label><label>Chất liệu<input class="input" name="material" placeholder="Da bê" required></label><label>Hạng đề xuất<select name="grade"><option>S</option><option>A</option><option>B</option><option>C</option></select></label><label>Giá niêm yết / Buy Now<input class="input" name="buyNow" placeholder="45000000" required></label><label>Giá Ask<input class="input" name="lowestAsk" placeholder="43800000" required></label><label class="wide">Phụ kiện / tag / hóa đơn / mã code<input class="input" name="includedItems" placeholder="Túi bụi, hộp, tag, hóa đơn scan đã che thông tin"></label><label class="wide">Mô tả tình trạng<textarea name="condition" placeholder="Mô tả dấu hiệu sử dụng, form dáng, vệ sinh, nguồn gốc và độ minh bạch." required></textarea></label><label class="wide">Lỗi thực tế nếu có<textarea name="flaws" placeholder="Nêu rõ lỗi, vị trí, mức độ ảnh hưởng. Nếu không có, ghi: Không ghi nhận lỗi đáng kể."></textarea></label></div>
    <h3 style="margin-top:28px">Bộ ảnh bắt buộc</h3><p class="muted">Cấu trúc ảnh giúp admin kiểm tra logo/tag/serial, độ rõ, lỗi thực tế và phát hiện ảnh lấy từ Internet ở phần ảnh thực tế.</p><div class="form-grid"><label>Ảnh mẫu nguyên bản / tham chiếu<input class="input" name="photoReference" type="file" accept="image/*" required></label><label>Ảnh tổng thể<input class="input" name="photoOverview" type="file" accept="image/*" required></label><label>Ảnh chi tiết<input class="input" name="photoDetail" type="file" accept="image/*" required></label><label>Ảnh nhãn mác / serial<input class="input" name="photoLabel" type="file" accept="image/*" required></label><label>Ảnh cận chất liệu<input class="input" name="photoMaterial" type="file" accept="image/*" required></label><label>Ảnh lỗi thực tế nếu có<input class="input" name="photoFlaw" type="file" accept="image/*"></label></div>
    <div class="actions"><button class="btn">Gửi kiểm duyệt</button><button type="button" class="btn ghost" data-action="save-draft">Lưu nháp</button></div></form><aside><div class="card compact ${verify.complete ? "" : "card-alert"}"><h3>eKYC seller</h3><p class="muted">${verify.complete ? "Tài khoản đã đủ điều kiện nhận thanh toán." : "Bạn vẫn có thể gửi bài, nhưng giải ngân cho seller sẽ bị tạm giữ cho đến khi hoàn tất eKYC."}</p><div class="summary-row"><span>Tiến độ</span><strong>${verify.done}/${verify.total || 5}</strong></div><div class="progress-bar" style="margin:14px 0 18px"><i style="width:${verify.progress}%"></i></div>${verify.items.map(([label, status]) => `<p class="small">${status === "verified" ? "✓" : "○"} ${label}</p>`).join("")}<div class="actions"><a class="btn ghost" href="${href("pages/seller/verification.html")}">${verify.complete ? "Xem hồ sơ eKYC" : "Hoàn tất eKYC"}</a></div></div><div id="listing-preview" class="card compact" style="margin-top:16px"><h3>Xem trước bộ ảnh</h3><p class="muted">Ảnh tham chiếu chính thức sẽ là ảnh lớn. Các ảnh tổng thể, chi tiết, nhãn mác và chất liệu sẽ hiển thị dưới dạng thumbnail sau khi sản phẩm được tạo.</p></div><div class="card compact" style="margin-top:16px"><h3>Hướng dẫn phân hạng</h3>${Object.entries(GRADE_GUIDE).map(([g, c]) => `<p>${gradeBadge(g)} <span class="muted">${c}</span></p>`).join("")}</div></aside></section>`;
}

function listingsTable(products) {
  if (!products.length) return emptyState("Chưa có bài đăng", "Tạo bài đăng đầu tiên để gửi quản trị viên duyệt.", `<a class="btn" href="${href("pages/seller/add-listing.html")}">Tạo bài đăng</a>`);
  return table("Danh sách bài đăng", ["Sản phẩm", "Thương hiệu", "AI scan", "Trạng thái", "Hạng", "Ask thấp nhất"], products.map((p) => [p.name, p.brand, aiReviewBadge(p.aiReview), statusLabel(p.status), `Hạng ${p.grade}`, money(p.lowestAsk)]));
}

function sellerAsks(compact = false) {
  const asks = state.asks.filter((a) => a.sellerId === currentUser().id);
  if (!asks.length) return emptyState("Chưa có Ask", "Người bán có thể đặt Ask từ trang chi tiết sản phẩm hoặc khi tạo bài đăng.");
  const rows = asks.map((a) => {
    const p = productById(a.productId);
    const canTrade = a.status === "active" && p.status === "approved";
    const holdLocked = (p.sellerStrategy || "Hold") === "Hold";
    return [a.id, p.name, money(p.highestBid), money(a.amount), p.sellerStrategy || "Hold", statusLabel(a.status), `<div class="inline-actions"><button class="btn ghost small-btn" data-action="hold-ask" data-id="${p.id}" ${holdLocked ? "disabled title=\"Đang ở chiến lược Hold\"" : ""}>Hold</button> <button class="btn small-btn" data-trade="sell-now" data-id="${p.id}" ${canTrade ? "" : "disabled title=\"Chỉ Sell Now khi Ask đang mở và listing đã duyệt\""}>Sell Now</button></div>`];
  });
  return table(compact ? "Bid/Ask cần theo dõi" : "Ask đang mở", ["Mã", "Sản phẩm", "Highest Bid", "Ask hiện tại", "Chiến lược", "Trạng thái", "Thao tác"], rows);
}

function sellerOrdersContent(sellerId) {
  const { orders } = sellerMetrics(sellerId);
  if (!orders.length) return emptyState("Chưa có đơn bán", "Khi Bid/Ask khớp hoặc buyer mua ngay, đơn xử lý của seller sẽ xuất hiện tại đây.");
  return table("Đơn xử lý / Fulfillment", ["Mã đơn", "Sản phẩm", "Người mua", "Thời gian mua", "Giá bán", "Escrow", "Xử lý", "Thao tác"], orders.map((o) => [
    o.id,
    o.item,
    o.buyer || "Buyer",
    fullTime(o.purchasedAt || o.date),
    money(o.subtotal || o.total),
    o.escrowStatus || "Tạm giữ",
    o.fulfillmentStatus || o.status,
    `${fulfillmentButtons(o)}<button class="btn ghost small-btn" data-action="print-order-report" data-id="${o.id}">In đơn</button>`
  ]));
}

function fulfillmentButtons(order) {
  const step = fulfillmentStep(order);
  const disabled = (locked, label) => (locked ? `disabled title="${label}"` : "");
  return `<div class="inline-actions">
    <button class="btn ghost small-btn" data-action="confirm-order" data-id="${order.id}" ${disabled(step !== 0, "Bước này đã khóa theo tiến trình một chiều")}>Xác nhận</button>
    <button class="btn ghost small-btn" data-action="pack-order" data-id="${order.id}" ${disabled(step !== 1, "Chỉ đóng gói sau khi đã xác nhận đơn")}>Đóng gói</button>
    <button class="btn small-btn" data-action="ship-order" data-id="${order.id}" ${disabled(step !== 2, "Chỉ giao vận sau khi đã đóng gói")}>Giao vận</button>
  </div>`;
}

function sellerRevenueContent(sellerId) {
  const metrics = sellerMetrics(sellerId);
  const verify = verificationSummary(currentUser());
  const withdrawalRows = state.withdrawals.filter((w) => w.sellerId === sellerId).map((w) => [w.id, money(w.amount), w.bank, w.status, w.date]);
  return `${!verify.complete ? `<section class="section"><div class="card card-alert"><h3>Giải ngân đang tạm khóa</h3><p class="muted">Seller đã phát sinh doanh số nhưng chưa hoàn tất eKYC. Hoàn tất xác thực để đủ điều kiện nhận thanh toán về tài khoản chính chủ.</p><div class="actions"><a class="btn" href="${href("pages/seller/verification.html")}">Hoàn tất eKYC</a></div></div></section>` : ""}
  <section class="section grid cols-4">${[
    ["Tổng doanh số", money(metrics.gross)],
    ["Phí hoa hồng", moneyNegative(metrics.commission)],
    ["Doanh thu ròng", money(metrics.net)],
    ["Số dư chờ rút", money(metrics.payoutPending)]
  ].map((m) => `<div class="card metric"><span class="eyebrow">${m[0]}</span><strong>${m[1]}</strong></div>`).join("")}</section>
  ${table("Lịch sử đơn bán", ["Mã đơn", "Sản phẩm", "Người mua", "Thời gian mua", "Giá bán", "Hoa hồng", "Thực nhận", "Trạng thái", "Báo cáo"], metrics.orders.map((o) => [o.id, o.item, o.buyer || "Buyer", fullTime(o.purchasedAt || o.date), money(o.subtotal || o.total), moneyNegative(o.commissionFee || commissionFee(o.subtotal || o.total)), money(o.sellerNet || sellerNet(o.subtotal || o.total)), o.status || o.escrowStatus || "Tạm giữ", `<button class="btn ghost small-btn" data-action="print-order-report" data-id="${o.id}">In đơn</button>`]))}
  ${withdrawalRows.length ? table("Lịch sử rút tiền", ["Mã", "Số tiền", "Tài khoản", "Trạng thái", "Ngày"], withdrawalRows) : emptyState("Chưa có lệnh rút", "Khi escrow giải ngân, số dư chờ rút sẽ xuất hiện trong ví người bán.")}`;
}

function sellerAdvertisingContent(sellerId) {
  const promos = state.promotions.filter((p) => p.sellerId === sellerId);
  const packages = Object.entries(promotionPackages()).map(([id, value]) => [id, ...value]);
  const metrics = sellerMetrics(sellerId);
  return `<section class="section grid cols-4">${packages.map(([id, name, model, cost]) => `<div class="card"><p class="eyebrow">${model}</p><h3>${name}</h3><p class="muted">Ưu tiên hiển thị cho listing đã duyệt, phù hợp seller muốn tăng tốc thanh khoản.</p><strong>${money(cost)}</strong><div class="actions"><button class="btn small-btn" data-action="buy-promo" data-id="${id}">Mua gói</button></div></div>`).join("")}</section>
  <section class="section"><div class="card"><h3>Số dư khả dụng cho quảng cáo</h3><p class="muted">Chi phí quảng cáo sẽ trừ trực tiếp vào số dư chờ rút của seller trong demo.</p><div class="summary-row total"><span>Số dư chờ rút</span><strong>${money(metrics.payoutPending)}</strong></div></div></section>
  ${promos.length ? table("Hiệu quả quảng cáo", ["Gói", "Mô hình phí", "Chi phí", "Hiển thị", "Click", "Đơn phát sinh", "Trạng thái"], promos.map((p) => [p.name, p.model, moneyNegative(p.cost), p.impressions, p.clicks, p.orders, p.status])) : emptyState("Chưa chạy quảng cáo", "Chọn một gói để mô phỏng ưu tiên hiển thị trong demo.")}`;
}

function adminOrdersContent() {
  if (!state.orders.length) return emptyState("Chưa có đơn hàng", "Đơn escrow sẽ xuất hiện tại đây khi buyer thanh toán.");
  return table("Quản lý đơn hàng / Escrow", ["Mã đơn", "Buyer", "Sản phẩm", "Tổng buyer trả", "Escrow", "Fulfillment"], state.orders.map((o) => [o.id, o.buyer, o.item, money(o.total), o.escrowStatus || "Tạm giữ", o.fulfillmentStatus || o.status]));
}

function adminDisputesContent() {
  const complaints = state.complaints || [];
  if (!complaints.length) return emptyState("Chưa có khiếu nại", "Khi buyer khiếu nại trong 72 giờ, hồ sơ dispute sẽ xuất hiện tại đây.");
  return table("Khiếu nại / Tranh chấp", ["Mã", "Đơn hàng", "Lý do", "Bằng chứng", "Trạng thái", "Ngày"], complaints.map((c) => [c.id, c.orderId, c.reason, c.evidence, c.status, c.date]));
}

function adminPage(kind) {
  return requireRole("admin", () => {
    const pending = state.products.filter((p) => p.status === "pending" || p.status === "revision" || p.status === "flagged" || p.aiReview?.status === "Auto-Reject");
    const content = {
      dashboard: adminDashboard(),
      pending: pendingListings(pending),
      moderation: moderationDetail(),
      users: table("Quản lý người dùng", ["Tên", "Email", "Vai trò", "Trạng thái người bán", "Trạng thái"], state.users.map((u) => [u.name, u.email, roleLabel(u.role), u.sellerStatus || "Không áp dụng", "Đang hoạt động"])),
      orders: adminOrdersContent(),
      disputes: adminDisputesContent(),
      markets: table("Theo dõi Bid/Ask", ["Sản phẩm", "Bid cao nhất", "Ask thấp nhất", "Trạng thái", "Hoạt động"], state.products.map((p) => [p.name, money(p.highestBid), money(p.lowestAsk), statusLabel(p.status), `${state.bids.filter((b) => b.productId === p.id).length} bid / ${state.asks.filter((a) => a.productId === p.id).length} ask`]))
    }[kind] || adminDashboard();
    shell(`<section class="dashboard"><aside class="side-nav">${adminNav()}</aside><div>${pageHero(adminTitle(kind), "Trung tâm điều phối bài đăng, người dùng, đơn hàng và Bid/Ask.", "Quản trị")}${content}</div></section>`);
  });
}

function adminNav() {
  return [["Tổng quan", "dashboard"], ["Chờ duyệt", "pending"], ["Kiểm duyệt", "moderation"], ["Người dùng", "users"], ["Đơn hàng", "orders"], ["Khiếu nại", "disputes"], ["Bid/Ask", "markets"]].map(([l, k]) => `<a href="${href(`pages/admin/${k}.html`)}">${l}</a>`).join("");
}

function adminTitle(kind) {
  return ({ dashboard: "Bảng điều khiển quản trị", pending: "Bài đăng chờ duyệt", moderation: "Chi tiết kiểm duyệt", users: "Quản lý người dùng", orders: "Quản lý đơn hàng", disputes: "Khiếu nại / Tranh chấp", markets: "Theo dõi Bid/Ask" }[kind] || "Quản trị");
}

function adminDashboard() {
  return `<section class="section grid cols-4">${[
    ["Chờ duyệt", state.products.filter((p) => p.status === "pending").length],
    ["AI gắn cờ", state.products.filter((p) => p.status === "flagged" || p.aiReview?.status === "Flagged").length],
    ["Đơn escrow", state.orders.filter((o) => o.escrowStatus === "Tạm giữ").length],
    ["Khiếu nại", (state.complaints || []).length]
  ].map((m) => `<div class="card metric"><span class="eyebrow">${m[0]}</span><strong>${m[1]}</strong></div>`).join("")}</section><section class="section grid cols-3">${[
    ["Người dùng", state.users.length], ["Người bán", state.users.filter((u) => u.role === "seller").length], ["Auto-Reject", state.products.filter((p) => p.aiReview?.status === "Auto-Reject").length]
  ].map((m) => `<div class="card metric"><span class="eyebrow">${m[0]}</span><strong>${m[1]}</strong></div>`).join("")}</section>`;
}

function pendingListings(products) {
  if (!products.length) return emptyState("Không có bài chờ duyệt", "Khi người bán gửi bài đăng mới, bài sẽ xuất hiện ở đây.", `<a class="btn" href="${href("pages/shop.html")}">Xem sàn giao dịch</a>`);
  return table("Hàng chờ kiểm duyệt", ["Sản phẩm", "Người bán", "AI scan", "Trạng thái", "Hạng đề xuất", "Thao tác"], products.map((p) => [p.name, userById(p.sellerId)?.name || "Người bán", aiReviewBadge(p.aiReview), statusLabel(p.status), `Hạng ${p.grade}`, `<a class="btn ghost small-btn" href="${href(`pages/admin/moderation.html?id=${p.id}`)}">Mở duyệt</a>`]));
}

function moderationDetail() {
  const params = new URLSearchParams(window.location.search);
  const p = productById(params.get("id")) || state.products.find((item) => item.status === "pending") || state.products[0];
  return `<section class="section grid cols-2"><div>${galleryLayout(p, true)}<div class="card compact" style="margin-top:14px"><h3>AI scan mock</h3><p>${aiReviewBadge(p.aiReview)}</p>${(p.aiReview?.notes || []).map((note) => `<p class="small muted">• ${note}</p>`).join("")}</div></div><form class="card" data-moderation-form data-id="${p.id}"><h3>${p.name}</h3><p class="muted">Người bán: ${userById(p.sellerId)?.name || "Người bán"} · ${p.brand} · ${p.category}</p><p>${p.condition}</p><p class="muted">Phụ kiện: ${p.includedItems || "Chưa khai báo"} · Lỗi: ${p.flaws || "Không ghi nhận"}</p><div class="checklist">${["Ảnh rõ và đủ góc chụp", "Logo / tag / serial đủ rõ", "Hao mòn được mô tả minh bạch", "Form dáng và vệ sinh đạt chuẩn", "Nguồn gốc / phụ kiện không gây hiểu nhầm"].map((item) => `<label class="check-row"><input type="checkbox" checked> ${item}</label>`).join("")}</div><div class="form-grid"><label>Hạng người bán đề xuất<select disabled><option>${p.grade}</option></select></label><label>Hạng quản trị chốt<select name="grade"><option ${p.grade === "S" ? "selected" : ""}>S</option><option ${p.grade === "A" ? "selected" : ""}>A</option><option ${p.grade === "B" ? "selected" : ""}>B</option><option ${p.grade === "C" ? "selected" : ""}>C</option></select></label><label>Trạng thái hiện tại<input class="input" value="${statusLabel(p.status)}" disabled></label><label>Nhãn xác thực<select name="verified"><option>Đã xác thực</option><option>Gắn cờ cần kiểm tra</option></select></label><label class="wide">Ghi chú cho người bán<textarea name="note">Vui lòng bổ sung ảnh cận cảnh nếu cần. Bài đăng chỉ hiển thị công khai sau khi duyệt.</textarea></label></div><div class="actions"><button class="btn" data-moderate="approved">Duyệt bài</button><button class="btn ghost" data-moderate="revision">Yêu cầu chỉnh sửa</button><button class="btn danger" data-moderate="rejected">Từ chối</button></div></form></section>`;
}

function table(title, headers, rows) {
  return `<section class="section report-section"><h2>${title}</h2><div class="table-wrap"><table class="table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function tradeModal() {
  return `<div class="modal" id="trade-modal" aria-hidden="true"><div class="modal-card"><div class="modal-head"><div><p class="eyebrow" id="modal-kicker">Thị trường</p><h3 id="modal-title">Đặt Bid</h3></div><button class="close" data-close-modal aria-label="Đóng">×</button></div><p class="muted" id="modal-copy">Nhập mức giá để tiếp tục.</p><form data-trade-form><input type="hidden" name="type"><input type="hidden" name="productId"><div class="form-grid"><label class="wide">Mức giá<input class="input" name="amount" inputmode="numeric" required></label><label>Hiệu lực<select name="duration"><option>30 ngày</option><option>14 ngày</option><option>7 ngày</option></select></label><label>Thanh toán / nhận tiền<select name="method"><option>Thẻ ngân hàng</option><option>Ví điện tử</option><option>Chuyển khoản</option></select></label></div><div class="card compact" style="margin-top:18px" id="trade-summary"></div><div class="form-error" id="trade-error"></div><div class="actions"><button class="btn" id="trade-submit">Xác nhận</button><button class="btn ghost" type="button" data-close-modal>Hủy</button></div></form></div></div>`;
}

function promoModal() {
  return `<div class="modal" id="promo-modal" aria-hidden="true"><div class="modal-card"><div class="modal-head"><div><p class="eyebrow">Quảng cáo / Đẩy bài</p><h3 id="promo-title">Xác nhận mua gói</h3></div><button class="close" data-close-promo aria-label="Đóng">×</button></div><p class="muted" id="promo-copy">Chi phí sẽ được trừ vào số dư chờ rút của seller.</p><div class="card compact" id="promo-summary"></div><div class="form-error" id="promo-error"></div><div class="actions"><button class="btn" data-confirm-promo>Xác nhận mua</button><button class="btn ghost" type="button" data-close-promo>Hủy</button></div></div></div>`;
}

function verificationModal() {
  return `<div class="modal" id="kyc-modal" aria-hidden="true"><div class="modal-card"><div class="modal-head"><div><p class="eyebrow" id="kyc-kicker">eKYC</p><h3 id="kyc-title">Xác thực người bán</h3></div><button class="close" data-close-kyc aria-label="Đóng">×</button></div><p class="muted" id="kyc-copy">Hoàn tất từng bước để mở khóa điều kiện nhận giải ngân.</p><form data-kyc-form><input type="hidden" name="step"><div id="kyc-fields"></div><div class="card compact" style="margin-top:18px" id="kyc-summary"></div><div class="form-error" id="kyc-error"></div><div class="actions"><button class="btn" id="kyc-submit">Xác nhận</button><button class="btn ghost" type="button" data-close-kyc>Hủy</button></div></form></div></div>`;
}

function bindGlobal() {
  qsa("[data-trade]").forEach((button) => button.addEventListener("click", () => openTradeModal(button.dataset.trade, button.dataset.id)));
  qsa("[data-close-modal]").forEach((button) => button.addEventListener("click", closeTradeModal));
  qsa("[data-close-promo]").forEach((button) => button.addEventListener("click", closePromoModal));
  qsa("[data-close-kyc]").forEach((button) => button.addEventListener("click", closeKycModal));
  qsa("[data-confirm-promo]").forEach((button) => button.addEventListener("click", confirmPromotion));
  qsa("[data-gallery-thumb]").forEach((button) => button.addEventListener("click", handleGalleryThumb));
  qsa("[data-gallery-main-frame]").forEach((frame) => frame.addEventListener("click", toggleGalleryZoom));
  qsa("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
  qs("[data-search-form]")?.addEventListener("submit", handleHeaderSearch);
  qs("[data-filter-form]")?.addEventListener("submit", handleFilter);
  qs("[data-auth-form]")?.addEventListener("submit", handleAuth);
  qs("[data-checkout-form]")?.addEventListener("submit", handleCheckout);
  qs("[data-listing-form]")?.addEventListener("submit", handleListingSubmit);
  qs("[data-moderation-form]")?.addEventListener("submit", handleModeration);
  qs("[data-complaint-form]")?.addEventListener("submit", handleComplaintSubmit);
  qs("[data-trade-form]")?.addEventListener("submit", handleTradeSubmit);
  qs("[data-kyc-form]")?.addEventListener("submit", handleKycSubmit);
  qs("[data-newsletter]")?.addEventListener("submit", (event) => { event.preventDefault(); toast("Đã đăng ký bản tin ARCHIVE."); event.currentTarget.reset(); });
  qsa("[data-demo-login]").forEach((button) => button.addEventListener("click", () => loginDemo(button.dataset.demoLogin)));
  qsa("[data-action='update-qty']").forEach((input) => input.addEventListener("change", updateQty));
}

function handleGalleryThumb(event) {
  const button = event.currentTarget;
  const root = button.closest(".product-gallery-ui");
  const main = qs("[data-gallery-main-img]", root);
  if (!main) return;
  main.src = button.dataset.src;
  main.alt = button.dataset.label || main.alt;
  qsa("[data-gallery-thumb]", root).forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  qs("[data-gallery-main-frame]", root)?.classList.remove("zoomed");
}

function toggleGalleryZoom(event) {
  const frame = event.currentTarget;
  if (event.target.closest("[data-gallery-thumb]")) return;
  frame.classList.toggle("zoomed");
}

function handleHeaderSearch(event) {
  event.preventDefault();
  const q = new FormData(event.currentTarget).get("q");
  window.location.href = href(`pages/shop.html?q=${encodeURIComponent(q || "")}`);
}

function handleFilter(event) {
  event.preventDefault();
  const params = new URLSearchParams();
  new FormData(event.currentTarget).forEach((value, key) => { if (value) params.set(key, value); });
  window.location.href = `${href("pages/shop.html")}?${params.toString()}`;
}

function handleAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === "open-kyc") return openKycModal(target.dataset.step);
  if (action === "send-otp") return sendOtpRequest();
  if (action === "run-face-scan") return runFaceScanMock();
  if (action === "add-cart") return addToCart(id);
  if (action === "buy-now") return buyNow(id);
  if (action === "toggle-wishlist") return toggleWishlist(id);
  if (action === "remove-cart") return removeCart(id);
  if (action === "logout") return logout();
  if (action === "reset-demo") return resetDemo();
  if (action === "save-draft") return toast("Đã lưu nháp demo. Bấm gửi quản trị viên duyệt để tạo bài đăng trong demo.");
  if (action === "chat-seller") return toast("Đã mở kênh chat mock với seller. Tin nhắn sẽ được lưu trong bản backend thật.");
  if (action === "hold-ask") return holdAsk(id);
  if (action === "confirm-order" || action === "pack-order" || action === "ship-order") return sellerFulfillment(action, id);
  if (action === "confirm-received") return confirmReceived(id);
  if (action === "open-complaint") return openComplaint(id);
  if (action === "buy-promo") return openPromoModal(id);
  if (action === "print-seller-report") return printSellerReport();
  if (action === "print-order-report") return printOrderReport(id);
}

function kycStepConfig(step, user) {
  const steps = Object.fromEntries(verificationSteps(user).map((item) => [item.key, item]));
  return steps[step];
}

function kycStepFields(step, user) {
  const meta = user?.verificationMeta || {};
  if (step === "phoneOtp") return `<div class="form-grid"><label class="wide">Số điện thoại nhận OTP<input class="input" name="phone" value="${meta.phone || user?.phone || ""}" placeholder="090 000 0002" required></label><label class="wide">Mã OTP<input class="input" name="otp" inputmode="numeric" placeholder="Nhập mã OTP vừa nhận qua SMS" required></label></div><div class="actions" style="margin-top:14px"><button class="btn ghost" type="button" data-action="send-otp">Gửi mã OTP</button></div><p class="small muted">Hệ thống dùng Twilio Verify để gửi OTP SMS thật tới số điện thoại của bạn. Mỗi lần gửi lại cần chờ cooldown trước khi bấm lại.</p>`;
  if (step === "idFront") return `<div class="form-grid"><label class="wide">Tải CCCD mặt trước<input class="input" name="document" type="file" accept="image/*" required></label><label class="wide">Số CCCD<input class="input" name="idNumber" value="${meta.idNumber || ""}" placeholder="012345678901" required></label></div><p class="small muted">Ảnh cần rõ 4 góc, không lóa, hiển thị trọn vẹn thông tin chính.</p>`;
  if (step === "idBack") return `<div class="form-grid"><label class="wide">Tải CCCD mặt sau<input class="input" name="document" type="file" accept="image/*" required></label><label class="wide">Ngày cấp / nơi cấp (mock)<input class="input" name="issuedInfo" value="${meta.issuedInfo || ""}" placeholder="Bộ Công an" required></label></div><p class="small muted">Mặt sau dùng để hoàn tất đối chiếu hồ sơ seller và bổ sung dữ liệu eKYC.</p>`;
  if (step === "faceScan") return `<div class="card compact"><h3>Hướng dẫn quét khuôn mặt</h3><div class="checklist"><p>• Giữ khuôn mặt ở giữa khung hình</p><p>• Ánh sáng rõ, không đội nón/đeo kính tối màu</p><p>• Nhìn thẳng vào camera và xác nhận khi quét xong</p></div></div><div class="actions" style="margin-top:14px"><button class="btn ghost" type="button" data-action="run-face-scan">Bắt đầu quét</button></div><p class="small muted" id="face-scan-state">${meta.faceScanAt ? `Đã quét lúc ${meta.faceScanAt}` : "Chưa bắt đầu quét khuôn mặt."}</p>`;
  if (step === "bankAccount") return `<div class="form-grid"><label>Ngân hàng<select name="bankName"><option>Vietcombank</option><option>Techcombank</option><option>ACB</option><option>MB Bank</option></select></label><label>Số tài khoản<input class="input" name="accountNumber" inputmode="numeric" value="${meta.accountNumber || ""}" placeholder="0123456789" required></label><label class="wide">Tên chủ tài khoản<input class="input" name="accountHolder" value="${meta.accountHolder || user?.name || ""}" placeholder="MAISON ARCHIVE SAIGON" required></label></div><p class="small muted">Tên chủ tài khoản cần trùng với danh tính seller để đủ điều kiện nhận giải ngân.</p>`;
  return `<p class="muted">Không tìm thấy bước eKYC.</p>`;
}

function normalizeVietnamPhone(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+${digits}`;
}

function isValidVietnamPhone(phone) {
  return /^\+84\d{9,10}$/.test(phone);
}

function setOtpCooldown(seconds, phone = "") {
  const modal = qs("#kyc-modal");
  const button = qs('[data-action="send-otp"]', modal);
  if (!button) return;
  if (otpCooldownTimer) clearInterval(otpCooldownTimer);
  const until = Date.now() + (Math.max(0, Number(seconds || 0)) * 1000);
  modal.dataset.cooldownUntil = String(until);
  const user = currentUser();
  if (user && user.role === "seller") {
    user.verificationMeta = user.verificationMeta || {};
    user.verificationMeta.otpCooldownUntil = until;
    if (phone) user.verificationMeta.phone = phone;
    saveState();
  }
  const tick = () => {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    button.disabled = left > 0;
    button.textContent = left > 0 ? `Gửi lại sau ${left}s` : "Gửi mã OTP";
    if (left <= 0 && otpCooldownTimer) {
      clearInterval(otpCooldownTimer);
      otpCooldownTimer = null;
    }
  };
  tick();
  if (seconds > 0) otpCooldownTimer = setInterval(tick, 1000);
}

function openKycModal(step) {
  const user = currentUser();
  if (!user || user.role !== "seller") return toast("Chỉ tài khoản người bán mới thao tác eKYC.", "error");
  ensureSellerVerification(user);
  if (!isVerificationStepUnlocked(user, step)) return toast("Hoàn tất bước trước để mở khóa bước này.", "error");
  const config = kycStepConfig(step, user);
  if (!config) return toast("Không tìm thấy bước eKYC.", "error");
  const modal = qs("#kyc-modal");
  modal.dataset.step = step;
  modal.dataset.otpSent = user?.verificationMeta?.otpRequestId && step === "phoneOtp" && user?.verification?.phoneOtp !== "verified" ? "true" : "false";
  modal.dataset.requestId = step === "phoneOtp" ? (user?.verificationMeta?.otpRequestId || "") : "";
  modal.dataset.faceScanned = user.verification?.[step] === "verified" ? "true" : "false";
  qs("#kyc-kicker").textContent = `Bước ${config.index}/5`;
  qs("#kyc-title").textContent = config.title;
  qs("#kyc-copy").textContent = config.description;
  qs("#kyc-fields").innerHTML = kycStepFields(step, user);
  qsa("[data-action]", qs("#kyc-fields")).forEach((button) => button.addEventListener("click", handleAction));
  qs("[data-kyc-form]").elements.step.value = step;
  qs("#kyc-summary").innerHTML = `<div class="summary-row"><span>Trạng thái hiện tại</span><strong>${config.status === "verified" ? "Đã xác thực" : "Chưa hoàn tất"}</strong></div><div class="summary-row"><span>Mục đích</span><span>Xác minh danh tính, an toàn giao dịch và điều kiện nhận giải ngân</span></div>`;
  qs("#kyc-error").textContent = "";
  modal.classList.add("open");
  if (step === "phoneOtp") {
    const cooldownUntil = Number(user?.verificationMeta?.otpCooldownUntil || 0);
    const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    setOtpCooldown(remaining);
  }
}

function closeKycModal() {
  if (otpCooldownTimer) {
    clearInterval(otpCooldownTimer);
    otpCooldownTimer = null;
  }
  qs("#kyc-modal")?.classList.remove("open");
}

async function apiPost(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({ ok: false, message: "Phản hồi máy chủ không hợp lệ." }));
  if (!response.ok || !result.ok) {
    const error = new Error(result.message || "Yêu cầu thất bại.");
    if (result.retryAfterSeconds) error.retryAfterSeconds = result.retryAfterSeconds;
    throw error;
  }
  return result;
}

async function sendOtpRequest() {
  const modal = qs("#kyc-modal");
  const button = qs('[data-action="send-otp"]', modal);
  modal.dataset.otpSent = "false";
  const phoneInput = qs('[name="phone"]', modal);
  const phone = normalizeVietnamPhone(String(phoneInput?.value || "").trim());
  if (!phone) {
    qs("#kyc-error").textContent = "Vui lòng nhập số điện thoại trước khi gửi OTP.";
    return;
  }
  if (!isValidVietnamPhone(phone)) {
    qs("#kyc-error").textContent = "Số điện thoại chưa đúng định dạng Việt Nam. Ví dụ: 0901234567.";
    return;
  }
  setLoading(button, "Đang gửi OTP...");
  try {
    const result = await apiPost("/api/otp/send", { phone, purpose: "seller-ekyc" });
    modal.dataset.otpSent = "true";
    modal.dataset.requestId = result.requestId;
    if (currentUser()) {
      currentUser().phone = phone;
      currentUser().verificationMeta = currentUser().verificationMeta || {};
      currentUser().verificationMeta.phone = phone;
      currentUser().verificationMeta.otpRequestId = result.requestId;
      saveState();
    }
    qs("#kyc-summary").innerHTML = `<div class="summary-row"><span>Trạng thái OTP</span><strong>Đã gửi thành công</strong></div><div class="summary-row"><span>Số điện thoại</span><span>${result.phone}</span></div><div class="summary-row"><span>Kênh</span><span>SMS qua Twilio Verify</span></div>`;
    qs("#kyc-error").textContent = "";
    toast("Đã gửi OTP tới số điện thoại thật.");
    setOtpCooldown(result.retryAfterSeconds || 60, phone);
  } catch (error) {
    modal.dataset.otpSent = "false";
    modal.dataset.requestId = "";
    const retryAfterSeconds = Number(error?.retryAfterSeconds || ((/(\d+)s/.exec(error.message || "") || [])[1] || 0));
    if (retryAfterSeconds > 0) setOtpCooldown(retryAfterSeconds, phone);
    qs("#kyc-error").textContent = error.message || "Không gửi được OTP.";
  } finally {
    if (!button.disabled) clearLoading(button);
  }
}

function runFaceScanMock() {
  const modal = qs("#kyc-modal");
  modal.dataset.faceScanned = "true";
  const stamp = nowLabel();
  qs("#face-scan-state") && (qs("#face-scan-state").textContent = `Đã quét khuôn mặt thành công lúc ${stamp}.`);
  qs("#kyc-summary").innerHTML = `<div class="summary-row"><span>Quét khuôn mặt</span><strong>Hoàn tất</strong></div><div class="summary-row"><span>Thời điểm</span><span>${stamp}</span></div>`;
  qs("#kyc-error").textContent = "";
  toast("Đã hoàn tất quét khuôn mặt mock.");
}

async function handleKycSubmit(event) {
  event.preventDefault();
  const user = currentUser();
  if (!user || user.role !== "seller") return toast("Chỉ seller mới thao tác eKYC.", "error");
  ensureSellerVerification(user);
  const form = event.currentTarget;
  const step = form.elements.step.value;
  const data = new FormData(form);
  const error = qs("#kyc-error");
  const verification = user.verification;
  const meta = user.verificationMeta || {};
  error.textContent = "";
  setLoading(event.submitter, "Đang xác nhận...");
  if (step === "phoneOtp") {
    try {
      if (qs("#kyc-modal").dataset.otpSent !== "true") throw new Error("Vui lòng gửi OTP trước khi xác nhận.");
      const phone = normalizeVietnamPhone(String(data.get("phone") || user.phone || "").trim());
      if (!isValidVietnamPhone(phone)) throw new Error("Số điện thoại chưa đúng định dạng Việt Nam.");
      const otp = String(data.get("otp") || "").trim();
      const requestId = qs("#kyc-modal").dataset.requestId || meta.otpRequestId || "";
      const result = await apiPost("/api/otp/verify", { phone, code: otp, requestId });
      user.phone = result.phone || phone;
      meta.phone = user.phone;
      meta.phoneVerifiedAt = fullTime(result.verifiedAt);
      meta.otpRequestId = "";
      meta.otpCooldownUntil = 0;
      user.phoneVerified = true;
      verification.phoneOtp = "verified";
    } catch (submitError) {
      clearLoading(event.submitter);
      return (error.textContent = submitError.message || "Không xác minh được OTP.");
    }
  }
  if (step === "idFront") {
    const file = data.get("document");
    if (!file || !file.name) {
      clearLoading(event.submitter);
      return (error.textContent = "Vui lòng tải ảnh CCCD mặt trước.");
    }
    meta.idFrontName = file.name;
    meta.idNumber = String(data.get("idNumber") || "");
    verification.idFront = "verified";
  }
  if (step === "idBack") {
    const file = data.get("document");
    if (!file || !file.name) {
      clearLoading(event.submitter);
      return (error.textContent = "Vui lòng tải ảnh CCCD mặt sau.");
    }
    meta.idBackName = file.name;
    meta.issuedInfo = String(data.get("issuedInfo") || "");
    verification.idBack = "verified";
  }
  if (step === "faceScan") {
    if (qs("#kyc-modal").dataset.faceScanned !== "true") {
      clearLoading(event.submitter);
      return (error.textContent = "Vui lòng bấm “Bắt đầu quét” để mô phỏng bước nhận diện khuôn mặt.");
    }
    meta.faceScanAt = nowLabel();
    verification.faceScan = "verified";
  }
  if (step === "bankAccount") {
    const accountNumber = String(data.get("accountNumber") || "").replace(/\s+/g, "");
    const accountHolder = String(data.get("accountHolder") || "").trim();
    if (accountNumber.length < 8 || !accountHolder) {
      clearLoading(event.submitter);
      return (error.textContent = "Vui lòng nhập tài khoản ngân hàng hợp lệ.");
    }
    meta.bankName = String(data.get("bankName") || "Ngân hàng");
    meta.accountNumber = accountNumber;
    meta.accountHolder = accountHolder;
    meta.bankMasked = `•••• ${accountNumber.slice(-4)}`;
    verification.bankAccount = "verified";
  }
  user.verificationMeta = meta;
  verification.payoutEligible = ["phoneOtp", "idFront", "idBack", "faceScan", "bankAccount"].every((key) => verification[key] === "verified");
  saveState();
  closeKycModal();
  clearLoading(event.submitter);
  toast(verification.payoutEligible ? "Đã hoàn tất eKYC. Tài khoản đủ điều kiện nhận thanh toán." : "Đã cập nhật bước xác thực seller.");
  route();
}

function holdAsk(id) {
  const product = productById(id);
  if ((product.sellerStrategy || "Hold") === "Hold") return toast("Listing này đang ở chiến lược Hold, thao tác đã được khóa.", "error");
  product.sellerStrategy = "Hold";
  saveState();
  toast("Đã giữ Ask hiện tại. Seller tiếp tục chờ buyer bid chạm mức giá.");
  route();
}

function sellerFulfillment(action, orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return toast("Không tìm thấy đơn hàng.", "error");
  const step = fulfillmentStep(order);
  const expectedStep = { "confirm-order": 0, "pack-order": 1, "ship-order": 2 }[action];
  if (step !== expectedStep) return toast("Thao tác này đã bị khóa vì đơn hàng đã chuyển sang trạng thái khác.", "error");
  if (action === "confirm-order") {
    order.fulfillmentStatus = "Seller đã xác nhận - cần đóng gói trong 48h";
    order.status = "Seller đã xác nhận đơn";
  }
  if (action === "pack-order") {
    order.fulfillmentStatus = "Đã đóng gói và tạo niêm phong định danh";
    order.status = "Chờ bàn giao vận chuyển";
  }
  if (action === "ship-order") {
    order.fulfillmentStatus = "Đang vận chuyển";
    order.status = "Đang vận chuyển";
    order.escrowStatus = "Tạm giữ";
  }
  saveState();
  toast("Đã cập nhật trạng thái xử lý đơn.");
  route();
}

function confirmReceived(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return toast("Không tìm thấy đơn hàng.", "error");
  order.status = "Đã hoàn tất - buyer xác nhận";
  order.fulfillmentStatus = "Hoàn tất";
  order.escrowStatus = "Đã giải ngân";
  saveState();
  toast("Đã xác nhận nhận hàng. Escrow mock đã giải ngân cho seller.");
  route();
}

function openComplaint(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return toast("Không tìm thấy đơn hàng.", "error");
  if (!state.complaints.some((c) => c.orderId === orderId)) {
    state.complaints.unshift({ id: uid("cp"), orderId, buyerId: order.buyerId, reason: "Buyer mở khiếu nại từ trang đơn hàng.", status: "Escrow đóng băng - chờ admin xem xét", evidence: "Chưa tải bằng chứng", date: new Date().toISOString().slice(0, 10) });
  }
  order.status = "Đang khiếu nại";
  order.escrowStatus = "Đóng băng";
  saveState();
  toast("Đã tạo hồ sơ khiếu nại mock và đóng băng escrow.");
  window.location.href = href("pages/buyer/complaint.html");
}

function openPromoModal(packageId) {
  const user = currentUser();
  if (!user || user.role !== "seller") return toast("Chỉ seller có thể mua gói quảng cáo.", "error");
  const pack = promotionPackages()[packageId] || promotionPackages()["home-24h"];
  const metrics = sellerMetrics(user.id);
  const modal = qs("#promo-modal");
  modal.dataset.packageId = packageId;
  qs("#promo-title").textContent = pack[0];
  qs("#promo-copy").textContent = "Xác nhận mua gói quảng cáo. Chi phí sẽ trừ vào số dư chờ rút của seller.";
  qs("#promo-summary").innerHTML = `<div class="summary-row"><span>Loại gói</span><strong>${pack[1]}</strong></div><div class="summary-row"><span>Chi phí</span><strong>${moneyNegative(pack[2])}</strong></div><div class="summary-row"><span>Số dư hiện tại</span><span>${money(metrics.payoutPending)}</span></div><div class="summary-row total"><span>Số dư sau khi mua</span><span>${money(Math.max(0, metrics.payoutPending - pack[2]))}</span></div>`;
  qs("#promo-error").textContent = "";
  modal.classList.add("open");
}

function confirmPromotion(event) {
  const user = currentUser();
  if (!user || user.role !== "seller") return toast("Chỉ seller có thể xác nhận gói quảng cáo.", "error");
  const packageId = qs("#promo-modal")?.dataset.packageId || "home-24h";
  const pack = promotionPackages()[packageId] || promotionPackages()["home-24h"];
  const metrics = sellerMetrics(user.id);
  if (metrics.payoutPending < pack[2]) {
    qs("#promo-error").textContent = `Số dư chờ rút không đủ. Cần ${money(pack[2])}, hiện có ${money(metrics.payoutPending)}.`;
    return;
  }
  setLoading(event.currentTarget, "Đang mua...");
  const product = state.products.find((p) => p.sellerId === user.id && p.status === "approved");
  state.promotions.unshift({ id: uid("promo"), sellerId: user.id, productId: product?.id, name: pack[0], model: pack[1], cost: pack[2], impressions: Math.floor(3000 + Math.random() * 9000), clicks: Math.floor(80 + Math.random() * 420), orders: 0, status: "Đang chạy" });
  saveState();
  closePromoModal();
  toast("Đã kích hoạt gói quảng cáo / đẩy bài mock.");
  route();
}

function closePromoModal() {
  qs("#promo-modal")?.classList.remove("open");
}

function printSellerReport() {
  document.body.classList.add("print-mode");
  toast("Đang mở hộp thoại in báo cáo lịch sử đơn hàng.");
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove("print-mode"), 500);
  }, 120);
}

function printOrderReport(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return toast("Không tìm thấy đơn hàng để in.", "error");
  const seller = userById(order.sellerId);
  const product = productById(order.productId);
  const buyerName = order.buyer || userById(order.buyerId)?.name || "Người mua";
  const reportWindow = window.open("", "_blank", "width=960,height=900");
  if (!reportWindow) return toast("Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up để tiếp tục.", "error");
  const subtotal = Number(order.subtotal || Math.max(0, Number(order.total || 0) - Number(order.shippingFee || 0)));
  const commission = Number(order.commissionFee || commissionFee(subtotal));
  const net = Number(order.sellerNet || sellerNet(subtotal));
  reportWindow.document.write(`<!doctype html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Phiếu đơn hàng ${order.id} · ARCHIVE</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #111; margin: 0; padding: 40px; background: #fff; }
      .wrap { max-width: 900px; margin: 0 auto; }
      .eyebrow { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: #777; margin: 0 0 14px; }
      h1 { font-family: "Cormorant Garamond", Georgia, serif; font-size: 56px; line-height: .95; margin: 0 0 16px; font-weight: 600; }
      p { margin: 0; }
      .intro { color: #666; margin-bottom: 28px; font-size: 15px; line-height: 1.7; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
      .card { border: 1px solid #d9d4cc; padding: 22px; }
      .row { display: flex; justify-content: space-between; gap: 20px; padding: 12px 0; border-bottom: 1px solid #ece7df; }
      .row:last-child { border-bottom: 0; padding-bottom: 0; }
      .label { color: #777; }
      .value { text-align: right; font-weight: 600; }
      .negative { color: #8e3b34; }
      .total { font-size: 18px; }
      .footer { margin-top: 32px; font-size: 12px; color: #777; }
      @media print { body { padding: 0; } .wrap { max-width: none; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <p class="eyebrow">Phiếu đơn bán</p>
      <h1>${order.id}</h1>
      <p class="intro">Báo cáo in riêng cho từng đơn hàng seller trên ARCHIVE. Tài liệu này tóm tắt giao dịch, phí hoa hồng và số tiền thực nhận.</p>
      <div class="grid">
        <section class="card">
          <div class="row"><span class="label">Sản phẩm</span><span class="value">${order.item || product?.name || "N/A"}</span></div>
          <div class="row"><span class="label">Thương hiệu</span><span class="value">${product?.brand || "N/A"}</span></div>
          <div class="row"><span class="label">Người mua</span><span class="value">${buyerName}</span></div>
          <div class="row"><span class="label">Người bán</span><span class="value">${seller?.name || "Seller"}</span></div>
          <div class="row"><span class="label">Thời gian mua</span><span class="value">${fullTime(order.purchasedAt || order.date)}</span></div>
          <div class="row"><span class="label">Trạng thái</span><span class="value">${order.fulfillmentStatus || order.status || "Đang xử lý"}</span></div>
        </section>
        <section class="card">
          <div class="row"><span class="label">Giá bán</span><span class="value">${money(subtotal)}</span></div>
          <div class="row"><span class="label">Phí hoa hồng</span><span class="value negative">-${money(Math.abs(commission))}</span></div>
          <div class="row"><span class="label">Phí vận chuyển buyer trả</span><span class="value">${money(order.shippingFee || 0)}</span></div>
          <div class="row"><span class="label">Escrow</span><span class="value">${order.escrowStatus || "Tạm giữ"}</span></div>
          <div class="row total"><span class="label">Seller thực nhận</span><span class="value">${money(net)}</span></div>
        </section>
      </div>
      <div class="footer">ARCHIVE · In lúc ${fullTime(new Date().toISOString())}</div>
    </div>
    <script>
      window.onload = () => {
        window.print();
        setTimeout(() => window.close(), 250);
      };
    </script>
  </body>
  </html>`);
  reportWindow.document.close();
}

function addToCart(id, redirect = false) {
  const product = productById(id);
  const existing = state.cart.find((item) => item.productId === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ productId: id, qty: 1, price: product.lowestAsk || product.buyNow });
  saveState();
  toast(`Đã thêm ${product.name} vào giỏ hàng.`);
  if (redirect) window.location.href = href("pages/buyer/checkout.html");
  else route();
}

function buyNow(id) {
  const user = currentUser();
  if (!user) return (window.location.href = href("pages/auth/sign-in.html"));
  if (user.role !== "buyer") return toast("Chỉ tài khoản người mua có thể mua ngay.", "error");
  addToCart(id, true);
}

function toggleWishlist(id) {
  if (!currentUser()) return (window.location.href = href("pages/auth/sign-in.html"));
  state.wishlist = state.wishlist.includes(id) ? state.wishlist.filter((item) => item !== id) : [...state.wishlist, id];
  saveState();
  toast(state.wishlist.includes(id) ? "Đã lưu vào yêu thích." : "Đã bỏ khỏi yêu thích.");
  route();
}

function removeCart(id) {
  state.cart = state.cart.filter((item) => item.productId !== id);
  saveState();
  toast("Đã xóa sản phẩm khỏi giỏ.");
  route();
}

function updateQty(event) {
  const id = event.currentTarget.dataset.id;
  const qty = Math.max(1, Math.min(2, Number(event.currentTarget.value || 1)));
  const item = state.cart.find((line) => line.productId === id);
  if (item) item.qty = qty;
  saveState();
  route();
}

function loginDemo(email) {
  const user = state.users.find((item) => item.email === email);
  if (!user) return;
  ensureSellerVerification(user);
  state.sessionUserId = user.id;
  saveState();
  toast(`Đã đăng nhập demo với vai trò ${roleLabel(user.role)}.`);
  setTimeout(() => (window.location.href = href(roleDashboardPath(user.role, user))), 450);
}

function handleAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.dataset.authForm;
  const data = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  setLoading(submitter);
  if (type === "forgot") {
    toast("Đã gửi liên kết đặt lại mật khẩu demo.");
    return clearLoading(submitter);
  }
  if (type === "sign-up") {
    if (state.users.some((u) => u.email === data.email)) {
      clearLoading(submitter);
      return toast("Email đã tồn tại trong demo.", "error");
    }
    const user = {
      id: uid("u"), name: data.name, email: data.email, password: data.password || "123456", role: data.role, sellerStatus: data.role === "seller" ? "pending" : undefined,
      verification: data.role === "seller" ? { phoneOtp: "pending", idFront: "pending", idBack: "pending", faceScan: "pending", bankAccount: "pending", payoutEligible: false } : undefined,
      verificationMeta: data.role === "seller" ? {} : undefined,
      sellerScore: data.role === "seller" ? 0 : undefined,
      completedSales: data.role === "seller" ? 0 : undefined
    };
    state.users.push(user);
    state.sessionUserId = user.id;
    saveState();
    toast("Đăng ký thành công.");
    setTimeout(() => (window.location.href = href(roleDashboardPath(user.role, user))), 500);
    return;
  }
  const user = state.users.find((u) => u.email === data.email && u.password === data.password);
  if (!user) {
    clearLoading(submitter);
    return toast("Email hoặc mật khẩu không đúng. Thử tài khoản demo mật khẩu 123456.", "error");
  }
  ensureSellerVerification(user);
  state.sessionUserId = user.id;
  saveState();
  toast(`Đăng nhập thành công: ${roleLabel(user.role)}.`);
  setTimeout(() => (window.location.href = href(roleDashboardPath(user.role, user))), 500);
}

function logout() {
  state.sessionUserId = null;
  saveState();
  toast("Đã đăng xuất.");
  setTimeout(() => (window.location.href = href("index.html")), 350);
}

function handleCheckout(event) {
  event.preventDefault();
  const items = cartItems();
  if (!items.length) return toast("Giỏ hàng đang trống.", "error");
  const form = event.currentTarget;
  if (!form.checkValidity()) return toast("Vui lòng nhập đủ thông tin giao hàng.", "error");
  setLoading(event.submitter, "Đang tạo đơn...");
  const data = Object.fromEntries(new FormData(form));
  state.shipping = data;
  const sum = totals(items);
  const sellerProduct = items[0].product;
  const subtotalForSeller = sum.subtotal;
  const order = {
    id: `DH-${Date.now().toString().slice(-6)}`,
    productId: items[0].productId,
    item: items.map((item) => item.product.name).join(", "),
    buyerId: currentUser().id,
    buyer: data.name,
    subtotal: sum.subtotal,
    shippingFee: sum.shipping,
    total: sum.total,
    commissionRate: commissionRate(),
    commissionFee: commissionFee(subtotalForSeller),
    sellerNet: sellerNet(subtotalForSeller),
    escrowStatus: "Tạm giữ",
    fulfillmentStatus: "Chờ seller xác nhận trong 48h",
    status: "Escrow tạm giữ - chờ seller xác nhận",
    date: new Date().toISOString().slice(0, 10),
    purchasedAt: new Date().toISOString(),
    method: data.method,
    sellerId: sellerProduct?.sellerId
  };
  state.orders.push(order);
  state.lastOrderId = order.id;
  state.cart = [];
  saveState();
  toast("Đặt hàng thành công.");
  setTimeout(() => (window.location.href = href("pages/buyer/order-confirmation.html")), 500);
}

function handleComplaintSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) return toast("Vui lòng nhập lý do khiếu nại.", "error");
  const data = Object.fromEntries(new FormData(form));
  const order = state.orders.find((o) => o.id === data.orderId);
  if (!order) return toast("Không tìm thấy đơn hàng để khiếu nại.", "error");
  state.complaints.unshift({ id: uid("cp"), orderId: order.id, buyerId: order.buyerId, reason: data.reason, status: "Escrow đóng băng - chờ admin xem xét", evidence: "Buyer sẽ bổ sung ảnh/video trong bản production", date: new Date().toISOString().slice(0, 10) });
  order.status = "Đang khiếu nại";
  order.escrowStatus = "Đóng băng";
  saveState();
  toast("Đã gửi khiếu nại. Escrow mock đã được đóng băng.");
  route();
}

function handleListingSubmit(event) {
  event.preventDefault();
  const user = currentUser();
  const form = event.currentTarget;
  if (!form.checkValidity()) return toast("Vui lòng nhập đủ thông tin và tải bộ ảnh bắt buộc.", "error");
  const data = Object.fromEntries(new FormData(form));
  const buyNow = parseMoney(data.buyNow);
  const lowestAsk = parseMoney(data.lowestAsk);
  if (!data.name || !data.condition || buyNow <= 0 || lowestAsk <= 0) return toast("Vui lòng nhập đủ thông tin và giá hợp lệ.", "error");
  setLoading(event.submitter, "Đang gửi duyệt...");
  const aiReview = runAiReview(data, buyNow, lowestAsk);
  const initialStatus = aiReview.status === "Auto-Reject" ? "rejected" : aiReview.status === "Flagged" ? "flagged" : "pending";
  const product = {
    id: uid("listing"), brand: data.brand, name: data.name, category: data.category, size: data.size, color: data.color,
    material: data.material, grade: data.grade, condition: data.condition, status: initialStatus, sellerId: user.id,
    buyNow, highestBid: Math.round(lowestAsk * 0.88), lowestAsk, lastSale: Math.round(lowestAsk * 0.92), trend: 52,
    badges: [statusLabel(initialStatus)], listedAt: new Date().toISOString().slice(0, 10),
    pricingMode: data.pricingMode, measurements: data.measurements, includedItems: data.includedItems || "Seller chưa khai báo phụ kiện", flaws: data.flaws || "Không ghi nhận lỗi đáng kể", sellerStrategy: "Hold",
    aiReview, adminReview: { status: initialStatus, gradeFinal: data.grade, note: aiReview.notes.join(" · ") },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: Boolean(data.photoFlaw?.name) },
    image: data.category === "Giày" ? "assets/products/prada-americas-cup.jpg" : data.category === "Quần áo" ? "assets/products/prada-outerwear.jpg" : data.category === "Phụ kiện" ? "assets/products/chanel-coco-crush.jpg" : "assets/products/prada-chanel-bags.jpg"
  };
  state.products.unshift(product);
  product.gallery = [product.image, product.image, product.image];
  state.asks.unshift({ id: uid("a"), productId: product.id, sellerId: user.id, seller: user.name, amount: lowestAsk, status: initialStatus === "rejected" ? "rejected" : "pending", createdAt: nowLabel() });
  saveState();
  toast(aiReview.status === "Auto-Reject" ? "AI scan tự động từ chối. Seller có thể chỉnh lại bài và gửi lại trong demo." : `Đã gửi bài đăng. Kết quả AI scan: ${aiReview.status}.`);
  setTimeout(() => (window.location.href = href("pages/seller/status.html")), 500);
}

function runAiReview(data, buyNow, lowestAsk) {
  const text = `${data.name || ""} ${data.condition || ""} ${data.flaws || ""}`.toLowerCase();
  const banned = ["fake", "replica", "rep 1:1", "like auth"];
  const notes = [];
  let score = 94;
  if (banned.some((word) => text.includes(word))) {
    notes.push("Phát hiện từ khóa cấm liên quan hàng giả/replica");
    score -= 45;
  } else notes.push("Không phát hiện từ khóa cấm");
  if (lowestAsk < buyNow * 0.55 || buyNow < 1000000) {
    notes.push("Giá bán bất thường so với biên độ thị trường");
    score -= 24;
  } else notes.push("Giá nằm trong biên độ chấp nhận");
  if (!data.photoLabel?.name || !data.photoDetail?.name || !data.photoMaterial?.name) {
    notes.push("Thiếu ảnh nhãn/chi tiết/chất liệu bắt buộc");
    score -= 22;
  } else notes.push("Bộ ảnh bắt buộc đã đủ cấu trúc");
  if (String(data.condition || "").length < 40) {
    notes.push("Mô tả tình trạng còn ngắn, cần admin xem kỹ");
    score -= 12;
  }
  const status = score < 55 ? "Auto-Reject" : score < 82 ? "Flagged" : "Passed";
  return { status, score: Math.max(0, Math.min(100, score)), notes };
}

function handleModeration(event) {
  event.preventDefault();
  const actionButton = event.submitter;
  setLoading(actionButton, "Đang cập nhật...");
  const status = actionButton?.dataset.moderate || "revision";
  const form = event.currentTarget;
  const product = productById(form.dataset.id);
  product.grade = new FormData(form).get("grade") || product.grade;
  product.status = status;
  product.badges = status === "approved" ? ["Đã xác thực", "Quản trị duyệt"] : [statusLabel(status)];
  product.adminReview = { status, gradeFinal: product.grade, note: new FormData(form).get("note") || statusLabel(status), reviewedAt: nowLabel() };
  state.asks.filter((a) => a.productId === product.id).forEach((ask) => { ask.status = status === "approved" ? "active" : status; });
  saveState();
  toast(status === "approved" ? "Đã duyệt. Sản phẩm đã xuất hiện ngoài sàn giao dịch." : `Đã cập nhật trạng thái: ${statusLabel(status)}.`);
  setTimeout(() => (window.location.href = href(status === "approved" ? "pages/shop.html" : "pages/admin/pending.html")), 650);
}

function openTradeModal(type, productId) {
  const product = productById(productId);
  const user = currentUser();
  if (!user) return (window.location.href = href("pages/auth/sign-in.html"));
  if ((type === "bid" || type === "buy-now") && user.role !== "buyer") return toast("Chỉ người mua có thể đặt bid hoặc mua ngay.", "error");
  if ((type === "ask" || type === "sell-now") && user.role !== "seller") return toast("Chỉ seller có thể đặt ask hoặc bán ngay.", "error");
  if ((type === "ask" || type === "sell-now") && product.sellerId !== user.id) return toast("Seller chỉ thao tác Ask/Sell Now trên bài đăng của mình trong demo.", "error");
  const form = qs("[data-trade-form]");
  form.elements.type.value = type;
  form.elements.productId.value = productId;
  const defaults = { bid: product.highestBid + 500000, ask: Math.max(product.highestBid + 1000000, product.lowestAsk - 500000), "sell-now": product.highestBid };
  form.elements.amount.value = defaults[type] || product.lowestAsk;
  qs("#modal-title").textContent = { bid: "Đặt giá mua (Bid)", ask: "Đặt giá bán (Ask)", "sell-now": "Bán ngay theo bid cao nhất" }[type] || "Thao tác thị trường";
  qs("#modal-kicker").textContent = product.brand;
  qs("#modal-copy").textContent = { bid: `Bid mới nên cao hơn bid hiện tại ${money(product.highestBid)}.`, ask: `Ask thấp hơn sẽ tăng khả năng khớp. Ask hiện tại ${money(product.lowestAsk)}.`, "sell-now": `Chấp nhận bid cao nhất ${money(product.highestBid)} và tạo giao dịch.` }[type];
  renderTradeSummary(product, type, defaults[type]);
  form.elements.amount.oninput = () => renderTradeSummary(product, type, parseMoney(form.elements.amount.value));
  qs("#trade-error").textContent = "";
  qs("#trade-modal").classList.add("open");
}

function renderTradeSummary(product, type, amount) {
  const sellerFee = commissionFee(amount);
  const shipping = shippingFee();
  const total = type === "ask" || type === "sell-now" ? amount - sellerFee : amount + shipping;
  qs("#trade-summary").innerHTML = `<div class="summary-row"><span>Sản phẩm</span><strong>${product.name}</strong></div><div class="summary-row"><span>Giá nhập</span><strong>${money(amount)}</strong></div>${type === "ask" || type === "sell-now" ? `<div class="summary-row"><span>Phí hoa hồng seller</span><span>${moneyNegative(sellerFee)}</span></div><div class="summary-row total"><span>Thực nhận dự kiến</span><span>${money(total)}</span></div>` : `<div class="summary-row"><span>Phí vận chuyển</span><span>${money(shipping)}</span></div><div class="summary-row total"><span>Tổng dự kiến</span><span>${money(total)}</span></div>`}<p class="small muted">${type === "ask" || type === "sell-now" ? "Hoa hồng chỉ tính cho seller khi giao dịch thành công." : "Buyer chỉ thanh toán giá sản phẩm và phí vận chuyển; tiền được tạm giữ trong escrow mock."}</p>`;
}

function handleTradeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.elements.type.value;
  const product = productById(form.elements.productId.value);
  const user = currentUser();
  const amount = parseMoney(form.elements.amount.value);
  const error = qs("#trade-error");
  if (!amount || amount < 1000000) return (error.textContent = "Vui lòng nhập mức giá hợp lệ từ 1.000.000₫.");
  if (type === "bid" && amount <= product.highestBid) return (error.textContent = `Bid mới phải cao hơn bid hiện tại ${money(product.highestBid)}.`);
  if (type === "ask" && amount < 1000000) return (error.textContent = "Ask phải là mức giá hợp lệ.");
  setLoading(event.submitter, "Đang cập nhật...");
  let redirectToCheckout = false;
  if (type === "bid") {
    state.bids.unshift({ id: uid("b"), productId: product.id, userId: user.id, buyer: user.name, amount, status: amount >= product.lowestAsk ? "matched" : "active", createdAt: nowLabel() });
    product.highestBid = Math.max(product.highestBid, amount);
    if (amount >= product.lowestAsk) {
      product.lastSale = product.lowestAsk;
      state.cart = [{ productId: product.id, qty: 1, price: product.lowestAsk }];
      redirectToCheckout = true;
      toast("Bid đã khớp Ask. Sản phẩm đã được đưa sang bước thanh toán.", "success");
    } else toast("Đặt bid thành công. Giao diện đã cập nhật bid cao nhất.");
  }
  if (type === "ask") {
    const matched = amount <= product.highestBid;
    state.asks.unshift({ id: uid("a"), productId: product.id, sellerId: user.id, seller: user.name, amount, status: matched ? "matched" : "active", createdAt: nowLabel() });
    product.lowestAsk = Math.min(product.lowestAsk || amount, amount);
    if (matched) {
      product.lastSale = product.highestBid;
      addMatchedOrder(product, user, product.highestBid, "Ask khớp Highest Bid - escrow tạm giữ");
      toast("Ask đã khớp Highest Bid. Hệ thống đã tạo giao dịch escrow mock.");
    } else toast("Đặt ask thành công. Ask thấp nhất đã được cập nhật.");
  }
  if (type === "sell-now") {
    if (amount !== product.highestBid) {
      clearLoading(event.submitter);
      return (error.textContent = "Bán ngay chỉ chấp nhận đúng Bid cao nhất hiện tại.");
    }
    product.lastSale = product.highestBid;
    state.bids.filter((b) => b.productId === product.id && b.amount === product.highestBid).forEach((b) => (b.status = "matched"));
    addMatchedOrder(product, user, product.highestBid, "Người bán chấp nhận Bid");
    toast("Đã bán ngay theo Bid cao nhất. Đơn hàng demo đã được tạo.");
  }
  saveState();
  closeTradeModal();
  if (redirectToCheckout) {
    setTimeout(() => (window.location.href = href("pages/buyer/checkout.html")), 450);
    return;
  }
  route();
}

function addMatchedOrder(product, user, amount, status) {
  const buyerBid = state.bids.find((b) => b.productId === product.id && b.amount >= amount);
  const buyer = buyerBid ? userById(buyerBid.userId) || user : user;
  state.orders.unshift({
    id: `DH-${Date.now().toString().slice(-6)}`,
    productId: product.id,
    item: product.name,
    buyerId: buyer.id,
    buyer: buyer.name,
    subtotal: amount,
    shippingFee: shippingFee(),
    total: amount + shippingFee(),
    commissionRate: commissionRate(),
    commissionFee: commissionFee(amount),
    sellerNet: sellerNet(amount),
    escrowStatus: "Tạm giữ",
    fulfillmentStatus: "Chờ seller xác nhận trong 48h",
    status,
    date: new Date().toISOString().slice(0, 10),
    purchasedAt: new Date().toISOString(),
    method: "Bid/Ask escrow demo",
    sellerId: product.sellerId
  });
}

function closeTradeModal() {
  qs("#trade-modal")?.classList.remove("open");
}

function route() {
  const page = document.body.dataset.page;
  const type = document.body.dataset.type;
  const map = { home: homePage, shop: shopPage, product: productDetailPage, brands: brandsPage, sell: sellPage, trust: trustPage, about: aboutPage };
  if (map[page]) return map[page]();
  if (page === "auth") return authPage(type);
  if (page === "buyer") return accountPage(type);
  if (page === "seller") return sellerPage(type);
  if (page === "admin") return adminPage(type);
  homePage();
}

document.addEventListener("DOMContentLoaded", route);
