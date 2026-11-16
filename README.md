# GKI – Trung tâm đào tạo CNTT vận hành bởi đội ngũ AI

Văn phòng isometric (tầng 9) nơi đội ngũ AI (CrewAI) của một trung tâm đào tạo CNTT làm việc thật cho khách hàng.
Mọi chuyển động trong văn phòng phản ánh tiến độ thật của các agent.

**Loại nhiệm vụ** (chọn khi giao việc):

| Loại | Ai làm | Kết quả |
|---|---|---|
| Thiết kế khoá học | các thành viên được chọn → Giám đốc đào tạo | Đề cương khoá học |
| Tư vấn lộ trình | các thành viên được chọn → Giám đốc đào tạo | Lộ trình học tập cá nhân |
| Buổi dạy | giảng viên đứng bục giảng, trợ lý ngồi cuối lớp, học viên (mặc suit) từ lối vào vào lớp → Giám đốc duyệt | Giáo án buổi học |

**Đội ngũ**: thêm / xoá nhân viên, đổi tên, vai trò (thiết kế chương trình, giảng viên, tư vấn, khảo thí, trợ giảng, tuyển sinh),
tuỳ chỉnh ngoại hình (màu da, kiểu & màu tóc, trang phục, phụ kiện). Mỗi người có **bàn mặc định** và **bàn làm việc**:
bật “Chế độ làm việc” (hoặc khi đang tham gia nhiệm vụ) thì chuyển sang bàn làm việc.
Nhân viên mới tham gia đội AI theo vai trò của mình.

> ⚠️ Tài liệu do AI soạn, chỉ mang tính tham khảo – cần người có chuyên môn rà soát trước khi sử dụng.

## Xem thử trên GitHub Pages

**(https://tinnguyentcb.github.io/gki-office/)**

GitHub Pages chỉ chạy được phần giao diện, nên bản này là **bản xem thử**: có đủ văn phòng, màn chào, Đơn cam kết,
sắp xếp nội thất, hồ sơ nhân viên; nút “Giao việc” chạy **mô phỏng** với nội dung ví dụ (không gọi AI).

## Chạy đầy đủ trên máy (có AI thật)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Tạo file `.env` (không bao giờ đưa file này lên GitHub):

```
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Chạy rồi mở http://localhost:8000 :

```powershell
uvicorn main:app --reload --port 8000
```

## Phát hành bản mới

Trước khi push, **tăng `APP_VERSION`** ở đầu `index.html` (vd. `2026.11.09-4` → `2026.11.09-5`).
GitHub Pages cho trình duyệt giữ file 10 phút; số phiên bản buộc trình duyệt tải lại toàn bộ CSS/JS mới
thay vì trộn file cũ với file mới.

## Cấu trúc

| File | Vai trò |
|---|---|
| `main.py` | Backend FastAPI + CrewAI (đội ngũ động theo vai trò), phát trạng thái qua WebSocket |
| `static/js/roles.js` | Vai trò, loại nhiệm vụ, mô tả công việc (3 ngôn ngữ) |
| `static/js/team.js` | Hồ sơ nhân viên: tên, vai trò, ngoại hình, bàn mặc định / bàn làm việc |
| `static/js/sim.js` | Mô phỏng: đi lại, làm việc, giải lao, bàn giao, buổi dạy & học viên |
| `static/js/characters.js` | Nhân vật pixel 8 hướng, ngoại hình tuỳ chỉnh |
| `static/js/furniture.js` | Nội thất dựng khối 3D, xoay được (bục giảng, tủ lạnh mini, lò vi sóng…) |
| `static/js/floorplan.js` | Mặt bằng chữ L tầng 9: phòng, vách, cửa |
| `static/js/pathfinding.js` | Tìm đường A* né đồ đạc |
| `static/js/dialogue.js` | Lời thoại theo vai trò |
| `static/js/onboarding.js` | Màn chào + Đơn cam kết (ký tên, đóng mộc) |
| `static/js/demo.js` | Chế độ mô phỏng không tốn API |
