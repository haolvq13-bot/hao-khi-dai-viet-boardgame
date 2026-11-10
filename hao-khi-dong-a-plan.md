# Plan: Hào Khí Đông A — Đại Chiến Sa Bàn Lục Giác (Independent Group Web Boardgame)

## 1. Mục tiêu Sư phạm & Nội dung Cốt lõi (100% Bám sát Bảng Kiến Thức)
Học sinh các nhóm vừa chơi vừa thuộc lòng chính xác 100% từng chữ trong 3 dòng của bảng **"Vai trò"**:

| TT | Dẫn chứng / Biểu hiện | Vai trò rút ra |
| :--- | :--- | :--- |
| **1** | **Chiến thắng Bạch Đằng** chấm dứt thời kì Bắc thuộc. Mở ra thời kỳ độc lập lâu dài cho dân tộc. | **Vai trò quan trọng đối với sự sinh tồn và phát triển của dân tộc VN.** |
| **2** | **Kháng chiến chống Xiêm, và quân Thanh** bảo vệ vững chắc nền độc lập, chủ quyền dân tộc. | **Bảo vệ vững chắc độc lập dân tộc.** |
| **3** | **Kháng chiến chống Tống** tạo môi trường hòa bình lâu dài, đất nước có điều kiện thuận lợi để phát triển. | **Giữ gìn bản sắc văn hóa; Tạo điều kiện thuận lợi cho phát triển đất nước.** |

## 2. Cơ chế "Mỗi Nhóm Làm Riêng Biệt" (Independent Group Progression + Live Sync)
- **Tự chủ hoàn toàn trên từng thiết bị / từng nhóm:**
  - Mỗi nhóm có **Sa bàn Lục giác (9 Thành trì)**, **Xúc xắc 3D**, **Túi Thẻ Mưu Kế**, và **Bảng Vàng Tổng Kết 3 Dòng** riêng của nhóm mình.
  - Nhóm nào giải nhanh và chính xác sẽ mở khóa các ô Lục giác và lắp ghép hoàn chỉnh 3 dòng trên **Bảng Vàng Tổng Kết** trước mà không phải chờ nhóm khác.
- **Kết nối Đa Thiết Bị 2-trong-1:**
  1. **Mã Phòng 6 Số + QR Code (WebRTC PeerJS Cloud):** Giáo viên mở màn hình **Sân Khấu Tổng Chỉ Huy (Teacher Stage)**, các nhóm quét QR hoặc nhập Mã phòng 6 số trên điện thoại/laptop của nhóm mình. Điểm số, số thành trì chiếm được, chuỗi Combo và tiến độ lắp ghép 3 dòng của từng nhóm sẽ **bắn trực tiếp theo thời gian thực** lên Bảng Xếp Hạng Sân Khấu của Giáo viên!
  2. **Đồng bộ Đa Tab Tức Thì (`BroadcastChannel` 0ms):** Giáo viên có thể mở 1 Tab Sân Khấu và nhiều Tab Nhóm ngay trên cùng 1 máy tính để test hoặc điều khiển song song.
  3. **Chế độ Độc lập (Standalone Group Mode):** Nhóm học sinh mở file/link web lên là chọn Tên Nhóm, Quốc Kỳ và bắt đầu công thành ngay lập tức kể cả khi không cần nhập mã phòng.

## 3. Đa dạng Hóa Hình Thức Hỏi Xoáy Sâu 3 Dòng (4 Chế Độ Thử Thách)
Để học sinh không chỉ chọn bừa A-B-C-D mà thực sự thuộc lòng bảng:
1. **Dạng 1 — Trắc nghiệm Cốt lõi (1 Sao):** Cho *Dẫn chứng/Biểu hiện* $\rightarrow$ Chọn đúng *Vai trò rút ra* (và ngược lại).
2. **Dạng 2 — Điền Từ Khóa Vàng (2 Sao - Cloze Test):** Điền chính xác cụm từ còn thiếu trong bảng (ví dụ: *"chấm dứt thời kì Bắc thuộc"*, *"sinh tồn và phát triển"*, *"bản sắc văn hóa"*, *"hòa bình lâu dài"*).
3. **Dạng 3 — Ghép Ấn Tín Đúng/Sai & Phân Tích Ngược (2 Sao):** Nhận diện ghép đúng hay ghép nhầm giữa 3 cuộc kháng chiến (Bạch Đằng, Chống Tống, Chống Xiêm - Thanh).
4. **Dạng 4 — Đại Chiến Ghép Bảng Toàn Diện (3 Sao - Boss Citadel):** Kéo/chọn nối trực tiếp cả **3 Dẫn chứng** với **3 Vai trò rút ra** để hoàn thành Bảng Vàng 100%!

## 4. Hiệu Ứng Khi Chọn Đúng ("Full Game Juice")
- **Web Audio API Synthesizer:** Tiếng trống trận hào hùng khi đổ xúc xắc, tiếng chiêng đồng + kèn khải hoàn (`C5-E5-G5-C6`) khi chọn đúng, tiếng khiên gỗ rung khi chọn sai.
- **Visual FX:** Pháo hoa Confetti 60FPS, chữ bay nổi (`+150 Vàng! 🔥 Combo x3!`), Cờ Đại Việt cắm lên đỉnh ô Lục giác vừa chiếm, và hiệu ứng **Khắc Chữ Vàng** trực tiếp vào *Bảng Vàng Kiến Thức* bên cạnh bàn cờ.
