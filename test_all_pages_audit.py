import asyncio
import os
from playwright.async_api import async_playwright

ARTIFACT_DIR = r"C:\Users\haolv\.gemini\antigravity\brain\8e58725f-bc71-489f-9515-2e9ca1a92c00"

PAGES_TO_TEST = [
    {
        "id": "1_github_teacher",
        "name": "GitHub Pages - Co Giao (?room=1010)",
        "url": "https://haolvq13-bot.github.io/hao-khi-dai-viet-boardgame/?room=1010",
        "viewport": {"width": 1366, "height": 820},
    },
    {
        "id": "2_github_student",
        "name": "GitHub Pages - Hoc Sinh (?room=1010&mode=student)",
        "url": "https://haolvq13-bot.github.io/hao-khi-dai-viet-boardgame/?room=1010&mode=student",
        "viewport": {"width": 390, "height": 844},
    },
    {
        "id": "3_vercel_teacher",
        "name": "Vercel Cloud - Co Giao (?room=1010)",
        "url": "https://fast-squall-jsburw4.tmp.now/?room=1010",
        "viewport": {"width": 1366, "height": 820},
    },
    {
        "id": "4_vercel_student",
        "name": "Vercel Cloud - Hoc Sinh (?room=1010&mode=student)",
        "url": "https://fast-squall-jsburw4.tmp.now/?room=1010&mode=student",
        "viewport": {"width": 390, "height": 844},
    },
    {
        "id": "5_localhost_teacher",
        "name": "Localhost 127.0.0.1:8686 (?room=1010)",
        "url": "http://127.0.0.1:8686/index.html?room=1010",
        "viewport": {"width": 1366, "height": 820},
    },
    {
        "id": "6_desktop_file",
        "name": "File Desktop Game_Hao_Khi_Dong_A.html",
        "url": "file:///C:/Users/haolv/Desktop/Game_Hao_Khi_Dong_A.html",
        "viewport": {"width": 1366, "height": 820},
    },
]

async def run_audit(label_prefix="default_dns", extra_args=None):
    print(f"\n================ AUDIT MODE: {label_prefix} ================")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=extra_args or [])
        for item in PAGES_TO_TEST:
            context = await browser.new_context(viewport=item["viewport"])
            page = await context.new_page()
            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            shot_path = os.path.join(ARTIFACT_DIR, f"audit_{label_prefix}_{item['id']}.png")
            try:
                resp = await page.goto(item["url"], wait_until="domcontentloaded", timeout=12000)
                await page.wait_for_timeout(2000)
                title = await page.title()
                has_board = await page.locator("#dioramaViewport").count()
                has_onboarding = await page.locator("#onboardingOverlay").count()
                status_code = resp.status if resp else "FILE/200"
                await page.screenshot(path=shot_path)
                print(f"[PASS] {item['name']} -> Status: {status_code} | Title: {title} | Board: {has_board} | Onboarding: {has_onboarding} | ConsoleErrors: {len(console_errors)}")
            except Exception as e:
                try:
                    await page.screenshot(path=shot_path)
                except Exception:
                    pass
                print(f"[FAIL] {item['name']} -> Error: {str(e).splitlines()[0]}")
            await context.close()
        await browser.close()

async def main():
    await run_audit("default_system_dns", [])

if __name__ == "__main__":
    asyncio.run(main())
