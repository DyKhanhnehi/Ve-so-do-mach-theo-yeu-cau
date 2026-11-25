# Xưởng Vẽ Mạch

Web app vẽ sơ đồ mạch điện theo ký hiệu IEC 60617, tự sinh **bảng đấu dây theo số dây**, **hướng dẫn lắp & chạy thử**, **tính chọn thiết bị** và **gợi ý dòng sản phẩm theo hãng** (Schneider, LS Electric, ABB, Siemens, Mitsubishi, Omron).

Chạy hoàn toàn trên trình duyệt — không cần cài đặt, không cần server, không cần internet (trừ font Google).

## Chạy thử

Mở `index.html` bằng trình duyệt, hoặc chạy một server tĩnh:

```bash
python -m http.server 8000
# mở http://localhost:8000
```

## Mạch mẫu

| Nhóm | Mạch |
|---|---|
| Động cơ | Khởi động trực tiếp (DOL), đảo chiều, sao–tam giác, biến tần |
| Phân phối | Tủ phân phối hạ thế (MCCB/ACB, đồng hồ, SPD), ATS lưới ↔ máy phát |
| Chiếu sáng | Tủ đèn + ổ cắm (RCBO 30 mA), đèn cầu thang 2 vị trí, chiếu sáng tự động (timer + cảm biến ánh sáng) |
| PLC | Đấu nối ngõ vào (nút nhấn, cảm biến PNP/NPN) và ngõ ra rơ-le |

## Tính toán

- Dòng định mức động cơ `In = P / (√3·U·cosφ·η)`, cosφ/η tự chọn theo công suất
- CB ≥ 1,25·In, chọn MCB/MCCB/ACB theo dòng và Icu theo dòng ngắn mạch
- Contactor AC-3, dải rơ-le nhiệt, sao–tam giác (0,58·In / 0,33·In)
- Tiết diện cáp đồng theo IEC 60364-5-52 (phương pháp C, 30 °C) × hệ số hiệu chỉnh, kiểm tra sụt áp

> Kết quả chỉ để tham khảo nhanh. Kỹ sư có chuyên môn phải kiểm tra lại theo TCVN/IEC và catalogue của hãng trước khi thi công. Tên dòng sản phẩm là gợi ý ở mức dòng (series), không phải mã đặt hàng.

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Giao diện, CSS |
| `engine.js` | Bộ vẽ ký hiệu IEC, bố cục nối tiếp/song song, đánh số dây (union-find), xuất SVG |
| `templates.js` | Tính toán, danh mục hãng, 10 mạch mẫu |
| `compose.js` | Ghép mạch tự do (dân dụng + điều khiển) từ mô tả |
| `nlp.js` | Hiểu mô tả tiếng Việt, chọn mạch mẫu hoặc ghép tự do |
| `sim.js` | Mô phỏng chạy thử mạch |
| `app.js` | Điều khiển giao diện, bảng thiết bị / đấu dây, chạy thử |

### Mô hình sơ đồ

Mỗi mạch là danh sách `sections`; mỗi section có `poles` (ví dụ `["L1","L2","L3"]` hoặc `["L"]`) và `net` là mảng phần tử **nối tiếp**. Nhánh **song song** viết `{ "par": [nhánh1, nhánh2] }`. Ví dụ mạch tự giữ:

```js
[{ t: 'nc', act: 'push', tag: 'S0' },
 { par: [[{ t: 'no', act: 'push', tag: 'S1' }], [{ t: 'no', tag: 'K1' }]] },
 { t: 'coil', tag: 'K1' }]
```

Thêm mạch mới: thêm một mục vào mảng `TPL` trong `templates.js` (gồm `params` và hàm `build(p)` trả về `sections`, `devices`, `calcs`, `steps`, `notes`).

## Chạy thử mạch (mô phỏng)

Bấm **▶ Chạy thử** trên thanh công cụ của bản vẽ:

- Bấm trực tiếp lên nút nhấn, công tắc, công tắc xoay, cảm biến, phao, CB… trên bản vẽ hoặc ở bảng *Thao tác*. Nút nhấn: giữ để nhấn, thả là nhả.
- Dây có điện sáng **xanh lá**; tiếp điểm vẽ đúng trạng thái đóng/mở; cuộn hút, đèn, còi, van… được tô sáng; động cơ quay.
- Mô phỏng tự giữ, khoá chéo, rơ-le thời gian (đếm ngược, tua nhanh 10×/60×), rơ-le nhiệt (nút *gây quá tải*), rơ-le xung, công tắc 2 chiều, dừng khẩn, cắt CB, mất nguồn lưới/máy phát (ATS), lệnh chạy biến tần.
- *Nhật ký* ghi lại từng sự kiện (nhấn nút, cuộn hút, timer hết giờ, tải bật/tắt) để đối chiếu với yêu cầu.

`sim.js` duyệt cây nối tiếp/song song: tính phía có điện từ thanh trên và phía thông về thanh dưới, cập nhật cuộn hút → tiếp điểm và lặp tới khi ổn định.

## Chế độ "Mô tả bằng lời" — chạy offline, không cần AI

Có 2 cách hiểu:

1. **Ghép mạch tự do** (`compose.js`) — cho mạch dân dụng và mạch điều khiển bất kỳ: đọc từng vế câu, nhận ra *tải* (đèn, ổ cắm, quạt, bơm 1 pha, bình nóng lạnh/bếp, điều hòa, chuông/còi, van điện từ, khoá điện, đèn báo, đèn cảnh báo, contactor băng tải), *điều kiện* (công tắc, công tắc 2 chiều, nút nhấn, nút dừng, cảm biến, chuyển động, ánh sáng, công tắc cửa, khói/gas, phao, nhiệt độ, áp suất, hẹn giờ, hành trình, dimmer) và *logic* (khi … thì bật/tắt, đồng thời/hoặc, sau N giây, sáng N phút rồi tắt, bật/tắt nhiều nơi bằng rơ-le xung, dừng khẩn). Mỗi vế thành một nhánh có bảo vệ riêng (MCB/RCBO theo loại tải). Chỉ vẽ phần động lực khi có động cơ kèm kW.
2. **Mạch mẫu có tính toán** (`nlp.js`) — động cơ (trực tiếp, đảo chiều, sao–tam giác, biến tần), tủ phân phối, ATS, PLC.


`nlp.js` hiểu câu mô tả tiếng Việt (có dấu hoặc không dấu) bằng luật kinh nghiệm thiết kế và tự ghép sơ đồ:

| Nhận ra | Ví dụ từ khoá |
|---|---|
| Loại mạch | bơm, quạt, băng tải, cầu trục, tủ phân phối / tủ tổng, ATS / máy phát, chiếu sáng, ổ cắm, cầu thang, PLC |
| Cách khởi động | trực tiếp, sao tam giác, biến tần, đảo chiều / thuận nghịch / lên xuống |
| Điều khiển tự động | phao / mực nước, áp suất / tăng áp, nhiệt độ, hẹn giờ, cảm biến, PLC/BMS, tay/tự động |
| Điều kiện chạy / dừng | “khi … thì chạy”, “khi … thì dừng”, “chạy 30 phút rồi dừng” — với cảm biến, công tắc hành trình, phao (thấp/đầy), áp suất, nhiệt độ, thời gian |
| Tính năng | dừng khẩn, còi báo trước N giây, 2–3 cấp tốc độ, chạy 1 chiều, hành trình 2 đầu cho đảo chiều |
| Thông số | kW, HP, kVA, V, kA, chiều dài cáp (m), số lộ, số mạch đèn, số cảm biến, PNP/NPN… |

Ví dụ: *“Băng tải có cảm biến, chạy khi chạm cảm biến thì dừng”* → nút Chạy tự giữ, tiếp điểm NC của cảm biến nối tiếp để dừng. *“Bơm 4 kW khi mực nước thấp thì chạy, đầy thì dừng”* → TAY/TỰ ĐỘNG theo rơ-le mực nước 2 mức. App báo lại phần đã hiểu và phần dùng giá trị mặc định.

Khi mở trên claude.ai còn có thêm nút *Nhờ AI thiết kế* cho các mạch không có sẵn mẫu (tuỳ chọn).

## Cài lên iPhone / Android

App là PWA: mở bằng Safari → nút Chia sẻ → **Thêm vào MH chính**. Sau lần mở đầu tiên app chạy được cả khi không có mạng.
