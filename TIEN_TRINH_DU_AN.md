# 📋 TIẾN TRÌNH DỰ ÁN - SMART HOME APP

> **Cập nhật lần cuối:** 17/04/2026 — Session 7  
> **Trạng thái:** ✅ Đã thêm LSTM + CNN-LSTM training pipeline + Flask API hỗ trợ chuyển đổi model  
> **APK mới nhất:** `C:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\android\app\build\outputs\apk\release\app-release.apk` (~32.12 MB)

---

## 1. TỔNG QUAN DỰ ÁN

| Thông tin | Chi tiết |
|-----------|----------|
| **Tên app** | Smart Home - Điều khiển nhà thông minh |
| **Công nghệ** | React Native 0.83.2 + Expo SDK 55 + TypeScript |
| **Mô hình AI** | XGBoost (main) + RandomForest (baseline) + LSTM + CNN-LSTM (deep learning) |
| **Phần cứng** | PLC → cảm biến → thu thập dữ liệu → Python xử lý → Flask API → App |
| **Mục đích** | Đồ án tốt nghiệp - Hệ thống quản lý nhà thông minh tích hợp dự báo phụ tải |

---

## 2. CÁC MÀN HÌNH (5 TAB)

| Tab | Tên | Chức năng chính |
|-----|-----|-----------------|
| 1 | 🏠 Tổng quan | Dashboard: công suất real-time, ngày/giờ live, thao tác nhanh (tắt tất cả/chế độ đêm/vắng nhà), danh sách phòng (nhấn → mở chi tiết) |
| 2 | 💡 Phòng | Quản lý phòng & thiết bị: bật/tắt toggle, thêm thiết bị, cảnh nhanh (buổi sáng/đi làm/cuối tuần/ngủ), biểu đồ tiêu thụ |
| 3 | 📊 Phân tích | Biểu đồ phụ tải, dự báo, **cảnh báo bất thường**, **xuất PDF**, gợi ý tiết kiệm |
| 4 | 🔧 Quản lý | Admin: duyệt/từ chối tài khoản, xem activity logs (chỉ admin thấy) |
| 5 | ⚙️ Cài đặt | Thông tin cá nhân, thông báo toggle, **đổi mật khẩu**, WiFi info, PLC info, Cloud Sync toggle, đăng xuất |

---

## 3. TÍNH NĂNG ĐÃ HOÀN THÀNH

### ✅ Tính năng cốt lõi (từ đầu)
- [x] Đăng nhập / Đăng ký tài khoản
- [x] Admin duyệt / từ chối user
- [x] Dashboard hiển thị công suất real-time
- [x] Quản lý phòng (4 phòng: Phòng khách, Phòng ngủ, Nhà bếp, Garage)
- [x] Bật / tắt thiết bị, thêm thiết bị mới
- [x] Biểu đồ phụ tải (LineChart thực tế vs dự báo)
- [x] Biểu đồ phân bổ tiêu thụ theo phòng (PieChart)
- [x] Dự báo phụ tải với độ tin cậy (%)
- [x] Gợi ý tiết kiệm điện
- [x] Thông tin mô hình Random Forest
- [x] Lưu trữ dữ liệu bằng AsyncStorage

### ✅ Tính năng mới thêm (12/03/2026 — Session 2)
- [x] **Cảnh báo bất thường** - Phát hiện thiết bị tiêu thụ bất thường (rò rỉ điện, hư hỏng)
  - 3 mức độ: 🔴 Nghiêm trọng, 🟡 Cảnh báo, 🔵 Thông tin
  - Nhấn vào → Modal chi tiết: công suất hiện tại vs bình thường, % tăng, khuyến nghị xử lý
  - VD: Máy lạnh phòng ngủ +85%, Tủ lạnh chạy liên tục 48h, Dòng rò 15mA
- [x] **Xuất báo cáo PDF** - Báo cáo tiêu thụ điện hàng tháng
  - Nội dung: tổng kWh, chi phí, chi tiết theo phòng, bảng cảnh báo, dự báo tháng tới
  - Dùng `expo-print` + `expo-sharing` → tạo PDF → chia sẻ/lưu
- [x] **Cập nhật icons** - Bớt AI, thực tế hơn cho smart home

### ✅ Tính năng sửa/thêm (12/03/2026 — Session 3)
- [x] **Hiển thị ngày giờ live** trên Dashboard (thay nhiệt độ/độ ẩm)
  - Thứ + ngày/tháng/năm (DD/MM/YYYY) + giờ:phút:giây cập nhật mỗi giây
- [x] **Xóa nhiệt độ & độ ẩm** khỏi toàn app (không có cảm biến)
  - Xóa khỏi: Dashboard stats, Room detail stats, Room grid cards
- [x] **Rooms data động (CRITICAL FIX)** - `rooms` giờ là `useMemo()` tính từ `devices` state
  - TRƯỚC: `rooms = useState(defaultRooms)` → hardcoded, không cập nhật khi bật/tắt thiết bị
  - SAU: `rooms = useMemo(() => compute from devices)` → công suất, số thiết bị active luôn đúng
- [x] **14 nút chết đã fix:**
  - Dashboard: 🔔 Chuông → chuyển tab Phân tích, 🕐 Chế độ đêm → tắt đèn+quạt giữ ML, 🏠 Vắng nhà → tắt tất cả
  - Rooms: 4 cảnh nhanh (Buổi sáng/Đi làm/Cuối tuần/Ngủ) → `applyScene()` thật sự bật/tắt thiết bị
  - Settings: Thông tin cá nhân → popup, 🔔 Toggle thật, 🔒 Đổi mật khẩu modal, WiFi/PLC → info popup, Cloud toggle thật
- [x] **Navigation fix** - Dashboard → Room cards giờ navigate đúng (`'RoomList'` thay vì `'Phòng'`)
  - Nhấn thẻ phòng trên Dashboard → mở chi tiết phòng đó ngay
  - Thêm `useEffect` lắng nghe route params thay đổi
- [x] **Đổi mật khẩu** - Modal trong Settings: nhập MK cũ → MK mới → xác nhận → lưu AsyncStorage
- [x] **applyScene()** - Hàm mới trong DataContext điều khiển thiết bị theo cảnh:
  - morning: bật tất cả đèn
  - work: tắt tất cả
  - weekend: bật tất cả
  - sleep: tắt đèn+quạt, giữ ML

### ✅ Tính năng sửa/thêm (24/03/2026 — Session 4)
- [x] **Đổi logo app mới** đồng bộ toàn bộ nơi hiển thị chính
  - `app.json`: `icon`, `splash.image`, `android.adaptiveIcon.foregroundImage`, `android.adaptiveIcon.monochromeImage`
  - `app.json`: `web.favicon` cập nhật về `assets/favicon.png`
  - `LoginScreen`, `AppNavigator`, `ChatScreen` cập nhật dùng `assets/icon.png`
- [x] **Nới khung chat trong Chatbox**
  - Tăng chiều cao thanh nhập và ô nhập (`minInputToolbarHeight`, `minComposerHeight`, `minHeight`)
  - Điều chỉnh padding/spacing để nhập nhiều dòng thoải mái hơn
- [x] **Cải thiện nhập tiếng Việt có dấu trong ô chat (Android)**
  - Tắt auto-correct/spell-check để giảm xung đột với bộ gõ Telex/VNI
  - Giữ bàn phím mặc định, ô nhập multiline, canh nhập từ trên (`textAlignVertical: 'top'`)
- [x] **Build lại APK release sau khi cập nhật UI/chat**
  - Build thành công với Gradle (`BUILD SUCCESSFUL`)
  - APK mới: ~32.12 MB, timestamp: `24/03/2026 12:01:01 AM`
  - Ghi chú: Bản build hiện tại đang để `reactNativeArchitectures=x86_64` (nhẹ, ưu tiên emulator)

### ✅ Tính năng mới thêm (29/03/2026 — Session 5)
- [x] **Mốc tích hợp cũ đã được thay thế**
  - Phần tích hợp trung gian trước đây đã được gỡ khỏi hướng triển khai hiện tại
  - Kiến trúc đang chốt: PLC S7-1200 -> Smart Home Server API -> App
  - Chi tiết thay thế nằm ở Session 10 và Session 11 bên dưới

### ✅ Tính năng mới thêm (02/04/2026 — Session 6)
- [x] **Thêm pipeline train 24h forecast cho Google Colab**
  - Thư mục mới: `ml-training/forecast-24h-colab/`
  - Dataset khuyến nghị cho V1: **UCI Individual Household Electric Power Consumption**
  - Có sẵn:
    - `train_24h_forecast.py`
    - `requirements.txt`
    - `README.md`
    - `plc_schema_example.csv`
  - Train 2 model:
    - `RandomForest` baseline
    - `XGBoost` main model
  - Có đường vào cho dữ liệu PLC CSV sau này để thay dataset công khai

### ✅ Tính năng mới thêm (17/04/2026 — Session 7)
- [x] **Thêm LSTM + CNN-LSTM training pipeline cho Google Colab**
  - File mới: `ml-training/forecast-24h-colab/train_lstm_forecast.py`
  - Reuse data pipeline (UCI / local CSV) từ `train_24h_forecast.py`
  - LSTM: 2 lớp LSTM (64→32) + Dropout + Dense(24)
  - CNN-LSTM: Conv1D(64,k=7) + Conv1D(32,k=5) + MaxPool + LSTM(64) + Dense(24)
  - Sliding window: 168h input → 24h output
  - MinMaxScaler + EarlyStopping + ReduceLROnPlateau
  - Export: `.keras` model, scalers `.joblib`, metrics JSON, sample forecast JSON
- [x] **Thêm LSTM predictor cho Flask API**
  - File mới: `backend/forecast_api/lstm_predictor.py`
  - Load model Keras + scalers, predict từ history, sample forecast fallback
- [x] **Cập nhật Flask API hỗ trợ chuyển model**
  - Query param `?model=lstm` trên tất cả endpoints
  - Endpoint mới: `GET /forecast/model-compare` — so sánh metrics tất cả model
  - XGBoost vẫn là default, không break gì cả
  - Auto-detect LSTM artifacts khi khởi động
- [x] **Cập nhật requirements.txt** thêm `tensorflow>=2.15.0`
- [x] **Cập nhật README.md** thêm hướng dẫn LSTM pipeline

---

## 4. CẤU TRÚC CODE QUAN TRỌNG

```
src/
├── constants/
│   ├── colors.ts          # Bảng màu toàn app
│   └── data.ts            # Interfaces (Room, Device, User, ActivityLog) + dữ liệu mặc định
├── contexts/
│   ├── AuthContext.tsx     # Xác thực: login, register, approve, reject, changePassword, AsyncStorage
│   ├── DataContext.tsx     # Quản lý thiết bị: đọc Smart Home Server API, fallback local/cache
│   ├── SmartHomeServerContext.tsx # Lưu cấu hình Server API + Forecast API + PLC
│   └── ForecastContext.tsx # Forecast provider đọc API riêng / mock fallback
├── services/
│   ├── smartHome/          # Client REST API riêng + mapper device/power
│   └── forecast/           # FlaskForecastProvider, mock fallback
├── types/
│   ├── smartHomeServer.ts  # Kiểu dữ liệu Server API/device/power/config
│   └── forecast.ts         # Kiểu dữ liệu PredictionPoint/AnomalyAlert/Insight/ModelInfo
├── navigation/
│   └── AppNavigator.tsx   # Bottom tabs (5 tab) + Stack navigator (Login/Register)
└── screens/
    ├── LoginScreen.tsx     # Đăng nhập (SĐT + mật khẩu)
    ├── RegisterScreen.tsx  # Đăng ký (cần admin duyệt)
    ├── DashboardScreen.tsx # Tab 1 - Tổng quan + ngày/giờ live
    ├── RoomsScreen.tsx     # Tab 2 - Phòng & thiết bị + cảnh nhanh
    ├── AnalysisScreen.tsx  # Tab 3 - Phân tích, cảnh báo, PDF ⭐ FILE CHÍNH
    ├── AdminScreen.tsx     # Tab 4 - Quản lý (admin only)
    └── SettingsScreen.tsx  # Tab 5 - Cài đặt + đổi mật khẩu modal

ml-training/
├── forecast-24h-colab/
    ├── README.md              # Huong dan chay tren Google Colab
    ├── requirements.txt       # Thu vien Python cho Colab (+ tensorflow)
    ├── train_24h_forecast.py  # Script train XGBoost + RF
    ├── train_lstm_forecast.py # Script train LSTM + CNN-LSTM
    └── plc_schema_example.csv # Mau schema cho du lieu PLC thuc te
└── assistant-intent/
    ├── README.md                  # Huong dan fine-tune intent voi Unsloth
    ├── requirements.txt           # Thu vien Unsloth/TRL/Datasets
    ├── dataset.jsonl              # Dataset cau lenh tieng Viet -> JSON intent
    └── train_unsloth_intent.py    # Script train LoRA intent classifier

backend/forecast_api/
├── app.py              # Flask API — hỗ trợ chuyển XGBoost/LSTM qua ?model=
├── lstm_predictor.py   # Load + predict Keras LSTM/CNN-LSTM model
├── server.js           # Alternative Node.js server
└── requirements.txt    # Python dependencies (+ tensorflow)

backend/smart_home_server/
├── app.py              # Server API riêng đọc PLC/Mock + chat intent
├── assistant_intents.py # Rule parser tiếng Việt, thay được bằng model Unsloth sau này
├── config.json         # PLC IP, MD tag, device command/status tag
└── requirements.txt    # Flask + python-snap7
```

### Thay đổi quan trọng trong DataContext.tsx (Session 3)
```typescript
// TRƯỚC: rooms là state tĩnh — KHÔNG BAO GIỜ thay đổi khi bật/tắt thiết bị
const [rooms] = useState<Room[]>(defaultRooms); // ❌ hardcoded active:3, power:850

// SAU: rooms là computed — TỰ ĐỘNG cập nhật từ devices state
const rooms = useMemo(() => {
    return defaultRooms.map(baseRoom => {
        const roomDevices = devices[baseRoom.id] || [];
        const activeDevices = roomDevices.filter(d => d.isOn);
        return {
            id: baseRoom.id, name: baseRoom.name,
            devices: roomDevices.length,
            active: activeDevices.length,
            power: activeDevices.reduce((sum, d) => sum + d.power, 0),
        };
    });
}, [devices]); // ✅ recalculate mỗi khi devices thay đổi
```

### Tab names trong AppNavigator (QUAN TRỌNG cho navigation)
```
Dashboard, RoomList, Analysis, Admin, Settings
```
- Khi navigate từ code, dùng tên CHÍNH XÁC trên (VD: `navigation.navigate('RoomList')` KHÔNG PHẢI `'Phòng'`)

---

## 5. TÀI KHOẢN TEST

| Role | SĐT | Mật khẩu |
|------|------|----------|
| Admin | 0123456789 | admin123 |

---

## 6. CÁCH BUILD APK

### Yêu cầu
- Node.js + npm
- Android SDK (SDK 36)
- **JDK 17** (Temurin) - BẮT BUỘC, đã cài tại `C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot`
- JDK 25 cũng có nhưng KHÔNG dùng cho build

### Các bước build

```powershell
# 1. Di chuyển vào thư mục dự án (dùng junction path ngắn để tránh lỗi path >260 ký tự)
cd C:\sha

# 2. Cài dependencies (nếu chưa có node_modules)
npm install

# 3. Prebuild Android
npx expo prebuild --clean

# 4. QUAN TRỌNG: Set JAVA_HOME = JDK 17 trước khi build
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"

# 5. Build APK
cd android
.\gradlew assembleRelease

# 6. APK output tại:
# C:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\android\app\build\outputs\apk\release\app-release.apk
```

### Lưu ý quan trọng
- **Junction path:** `C:\sha` → `C:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app` (tránh lỗi Windows path >260 ký tự cho CMake/ninja)
- **JAVA_HOME phải là JDK 17** mỗi lần build. JDK 25 sẽ gây lỗi `IBM_SEMERU` với Gradle 9.0
- **Dung lượng APK giảm (~32 MB)** do đang build theo 1 ABI (`x86_64`) để test emulator; nếu cần cài điện thoại thật nên build thêm `arm64-v8a` hoặc universal
- Sau `expo prebuild --clean`, file `android/gradle.properties` cần có:
  ```
  org.gradle.java.installations.auto-download=false
  react.internal.disableJavaVersionAlignment=true
  ```
  (Đã thêm, nhưng prebuild có thể overwrite → kiểm tra lại)

---

## 7. CÁCH TEST TRÊN EMULATOR

```powershell
# 1. Mở emulator
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Start-Process "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd","Medium_Phone_API_36.1"

# 2. Cài APK lên emulator
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "C:\sha\android\app\build\outputs\apk\release\app-release.apk"

# 3. Mở app
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -n com.anonymous.smarthomeapp/.MainActivity
```

- Emulator: **Medium_Phone_API_36.1** (Android 36, x86_64)
- Kết quả test lần cuối: **0 crash, 0 JS error, 5/5 tab hoạt động**

---

## 8. CÁC LỖI ĐÃ GẶP & CÁCH FIX

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `FormData doesn't exist` | Polyfill chưa load | Thêm `import 'react-native/Libraries/Core/InitializeCore'` đầu `index.ts` |
| 2 | AsyncStorage Maven artifact missing | v3.0.1 cần local maven repo | Downgrade về `^2.1.2` trong package.json |
| 3 | Windows path >260 chars | CMake/ninja path quá dài | Tạo junction `C:\sha` trỏ tới thư mục dự án |
| 4 | `IBM_SEMERU` Gradle error | Gradle foojay-resolver + JDK 25 | Cài JDK 17, set JAVA_HOME, thêm properties |
| 5 | `Inconsistent JVM-target` | Gradle dùng JDK sai | Set `react.internal.disableJavaVersionAlignment=true` rồi dùng JDK 17 |
| 6 | Rooms data không cập nhật | `rooms = useState(hardcoded)` tĩnh | Đổi sang `useMemo()` tính từ `devices` state |
| 7 | 14 nút chết (không onPress) | Chưa implement handler | Thêm Alert, navigation, toggle, modal cho từng nút |
| 8 | Nhấn phòng trên Dashboard không hoạt động | Navigate sai tên (`'Phòng'` thay vì `'RoomList'`) | Đổi thành `navigation.navigate('RoomList', { roomId })` |
| 9 | Params không trigger re-render | RoomsScreen chỉ đọc params lần đầu | Thêm `useEffect` lắng nghe `route.params` thay đổi |

---

## 9. VIỆC CHƯA LÀM (TƯƠNG LAI)

### Backend thực tế
- [ ] Viết Python script thu thập dữ liệu từ PLC (2 phút/lần)
- [ ] Train model Random Forest với dữ liệu thật
- [ ] Tạo Flask API trả về dự báo + cảnh báo
- [ ] Kết nối app với Flask API (thay mock data)

### Kiến trúc dự kiến
```
PLC + Cảm biến → Text file → CSV → Python (Random Forest) → Flask API → React Native App
```

### Kiến trúc demo hiện tại
```
Home Assistant (local) → states/services/conversation → React Native App
                              └→ template sensors demo forecast
Flask API (tương lai) → ForecastProvider → AnalysisScreen
```

### Thu thập dữ liệu
- Tần suất: 2 phút/lần
- Thời gian: 10 giờ/ngày tại phòng thí nghiệm
- Cần tối thiểu: 5-10 ngày (3,000-6,000 mẫu)
- Mục tiêu: 15,000+ mẫu để đạt MAPE < 10%

---

## 10. DEPENDENCIES

```json
{
  "@react-native-async-storage/async-storage": "^2.1.2",
  "@react-navigation/bottom-tabs": "^7.15.5",
  "@react-navigation/native": "^7.1.33",
  "@react-navigation/native-stack": "^7.14.4",
  "expo": "~55.0.5",
  "expo-linear-gradient": "^55.0.8",
  "expo-print": "~14.2.1",
  "expo-sharing": "~13.2.2",
  "react": "19.2.0",
  "react-native": "0.83.2",
  "react-native-chart-kit": "^6.12.0",
  "react-native-safe-area-context": "^5.7.0",
  "react-native-screens": "^4.24.0",
  "react-native-svg": "^15.15.3"
}
```

---

*File này dùng để tham khảo nhanh khi mở dự án ở bất kỳ đâu. Cập nhật khi có thay đổi quan trọng.*

---

## LỊCH SỬ CẬP NHẬT

| Session | Ngày | Nội dung chính |
|---------|------|----------------|
| 1 | 12/03/2026 | Build APK lần đầu, fix FormData/AsyncStorage/path/JDK, test emulator |
| 2 | 12/03/2026 | Thêm cảnh báo bất thường + xuất PDF, update icons |
| 3 | 12/03/2026 | Thêm ngày/giờ live, xóa nhiệt độ/độ ẩm, fix 14 nút chết, rooms dynamic, navigation fix, đổi mật khẩu, applyScene |
| 4 | 24/03/2026 | Đổi logo app mới, nới chatbox, tối ưu nhập tiếng Việt có dấu, build lại APK release (~32.12 MB) |
| 5 | 29/03/2026 | Tích hợp Home Assistant local, thêm forecast provider, Chat/Analysis nối Home Assistant, thêm file rule demo |
| 6 | 02/04/2026 | Thêm folder train cho Google Colab, chọn UCI cho V1 24h forecast, thêm RandomForest + XGBoost pipeline |
| 7 | 17/04/2026 | Thêm LSTM + CNN-LSTM training pipeline, lstm_predictor backend, Flask API model switch ?model=lstm, endpoint /model-compare |
| 8 | 22/04/2026 | Cài Flutter SDK/Dart, tạo `flutter_app/` song song, port UI + logic HA/PLC/Forecast lần 1, analyze/test/build APK debug thành công |
## 0. CAP NHAT FLUTTER SONG SONG (22/04/2026 - Session 8)

### Trang thai moi
- [x] Da cai Flutter SDK 3.41.7 stable tai `C:\Users\ADMIN\development\flutter`
- [x] Dart di kem Flutter: 3.11.5
- [x] Da cai Android command-line tools vao Android SDK hien co
- [x] Da accept Android SDK licenses
- [x] `flutter doctor -v`: Android toolchain da san sang; Visual Studio desktop con thieu nhung khong anh huong build Android
- [x] Da tao project Flutter song song tai `flutter_app/`
- [x] Giu nguyen app React Native/Expo cu o thu muc goc, chua xoa/chua thay Android project cu
- [x] Da port lan 1 UI + logic chinh sang Flutter trong `flutter_app/lib/main.dart`
- [x] Da build thanh cong APK debug Flutter: `flutter_app/build/app/outputs/flutter-apk/app-debug.apk`

### Pham vi da port sang Flutter
- [x] Dang nhap / dang ky user
- [x] Tai khoan mau: Admin `0123456789` / `admin123`, User `0987654321` / `user123`
- [x] Bottom navigation: Tong quan, Phong, Phan tich, Chat, Quan ly admin, Cai dat
- [x] Dashboard tinh tong cong suat, so thiet bi dang bat, thao tac nhanh
- [x] Quan ly phong/thiet bi local: bat/tat, them, xoa, bat/tat tat ca trong phong
- [x] Canh nhanh: morning/work/weekend/sleep
- [x] Home Assistant REST service trong Flutter:
  - `GET /api/states`
  - `POST /api/services/<domain>/turn_on`
  - `POST /api/services/<domain>/turn_off`
  - `POST /api/conversation/process`
- [x] Cau hinh Home Assistant trong tab Cai dat: Base URL, long-lived token, Forecast API URL, model `xgboost` / `lstm`
- [x] Mapping PLC -> Home Assistant -> App duoc port vao Flutter
- [x] Analysis co rule fallback va co duong goi Forecast API
- [x] Chat text co local command fallback va uu tien HA conversation API neu da cau hinh
- [x] Admin duyet/tu choi/xoa user va xem activity logs
- [x] Android manifest Flutter da bat `INTERNET` va `usesCleartextTraffic="true"` de test HTTP noi bo voi Home Assistant

### Kiem tra da chay
```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\flutter_app
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

Ket qua:
- [x] `flutter pub get`: thanh cong
- [x] `flutter analyze`: No issues found
- [x] `flutter test`: All tests passed
- [x] `flutter build apk --debug`: build thanh cong

### Ghi chu ky thuat
- Flutter desktop targets Windows/Linux/macOS dang duoc tat tam thoi de tranh loi symlink khi Windows chua bat Developer Mode.
- Android/Web van dung binh thuong.
- Buoc tiep theo nen lam: test APK Flutter tren emulator/thiet bi that, kiem tra Home Assistant voi token that, tach `main.dart` thanh module nho, sau khi ban Flutter on dinh moi xoa Expo/RN va thay Android project that bang Flutter.

---

## 0.2. CHUYEN KIEN TRUC SANG SERVER RIENG, GO HOME ASSISTANT KHOI APP (18/05/2026 - Session 10)

### Trang thai moi
- [x] Da bo provider/context Home Assistant khoi `App.tsx`
- [x] Da them `SmartHomeServerProvider` lam cau hinh trung tam cho server/domain rieng
- [x] Da them `SmartHomeApiClient` goi REST API rieng
- [x] Da sua `DataContext` de doc `/api/devices` tu server rieng, fallback local khi server chua san sang
- [x] Da sua `ChatScreen` de goi `/api/assistant/chat` thay vi conversation API cu
- [x] Da sua `SettingsScreen` thanh cau hinh Server API rieng + Forecast API + PLC
- [x] Da sua `DashboardScreen` doc `/api/power/current` de hien thi cong suat/kWh that tu server
- [x] Da xoa cac file source Home Assistant cu trong `src/`
- [x] Da xoa file rule demo trong `home-assistant/`
- [x] Da tao backend server rieng tai `backend/smart_home_server/`

### Kien truc chot hien tai
```text
MFM384 -> RS485/Modbus RTU -> PLC S7-1200 CPU 1215C
PLC -> Ethernet -> Smart Home Server API
App -> REST API / domain server rieng
```

### Server API moi
Thu muc:
```text
backend/smart_home_server/
```

Endpoint:
```text
GET  /health
GET  /api/power/current
GET  /api/devices
POST /api/devices/<device_id>/turn-on
POST /api/devices/<device_id>/turn-off
POST /api/scenes/<scene>
POST /api/assistant/chat
```

### PLC tag cong suat dang cau hinh
```text
V1N       -> MD200
I1N       -> MD212
Total kW  -> MD224
Total kWh -> MD228
PLC IP tam thoi: 198.162.0.1
```

### Kiem tra da chay
```powershell
npx tsc --noEmit
python -m py_compile backend\smart_home_server\app.py
```

Ket qua:
- [x] TypeScript pass
- [x] Smart Home Server API mock endpoints pass

---

## 0.3. THEM HUONG UNSLOTH CHO CHAT INTENT TIENG VIET (18/05/2026 - Session 11)

### Muc tieu
- Dung Unsloth de fine-tune model nho hieu cau lenh tieng Viet
- Output cua AI la JSON intent, de server dieu khien thiet bi/doc cong suat an toan hon
- Giai doan dau van dung rule parser local de app co the demo ngay, sau do thay bang model LoRA/LLM inference

### Da them
- [x] `backend/smart_home_server/assistant_intents.py`
- [x] `POST /api/assistant/chat` tra them field `intent`
- [x] `ml-training/assistant-intent/dataset.jsonl` voi 80 cau lenh mau tieng Viet
- [x] `ml-training/assistant-intent/train_unsloth_intent.py`
- [x] `ml-training/assistant-intent/README.md`
- [x] `ml-training/assistant-intent/requirements.txt`

### Intent dang ho tro
```text
get_power_current
turn_on_device
turn_off_device
turn_on_all
turn_off_all
set_filtered_devices
apply_scene
list_devices
get_forecast
unknown
```

### Kiem tra da chay
```powershell
python -m py_compile backend\smart_home_server\app.py backend\smart_home_server\assistant_intents.py ml-training\assistant-intent\train_unsloth_intent.py
```

Test chat intent mau:
- "Cong suat hien tai bao nhieu?" -> `get_power_current`
- "Bat den phong khach" -> `turn_on_device`
- "Tat tat ca thiet bi" -> `turn_off_all`
- "Tat tat ca den phong khach" -> `set_filtered_devices`
- "Du bao phu tai 24 gio toi" -> `get_forecast`

---

## 0.4. VIEC CHUA LAM / GHI NHO DE LAM SAU

### Chatbot gioi thieu du an
- [x] Lam website local `project-site/` de giai thich do an cho nguoi xem
- [x] Them chatbot FAQ/retrieval local tren website
- [x] Chatbot chi hoi dap ve du an, khong dieu khien PLC that
- [x] Khong dua noi dung "vi sao bo Home Assistant" vao chatbot gioi thieu
- [x] Chuan bi bo cau hoi/tra loi ban dau ve:
  - Du an nay lam gi
  - PLC S7-1200 CPU 1215C co vai tro gi
  - MFM384 do thong so nao
  - Du lieu di tu MFM384 -> RS485/Modbus RTU -> PLC -> Server -> App nhu the nao
  - App hien thi dien ap, dong dien, cong suat, kWh o dau
  - AI du bao phu tai hoat dong nhu the nao
  - Unsloth/AI Assistant dung de ho tro hoi dap du an nhu the nao
  - Huong phat trien sau nay
- [x] Uu tien huong FAQ/RAG doc tai lieu du an truoc, chua can fine-tune Unsloth ngay
- [ ] Sau khi FAQ/RAG on dinh moi tinh den fine-tune bang Unsloth neu can

### Website local gioi thieu du an
- [x] File mo web: `project-site/index.html`
- [x] File sua noi dung/chatbot: `project-site/knowledge.js`
- [x] File giao dien: `project-site/styles.css`
- [x] File logic chatbot: `project-site/app.js`
- [x] Huong dan sua nhanh: `project-site/README.md`

### Giong noi tieng Viet
- [ ] Them nut micro trong app/chat
- [ ] Dung Speech-to-Text tieng Viet de chuyen giong noi thanh text
- [ ] Gui text sau khi nhan giong noi vao `/api/assistant/chat`
- [ ] Test cac cau lenh tieng Viet co dau va khong dau

### Server/domain rieng
- [ ] Khi co ten mien rieng, tro domain ve server API
- [ ] Cau hinh HTTPS neu dua ra internet
- [ ] Khong expose PLC truc tiep len internet
- [ ] Neu chay that 24/7, dung laptop/mini PC/Raspberry Pi lam gateway noi PLC va server

### PLC va du lieu dien nang
- [ ] Xac nhan lai IP PLC that, tam thoi dang de `198.162.0.1`
- [ ] Xac nhan cac MD tag:
  - V1N -> MD200
  - I1N -> MD212
  - Total kW -> MD224
  - Total kWh -> MD228
- [ ] Khi co PLC that, doi `mode` trong `backend/smart_home_server/config.json` tu `mock` sang `plc-real`
- [ ] Test doc `/api/power/current` voi PLC that

### APK / App
- [ ] Cai APK tren dien thoai Android that
- [ ] Trong app, cau hinh Server API URL theo IP may chay Flask, vi du `http://172.16.50.18:5001`
- [ ] Test dien thoai va laptop cung WiFi
- [ ] Test dashboard doc cong suat, rooms bat/tat, chat intent

---

## 0.1. DONG GOI SOURCE CONTEXT CHO GPT WEB (25/04/2026 - Session 9)

### Trang thai moi
- [x] Da doc link ChatGPT share `https://chatgpt.com/share/69b0db1f-7b58-8013-a1ef-16c8d149f512`
- [x] Da tom tat chu de nghien cuu tu link: he thong dien thong minh, du bao phu tai, AI/LSTM, PLC/SCADA, nha thong minh
- [x] Da tong hop trang thai app Smart Home hien tai tu source va tai lieu repo
- [x] Da tao file source context cho GPT web: `SMART_HOME_APP_SOURCE_FOR_GPT.txt`
- [x] Da ghi ro luu y: tai lieu tien trinh co nhac `flutter_app/`, nhung workspace hien tai ngay 25/04/2026 chua thay thu muc nay; can xac minh lai truoc khi tiep tuc Flutter migration

### File co the dua cho GPT web doc
- `SMART_HOME_APP_SOURCE_FOR_GPT.txt`

### Noi dung chinh trong file
- Tong quan tu link nghien cuu
- Trang thai app React Native/Expo hien tai
- Home Assistant hub + conversation API
- PLC/Home Assistant/App mapping
- Forecast API va ML pipeline
- Chat/voice command
- Build/test RN APK
- Huong Flutter song song va roadmap tiep theo

---
