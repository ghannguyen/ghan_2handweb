const GRADE_GUIDE = {
  S: "New with Tags. Mới hoàn toàn, còn tag, gần như chưa sử dụng.",
  A: "Like new 99%. Gần như mới tuyệt đối, rất ít hoặc không có dấu hiệu hao mòn.",
  B: "Like new 97-98%. Đã qua sử dụng rất ít, còn rất tốt.",
  C: "Like new 95%. Đã qua sử dụng, có hao mòn rõ hơn nhưng vẫn dùng tốt."
};

const SHIPPING_FEE = 350000;
const SELLER_COMMISSION_RATE = 0.12;

const BRANDS = [
  "Louis Vuitton", "Chanel", "Hermes", "Dior", "Prada", "Gucci", "Celine", "Saint Laurent",
  "Bottega Veneta", "Loewe", "Miu Miu", "Maison Margiela", "Moncler", "Rick Owens", "Balenciaga", "The Row"
];

const PRODUCT_IMAGES = {
  celineAva: [
    "https://image.celine.com/324d31511f5517b/original/114493DGQ-04LU_1_FW23_W.jpg?im=Resize=(1600)",
    "https://www.fashionphile.com/cdn/shop/files/d85609a89e29d3937afbe8b086a02048.jpg?v=1768388544&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/7241a6c5f69168bc95fda46bdb65b3d0.jpg?v=1768388544&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/c322c190e04af02ba55d2e00a3300e87.jpg?v=1768388544&width=1946"
  ],
  pradaJacket: [
    "https://www.prada.com/content/dam/pradabkg_products/2/29X/29X900/1WQ8F0002/29X900_1WQ8_F0002_S_202_SLF.jpg/_jcr_content/renditions/cq5dam.web.hebebed.2000.2000.jpg",
    "https://www.prada.com/content/dam/pradabkg_products/2/29X/29X900/1WQ8F0002/29X900_1WQ8_F0002_S_202_MDB.jpg/_jcr_content/renditions/cq5dam.web.hebebed.2000.2000.jpg",
    "https://www.prada.com/content/dam/pradabkg_products/2/29X/29X900/1WQ8F0002/29X900_1WQ8_F0002_S_202_MDF.jpg/_jcr_content/renditions/cq5dam.web.hebebed.2000.2000.jpg",
    "https://www.prada.com/content/dam/pradabkg_products/2/29X/29X900/1WQ8F0002/29X900_1WQ8_F0002_S_202_MDD.jpg/_jcr_content/renditions/cq5dam.web.hebebed.2000.2000.jpg"
  ],
  diorB30: [
    "https://images.stockx.com/360/Dior-B30-White/Images/Dior-B30-White/Lv2/img01.jpg?dpr=1&h=900&q=90&updated_at=1681456682&w=1200",
    "https://www.fashionphile.com/cdn/shop/files/bede63a00c41c6790ce88143f6198982.jpg?v=1753318959&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/db83eaec6ce93dad9de8d88cc0551e8e.jpg?v=1753318959&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/113276b353565534fe4a51d8884d6f67.jpg?v=1753318959&width=1946"
  ],
  bottegaCassette: [
    "https://www.fashionphile.com/cdn/shop/files/5ccbc62f7cc6f62998495ff91ed1fb87.jpg?v=1749687474&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/bd408843aeb6587dd520f18c2bd6b2cd.jpg?v=1749687474&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/0be77b99e0e38f3686e63f76ad78a0f8.jpg?v=1749687474&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/a849f8cc9aded0428dc5beeec19ef3c0.jpg?v=1749687474&width=1946"
  ],
  rickGeobasket: [
    "https://images.stockx.com/images/Rick-Owens-Geobasket-Sneakers-Black-Milk.jpg?bg=FFFFFF&dpr=1&fit=fill&h=900&q=90&trim=color&updated_at=1767908539&w=1200",
    "https://www.rickowens.eu/cdn/shop/files/RU01F2894_LCSUCO_10411_01.jpg?v=1769695426&width=1200",
    "https://www.rickowens.eu/cdn/shop/files/RU01F2894_LCSUCO_10411_02.jpg?v=1769695426&width=1200",
    "https://www.rickowens.eu/cdn/shop/files/RU01F2894_LCSUCO_10411_03.jpg?v=1769695426&width=1200"
  ],
  chanelCocoCrush: [
    "https://www.fashionphile.com/cdn/shop/files/084f95f9556602593734ec34ea79986f.jpg?v=1774360501&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/412027f53cacf72aa16284ae699cfb63.jpg?v=1774360501&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/712393d95ae98f74bf280c3748e3cfce.jpg?v=1774360501&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/058ed2e8083b8d940f1061bc4d546ae2.jpg?v=1774360502&width=1946"
  ],
  chanelFlap: [
    "https://www.fashionphile.com/cdn/shop/files/f64144354bfd74eba71d5b9c0a0966ec.jpg?v=1749106809&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/05d6e67ad6dacf32d9bd1cae86aa66f0.jpg?v=1749106808&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/b22c239ceb1226d9503bd0668698b451.jpg?v=1749106809&width=1946",
    "https://www.fashionphile.com/cdn/shop/files/afb41e3d56f263fc6b69fe38cd541d7b.jpg?v=1749106809&width=1946"
  ],
  celineHoodie: [
    "https://image.celine.com/14aa2b37033f90d/original/2Y321670Q-38AW_1_SUM21_V.jpg?im=Resize=(1600)",
    "https://image.celine.com/2207dd1a74592e36/original/2Y321670Q-38AW_2_SUM21_V.jpg?im=Resize=(1600)",
    "https://image.celine.com/12d894cbc873c616/original/2Y321670Q-38AW_3_SUM21_V.jpg?im=Resize=(1600)",
    "https://image.celine.com/4fe59ca3fcfc1897/original/2Y321670Q-38AW_4_SUM21_V.jpg?im=Resize=(1600)"
  ]
};

const SEED_USERS = [
  { id: "u-buyer", name: "Minh Anh", role: "buyer", email: "buyer@archive.vn", password: "123456", phone: "090 000 0001" },
  {
    id: "u-seller", name: "Maison Archive Saigon", role: "seller", email: "seller@archive.vn", password: "123456", phone: "090 000 0002", sellerStatus: "approved",
    verification: {
      phoneOtp: "pending",
      idFront: "pending",
      idBack: "pending",
      faceScan: "pending",
      bankAccount: "pending",
      payoutEligible: false
    },
    verificationMeta: {},
    sellerScore: 4.9,
    completedSales: 38
  },
  { id: "u-admin", name: "Quản trị ARCHIVE", role: "admin", email: "admin@archive.vn", password: "123456", phone: "090 000 0003" }
];

const SEED_PRODUCTS = [
  {
    id: "celine-triomphe-ava", brand: "Celine", name: "Túi Medium Ava Triomphe Strap", category: "Túi xách", size: "Một cỡ",
    color: "Tan / Triomphe canvas", material: "Triomphe canvas và da bê", grade: "A", condition: "Đã sử dụng nhẹ, góc túi sạch, canvas và viền da có vài vết xước tóc rất nhỏ.",
    status: "approved", sellerId: "u-seller", buyNow: 45500000, highestBid: 40800000, lowestAsk: 43800000, lastSale: 42100000, trend: 86,
    badges: ["Đã xác thực", "Bid mạnh"], listedAt: "2026-03-22", pricingMode: "fixed_bid_ask", measurements: "24 x 14 x 7 cm", includedItems: "Túi bụi, hộp, thẻ care card", flaws: "Xước tóc rất nhỏ tại khóa kim loại.", sellerStrategy: "Hold",
    aiReview: { status: "Passed", score: 94, notes: ["Ảnh thực tế hợp lệ", "Không phát hiện từ khóa cấm", "Giá trong biên độ thị trường"] },
    adminReview: { status: "approved", gradeFinal: "A", note: "Đủ góc chụp, grade phù hợp." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.celineAva[0],
    gallery: PRODUCT_IMAGES.celineAva,
    imageSources: ["Celine official", "FASHIONPHILE resale", "FASHIONPHILE resale", "FASHIONPHILE resale"]
  },
  {
    id: "prada-re-nylon-jacket", brand: "Prada", name: "Áo khoác Re-Nylon Cropped", category: "Quần áo", size: "M",
    color: "Graphite", material: "Re-Nylon", grade: "S", condition: "Chưa sử dụng, còn tag và túi bảo quản.",
    status: "approved", sellerId: "u-seller", buyNow: 31800000, highestBid: 26800000, lowestAsk: 30500000, lastSale: 29200000, trend: 74,
    badges: ["Đã xác thực", "Mới lên sàn"], listedAt: "2026-04-01", pricingMode: "fixed_bid_ask", measurements: "Vai 42 cm · Dài áo 58 cm", includedItems: "Tag giấy, túi bảo quản", flaws: "Không ghi nhận lỗi đáng kể.", sellerStrategy: "Hold",
    aiReview: { status: "Passed", score: 97, notes: ["Ảnh tag rõ", "Mô tả thống nhất với grade S", "Giá phù hợp"] },
    adminReview: { status: "approved", gradeFinal: "S", note: "Còn tag, ảnh đầy đủ." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.pradaJacket[0],
    gallery: PRODUCT_IMAGES.pradaJacket,
    imageSources: ["Prada official", "Prada official", "Prada official", "Prada official"]
  },
  {
    id: "dior-b30-sneaker", brand: "Dior", name: "Giày B30 White", category: "Giày", size: "42",
    color: "Trắng", material: "Mesh và vải kỹ thuật", grade: "A", condition: "Đế có dấu hiệu sử dụng rất nhẹ, upper trắng đã vệ sinh chuyên nghiệp.",
    status: "approved", sellerId: "u-seller", buyNow: 18800000, highestBid: 16200000, lowestAsk: 17800000, lastSale: 17100000, trend: 68,
    badges: ["Đã xác thực"], listedAt: "2026-03-14", pricingMode: "fixed_bid_ask", measurements: "EU 42 · Insole 27 cm", includedItems: "Hộp, túi dust bag, dây thay thế", flaws: "Đế có vết dùng nhẹ.", sellerStrategy: "Sell Now nếu Bid trên 17 triệu",
    aiReview: { status: "Passed", score: 91, notes: ["Ảnh upper/sole rõ", "Không phát hiện ảnh trùng bất thường", "Giá hợp lý"] },
    adminReview: { status: "approved", gradeFinal: "A", note: "Upper sạch, đế hao mòn nhẹ." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.diorB30[0],
    gallery: PRODUCT_IMAGES.diorB30,
    imageSources: ["StockX product image", "FASHIONPHILE resale", "FASHIONPHILE resale", "FASHIONPHILE resale"]
  },
  {
    id: "bottega-cassette", brand: "Bottega Veneta", name: "Túi Padded Cassette Fondant", category: "Túi xách", size: "Một cỡ",
    color: "Fondant", material: "Suede maxi intrecciato", grade: "B", condition: "Dây có nếp gập, bề mặt suede có dấu hiệu dùng nhẹ, form vẫn đẹp.",
    status: "approved", sellerId: "u-seller", buyNow: 52000000, highestBid: 46800000, lowestAsk: 50500000, lastSale: 48600000, trend: 79,
    badges: ["Đã xác thực"], listedAt: "2026-02-26", pricingMode: "fixed_bid_ask", measurements: "26 x 18 x 8 cm", includedItems: "Túi bụi, hóa đơn scan đã che thông tin cá nhân", flaws: "Bề mặt suede có vài vùng lông nhẹ và dây có nếp gập.", sellerStrategy: "Hold",
    aiReview: { status: "Passed", score: 89, notes: ["Có ảnh lỗi thực tế", "Logo và form dáng rõ", "Giá trong biên độ"] },
    adminReview: { status: "approved", gradeFinal: "B", note: "Grade B phù hợp hao mòn góc." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.bottegaCassette[0],
    gallery: PRODUCT_IMAGES.bottegaCassette,
    imageSources: ["FASHIONPHILE product-standard", "FASHIONPHILE resale", "FASHIONPHILE resale", "FASHIONPHILE resale"]
  },
  {
    id: "rick-owens-geobasket", brand: "Rick Owens", name: "Giày Geobasket High-Top", category: "Giày", size: "41",
    color: "Milk / Đen", material: "Da", grade: "B", condition: "Da còn chắc, phần đế và mũi giày có dấu hiệu sử dụng.",
    status: "approved", sellerId: "u-seller", buyNow: 22800000, highestBid: 19400000, lowestAsk: 21800000, lastSale: 20800000, trend: 71,
    badges: ["Bid mạnh"], listedAt: "2026-03-18", pricingMode: "fixed_bid_ask", measurements: "EU 41 · Insole 26.5 cm", includedItems: "Hộp thay thế, dây giày", flaws: "Đế và mũi giày có dấu hiệu sử dụng.", sellerStrategy: "Hold",
    aiReview: { status: "Flagged", score: 76, notes: ["Cần kiểm tra thêm ảnh nhãn trong giày", "Giá thấp hơn trung bình nhưng chưa auto-reject"] },
    adminReview: { status: "approved", gradeFinal: "B", note: "Đã bổ sung ảnh nhãn, duyệt có ghi chú." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.rickGeobasket[0],
    gallery: PRODUCT_IMAGES.rickGeobasket,
    imageSources: ["StockX product image", "Rick Owens official", "Rick Owens official", "Rick Owens official"]
  },
  {
    id: "chanel-coco-crush", brand: "Chanel", name: "Nhẫn Coco Crush", category: "Phụ kiện", size: "52",
    color: "Beige Gold", material: "Vàng 18K", grade: "A", condition: "Đã đánh bóng, có xước vi mô khi quan sát gần.",
    status: "approved", sellerId: "u-seller", buyNow: 60600000, highestBid: 54800000, lowestAsk: 58800000, lastSale: 57200000, trend: 82,
    badges: ["Đã xác thực"], listedAt: "2026-01-30", pricingMode: "fixed_bid_ask", measurements: "Size 52", includedItems: "Hộp, giấy kiểm định nội bộ, pouch", flaws: "Xước vi mô do sử dụng bình thường.", sellerStrategy: "Hold",
    aiReview: { status: "Passed", score: 93, notes: ["Ảnh khắc dấu rõ", "Mô tả chất liệu nhất quán"] },
    adminReview: { status: "approved", gradeFinal: "A", note: "Đã kiểm tra bề mặt và phụ kiện." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.chanelCocoCrush[0],
    gallery: PRODUCT_IMAGES.chanelCocoCrush,
    imageSources: ["FASHIONPHILE product-standard", "FASHIONPHILE resale", "FASHIONPHILE resale", "FASHIONPHILE resale"]
  },
  {
    id: "chanel-classic-flap", brand: "Chanel", name: "Túi Classic Flap Archive", category: "Túi xách", size: "Small",
    color: "Đen", material: "Da quilted", grade: "C", condition: "Form mềm hơn ban đầu, cạnh có tối màu, khóa và dây vẫn hoạt động tốt.",
    status: "approved", sellerId: "u-seller", buyNow: 34400000, highestBid: 27800000, lowestAsk: 32600000, lastSale: 31200000, trend: 58,
    badges: ["Đã xác thực"], listedAt: "2026-03-08", pricingMode: "fixed_bid_ask", measurements: "23 x 14 x 6.5 cm", includedItems: "Túi bụi, hộp không đồng bộ", flaws: "Form mềm hơn ban đầu, cạnh tối màu.", sellerStrategy: "Sell Now nếu Bid trên 30 triệu",
    aiReview: { status: "Passed", score: 86, notes: ["Ảnh lỗi minh bạch", "Grade C hợp lý"] },
    adminReview: { status: "approved", gradeFinal: "C", note: "Duyệt với ghi chú hao mòn cạnh." },
    imageChecklist: { reference: true, overview: true, detail: true, label: true, material: true, flaw: true },
    image: PRODUCT_IMAGES.chanelFlap[0],
    gallery: PRODUCT_IMAGES.chanelFlap,
    imageSources: ["FASHIONPHILE product-standard", "FASHIONPHILE resale", "FASHIONPHILE resale", "FASHIONPHILE resale"]
  },
  {
    id: "celine-logo-hoodie", brand: "Celine", name: "Áo hoodie logo Celine", category: "Quần áo", size: "M",
    color: "Đen", material: "Cotton fleece", grade: "A", condition: "Phom áo còn đẹp, bề mặt vải có dấu hiệu sử dụng nhẹ.",
    status: "pending", sellerId: "u-seller", buyNow: 35800000, highestBid: 29500000, lowestAsk: 34000000, lastSale: 32600000, trend: 63,
    badges: ["Chờ duyệt"], listedAt: "2026-04-05", pricingMode: "fixed_bid_ask", measurements: "Vai 48 cm · Dài áo 68 cm", includedItems: "Túi bảo quản", flaws: "Vải có dấu hiệu dùng nhẹ.", sellerStrategy: "Hold",
    aiReview: { status: "Flagged", score: 72, notes: ["Cần ảnh nhãn mác rõ hơn", "Cần ảnh cận chất liệu"] },
    adminReview: { status: "pending", gradeFinal: "A", note: "Chờ quản trị viên kiểm tra." },
    imageChecklist: { reference: true, overview: true, detail: false, label: false, material: false, flaw: true },
    image: PRODUCT_IMAGES.celineHoodie[0],
    gallery: PRODUCT_IMAGES.celineHoodie,
    imageSources: ["Celine official", "Celine official", "Celine official", "Celine official"]
  }
];

const SEED_BIDS = [
  { id: "b-101", productId: "celine-triomphe-ava", userId: "u-buyer", buyer: "Minh Anh", amount: 40800000, status: "active", createdAt: "2026-04-02 10:20" },
  { id: "b-102", productId: "prada-re-nylon-jacket", userId: "u-buyer", buyer: "Minh Anh", amount: 26800000, status: "active", createdAt: "2026-04-03 16:40" },
  { id: "b-103", productId: "bottega-cassette", userId: "u-buyer", buyer: "Minh Anh", amount: 46800000, status: "matched", createdAt: "2026-04-04 09:12" }
];

const SEED_ASKS = [
  { id: "a-201", productId: "celine-triomphe-ava", sellerId: "u-seller", seller: "Maison Archive Saigon", amount: 43800000, status: "active", createdAt: "2026-04-01 11:00" },
  { id: "a-202", productId: "dior-b30-sneaker", sellerId: "u-seller", seller: "Maison Archive Saigon", amount: 17800000, status: "active", createdAt: "2026-03-28 14:30" },
  { id: "a-203", productId: "celine-logo-hoodie", sellerId: "u-seller", seller: "Maison Archive Saigon", amount: 34000000, status: "pending", createdAt: "2026-04-05 19:10" }
];

const SEED_ORDERS = [
  { id: "DH-9014", productId: "bottega-cassette", item: "Túi Padded Cassette", buyerId: "u-buyer", buyer: "Minh Anh", subtotal: 48600000, shippingFee: SHIPPING_FEE, total: 48950000, commissionRate: SELLER_COMMISSION_RATE, commissionFee: 5832000, sellerNet: 42768000, escrowStatus: "Tạm giữ", fulfillmentStatus: "Đang vận chuyển", status: "Đang vận chuyển", date: "2026-04-02", purchasedAt: "2026-04-02 14:36", method: "Thẻ ngân hàng" },
  { id: "DH-9015", productId: "dior-b30-sneaker", item: "Giày B30 Technical Sneaker", buyerId: "u-buyer", buyer: "Minh Anh", subtotal: 17100000, shippingFee: SHIPPING_FEE, total: 17450000, commissionRate: SELLER_COMMISSION_RATE, commissionFee: 2052000, sellerNet: 15048000, escrowStatus: "Đã giải ngân", fulfillmentStatus: "Hoàn tất", status: "Đã hoàn tất", date: "2026-03-29", purchasedAt: "2026-03-29 18:12", method: "Ví điện tử" }
];

const SEED_PROMOTIONS = [
  { id: "promo-1", sellerId: "u-seller", productId: "celine-triomphe-ava", name: "Đẩy bài 24h", model: "Gói cố định theo thời gian", cost: 290000, impressions: 12840, clicks: 412, orders: 1, status: "Đang chạy" },
  { id: "promo-2", sellerId: "u-seller", productId: "dior-b30-sneaker", name: "Ưu tiên đầu danh mục", model: "Trả theo lượt click", cost: 180000, impressions: 9320, clicks: 260, orders: 0, status: "Đã kết thúc" }
];

const SEED_WITHDRAWALS = [
  { id: "wd-1", sellerId: "u-seller", amount: 15048000, status: "Đã rút", date: "2026-04-01", bank: "VCB · **** 2046" }
];

const SEED_COMPLAINTS = [
  { id: "cp-1", orderId: "DH-9014", buyerId: "u-buyer", reason: "Cần kiểm tra thêm tình trạng góc túi", status: "Đang theo dõi 72h", evidence: "Ảnh buyer gửi trong demo", date: "2026-04-04" }
];
