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
| `app.js` | Điều khiển giao diện, bảng thiết bị / đấu dây, chế độ AI |

### Mô hình sơ đồ

Mỗi mạch là danh sách `sections`; mỗi section có `poles` (ví dụ `["L1","L2","L3"]` hoặc `["L"]`) và `net` là mảng phần tử **nối tiếp**. Nhánh **song song** viết `{ "par": [nhánh1, nhánh2] }`. Ví dụ mạch tự giữ:

```js
[{ t: 'nc', act: 'push', tag: 'S0' },
 { par: [[{ t: 'no', act: 'push', tag: 'S1' }], [{ t: 'no', tag: 'K1' }]] },
 { t: 'coil', tag: 'K1' }]
```

Thêm mạch mới: thêm một mục vào mảng `TPL` trong `templates.js` (gồm `params` và hàm `build(p)` trả về `sections`, `devices`, `calcs`, `steps`, `notes`).

## Chế độ "Mô tả bằng lời"

Khi chạy trên claude.ai, app gọi Claude để chọn mạch mẫu phù hợp hoặc tự thiết kế sơ đồ theo cùng mô hình JSON. Chạy ngoài claude.ai thì phần này tắt, mọi chức năng khác vẫn hoạt động. Có thể thay hàm gọi AI trong `app.js` (`runAI`) bằng API nội bộ khác.
