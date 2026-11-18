/* Run with Node.js and Playwright installed. No game state is forced to PLAYING.
 * Optional environment: GAME_ROOT, GAME_ASSET_ROOT, QA_OUT, PEERJS_FILE,
 * PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE. Tests use unique disposable rooms.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.GAME_ROOT || __dirname;
const assets = process.env.GAME_ASSET_ROOT || root;
const output = process.env.QA_OUT || path.join(root, 'qa-results');
fs.mkdirSync(output, {recursive:true});
const report = { startedAt:new Date().toISOString(), sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex'), cases:[], pageErrors:[], consoleErrors:[], networkFailures:[] };
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = pathname.startsWith('/assets/') ? path.resolve(assets, '.' + pathname) : path.join(root,'index.html');
  if (pathname.includes('..')) { res.writeHead(400); res.end(); return; }
  fs.readFile(file,(err,data) => {
    const type = file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
    res.writeHead(err ? 404 : 200, {'Content-Type':type,'Cache-Control':'no-store'});
    res.end(err ? 'Not found' : data);
  });
});
let browser;
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
function log(event,details={}) { console.log(JSON.stringify({event,...details})); }
async function drag(page, source, target) {
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(), b = await target.boundingBox();
  assert(a && b, 'Visible drag source and target required');
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:14});
  await page.mouse.up();
}
async function answer(page, correct, touch) {
  const card = page.locator(`#battleOptionsGrid .option-btn[data-correct="${correct ? 1:0}"]`).first();
  if (touch) { await card.tap(); await page.locator('#stage123DropZone').tap(); }
  else await drag(page,card,page.locator('#stage123DropZone'));
}
async function play(page,index) {
  await page.locator('#btnMapFloatingGo').click();
  for (const stage of [1,2,3]) {
    await page.waitForFunction(s => document.getElementById('battleModal').classList.contains('open') && activeStageBattle && activeStageBattle.stageNum === s && document.querySelector('#battleOptionsGrid .option-btn')?.dataset.disabled !== '1',stage,{timeout:20000});
    if (index===3 && stage===2) {
      await answer(page,false,true);
      await page.waitForFunction('myGroup.wrongAttempts === 1');
      await page.waitForFunction('document.getElementById("battleModal").classList.contains("open") && document.querySelector("#battleOptionsGrid .option-btn")?.dataset.disabled !== "1"',{},{timeout:20000});
    }
    await answer(page,true,index%2===1);
    await page.waitForFunction(s => myGroup.conqueredStages.includes(s),stage);
    assert.equal(await page.evaluate('myGroup.gold'),stage*10);
    log('stage-complete',{student:index+1,stage});
  }
  await page.waitForFunction('document.getElementById("battleModal").classList.contains("open") && document.getElementById("bossMatchingQuestionArea").style.display !== "none"',{},{timeout:20000});
  if (index===3) {
    await drag(page,page.locator('.stage4-drag-chip[data-id="row0"]'),page.locator('.stage4-drop-slot[data-target-id="row1"]'));
    await page.waitForFunction('myGroup.wrongAttempts === 2');
    assert.equal(await page.evaluate('pairedRowIds.length'),0);
  }
  for (const id of ['row0','row1','row2']) {
    await drag(page,page.locator(`.stage4-drag-chip[data-id="${id}"]`),page.locator(`.stage4-drop-slot[data-target-id="${id}"]`));
    await page.waitForFunction(r => pairedRowIds.includes(r),id);
  }
  await page.waitForFunction('myGroup.gold === 40 && myGroup.conqueredStages.length === 4');
  log('student-finished',{student:index+1});
}
async function runCase(transport,fullGame) {
  const room = 'qa' + crypto.randomBytes(6).toString('hex');
  const entry = { transport,room,checks:[],students:[] };
  report.cases.push(entry);
  const contexts = [];
  const observedPages = [];
  const shared = transport === 'broadcast' ? await browser.newContext({viewport:{width:1100,height:850},hasTouch:true}) : null;
  if (shared) contexts.push(shared);
  async function pageFor(role,index,offset=0) {
    const context = shared || await browser.newContext({viewport:index%2===1 ? {width:390,height:844}:{width:1440,height:900},hasTouch:true});
    if (!shared) contexts.push(context);
    const page = await context.newPage();
    observedPages.push(page);
    await page.route('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',route=>transport==='broadcast' ? route.fulfill({body:'',contentType:'application/javascript'}) : process.env.PEERJS_FILE ? route.fulfill({path:process.env.PEERJS_FILE,contentType:'application/javascript'}) : route.continue());
    page.on('pageerror',e=>report.pageErrors.push({transport,index,message:e.message}));
    page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({transport,index,message:m.text()});});
    page.on('requestfailed',r=>report.networkFailures.push({transport,index,url:r.url(),error:r.failure()?.errorText}));
    await page.addInitScript(ms=>{const original=Date.now.bind(Date);Date.now=()=>original()+ms;},offset);
    await page.goto(`${base}/?room=${room}&mode=${role}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction('typeof roomMatchState !== "undefined"');
    return page;
  }
  try {
    const teacher = await pageFor('teacher',0);
    if (transport==='webrtc') await teacher.waitForFunction('myPeer && myPeer.open');
    const students = await Promise.all([0,120000,-120000,3600000].map((offset,i)=>pageFor('student',i+1,offset)));
    // All four choose the same default slot before any reservation has completed.
    await Promise.all(students.map(async(p,i)=>{
      await p.fill('#inputOnboardTeamName',`QA Đội ${i+1}`);
      await p.locator('.dir-choice-card[data-dir="east"]').click();
    }));
    await Promise.all(students.map(p=>p.click('#btnConfirmEnterBoard')));
    await Promise.all(students.map(p=>p.waitForSelector('#onboardStep2GuideView',{state:'visible'})));
    const directions = await Promise.all(students.map(p=>p.evaluate('myGroup.direction')));
    assert.equal(new Set(directions).size,4);
    entry.checks.push('Four simultaneous requests for the same team receive four distinct reservations');
    const stalePayload = await students[0].evaluate('buildMySyncPayload()');
    await Promise.all(students.slice(0,3).map(p=>p.click('#btnConfirmReadyAfterGuide')));
    await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online && l.isReady).length === 3');
    assert.equal(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled(),true);
    entry.checks.push('Teacher cannot start while the fourth student is reading');
    await students[3].click('#btnConfirmReadyAfterGuide');
    await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online && l.isReady).length === 4');
    await students[0].evaluate(payload=>{
      if(syncChannel)syncChannel.postMessage(payload);
      sendToAllWebRtcPeers(payload);
    },stalePayload);
    await pause(500);
    assert.equal(await teacher.evaluate('Object.values(allFourLanesState).filter(l=>l.online && l.isReady).length'),4);
    entry.checks.push('An old not-ready snapshot cannot overwrite a newer ready update');
    if (transport==='webrtc') {
      await students[2].evaluate('Object.values(activePeerConns).forEach(c=>c.close())');
      await students[2].waitForFunction('Object.values(activePeerConns).some(c=>c.open)');
      entry.checks.push('Dropped data channel reconnects without selecting a team again');
      await students[1].evaluate(() => {
        const realApply = applyIncomingPlayerSync;
        window.qaDroppedStart = false;
        applyIncomingPlayerSync = payload => {
          if (payload && payload.type === 'START_MATCH_CMD' && !window.qaDroppedStart) {
            window.qaDroppedStart = true;
            return;
          }
          realApply(payload);
        };
      });
    }
    await teacher.locator('#btnTeacherStartMatchSidebar').click();
    await Promise.all(students.map(p=>p.waitForFunction('roomMatchState.status === "PLAYING"')));
    if(transport==='webrtc') assert.equal(await students[1].evaluate('window.qaDroppedStart'),true);
    entry.checks.push('All four start with device clocks shifted by 0, +2 minutes, -2 minutes and +1 hour');
    if(transport==='webrtc')entry.checks.push('Periodic teacher snapshot recovers a lost START_MATCH_CMD');
    if (fullGame) {
      await Promise.all(students.map(play));
      await teacher.waitForFunction('Object.values(allFourLanesState).every(l=>l.online && l.stageProgress===4 && l.gold===40)');
      await teacher.waitForSelector('#leaderboardModal.open');
      entry.ranking = await teacher.evaluate('computeFourGroupsRankingAndAnalysis().map(r=>({rank:r.rank,direction:r.direction,score:r.evalTotalScore,stage:r.stageProgress}))');
      assert.equal(entry.ranking.length,4);
      assert(entry.ranking.every(r=>r.score===40&&r.stage===4));
      await Promise.all(students.map(p=>p.waitForFunction('Object.values(allFourLanesState).every(l=>l.online && l.stageProgress===4)')));
      const leaderboards = await Promise.all(students.map(p=>p.evaluate('computeFourGroupsRankingAndAnalysis().map(r=>r.direction)')));
      for(const leaderboard of leaderboards)assert.deepEqual(leaderboard,entry.ranking.map(r=>r.direction));
      entry.checks.push('Teacher and all students show the same final ranking');
      entry.checks.push('Four real UI sessions complete all stages, including wrong-answer retries and touch input');
      await teacher.screenshot({path:path.join(output,'olimpia-four-players-finished.png')});
      await students[1].screenshot({path:path.join(output,'olimpia-mobile-finished.png')});
    }
    entry.students = await Promise.all(students.map(p=>p.evaluate('({direction:myGroup.direction,score:myGroup.gold,status:roomMatchState.status,elapsedSec:myGroup.elapsedSec,finishedAt:myGroup.finishedAt,errors:myGroup.wrongAttempts,diagnostics:window.olimpiaRoomDiagnostics})')));
    if(fullGame){
      assert(entry.students.every(s=>s.elapsedSec>0&&s.elapsedSec<120&&Math.abs(s.finishedAt-Date.now())<120000));
      entry.checks.push('Elapsed time and finish timestamps do not inherit device clock offsets');
    }
    if(fullGame) await teacher.locator('#leaderboardModal button[onclick="closeLeaderboardModal()"]').click();
    if(transport==='webrtc'){
      await students[2].evaluate(()=>{
        window.qaOriginalReconnect = connectToOtherDirectionalPeers;
        connectToOtherDirectionalPeers = () => {};
        Object.values(activePeerConns).forEach(c=>c.close());
      });
      await students[2].waitForFunction('!Object.values(activePeerConns).some(c=>c.open)');
    }
    await teacher.locator('#btnTopbarResetRoom').click();
    if(transport==='webrtc'){
      await Promise.all(students.filter((p,i)=>i!==2).map(p=>p.waitForFunction('!hasClaimedCharacter')));
      assert.equal(await students[2].evaluate('hasClaimedCharacter'),true);
      await students[2].evaluate('connectToOtherDirectionalPeers = window.qaOriginalReconnect');
    }
    await Promise.all(students.map(p=>p.waitForFunction('roomMatchState.status==="WAITING" && !hasClaimedCharacter && document.getElementById("onboardingModal").classList.contains("open")')));
    entry.checks.push('Teacher reset reaches every student despite clock offsets');
    await pause(1800);
    assert.equal(await teacher.evaluate('Object.values(allFourLanesState).filter(l=>l.online).length'),0);
    for(const page of students){
      assert.equal(await page.locator('#onboardStep1SelectView').isVisible(),true);
      assert.equal(await page.evaluate('myGroup.gold'),0);
      assert.equal(await page.evaluate('myGroup.isReady'),false);
    }
    entry.checks.push('A student disconnected during reset recovers from the teacher snapshot without resurrecting old progress');
    await Promise.all(students.map(p=>p.click('#btnConfirmEnterBoard')));
    await Promise.all(students.map(p=>p.waitForSelector('#onboardStep2GuideView',{state:'visible'})));
    await Promise.all(students.slice(0,3).map(p=>p.click('#btnConfirmReadyAfterGuide')));
    await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online && l.isReady).length===3');
    assert.equal(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled(),true);
    await students[3].click('#btnConfirmReadyAfterGuide');
    await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online && l.isReady).length===4');
    await teacher.locator('#btnTeacherStartMatchSidebar').click();
    await Promise.all(students.map(p=>p.waitForFunction('roomMatchState.status==="PLAYING"')));
    entry.checks.push('All four rejoin and start a second round through the real UI');
    entry.status='passed';
    log('case-passed',{transport,checks:entry.checks.length});
  } catch(error) {
    entry.status='failed';entry.error=error.stack;
    entry.failureState=await Promise.all(observedPages.map(p=>p.evaluate('({role:myRole,claimed:hasClaimedCharacter,ready:myGroup.isReady,direction:myGroup.direction,lanes:allFourLanesState,room:roomMatchState})').catch(()=>null)));
    throw error;
  }
  finally {for(const context of contexts)await context.close();}
}
let base;
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try {
    await runCase('webrtc',true);
    await runCase('broadcast',false);
    assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));
    assert.equal(report.consoleErrors.length,0,JSON.stringify(report.consoleErrors));
    report.status='passed';
  } finally {
    report.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(output,'olimpia-qa.json'),JSON.stringify(report,null,2));
    await browser.close();
    server.close();
  }
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
