# 🚀 MASTER PROMPT ONE-SHOT — ĐƯA ẢNH MAP (& BẢNG KIẾN THỨC) ĐỂ ANTIGRAVITY TỰ ĐỘNG LÀM & PUBLISH GAME HOÀN CHỈNH 100%

> **Hướng dẫn sử dụng**: Lần tới khi anh Tú muốn tạo một game mới, anh chỉ cần **đính kèm (attach) 1 ảnh Map mẫu (và ảnh/nội dung bảng kiến thức bài học)** vào khung chat của Antigravity, sau đó **copy nguyên khối Prompt dưới đây** dán vào. Antigravity sẽ tự động làm sạch ảnh map, lập trình đầy đủ giao diện + kéo thả + đồng bộ 4 đội + chạy 4 Agent test (0 lỗi) + đẩy thẳng lên GitHub Pages & Vercel trong 1 lượt duy nhất!

---

## 📋 BẢN PROMPT CHUẨN (COPY NGUYÊN KHỐI NÀY DÁN VÀO ANTIGRAVITY)

```markdown
/hiii Hãy tạo và xuất bản hoàn chỉnh 100% một Web Game Giáo Dục 4 Đội Thi Đấu Thời Gian Thực theo đúng ảnh Map đính kèm và chuẩn kiến trúc chuẩn tại `C:\Users\haolv\.gemini\antigravity\scratch\hao-khi-dong-a-boardgame\index.html` (kèm SOP `QUY_TRINH_TAO_GAME_OLIMPIA_4_DOI.md`).

### 1. THÔNG TIN BÀI HỌC & TÊN GAME:
- **Tên Game**: [Điền tên game, VD: OLIMPIA — ĐƯỜNG LÊN ĐỈNH OLIMPIA]
- **Tên Repo / Link xuất bản**: [Điền tên repo, VD: olimpia-lich-su-boardgame]
- **Bảng Kiến Thức Gốc (3 dòng × 2 cột: Dẫn chứng/Biểu hiện ↔ Ý nghĩa/Vai trò)**:
  1. Dòng 1: [Dẫn chứng 1] ↔ [Ý nghĩa 1] (Từ khóa: [Từ khóa 1A], [Từ khóa 1B])
  2. Dòng 2: [Dẫn chứng 2] ↔ [Ý nghĩa 2] (Từ khóa: [Từ khóa 2A], [Từ khóa 2B])
  3. Dòng 3: [Dẫn chứng 3] ↔ [Ý nghĩa 3] (Từ khóa: [Từ khóa 3A], [Từ khóa 3B])
  *(Nếu anh đính kèm ảnh bảng kiến thức thì tự động đọc OCR từ ảnh để trích xuất 3 dòng này)*

### 2. CÁC QUY TẮC THIẾT KẾ & KỸ THUẬT BẮT BUỘC (KHÔNG ĐƯỢC SAI SÓT):
1. **Xử lý Ảnh Bản Đồ (`assets/mountain_climb_map_bg.png`) & Nhân Vật**:
   - Dùng `image-generator` tạo lại bản đồ nền theo đúng bố cục ảnh Map đính kèm nhưng **phải xóa sạch 100% chữ tĩnh, các biển báo phụ/chặng dư và hình nhân vật vẽ dính trên nền** (để khi gắn 4 nút Chặng HTML và 4 nhân vật động lên không bị đè chữ).
   - Dùng 4 Avatar học sinh chibi sắc nét cho 4 đội: Đội 1 (Đỏ `#DC2626`), Đội 2 (Xanh lá `#16A34A`), Đội 3 (Xanh dương `#2563EB`), Đội 4 (Vàng `#D97706`).
   - Trên bản đồ chỉ hiển thị đúng **4 Chặng**: **Chặng 1 (Khởi Động)** ➔ **Chặng 2 (Vượt Chướng Ngại Vật)** ➔ **Chặng 3 (Tăng Tốc)** ➔ **Chặng 4 (Final: Đỉnh Olimpia)**.

2. **Luồng Sảnh Chờ 3 Chốt (Onboarding & Ready Gate)**:
   - **Cô Giáo** mở khóa bằng Mã PIN `1234` (hoặc `?mode=teacher`): Có nút tạo phòng, đổi mã, bật bảng Mã QR và nút Bắt Đầu.
   - **Học Sinh** (`?mode=student` khi quét QR):
     - **Bước 1**: Nhập Tên Nhóm (lấy làm Tên Đội xuyên suốt game) + Mã Phòng + Chọn 1 trong 4 nhân vật còn trống ➔ Bấm `"📖 TIẾP TỤC: ĐỌC HƯỚNG DẪN LUẬT CHƠI ➔"` (trạng thái `online: true, isReady: false`).
     - **Bước 2**: Hiển thị màn hình đọc hướng dẫn ngắn gọn 3 bước ➔ Học sinh đọc xong bấm `"✅ ĐÃ HIỂU HƯỚNG DẪN — BẤM SẴN SÀNG!"` mới chuyển sang `isReady: true`.
   - **Khóa cứng nút Bắt Đầu của Cô Giáo**: Chỉ khi **tất cả các đội đã vào phòng đều bấm Sẵn Sàng (`onlineCount > 0 && readyCount === onlineCount`)** thì nút `"🥁 CÔ GIÁO: BẮT ĐẦU TRẬN ĐẤU"` mới mở khóa.

3. **Giao Diện Màn Hình Học Sinh & Chế Độ Sáng/Tối**:
   - **Tuyệt đối không hiện banner nhiều dòng hay bảng tiêu đề bản đồ ở góc trên màn hình học sinh**.
   - Góc trên của học sinh chỉ dùng duy nhất **1 thanh viên thuốc 1 dòng siêu gọn (`#studentPlayingTopHud`, cao `<= 40px`, `white-space: nowrap`)** ở cả lúc chờ (`⏳ Sẵn sàng • #MãPhòng` + `🏳️ Đổi Đội`) và lúc đang thi (`⛰️ Chặng X/4 • ⭐ Y điểm`), kèm nút chuyển đổi **Chế độ Sáng / Tối (`🌙/☀️`)** và **Âm thanh (`🔊`)**.

4. **Giao Diện Câu Hỏi Tối Giản & Kéo-Thả Đa Thiết Bị (Chuột + Điện Thoại)**:
   - Bỏ toàn bộ khung đối kháng VS / thanh máu rườm rà trong hộp thoại câu hỏi.
   - **Chặng 1, 2, 3**: Chỉ hiển thị đúng **3 đáp án (`A`, `B`, `C`) xếp theo chiều ngang (`grid-template-columns: repeat(3, minmax(0, 1fr))`)** dùng thẻ `<div role="button" class="option-btn draggable-option">`. Học sinh kéo trực tiếp thẻ `A / B / C` (có bóng nổi `.dnd-floating-ghost`) thả vào `#stage123DropZone` phía trên (hoặc chạm chọn 2 bước).
   - **Chặng 4 (Về Đích)**: Bố cục 2 khay ngang gọn trong **1 màn hình điện thoại không cần cuộn dọc**: Khay trên gồm 3 thẻ kéo *Ý nghĩa rút ra*, Khay dưới gồm 3 hộp *Dẫn chứng* kèm ô thả `.stage4-drop-slot` (thả vào bất kỳ đâu trên hộp dẫn chứng đều nhận).
   - Bộ xử lý kéo thả (`attachUniversalDragAndDrop`) bắt buộc gắn `pointermove`, `pointerup`, `pointercancel` trên `window` cho cả `mouse`, `touch`, `pen` với `touch-action: none` và bảo toàn các cặp đã ghép ở Chặng 4.

5. **Điểm Số `10 Điểm/Câu`, Phạt Lùi Bước & Bảng Xếp Hạng + Bảng Chốt Kiến Thức**:
   - Khởi đầu `0 điểm`. Mỗi chặng vượt qua cộng đúng **`+10 điểm`** (tối đa **`40 điểm`**) và lưu mốc thời gian `finishedAt = Date.now()`.
   - Trả lời sai ở Chặng 1-2-3: Nhân vật tự động **lùi 2 bước trên bản đồ** rồi mở lại câu hỏi để làm lại.
   - **Bảng Xếp Hạng Chung Cuộc**:
     - Chỉ hiển thị 4 thẻ tối giản (`Hạng #1..#4 + Avatar + Tên Đội + Điểm số`).
     - Xếp theo Tổng điểm giảm dần; **nếu bằng điểm nhau thì đội nào về đích trước (`finishedAt` nhỏ hơn) đứng Hạng 1 Quán Quân**.
     - Bên dưới là **Bảng Chuẩn Kiến Thức 2 Cột chữ cực lớn** kèm nút **🔍 Phóng To Bảng Chốt Kiến Thức** để Cô Giáo chốt bài trên lớp.

6. **Đồng Bộ Thời Gian Thực Không Nghẽn & Tự Động Kiểm Thử 4 Agent + Publish GitHub/Vercel**:
   - Sử dụng **WebRTC PeerJS P2P Mesh 5 chiều (`hkdv-v4-${roomCode}-teacher` + `east`, `south`, `west`, `north`)** không phụ thuộc HTTP POST bị giới hạn `429` khi chung Wi-Fi trường.
   - Sau khi code xong, **bắt buộc tự chạy Playwright với 4 Agent học sinh** vào phòng `#1010`, chọn đủ 4 đội, đọc hướng dẫn, bấm Sẵn Sàng, kéo thả thực tế từ Chặng 1 đến Chặng 4 (có test cả 1 lần kéo thả sai lùi 2 bước), kiểm tra log đạt **`0 Console Error / 0 Page Error`** và chụp ảnh nghiệm thu cả Mobile (`390x844`) lẫn Desktop (`1440x900`).
   - Tạo sẵn `vercel.json`, copy bản chạy độc lập ra Desktop, `git init` / `git push` lên GitHub, bật **GitHub Pages** và deploy lên **Vercel** (`npx vercel --prod --yes` hoặc đồng bộ GitHub-Vercel), cập nhật URL xuất bản vào `getRoomShareUrl` để Mã QR quét trên điện thoại chạy ngay lập tức!
```
