window.PROJECT_KNOWLEDGE = {
  project: {
    name: "Smart Home AI",
    subtitle: "Giám sát điện năng và điều khiển nhà thông minh dùng PLC S7-1200",
    summary:
      "Đồ án xây dựng hệ thống đọc dữ liệu điện năng từ MFM384, truyền về PLC Siemens S7-1200 CPU 1215C, đưa dữ liệu lên Smart Home Server API và hiển thị trên app/web.",
  },
  metrics: [
    { label: "Điện áp", value: "V1N", note: "PLC tag MD200" },
    { label: "Dòng điện", value: "I1N", note: "PLC tag MD212" },
    { label: "Công suất", value: "Total kW", note: "PLC tag MD224" },
    { label: "Điện năng", value: "Total kWh", note: "PLC tag MD228" },
  ],
  workflow: [
    {
      title: "Thiết bị đo MFM384",
      text: "Đo điện áp, dòng điện, công suất và kWh của hệ thống điện dân dụng.",
    },
    {
      title: "RS485 / Modbus RTU",
      text: "MFM384 truyền dữ liệu đo về PLC qua RS485 theo giao thức Modbus RTU.",
    },
    {
      title: "PLC S7-1200 CPU 1215C",
      text: "PLC nhận dữ liệu, lưu vào vùng tag/MD và xử lý logic điều khiển thiết bị.",
    },
    {
      title: "Smart Home Server API",
      text: "Backend Flask cung cấp REST API cho app đọc công suất, trạng thái thiết bị và gửi lệnh điều khiển.",
    },
    {
      title: "App và website",
      text: "App hiển thị dashboard, phòng/thiết bị, phân tích phụ tải và chatbot; website giới thiệu kiến trúc đồ án.",
    },
  ],
  faq: [
    {
      question: "Dự án này làm gì?",
      answer:
        "Dự án giám sát điện năng và hỗ trợ điều khiển nhà thông minh. Dữ liệu được đo bằng MFM384, đưa về PLC S7-1200, sau đó server đọc và hiển thị lên app/web.",
      keywords: ["du an", "lam gi", "gioi thieu", "muc tieu", "smart home"],
    },
    {
      question: "Hệ thống gồm những thành phần nào?",
      answer:
        "Hệ thống gồm thiết bị đo điện MFM384, PLC Siemens S7-1200 CPU 1215C, đường truyền RS485/Modbus RTU, Smart Home Server API, app Android và website giới thiệu.",
      keywords: ["thanh phan", "he thong", "kien truc", "phan cung"],
    },
    {
      question: "PLC S7-1200 có vai trò gì?",
      answer:
        "PLC là bộ điều khiển trung tâm ở tầng thiết bị. PLC nhận dữ liệu từ MFM384, lưu vào tag/MD, xử lý logic và cung cấp dữ liệu để server đọc qua Ethernet.",
      keywords: ["plc", "s7", "1200", "1215", "siemens"],
    },
    {
      question: "MFM384 đo thông số nào?",
      answer:
        "Bản demo tập trung vào 4 thông số chính: V1N, I1N, Total kW và Total kWh, tương ứng với điện áp, dòng điện, công suất và điện năng tiêu thụ.",
      keywords: ["mfm384", "dien ap", "dong dien", "cong suat", "kwh"],
    },
    {
      question: "Dữ liệu đi từ MFM384 về app như thế nào?",
      answer:
        "Luồng dữ liệu là MFM384 -> RS485/Modbus RTU -> PLC -> Ethernet -> Smart Home Server API -> app Android và website.",
      keywords: ["du lieu", "rs485", "modbus", "api", "app", "workflow"],
    },
    {
      question: "Server API có nhiệm vụ gì?",
      answer:
        "Server API là lớp trung gian giữa PLC và app/web. Nó trả về endpoint như /api/power/current, /api/devices và nhận lệnh điều khiển thiết bị khi cần.",
      keywords: ["server", "api", "backend", "endpoint", "flask"],
    },
    {
      question: "Cloudflare Tunnel dùng để làm gì?",
      answer:
        "Cloudflare Tunnel giúp public API từ laptop ra domain https://api.smarthomeai.id.vn mà không cần VPS. Laptop vẫn cần bật và có mạng để API hoạt động.",
      keywords: ["cloudflare", "tunnel", "domain", "api", "vps"],
    },
    {
      question: "AI dự báo phụ tải hoạt động ra sao?",
      answer:
        "AI dùng dữ liệu lịch sử điện năng để dự đoán xu hướng tiêu thụ trong các giờ tiếp theo. Dự án đã chuẩn bị pipeline XGBoost, RandomForest, LSTM và CNN-LSTM.",
      keywords: ["ai", "du bao", "phu tai", "xgboost", "randomforest", "lstm"],
    },
  ],
};
