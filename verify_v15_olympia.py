import os
import time
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright

PROJECT_DIR = r"C:\Users\haolv\.gemini\antigravity\scratch\hao-khi-dong-a-boardgame"
ARTIFACT_DIR = r"C:\Users\haolv\.gemini\antigravity\brain\8e58725f-bc71-489f-9515-2e9ca1a92c00"
PORT = 8792


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def log_message(self, format, *args):
        pass


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_server():
    with ThreadedTCPServer(("127.0.0.1", PORT), QuietHandler) as httpd:
        httpd.serve_forever()


def run_tests():
    srv_thread = threading.Thread(target=start_server, daemon=True)
    srv_thread.start()
    time.sleep(0.5)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        js_errors = []
        page.on("pageerror", lambda err: js_errors.append(str(err)))

        # 1. Open Teacher View to inspect Olympia Map & Light/Dark Mode
        page.goto(f"http://127.0.0.1:{PORT}/?room=1515&mode=teacher", wait_until="domcontentloaded")
        page.wait_for_timeout(1200)

        h1_text = page.locator(".brand-title h1").inner_text()
        assert "HÀNH TRÌNH VỀ NGUỒN" in h1_text, f"Unexpected title: {h1_text}"

        # Check that only 3 Stage Checkpoints + 1 Summit Node exist on the Olympia shared road
        stage_nodes_count = page.locator(".stage-node").count()
        assert stage_nodes_count == 3, f"Expected 3 shared Olympia stage nodes, got {stage_nodes_count}"

        # Screenshot 1: Olympia Map in Light Mode
        shot1 = os.path.join(ARTIFACT_DIR, "v15_1_olympia_map_light.png")
        page.screenshot(path=shot1, full_page=False)
        print("Saved:", shot1)

        # Toggle Dark Mode
        page.click("#btnThemeToggle")
        page.wait_for_timeout(450)
        assert page.evaluate("document.body.classList.contains('dark-theme')") is True
        shot2 = os.path.join(ARTIFACT_DIR, "v15_2_olympia_map_dark.png")
        page.screenshot(path=shot2, full_page=False)
        print("Saved:", shot2)

        # Switch back to Light Mode
        page.click("#btnThemeToggle")
        page.wait_for_timeout(350)

        # 2. Student joins and plays through Stage 1 (Khởi Động), Stage 2 (Vượt Chướng Ngại Vật), Stage 3 (Tăng Tốc), Stage 4 (Đỉnh Olympia)
        student_page = context.new_page()
        student_page.on("pageerror", lambda err: js_errors.append(str(err)))
        student_page.goto(f"http://127.0.0.1:{PORT}/?room=1515&mode=student", wait_until="domcontentloaded")
        student_page.wait_for_timeout(900)

        student_page.fill("#inputOnboardTeamName", "Đội 1 - Olympia")
        student_page.click("#btnConfirmEnterBoard")
        student_page.wait_for_timeout(500)

        # Verify student is in WAITING state until Teacher starts
        status_before = student_page.evaluate("roomMatchState.status")
        assert status_before == "WAITING", f"Expected WAITING before teacher starts, got {status_before}"

        # Teacher starts match
        page.evaluate("hostTriggerStartMatch()")
        student_page.wait_for_timeout(700)
        student_page.evaluate("roomMatchState.status = 'PLAYING'; roomMatchState.startedAt = Date.now() - 8000; updateAllUI();")
        student_page.wait_for_timeout(400)

        # Open Stage 1 ("Chặng 1: Khởi Động")
        student_page.evaluate("openStageBattleModal(1)")
        student_page.wait_for_timeout(500)
        prompt_text = student_page.locator("#battleQuestionPrompt").inner_text()
        excerpt_text = student_page.locator("#battleSourceExcerpt").inner_text()
        assert "Chặng 1: Khởi Động" in prompt_text, f"Expected Chặng 1: Khởi Động in prompt, got: {prompt_text}"
        assert ("Nam quốc sơn hà" in excerpt_text) or ("Bình ngô đại cáo" in excerpt_text) or ("Hịch tướng sĩ" in excerpt_text) or ("Hội nghị Diên Hồng" in excerpt_text) or ("Nghệ thuật chiến tranh" in excerpt_text) or ("Phát huy sức mạnh dân tộc" in excerpt_text) or ("tự hào" in excerpt_text) or ("truyền thống tốt đẹp" in excerpt_text) or ("bài học kinh nghiệm" in excerpt_text), f"Unexpected excerpt: {excerpt_text}"

        shot3 = os.path.join(ARTIFACT_DIR, "v15_3_stage1_khoi_dong_y_nghia.png")
        student_page.screenshot(path=shot3, full_page=False)
        print("Saved:", shot3)

        # Simulate Drag-and-Drop onto #stage123DropZone for Stage 1
        student_page.evaluate("""() => {
            const correctBtn = document.querySelector('#battleOptionsGrid .option-btn[data-correct="1"]');
            const dropBox = document.getElementById('stage123DropZone');
            window._currentDraggedElement = correctBtn;
            dropBox.dispatchEvent(new Event('drop', { bubbles: true }));
        }""")
        student_page.wait_for_timeout(1900)

        # Complete Stage 2 & Stage 3 directly before pairing Stage 4
        student_page.evaluate("""() => {
            clearWalkTimers();
            isMarchingAnimation = false;
            myGroup.conqueredStages = [1, 2, 3];
            myGroup.currentStage = 4;
            myGroup.tokenStepIdx = 15;
            myGroup.gold = 680;
            allFourLanesState.west.online = true;
            allFourLanesState.west.teamName = 'Đội 2 - Vượt Sóng';
            allFourLanesState.west.stageProgress = 3;
            allFourLanesState.west.gold = 540;
            allFourLanesState.south.online = true;
            allFourLanesState.south.teamName = 'Đội 3 - Tăng Tốc';
            allFourLanesState.south.stageProgress = 2;
            allFourLanesState.south.gold = 410;
            allFourLanesState.north.online = true;
            allFourLanesState.north.teamName = 'Đội 4 - Về Đích';
            allFourLanesState.north.stageProgress = 1;
            allFourLanesState.north.gold = 300;
            openBossCitadelChallenge();
        }""")
        student_page.wait_for_timeout(500)

        shot4 = os.path.join(ARTIFACT_DIR, "v15_4_stage4_olympia_drag_drop.png")
        student_page.screenshot(path=shot4, full_page=False)
        print("Saved:", shot4)

        # Pair all 3 rows via Drag-and-Drop in Stage 4 ("Ý nghĩa rút ra" -> "Dẫn chứng/biểu hiện")
        for r_id in ["row0", "row1", "row2"]:
            student_page.evaluate(f"""() => {{
                const chip = document.querySelector('.stage4-drag-chip[data-id="{r_id}"]');
                const slot = document.querySelector('.stage4-drop-slot[data-target-id="{r_id}"]');
                window._currentDraggedElement = chip;
                slot.dispatchEvent(new Event('drop', {{ bubbles: true }}));
            }}""")
            student_page.wait_for_timeout(280)

        student_page.wait_for_timeout(1150)
        shot5 = os.path.join(ARTIFACT_DIR, "v15_5_olympia_leaderboard_and_y_nghia_table.png")
        student_page.screenshot(path=shot5, full_page=False)
        print("Saved:", shot5)

        # Open Giant Fullscreen Knowledge Consolidation Modal ("Ý NGHĨA CỦA CHIẾN TRANH BẢO VỆ TỔ QUỐC")
        student_page.evaluate("openKnowledgeSummaryModal()")
        student_page.wait_for_timeout(450)
        modal_text = student_page.locator("#knowledgeSummaryModal").inner_text()
        assert "Ý NGHĨA CỦA CHIẾN TRANH BẢO VỆ TỔ QUỐC" in modal_text
        assert "Nam quốc sơn hà" in modal_text
        assert "Hịch tướng sĩ" in modal_text
        assert "Để lại bài học kinh nghiệm quý báu" in modal_text

        shot6 = os.path.join(ARTIFACT_DIR, "v15_6_fullscreen_y_nghia_modal.png")
        student_page.screenshot(path=shot6, full_page=False)
        print("Saved:", shot6)

        assert len(js_errors) == 0, f"JS Errors detected: {js_errors}"
        print("ALL V15 OLYMPIA & Y NGHIA ASSERTIONS PASSED WITH 0 JS ERRORS!")
        browser.close()


if __name__ == "__main__":
    run_tests()
