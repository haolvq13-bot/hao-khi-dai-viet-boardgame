const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1210-0_26.1116.1210.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
const phase=process.env.TEST_PHASE||'baseline';
const expectedHash=(process.env.EXPECTED_SHA256||'').toLowerCase();
let base=process.env.GAME_URL||'https://haolvq13-bot.github.io/hao-khi-dai-viet-boardgame/';
let server;
const output=process.env.QA_OUT||`D:/Documents/CODEX/2026-11-18/em-check-xem-tr-n-wep/outputs/${phase}`;
fs.mkdirSync(output,{recursive:true});
const report={phase,startedAt:new Date().toISOString(),base,expectedSourceSha256:expectedHash||null,cases:[],documents:[],pageErrors:[],consoleErrors:[],networkFailures:[]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
function log(event,details={}){console.log(JSON.stringify({event,...details}));}
function room(){return 'CHECK'+crypto.randomBytes(6).toString('hex').toUpperCase();}
function createCase(name){const item={name,room:room(),status:'running',observations:[]};report.cases.push(item);return item;}
async function newPage(item,role,label,clientId){
  const context=await browser.newContext({viewport:{width:1200,height:900}});
  item.contexts.push(context);
  const page=await context.newPage();item.pages.push(page);
  if(clientId)await page.addInitScript(cid=>sessionStorage.setItem('hkdv_session_client_id',cid),clientId);
  page.on('pageerror',e=>report.pageErrors.push({case:item.name,label,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({case:item.name,label,message:m.text()});});
  page.on('requestfailed',r=>report.networkFailures.push({case:item.name,label,url:r.url(),error:r.failure()?.errorText}));
  const url=new URL(base);url.searchParams.set('room',item.room);url.searchParams.set('mode',role);url.searchParams.set('qa',item.room);
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200);
  const hash=crypto.createHash('sha256').update(await response.body()).digest('hex');
  report.documents.push({case:item.name,label,sha256:hash,status:response.status()});
  if(expectedHash)assert.equal(hash,expectedHash,'Loaded source must match published expected SHA256');
  await page.waitForFunction('typeof roomMatchState !== "undefined"');
  return page;
}
async function ready(page,name){
  await page.fill('#inputOnboardTeamName',name);
  await page.click('#btnConfirmEnterBoard');
  await page.waitForSelector('#onboardStep2GuideView',{state:'visible',timeout:20000});
  await page.click('#btnConfirmReadyAfterGuide');
  await page.waitForFunction('hasClaimedCharacter && myGroup.isReady');
}
async function snapshot(page){return page.evaluate('({clientId:myClientId,peerId:myPeer&&myPeer.id,peerOpen:!!(myPeer&&myPeer.open),claimed:hasClaimedCharacter,ready:myGroup.isReady,direction:myGroup.direction,revision:myGroup.syncRevision,status:roomMatchState.status,lanes:allFourLanesState,diagnostics:window.olimpiaRoomDiagnostics})');}
async function manage(item,fn){
  item.contexts=[];item.pages=[];
  try{await fn(item);item.status='passed';}
  catch(error){item.status='failed';item.error=error.stack;log('case-failed',{case:item.name,error:error.message});}
  finally{
    item.finalStates=await Promise.all(item.pages.map(p=>snapshot(p).catch(()=>null)));
    await Promise.all(item.pages.map((p,i)=>p.screenshot({path:path.join(output,`${item.name}-session-${i}.png`)}).catch(()=>null)));
    for(const context of item.contexts)await context.close();
    delete item.contexts;delete item.pages;
    fs.writeFileSync(path.join(output,'join-report.json'),JSON.stringify(report,null,2));
    log('case-complete',{case:item.name,status:item.status,room:item.room,observationEvents:item.observations.map(o=>o.event)});
  }
}
async function threeBeforeFourth(item){
  const teacher=await newPage(item,'teacher','teacher');
  await teacher.waitForFunction('myPeer && myPeer.open');
  const students=[];
  for(let i=0;i<3;i++){
    const p=await newPage(item,'student',`student-${i+1}`);await ready(p,`Agent ${i+1}`);students.push(p);
  }
  await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online&&l.isReady).length===3');
  const disabled=await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled();
  item.observations.push({event:'three-total-ready',startDisabled:disabled,teacher:await snapshot(teacher)});
  log('three-total-ready',{phase,startDisabled:disabled,room:item.room});
  if(phase==='baseline'){
    assert.equal(disabled,false,'Baseline should expose premature Start');
    await teacher.locator('#btnTeacherStartMatchSidebar').click();
    await Promise.all(students.map(p=>p.waitForFunction('roomMatchState.status === "PLAYING"')));
    const fourth=await newPage(item,'student','student-4');
    await fourth.fill('#inputOnboardTeamName','Agent Fourth');
    await fourth.click('#btnConfirmEnterBoard');
    await fourth.waitForFunction('pendingTeamClaim===null',{},{timeout:18000});
    const state=await snapshot(fourth);
    const pageText=await fourth.locator('body').innerText();
    item.observations.push({event:'fourth-after-start',state,visibleText:pageText});
    assert.equal(state.claimed,false);
    assert(pageText.includes('Trận đấu đã bắt đầu'),'Fourth gets explicit already-started rejection');
    log('baseline-reproduced',{issue:'Three ready can start; fourth explicitly rejected',room:item.room});
  }else{
    assert.equal(disabled,true,'Start must stay disabled until fourth total student is ready');
    const fourth=await newPage(item,'student','student-4');
    await fourth.fill('#inputOnboardTeamName','Agent Fourth');
    await fourth.click('#btnConfirmEnterBoard');
    await fourth.waitForSelector('#onboardStep2GuideView',{state:'visible'});
    assert.equal(await teacher.locator('#btnTeacherStartMatchSidebar').isDisabled(),true);
    await fourth.click('#btnConfirmReadyAfterGuide');
    await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online&&l.isReady).length===4');
    await teacher.locator('#btnTeacherStartMatchSidebar').click();
    await Promise.all([...students,fourth].map(p=>p.waitForFunction('roomMatchState.status==="PLAYING"')));
    item.observations.push({event:'all-four-started'});
  }
}
async function reloadReady(item){
  const teacher=await newPage(item,'teacher','teacher');
  await teacher.waitForFunction('myPeer&&myPeer.open');
  const student=await newPage(item,'student','student');
  await ready(student,'Agent Reload');
  await teacher.waitForFunction('Object.values(allFourLanesState).some(l=>l.online&&l.isReady)');
  await pause(18000);
  const before=await snapshot(student);
  const teacherBefore=await snapshot(teacher);
  item.observations.push({event:'before-reload',student:before,teacher:teacherBefore});
  log('before-reload',{room:item.room,revision:before.revision,teacherRevision:teacherBefore.lanes[before.direction].revision});
  const begin=Date.now();
  await student.reload({waitUntil:'domcontentloaded'});
  await student.waitForFunction('typeof roomMatchState!=="undefined"');
  const reloaded=await snapshot(student);
  item.observations.push({event:'after-reload-before-rejoin',student:reloaded});
  await student.fill('#inputOnboardTeamName','Agent Reload Again');
  await student.click('#btnConfirmEnterBoard');
  const joined=await student.waitForSelector('#onboardStep2GuideView',{state:'visible',timeout:16000}).then(()=>true,()=>false);
  if(!joined){
    item.observations.push({event:'rejoin-failed',elapsedMs:Date.now()-begin,student:await snapshot(student),teacher:await snapshot(teacher),text:await student.locator('body').innerText()});
    if(phase==='postfix')throw new Error('Reloaded same-tab client could not rejoin');
    return;
  }
  await student.click('#btnConfirmReadyAfterGuide');
  const direction=await student.evaluate('myGroup.direction');
  const readyClicked=Date.now();
  const timedSamples=[];
  for(let i=0;i<15;i++){
    const local=await snapshot(student),remote=await snapshot(teacher);
    const lane=remote.lanes[direction];
    timedSamples.push({elapsedMs:Date.now()-readyClicked,localRevision:local.revision,teacherRevision:lane.revision,teacherReady:lane.isReady,teacherName:lane.teamName,peerOpen:local.peerOpen});
    if(lane.isReady&&lane.teamName==='Agent Reload Again')break;
    await pause(1000);
  }
  item.observations.push({event:'readiness-recovery',totalElapsedMs:Date.now()-begin,samples:timedSamples});
  const recovered=timedSamples.at(-1).teacherReady&&timedSamples.at(-1).teacherName==='Agent Reload Again';
  log('reload-recovery',{phase,room:item.room,recovered,samples:timedSamples});
  if(phase==='postfix'){assert(recovered,'Teacher must accept reloaded readiness');assert(timedSamples.at(-1).elapsedMs<6000,'Reloaded readiness must recover promptly');}
}
async function clonedIds(item){
  const teacher=await newPage(item,'teacher','teacher');await teacher.waitForFunction('myPeer&&myPeer.open');
  const duplicate='clone-'+crypto.randomBytes(6).toString('hex');
  const [first,clone]=await Promise.all([
    newPage(item,'student','original-tab',duplicate),
    newPage(item,'student','cloned-tab',duplicate)
  ]);
  await Promise.all([ready(first,'Original Session'),ready(clone,'Cloned Session')]);
  const [a,b]=await Promise.all([snapshot(first),snapshot(clone)]);
  assert.notEqual(a.peerId,b.peerId,'Two live cloned tabs must receive distinct peer identities');
  await teacher.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online&&l.isReady).length===2');
  item.observations.push({event:'cloned-id-recovered',first:a,clone:b});
}
async function staleReservation(item){
  const teacher=await newPage(item,'teacher','teacher');await teacher.waitForFunction('myPeer&&myPeer.open');
  const students=[];
  for(let i=0;i<3;i++){const p=await newPage(item,'student',`student-${i+1}`);await ready(p,`Real ${i+1}`);students.push(p);}
  const ghost=await newPage(item,'student','abandoned');await ready(ghost,'Abandoned');
  const ghostClient=await ghost.evaluate('myClientId');
  await ghost.close();
  const replacement=await newPage(item,'student','replacement');
  await replacement.fill('#inputOnboardTeamName','Replacement Fourth');
  await replacement.click('#btnConfirmEnterBoard');
  await replacement.waitForSelector('#onboardStep2GuideView',{state:'visible',timeout:45000});
  await replacement.click('#btnConfirmReadyAfterGuide');
  await teacher.waitForFunction(old=>Object.values(allFourLanesState).filter(l=>l.online&&l.isReady).length===4&&!Object.values(allFourLanesState).some(l=>l.claimedBy===old),ghostClient,{timeout:45000});
  item.observations.push({event:'replacement-reclaimed-abandoned-slot'});
}
async function duplicateTeacher(item){
  const owner=await newPage(item,'teacher','owner-teacher');
  await owner.waitForFunction('myPeer&&myPeer.open');
  const student=await newPage(item,'student','existing-student');await ready(student,'Existing Student');
  await owner.waitForFunction('Object.values(allFourLanesState).filter(l=>l.online&&l.isReady).length===1');
  const before=await snapshot(owner);
  const other=await newPage(item,'teacher','duplicate-teacher');
  await other.waitForSelector('#roomConnectionBanner',{state:'visible'});
  await other.waitForFunction('teacherRoomConflict===true');
  assert((await other.locator('#roomConnectionBanner').innerText()).includes('đang có cô giáo khác mở'));
  await pause(6500);
  assert.equal(await other.locator('#roomConnectionBanner').isVisible(),true,'Conflict banner must outlive a transient toast');
  await other.locator('#btnTopbarResetRoom').click();
  await pause(1200);
  const after=await snapshot(owner);
  assert.equal(after.status,before.status);
  assert.equal(after.lanes.east.claimedBy,before.lanes.east.claimedBy);
  assert.equal(await student.evaluate('hasClaimedCharacter'),true,'Duplicate host must not reset actual owner room');
  const oldCode=await other.evaluate('currentRoomCode');
  await other.locator('#roomConnectionBanner button').click();
  await other.waitForFunction(old=>currentRoomCode!==old&&/^\d{6}$/.test(currentRoomCode)&&myPeer&&myPeer.open,oldCode);
  item.observations.push({event:'duplicate-host-banner-persistent',ownerBefore:before,ownerAfter:after,newCode:await other.evaluate('currentRoomCode')});
}
async function main(){
  if(process.env.GAME_ROOT){
    const gameRoot=process.env.GAME_ROOT;
    const assets=process.env.GAME_ASSET_ROOT||gameRoot;
    server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=pathname.startsWith('/assets/')?path.join(assets,pathname):path.join(gameRoot,'index.html');
      if(pathname.includes('..')){res.writeHead(400);res.end();return;}
      fs.readFile(file,(error,data)=>{
        const type=file.endsWith('.jpg')?'image/jpeg':file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.json')?'application/json':'text/html; charset=utf-8';
        res.writeHead(error?404:200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(error?'Not found':data);
      });
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base=`http://127.0.0.1:${server.address().port}/`;report.base=base;report.localCandidate=gameRoot;
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'C:/Users/haolv/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'});
  try{
    await manage(createCase('three-before-fourth'),threeBeforeFourth);
    await manage(createCase('same-tab-reload'),reloadReady);
    if(phase==='postfix')await manage(createCase('cloned-client-id'),clonedIds);
    if(phase==='postfix')await manage(createCase('duplicate-teacher-protection'),duplicateTeacher);
    if(phase==='postfix'&&process.env.CHECK_GHOST==='1')await manage(createCase('abandoned-reservation'),staleReservation);
  }finally{
    report.finishedAt=new Date().toISOString();report.status=report.cases.every(c=>c.status==='passed')?'passed':'failed';
    fs.writeFileSync(path.join(output,'join-report.json'),JSON.stringify(report,null,2));
    await browser.close();
    if(server)server.close();
    log('complete',{phase,status:report.status,report:path.join(output,'join-report.json')});
    if(report.status!=='passed')process.exitCode=1;
  }
}
main().catch(error=>{console.error(error);if(server)server.close();process.exitCode=1;});
