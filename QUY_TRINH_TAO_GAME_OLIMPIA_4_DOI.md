# 🏆 QUY TRÌNH ĐÓNG GÓI TOÀN DIỆN (SOP 10 BƯỚC) — TỪ KHỞI TẠO GAME ĐẾN PUBLISH LÊN GITHUB PAGES & VERCEL

> **Mục tiêu**: Quy trình chuẩn hóa từng bước (kèm lệnh thực thi sẵn sàng copy-paste) từ lúc **khởi tạo thư mục dự án ➔ tạo tài nguyên ➔ lập trình game ➔ kiểm thử 4 Agent ➔ đẩy code lên GitHub ➔ Publish tự động lên GitHub Pages & Vercel ➔ Gắn link Public vào Mã QR cho học sinh quét chơi trên điện thoại**.

---

## 🗺️ SƠ ĐỒ PIPELINE TỪ TẠO GAME ĐẾN PUBLISH ONLINE (10 BƯỚC)

```text
[Bước 1] Khởi tạo cấu trúc thư mục dự án chuẩn (index.html + assets/ + vercel.json)
   │
   ▼
[Bước 2] Chuẩn hóa bảng kiến thức bài học & Tạo bộ ảnh/âm thanh trong assets/
   │
   ▼
[Bước 3] Ghép nội dung vào Khung Game Chuẩn (Sảnh chờ 3 chốt + Kéo thả 4 chặng + 10 điểm/câu)
   │
   ▼
[Bước 4] Chạy Server Local (port 8686) & Kiểm thử tự động 4 Agent bằng Playwright (0 lỗi Console)
   │
   ▼
[Bước 5] Cấu hình Link Public cho Mã QR (getRoomShareUrl trỏ về domain Vercel / GitHub Pages)
   │
   ▼
[Bước 6] Khởi tạo Git & Đẩy mã nguồn lên GitHub Repository (git init ➔ commit ➔ push)
   │
   ▼
[Bước 7] Kích hoạt & Publish lên GitHub Pages (https://<user>.github.io/<repo>/)
   │
   ▼
[Bước 8] Liên kết GitHub & Publish lên Vercel (https://<project>.vercel.app)
   │
   ▼
[Bước 9] Kiểm tra đồng bộ WebRTC P2P giữa Máy Cô Giáo & 4 Điện Thoại qua Link Online
   │
   ▼
[Bước 10] Quy trình Cập nhật (Update) chỉ bằng 1 lệnh khi sửa câu hỏi/giao diện
```

---

## 🛠️ CHI TIẾT TỪNG BƯỚC THỰC HIỆN (KÈM LỆNH CHUẨN)

### BƯỚC 1: Khởi Tạo Cấu Trúc Thư Mục Dự Án Chuẩn
Tạo 1 thư mục dự án gọn nhẹ (Static Web App thuần HTML/CSS/JS để tương thích 100% với cả **Vercel** và **GitHub Pages** mà không cần bước build phức tạp):

```powershell
# Tạo thư mục dự án
mkdir ten-game-olimpia
cd ten-game-olimpia
mkdir assets
```

Cấu trúc chuẩn của thư mục:
```text
ten-game-olimpia/
├── index.html                      # Toàn bộ giao diện, logic kéo-thả, P2P WebRTC & bảng xếp hạng
├── vercel.json                     # Cấu hình cache & header tối ưu cho Vercel
└── assets/                         # Toàn bộ hình ảnh & âm thanh của game
    ├── mountain_climb_map_bg.png   # Bản đồ leo núi Olimpia sạch chữ tĩnh
    ├── student_team1_red.jpg       # Avatar Đội 1 (Đỏ)
    ├── student_team2_green.jpg     # Avatar Đội 2 (Xanh lá)
    ├── student_team3_blue.jpg      # Avatar Đội 3 (Xanh dương)
    ├── student_team4_yellow.jpg    # Avatar Đội 4 (Vàng)
    └── voice_*.mp3                 # Các file giọng đọc MC & hiệu ứng
```

Tạo sẵn file `vercel.json` ở thư mục gốc để Vercel phục vụ trang tĩnh siêu tốc:
```json
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false
}
```

---

### BƯỚC 2: Chuẩn Hóa Dữ Liệu Câu Hỏi & Tài Nguyên Đồ Họa
1. **Dữ liệu câu hỏi (`CORE_HISTORY_ROWS` trong `index.html`)**:
   - Nhập 3 dòng kiến thức 2 cột (`evidence` ↔ `role` + `keywords`).
   - Hệ thống tự động sinh đủ 4 chặng:
     - **Chặng 1 (Khởi Động)**: Cho *Dẫn chứng*, kéo thả 1 trong 3 đáp án ngang `A, B, C` (*Ý nghĩa*).
     - **Chặng 2 (Vượt Chướng Ngại Vật)**: Cho *Ý nghĩa*, kéo thả 1 trong 3 đáp án ngang `A, B, C` (*Dẫn chứng*).
     - **Chặng 3 (Tăng Tốc)**: Điền cặp từ khóa khuyết `(1) - (2)`, kéo thả 1 trong 3 đáp án ngang `A, B, C`.
     - **Chặng 4 (Đỉnh Olimpia)**: Kéo thả 3 thẻ *Ý nghĩa* ở khay trên vào 3 hộp *Dẫn chứng* ở khay dưới.
2. **Tài nguyên `assets/`**:
   - Đặt ảnh bản đồ nền leo núi sạch chữ tĩnh và 4 avatar học sinh vào `assets/`.

---

### BƯỚC 3: Kiểm Tra Các Chốt Logic Bất Biến Trong `index.html`
Trước khi chạy thử, đảm bảo đủ 5 chốt kỹ thuật đã đóng gói:
1. **Sảnh chờ 3 chốt**: Chọn Đội & Nhập Tên Nhóm ➔ Đọc Hướng Dẫn (`isReady = false`) ➔ Bấm Sẵn Sàng (`isReady = true`) ➔ Nút **Bắt Đầu Trận Đấu** của Cô Giáo chỉ mở khóa khi `100%` đội vào phòng đã bấm Sẵn Sàng.
2. **HUD Học Sinh 1 dòng (`#studentPlayingTopHud`)**: Viên thuốc 1 dòng (`height: 36px`) ở góc trên, không che bản đồ, có nút Sáng/Tối (`🌙/☀️`).
3. **Kéo-Thả Đa Thiết Bị (`attachUniversalDragAndDrop`)**: Theo dõi `pointermove`/`pointerup` trên `window` cho cả Chuột, Cảm ứng điện thoại và Bút bảng tương tác.
4. **Điểm số & Xếp hạng**: Mỗi câu đúng `+10 điểm` (`10, 20, 30, 40 điểm`), sai lùi 2 bước. Bảng xếp hạng ưu tiên Tổng điểm, nếu bằng điểm thì **đội nào về đích trước (`finishedAt` nhỏ hơn) đứng Hạng 1**.
5. **Đồng bộ WebRTC P2P (`0.peerjs.com`)**: Kết nối 5 chiều (`hkdv-v4-${roomCode}-teacher` + `east`, `south`, `west`, `north`), không bị lỗi `HTTP 429` khi học sinh dùng chung Wi-Fi trường.

---

### BƯỚC 4: Chạy Server Local & Kiểm Thử Tự Động 4 Agent (Playwright)
1. **Mở Server Local cổng `8686`**:
   ```powershell
   python -m http.server 8686
   ```
2. **Chạy kịch bản kiểm thử 4 Agent tự động**:
   ```powershell
   python run_4_agents_live_room_1010.py
   ```
   - Xác nhận cả 4 Agent vào phòng, đọc hướng dẫn, bấm Sẵn Sàng, kéo thả vượt qua Chặng 1 ➔ 4, lên Bảng xếp hạng đúng thứ tự thời gian về đích và đạt **`0 Console Error / 0 Page Error`**.

---

### BƯỚC 5: Cấu Hình Link Online Cho Mã QR (`getRoomShareUrl`)
Để khi Cô Giáo mở game trên máy tính (dù mở bằng file `.html` trên Desktop hay `localhost`), học sinh dùng điện thoại 4G/Wi-Fi quét Mã QR vẫn vào thẳng bản Online trên **Vercel** hoặc **GitHub Pages**:
- Cập nhật hàm `getRoomShareUrl(code)` và `cloudAssetBase` trong `index.html` trỏ về URL xuất bản:
  ```javascript
  // Ưu tiên link Vercel hoặc GitHub Pages đã publish:
  const PUBLIC_GAME_URL = 'https://ten-game-olimpia.vercel.app/';
  // Hoặc GitHub Pages: 'https://<username>.github.io/<repo-name>/'

  function getRoomShareUrl(code) {
    const host = window.location.hostname || '';
    const isLocalLoopback =
      window.location.protocol === 'file:' ||
      host === '127.0.0.1' ||
      host === 'localhost';
    const base = isLocalLoopback
      ? PUBLIC_GAME_URL
      : window.location.href.split('?')[0].split('#')[0];
    return `${base}?room=${encodeURIComponent(code)}&mode=student`;
  }
  ```

---

### BƯỚC 6: Khởi Tạo Git & Đẩy Code Lên GitHub
Chạy bộ lệnh sau trong thư mục dự án để đẩy toàn bộ `index.html` và `assets/` lên GitHub:

```powershell
# 1. Khởi tạo Git repository và đặt nhánh chính là main
git init
git branch -M main

# 2. Thêm toàn bộ file và tạo commit đầu tiên
git add -A
git commit -m "Initial release: Game Olimpia 4 Doi Leo Nui v1.0"

# 3. Tạo repo mới trên GitHub (dùng GitHub CLI hoặc gắn link repo đã tạo trên web)
# Cách A (Nếu dùng GitHub CLI gh):
gh repo create ten-game-olimpia --public --source=. --remote=origin --push

# Cách B (Nếu đã tạo repo trống trên web github.com):
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

---

### BƯỚC 7: Publish Lên GitHub Pages (Miễn Phí, Ổn Định)
Có 2 cách bật GitHub Pages cho repository vừa đẩy lên:

- **Cách 1 (Bằng lệnh CLI nhanh trong 5 giây)**:
  ```powershell
  gh api repos/<username>/<repo-name>/pages -X POST -F build_type=legacy -F source[branch]=main -F source[path]=/
  ```
- **Cách 2 (Trên giao diện Web GitHub)**:
  1. Vào trang GitHub của repo ➔ Bấm tab **Settings** ➔ chọn mục **Pages** ở cột trái.
  2. Tại mục **Branch**, chọn nhánh **`main`** và thư mục **`/ (root)`** ➔ Bấm **Save**.
  3. Sau 30–60 giây, game sẽ có link chính thức tại:
     `https://<username>.github.io/<repo-name>/`

---

### BƯỚC 8: Publish Lên Vercel (Tốc Độ CDN Toàn Cầu Siêu Nhanh & Tự Động Deploy Khi Push GitHub)

#### Cách A: Liên kết trực tiếp từ GitHub trên Web Vercel (Khuyên dùng — Tự động cập nhật mỗi khi `git push`)
1. Đăng nhập [https://vercel.com](https://vercel.com) bằng tài khoản GitHub.
2. Bấm **Add New...** ➔ **Project**.
3. Chọn repository **`<repo-name>`** vừa đẩy lên GitHub ➔ Bấm **Import**.
4. Tại màn hình cấu hình:
   - **Framework Preset**: Chọn **`Other`** (vì là HTML/JS thuần).
   - **Root Directory**: Để mặc định `./`.
   - **Build Command** & **Output Directory**: Để trống (mặc định).
5. Bấm **Deploy** ➔ Sau ~15 giây, Vercel cấp ngay đường dẫn HTTPS tốc độ cao:
   `https://<project-name>.vercel.app`

#### Cách B: Publish trực tiếp từ Terminal bằng Vercel CLI (Chỉ 1 lệnh)
```powershell
# Chạy tại thư mục dự án (lần đầu sẽ hỏi đăng nhập Vercel)
npx vercel --prod --yes
```
Vercel sẽ upload trực tiếp thư mục hiện tại và trả về link Production `https://<project-name>.vercel.app`.

---

### BƯỚC 9: Nghiệm Thu Thực Tế Trên Link Online (Vercel / GitHub Pages)
1. **Trên máy tính của Cô Giáo**:
   - Mở link `https://<project-name>.vercel.app/?mode=teacher` (hoặc mở file HTML trên Desktop, bấm `👩‍🏫 Dành Cho Cô Giáo (PIN)` ➔ nhập `1234`).
   - Bấm nút **📱 Mã QR Phòng** để chiếu mã QR lên màn hình lớn.
2. **Trên 4 điện thoại học sinh**:
   - Quét mã QR trên màn hình ➔ Điện thoại tự mở `https://<project-name>.vercel.app/?room=1010&mode=student`.
   - Nhập Tên Nhóm ➔ Chọn Đội ➔ Đọc Hướng Dẫn ➔ Bấm **Sẵn Sàng**.
3. **Cô Giáo bấm `🥁 CÔ GIÁO: BẮT ĐẦU TRẬN ĐẤU`**:
   - Cả 4 nhóm đua leo núi, kéo thả đáp án từ Chặng 1 đến Chặng 4. Khi cả 4 nhóm về đích, màn hình Cô Giáo tự động bật **Bảng Xếp Hạng Chung Cuộc & Bảng Chuẩn Kiến Thức**.

---

### BƯỚC 10: Quy Trình Cập Nhật Nhanh (Khi Sửa Câu Hỏi Hoặc Giao Diện)
Sau khi đã nối GitHub với GitHub Pages và Vercel, mỗi khi sửa câu hỏi hoặc giao diện trong `index.html`, chỉ cần chạy **1 dòng lệnh duy nhất** là cả bản Desktop, GitHub Pages và Vercel đều tự động cập nhật đồng thời:

```powershell
git add -A; git commit -m "Update game content & UI"; git push origin main
```
- **Vercel**: Tự động nhận webhook từ GitHub và cập nhật bản mới trong **10–15 giây**.
- **GitHub Pages**: Tự động cập nhật bản mới trong **30–45 giây**.
