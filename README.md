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
| `nlp.js` | Hiểu mô tả tiếng Việt bằng luật kinh nghiệm (offline) |
| `app.js` | Điều khiển giao diện, bảng thiết bị / đấu dây |

### Mô hình sơ đồ

Mỗi mạch là danh sách `sections`; mỗi section có `poles` (ví dụ `["L1","L2","L3"]` hoặc `["L"]`) và `net` là mảng phần tử **nối tiếp**. Nhánh **song song** viết `{ "par": [nhánh1, nhánh2] }`. Ví dụ mạch tự giữ:

```js
[{ t: 'nc', act: 'push', tag: 'S0' },
 { par: [[{ t: 'no', act: 'push', tag: 'S1' }], [{ t: 'no', tag: 'K1' }]] },
 { t: 'coil', tag: 'K1' }]
```

Thêm mạch mới: thêm một mục vào mảng `TPL` trong `templates.js` (gồm `params` và hàm `build(p)` trả về `sections`, `devices`, `calcs`, `steps`, `notes`).

## Chế độ "Mô tả bằng lời" — chạy offline, không cần AI

`nlp.js` hiểu câu mô tả tiếng Việt (có dấu hoặc không dấu) bằng luật kinh nghiệm thiết kế và tự ghép sơ đồ:

| Nhận ra | Ví dụ từ khoá |
|---|---|
| Loại mạch | bơm, quạt, băng tải, cầu trục, tủ phân phối / tủ tổng, ATS / máy phát, chiếu sáng, ổ cắm, cầu thang, PLC |
| Cách khởi động | trực tiếp, sao tam giác, biến tần, đảo chiều / thuận nghịch / lên xuống |
| Điều khiển tự động | phao / mực nước, áp suất / tăng áp, nhiệt độ, hẹn giờ, cảm biến, PLC/BMS, tay/tự động |
| Tính năng | dừng khẩn, còi báo trước N giây, 2–3 cấp tốc độ, chạy 1 chiều |
| Thông số | kW, HP, kVA, V, kA, chiều dài cáp (m), số lộ, số mạch đèn, số cảm biến, PNP/NPN… |

Ví dụ: *“Bơm nước 5,5 kW chế độ tay/tự động theo phao, có dừng khẩn, cáp dài 60 m”*. App báo lại phần đã hiểu và phần dùng giá trị mặc định.

Khi mở trên claude.ai còn có thêm nút *Nhờ AI thiết kế* cho các mạch không có sẵn mẫu (tuỳ chọn).

## Cài lên iPhone / Android

App là PWA: mở bằng Safari → nút Chia sẻ → **Thêm vào MH chính**. Sau lần mở đầu tiên app chạy được cả khi không có mạng.
