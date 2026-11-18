'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1117-1425-0_26.1117.1425.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const base = 'https://haolvq13-bot.github.io/hao-khi-dai-viet-boardgame/';
const source = process.env.QA_SOURCE || (fs.existsSync(path.join(__dirname, 'round-reset-fix')) ? path.join(__dirname, 'round-reset-fix') : __dirname);
const out = process.env.QA_OUT || path.resolve(__dirname, '../outputs/round-reset-preview');
fs.mkdirSync(out, { recursive: true });
const room = 'ROUND' + Date.now().toString(36).toUpperCase();
const report = { startedAt: new Date().toISOString(), room, mode: process.env.QA_DEPLOYED ? 'Deployed assets, public WSS, fixed-room constant replaced only in isolated QA browser fixture' : 'Candidate assets on HTTPS origin, public WSS, isolated QA room constant', checks: [], errors: [], documents: [], rounds: [] };
const contexts = [];
let browser;
function check(name) { report.checks.push(name); console.log(name); }
async function pageFor(role, i, givenUrl) {
  const context = await browser.newContext({ viewport: i % 2 ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: Boolean(i % 2), hasTouch: Boolean(i % 2) });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push({ i, message: error.message }));
  await page.route(base + '**', async route => {
    const name = new URL(route.request().url()).pathname.slice(new URL(base).pathname.length);
    if (!['', 'index.html', 'classroom-relay.js', 'relay-config.json'].includes(name)) return route.continue();
    if (process.env.QA_DEPLOYED && name && name !== 'index.html') return route.continue();
    let body;
    if (process.env.QA_DEPLOYED) { const response = await route.fetch(); assert.equal(response.status(), 200); body = await response.body(); }
    else body = fs.readFileSync(path.join(source, name || 'index.html'));
    if (!name || name === 'index.html') {
      const hash = crypto.createHash('sha256').update(body).digest('hex');
      report.documents.push({ i, sha256: hash });
      if (process.env.EXPECTED_SHA256) assert.equal(hash, process.env.EXPECTED_SHA256.toLowerCase());
      const html = body.toString('utf8');
      assert(html.includes("const FIXED_CLASSROOM_CODE = '1010';"));
      body = html.replace("const FIXED_CLASSROOM_CODE = '1010';", 'const FIXED_CLASSROOM_CODE = ' + JSON.stringify(room) + ';');
    }
    await route.fulfill({ body, contentType: name.endsWith('.js') ? 'application/javascript' : name.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
  });
  await page.goto(givenUrl || base + '?room=' + room + '&mode=' + role + '&v=qa-roundreset-' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.classroomRelayStatus?.().ready);
  assert.equal(await page.evaluate(() => window.classroomRelayStatus().roomCode), room, 'Never claim or reset the real classroom');
  return page;
}
async function join(page, name, ready = true) {
  await page.fill('#inputOnboardTeamName', name);
  await page.click('#btnConfirmEnterBoard');
  await page.waitForSelector('#onboardStep2GuideView', { state: 'visible', timeout: 18000 });
  if (ready) await page.click('#btnConfirmReadyAfterGuide');
}
async function count(teacher, n, ready = n) {
  await teacher.waitForFunction(({ n, ready }) => {
    const lanes = Object.values(allFourLanesState).filter(isLaneCurrentlyConnected);
    return lanes.length === n && lanes.filter(l => l.isReady).length === ready;
  }, { n, ready }, { timeout: 18000 });
}
async function start(teacher, students, tapStage = false) {
  await count(teacher, students.length);
  assert(await teacher.locator('#btnTeacherStartMatchSidebar').isEnabled());
  if (tapStage) await teacher.locator('.stage-node').first().click({ force: true });
  else await teacher.locator('#btnTeacherStartMatchSidebar').click();
  await Promise.all(students.map(p => p.waitForFunction(() => roomMatchState.status === 'PLAYING')));
  assert.equal(await teacher.evaluate(() => roomMatchState.participantDirections.length), students.length);
}
async function drag(page, source, target) {
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(), b = await target.boundingBox(); assert(a && b);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 }); await page.mouse.up();
}
async function play(page, touch) {
  await page.waitForFunction(() => !document.getElementById('stageBreakOverlay').classList.contains('active'));
  if (touch) await page.locator('.stage-node').first().tap({ force: true });
  else await page.locator('.stage-node').first().click({ force: true });
  for (const stage of [1, 2, 3]) {
    await page.waitForFunction(s => document.getElementById('battleModal').classList.contains('open') && activeStageBattle?.stageNum === s && document.querySelector('#battleOptionsGrid .option-btn')?.dataset.disabled !== '1', stage, { timeout: 25000 });
    await drag(page, page.locator('#battleOptionsGrid .option-btn[data-correct="1"]'), page.locator('#stage123DropZone'));
    await page.waitForFunction(s => myGroup.conqueredStages.includes(s), stage);
  }
  await page.waitForFunction(() => document.getElementById('battleModal').classList.contains('open') && document.getElementById('bossMatchingQuestionArea').style.display !== 'none', {}, { timeout: 25000 });
  for (const row of ['row0', 'row1', 'row2']) {
    await drag(page, page.locator(`.stage4-drag-chip[data-id="${row}"]`), page.locator(`.stage4-drop-slot[data-target-id="${row}"]`));
    await page.waitForFunction(r => pairedRowIds.includes(r), row);
  }
  await page.waitForFunction(() => myGroup.gold === 40 && myGroup.conqueredStages.length === 4);
}
async function reset(teacher, students) {
  const oldEpoch = await teacher.evaluate(() => roomMatchState.resetEpoch);
  const ids = await Promise.all(students.map(p => p.evaluate(() => myClientId)));
  await teacher.evaluate(() => teacherUnlockAllCharactersInRoom(true));
  await count(teacher, 0);
  await Promise.all(students.map(p => p.waitForFunction(() => !hasClaimedCharacter && !myGroup.isReady && myGroup.gold === 0 && document.getElementById('onboardingModal').classList.contains('open'))));
  await Promise.all(students.map((p, i) => p.waitForFunction(id => myClientId !== id && window.classroomRelayStatus().ready, ids[i])));
  assert((await teacher.evaluate(() => roomMatchState.resetEpoch)) > oldEpoch);
  assert(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled());
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/haolv/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
  try {
    const teacher = await pageFor('teacher', 0);
    assert(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled());
    const first = await pageFor('student', 1);
    await join(first, 'QA R1 one team', false);
    await count(teacher, 1, 0);
    assert(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled());
    await first.click('#btnConfirmReadyAfterGuide');
    await start(teacher, [first]);
    check('One ready team can start; zero teams and unread guide cannot start');
    await play(first, true);
    await teacher.waitForFunction(() => Object.values(allFourLanesState).filter(l => l.online).every(l => l.gold === 40));
    check('Round 1 finishes with one team and correct 40-point result');
    const stale = await first.evaluate(() => buildMySyncPayload());
    await first.evaluate(() => {
      window.qaLateVoiceCallbacks = 0;
      const enabled = audioEnabled, audio = currentVoiceAudio, playing = isGeneralVoiceCurrentlyPlaying;
      audioEnabled = true; currentVoiceAudio = new Audio(); isGeneralVoiceCurrentlyPlaying = () => true;
      waitForGeneralVoiceToFinish(() => { window.qaLateVoiceCallbacks++; }, 1200);
      audioEnabled = enabled; currentVoiceAudio = audio; isGeneralVoiceCurrentlyPlaying = playing;
    });
    await reset(teacher, [first]);
    await first.evaluate(packet => sendToAllWebRtcPeers(packet), stale);
    await teacher.waitForTimeout(1800);
    await count(teacher, 0);
    assert.equal(await first.evaluate(() => window.qaLateVoiceCallbacks), 0);
    check('Reset evicts old sessions, clears readiness/score and cancels previous-round packets and voice callbacks');
    await join(first, 'QA R2 returning team');
    const qrUrl = await teacher.evaluate(() => getRoomShareUrl(currentRoomCode));
    const second = await pageFor('student', 2, qrUrl);
    await join(second, 'QA R2 rescanned QR');
    await start(teacher, [first, second], true);
    await Promise.all([play(first, true), play(second, false)]);
    check('Round 2 reuses the original tab plus a newly scanned QR; both finish at 40 points');
    report.rounds.push({ participants: 1, finished: true }, { participants: 2, finished: true });
    await first.context().setOffline(true);
    await teacher.evaluate(() => teacherUnlockAllCharactersInRoom(true));
    await second.waitForFunction(() => !hasClaimedCharacter && !myGroup.isReady);
    await first.context().setOffline(false);
    await first.waitForFunction(() => !hasClaimedCharacter && !myGroup.isReady && window.classroomRelayStatus().ready, {}, { timeout: 20000 });
    await count(teacher, 0);
    check('A student offline during reset returns to the empty lobby instead of restoring an old team');
    const third = await pageFor('student', 3, qrUrl);
    await Promise.all([join(first, 'QA R3 team 1'), join(second, 'QA R3 team 2'), join(third, 'QA R3 team 3')]);
    await start(teacher, [first, second, third], true);
    await reset(teacher, [first, second, third]);
    await teacher.waitForTimeout(3500);
    await count(teacher, 0);
    assert.equal(await first.evaluate(() => document.getElementById('battleModal').classList.contains('open')), false);
    check('Three teams can start; reset during marching cancels delayed gameplay and leaves the room empty');
    const fourth = await pageFor('student', 4, qrUrl);
    const all = [first, second, third, fourth];
    await Promise.all(all.map((p, i) => join(p, 'QA R4 team ' + (i + 1))));
    await start(teacher, all);
    await Promise.all(all.map((p, i) => play(p, Boolean((i + 1) % 2))));
    check('Round 4 accepts all four teams and all four finish every stage');
    await reset(teacher, all);
    await teacher.waitForTimeout(Number(process.env.QA_IDLE_MS || 17500));
    await count(teacher, 0);
    assert(await teacher.evaluate(() => Object.values(allFourLanesState).every(l => !l.online && !l.isReady && l.gold === 0)));
    check('After four rounds the reset room remains 0/4 with no team restored by old heartbeats');
    await teacher.screenshot({ path: path.join(out, 'empty-room-after-four-rounds.png') });
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack;
    report.failureStates = await Promise.all(contexts.flatMap(c => c.pages()).map(async p => {
      try { return await p.evaluate(() => ({ role: myRole, room: currentRoomCode, meta: roomMatchState, group: myGroup, relay: window.classroomRelayStatus(), pending: Boolean(pendingTeamClaim), lanes: allFourLanesState, modals: ['leaderboardModal','battleModal','onboardingModal','stageBreakOverlay'].filter(id => document.getElementById(id)?.classList.contains('open') || document.getElementById(id)?.classList.contains('active')), diagnostics: window.olimpiaRoomDiagnostics })); }
      catch (failure) { return { unavailable: String(failure) }; }
    }));
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await Promise.allSettled(contexts.map(c => c.close())); await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
