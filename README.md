# ARCHIVE · Sàn đồ hiệu second-hand

Frontend nhiều trang cho nền tảng mua bán đồ hiệu second-hand, kết hợp mua ngay, Bid/Ask và quy trình quản trị viên kiểm duyệt. Project hiện có thêm backend Node nhỏ để serve toàn bộ website và xử lý OTP thật cho bước eKYC seller.

## Chạy local

1. Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

2. Điền cấu hình Twilio Verify trong `.env`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

3. Chạy server:

```bash
npm start
```

4. Mở `http://localhost:4173`

Lưu ý:

- Không dùng `python3 -m http.server` nữa nếu bạn muốn OTP thật hoạt động.
- Bước OTP seller sẽ gọi `POST /api/otp/send` và `POST /api/otp/verify` trên cùng origin.
- Nếu chưa cấu hình Twilio Verify, UI sẽ báo lỗi gửi OTP thay vì dùng mã mock.
- Nếu tài khoản Twilio đang là `Trial`, số nhận OTP phải nằm trong `Verified Caller IDs` của đúng project/account đang dùng ở `.env`.

## Tài khoản demo

- Người mua: `buyer@archive.vn` / `123456`
- Người bán: `seller@archive.vn` / `123456`
- Quản trị viên: `admin@archive.vn` / `123456`

## Cấu trúc

- `index.html`: trang chủ
- `pages/`: route public, auth, buyer, seller và admin
- `assets/css/styles.css`: design system monochrome luxury, responsive layout, toast, form, card, badge
- `assets/js/data.js`: dữ liệu mẫu tiếng Việt, giá VNĐ, users, products, bids, asks, orders, grade guide, escrow, hoa hồng seller, quảng cáo và khiếu nại
- `assets/js/app.js`: điều hướng, state `localStorage`, đăng nhập demo, giỏ hàng/thanh toán, Bid/Ask, seller eKYC UI, admin moderation, doanh thu seller và quảng cáo/đẩy bài
- `assets/products/`: ảnh thật local cũ dùng làm fallback tối thiểu cho demo
- `assets/js/data.js`: bộ ảnh hiện tại của sản phẩm được khai báo theo từng item, ưu tiên ảnh chuẩn sản phẩm và ảnh resale thật từ nguồn công khai
- `server/index.js`: Node server phục vụ file tĩnh và API OTP thật qua Twilio Verify
- `server/data/otp-store.json`: storage metadata cho cooldown, rate limit, số lần verify và trạng thái phiên OTP

## Nguồn ảnh demo

Các ảnh sản phẩm hiện dùng bộ URL thật theo từng sản phẩm trong `assets/js/data.js`, gồm ảnh chuẩn sản phẩm và ảnh resale/public product photos của đúng item để mô phỏng marketplace. File local trong `assets/products/` chỉ còn đóng vai trò fallback tối thiểu nếu một URL ngoài lỗi.

- `celine-ava-marieclaire.jpg` và `celine-triomphe-marieclaire.jpg`: Marie Claire CDN, ảnh Celine Ava/Triomphe trong bài editorial.
- `celine-hoodie.jpg`: Wikimedia Commons, ảnh Celine Hoodie.
- `bottega-bag.jpg`: Wikimedia Commons, ảnh túi Bottega Veneta.
- `prada-chanel-bags.jpg`: Wikimedia Commons, ảnh handbags Prada/Chanel.
- `prada-americas-cup.jpg`: Wikimedia Commons, ảnh Prada America's Cup High.
- `prada-outerwear.jpg`: Wikimedia Commons, ảnh outerwear Prada.
- `rick-owens-geobasket.jpg`: Wikimedia Commons, ảnh Rick Owens Geobasket sneaker.
- `chanel-coco-crush.jpg`: Wikimedia Commons, ảnh Chanel Coco Crush photocall.
- `dior-b30-black.webp` và `dior-b30-white.webp`: StockX image CDN, ảnh sản phẩm Dior B30.

## Luồng đã có

- Người mua có thể đăng nhập, lưu yêu thích, thêm giỏ, checkout chỉ gồm giá sản phẩm + phí vận chuyển, xem đơn hàng, xác nhận nhận hàng, khiếu nại 72 giờ và đặt Bid.
- Người bán có thể đăng nhập, đi qua flow eKYC 5 bước, gửi OTP thật qua SMS nếu backend đã cấu hình Twilio, tạo bài đăng với bộ ảnh bắt buộc, đặt Ask, Hold/Sell Now, xử lý đơn, xem doanh số, hoa hồng, doanh thu ròng, ví chờ rút và mua gói quảng cáo/đẩy bài.
- Tiến trình xử lý đơn của seller là một chiều: xác nhận đơn, đóng gói, giao vận. Các bước trước đó tự khóa sau khi đã chuyển trạng thái.
- Trang doanh thu seller hiển thị phí hoa hồng và chi phí quảng cáo bằng số âm màu đỏ, có thời gian mua hàng và nút in báo cáo.
- Quản trị viên có thể đăng nhập, xem bài chờ duyệt/AI flagged, mở moderation detail, duyệt/từ chối/yêu cầu chỉnh sửa, quản lý đơn escrow và khiếu nại.
- Trang chi tiết sản phẩm cập nhật Bid cao nhất, Ask thấp nhất, giao dịch gần nhất, seller trust, phụ kiện/lỗi thực tế, AI/admin review và lịch sử hoạt động ngay trong frontend demo.

## OTP thật qua Twilio Verify

- Backend gọi Twilio Verify để gửi OTP SMS thật tới số điện thoại người dùng.
- Backend gọi Verify Check để xác minh mã OTP người dùng nhập.
- `server/data/otp-store.json` chỉ lưu metadata phiên OTP của app:
  - request/session id
  - cooldown gửi lại
  - số lần verify sai
  - trạng thái verified/locked
- OTP code do Twilio Verify quản lý, không hardcode trong frontend hoặc local storage.
- Có chống spam cơ bản:
  - giới hạn số lần gửi trong cửa sổ thời gian
  - cooldown trước khi gửi lại
  - giới hạn số lần verify sai ở app layer
- `GET /api/health` trả thêm `envFilePresent`, `accountSid`, `verifyServiceSid` và `port` để debug nhanh runtime hiện tại mà không lộ secret đầy đủ.

Nếu trình duyệt đang giữ dữ liệu cũ, bấm `Đặt lại dữ liệu demo` ở footer để seed lại schema `archive_marketplace_vi_v6`.
