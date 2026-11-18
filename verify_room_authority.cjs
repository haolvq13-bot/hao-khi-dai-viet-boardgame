'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1117-1425-0_26.1117.1425.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const source = process.env.QA_SOURCE || (fs.existsSync(path.join(__dirname, 'round-reset-fix')) ? path.resolve(__dirname, 'round-reset-fix') : __dirname);
const room = 'AUTH' + Date.now().toString(36).toUpperCase();
const out = process.env.QA_OUT || path.resolve(__dirname, '../outputs/authority-local');
fs.mkdirSync(out, { recursive: true });
const report = { room, startedAt: new Date().toISOString(), checks: [], errors: [], mode: process.env.QA_DEPLOYED ? 'Deployed assets/public relay; isolated room fixture; multiple tabs sharing storage' : 'Candidate and relay v3 on localhost; multiple tabs sharing storage' };
let browser, backend, server;
function check(name) { report.checks.push(name); console.log(name); }
async function main() {
  let base;
  if (process.env.QA_DEPLOYED) base = 'https://haolvq13-bot.github.io/hao-khi-dai-viet-boardgame/';
  else {
    const serverFile = process.env.RELAY_SERVER_PATH || (fs.existsSync(path.resolve(__dirname, '../outputs/classroom-relay/server.cjs')) ? path.resolve(__dirname, '../outputs/classroom-relay/server.cjs') : path.join(__dirname, 'relay-runtime/server.cjs'));
    backend = spawn(process.execPath, [serverFile], { windowsHide: true, env: { ...process.env, CLASSROOM_RELAY_PORT: '18770', ALLOW_LOCAL_TEST: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { backend.stdout.once('data', resolve); backend.once('error', reject); backend.once('exit', code => reject(new Error('Local relay exited ' + code))); });
    server = http.createServer((req, res) => {
      const name = new URL(req.url, 'http://localhost').pathname.slice(1);
      if (name.startsWith('assets/')) {
        fs.readFile(path.join('C:/Users/haolv/.gemini/antigravity/scratch/hao-khi-dong-a-boardgame', name), (error, body) => { res.writeHead(error ? 404 : 200); res.end(error ? '' : body); });
      } else if (!name || name === 'index.html') {
        const legacy = new URL(req.url, 'http://localhost').searchParams.has('legacy');
        const body = legacy ? '<!doctype html><title>Legacy tab fixture</title>' : fs.readFileSync(path.join(source, 'index.html'), 'utf8').replace("const FIXED_CLASSROOM_CODE = '1010';", 'const FIXED_CLASSROOM_CODE = ' + JSON.stringify(room) + ';');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body);
      } else if (name === 'classroom-relay.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(fs.readFileSync(path.join(source, name)));
      } else if (name === 'relay-config.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ url: 'ws://127.0.0.1:18770/relay' }));
      } else { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port + '/';
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/haolv/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pages = [];
  async function open(role, legacy = false) {
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') (report.consoleErrors ||= []).push(message.text()); });
    page.on('requestfailed', request => { (report.networkFailures ||= []).push({ url: request.url(), error: request.failure()?.errorText }); });
    await page.route(base + '**', async route => {
      if (!process.env.QA_DEPLOYED) return route.continue();
      const url = new URL(route.request().url());
      const name = url.pathname.slice(new URL(base).pathname.length);
      if (legacy && (!name || name === 'index.html')) return route.fulfill({ body: '<!doctype html><title>Legacy tab fixture</title>', contentType: 'text/html' });
      if (!['', 'index.html', 'classroom-relay.js', 'relay-config.json'].includes(name)) return route.continue();
      if (process.env.QA_DEPLOYED && name && name !== 'index.html') return route.continue();
      let body = process.env.QA_DEPLOYED ? await (await route.fetch()).body() : fs.readFileSync(path.join(source, name || 'index.html'));
      if (!name || name === 'index.html') body = body.toString('utf8').replace("const FIXED_CLASSROOM_CODE = '1010';", 'const FIXED_CLASSROOM_CODE = ' + JSON.stringify(room) + ';');
      if (!process.env.QA_DEPLOYED && name === 'relay-config.json') body = JSON.stringify({ url: 'ws://127.0.0.1:18770/relay' });
      await route.fulfill({ body, contentType: name.endsWith('.js') ? 'application/javascript' : name.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
    });
    await page.goto(base + '?mode=' + role + '&room=' + room + '&v=authority-test-' + Date.now() + (legacy ? '&legacy=1' : ''), { waitUntil: 'domcontentloaded' });
    return page;
  }
  try {
    const legacy = await open('student', true);
    const ghosts = Object.fromEntries(['east', 'west', 'south', 'north'].map(key => [key, { direction: key, online: true, isReady: true, claimedBy: 'ghost_' + key, roomCode: room, gold: 0, revision: 999, roomMatchState: { resetEpoch: 0 } }]));
    await legacy.evaluate(({ room, ghosts }) => localStorage.setItem('hkdv_room_snapshot_' + room, JSON.stringify({ _meta: { status: 'WAITING', resetEpoch: 0 }, ...ghosts })), { room, ghosts });
    const firstTeacher = await open('teacher');
    await firstTeacher.waitForFunction(() => window.isClassroomRelayTeacherReady(), {}, { timeout: 8000 });
    assert.equal(await firstTeacher.evaluate(() => Object.values(allFourLanesState).filter(l => l.online).length), 0);
    assert.equal(await firstTeacher.evaluate(() => syncChannel), null);
    check('Four stale team locks in shared storage cannot populate or fill the real room');
    const secondTeacher = await open('teacher');
    await secondTeacher.waitForFunction(() => window.classroomRelayStatus().conflict);
    assert(await firstTeacher.evaluate(() => window.isClassroomRelayTeacherReady()));
    check('A second teacher tab cannot silently take over the active classroom');
    await legacy.evaluate(({ room, ghosts }) => {
      window.legacy = new BroadcastChannel('hkdv_4way_room_' + room);
      window.legacy.onmessage = event => { if (event.data.type === 'TEAM_CLAIM_REQUEST') window.legacy.postMessage({ ...event.data, type: 'TEAM_CLAIM_RESULT', accepted: false, reason: 'Phòng đã đủ 4 đội.' }); };
      window.legacy.postMessage({ type: 'ROOM_STATE_SNAPSHOT', roomCode: room, lanes: ghosts, roomMatchState: { status: 'WAITING', resetEpoch: Date.now() + 60000 } });
      localStorage.setItem('hkdv_room_snapshot_' + room, JSON.stringify({ _meta: { status: 'WAITING', resetEpoch: Date.now() + 60000 }, ...ghosts }));
    }, { room, ghosts });
    const student = await open('student');
    await student.waitForFunction(() => window.classroomRelayStatus().ready && window.classroomRelayStatus().teacherPresent);
    await student.fill('#inputOnboardTeamName', 'Shared browser student');
    await student.click('#btnConfirmEnterBoard');
    await student.waitForSelector('#onboardStep2GuideView', { state: 'visible' });
    await student.click('#btnConfirmReadyAfterGuide');
    await firstTeacher.waitForFunction(() => Object.values(allFourLanesState).filter(isLaneCurrentlyConnected).length === 1);
    check('A student in the same browser ignores fake room-full replies and snapshots from legacy tabs');
    await secondTeacher.locator('#teacherHostPanel button[onclick="teacherUnlockAllCharactersInRoom(true)"]').click();
    await secondTeacher.waitForFunction(() => window.isClassroomRelayTeacherReady() && roomMatchState.resetEpoch > 0 && Object.values(allFourLanesState).every(l => !l.online));
    await firstTeacher.waitForFunction(() => window.classroomRelayStatus().conflict);
    await student.waitForFunction(() => !hasClaimedCharacter && !myGroup.isReady && document.getElementById('onboardingModal').classList.contains('open'));
    assert.equal(await secondTeacher.locator('.chibi-map-token:visible').count(), 0);
    check('Pressing Reset explicitly transfers teacher ownership, evicts students and empties the visible lobby');
    await student.waitForFunction(() => window.classroomRelayStatus().ready && window.classroomRelayStatus().teacherPresent);
    await student.click('#btnConfirmEnterBoard');
    await student.waitForSelector('#onboardStep2GuideView', { state: 'visible' });
    await student.click('#btnConfirmReadyAfterGuide');
    await secondTeacher.waitForFunction(() => Object.values(allFourLanesState).filter(l => isLaneCurrentlyConnected(l) && l.isReady).length === 1);
    assert.equal(await secondTeacher.locator('.chibi-map-token.walking').count(), 0);
    assert(await secondTeacher.locator('#btnTeacherStartMatchSidebar').isEnabled());
    check('Re-entering after takeover is accepted, idle students do not bounce, and one ready team can start');
    await secondTeacher.locator('#teacherHostPanel button[onclick="teacherUnlockAllCharactersInRoom(true)"]').click();
    await student.waitForFunction(() => !hasClaimedCharacter);
    await secondTeacher.waitForTimeout(2000);
    assert.equal(await secondTeacher.locator('.chibi-map-token:visible').count(), 0);
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    report.status = 'passed';
    await secondTeacher.screenshot({ path: path.join(out, 'empty-authoritative-room.png') });
  } catch (error) {
    report.status = 'failed'; report.error = error.stack;
    report.states = await Promise.all(pages.map(async page => {
      try { return await page.evaluate(() => ({ url: location.href, relay: window.classroomRelayStatus?.(), diagnostics: window.olimpiaRoomDiagnostics, role: typeof myRole === 'undefined' ? null : myRole })); }
      catch (failure) { return { unavailable: String(failure) }; }
    }));
    throw error;
  }
  finally {
    report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await context.close(); await browser.close(); backend?.kill(); server?.close();
  }
}
main().catch(error => { console.error(error); backend?.kill(); server?.close(); process.exitCode = 1; });
