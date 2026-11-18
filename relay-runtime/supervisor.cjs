'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = __dirname;
const settings = JSON.parse(fs.readFileSync(path.join(root, 'runtime-settings.json'), 'utf8'));
const lockPath = path.join(root, 'supervisor.lock');
const logPath = path.join(root, 'supervisor-events.jsonl');
let stopping = false, serverChild = null, tunnelChild = null, publishing = false;
let latestUrl = null, publishedUrl = null, checkingHealth = false;
function append(file, message) {
  if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) fs.renameSync(file, file + '.previous');
  fs.appendFileSync(file, message);
}
function log(event, details = {}) { append(logPath, JSON.stringify({ at: new Date().toISOString(), event, ...details }) + '\n'); }
function acquireLock() {
  if (fs.existsSync(lockPath)) {
    const owner = Number(fs.readFileSync(lockPath, 'utf8'));
    try { process.kill(owner, 0); return false; } catch (error) {
      if (error.code !== 'ESRCH') throw error;
      fs.unlinkSync(lockPath);
    }
  }
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  return true;
}
function writeStatus() {
  fs.writeFileSync(path.join(root, 'processes.json'), JSON.stringify({ supervisorPid: process.pid, relayPid: serverChild?.pid || null, tunnelPid: tunnelChild?.pid || null, port: settings.port, relayUrl: latestUrl, updatedAt: new Date().toISOString() }, null, 2));
}
function startServer() {
  if (stopping || serverChild) return;
  const child = spawn(settings.node, [path.join(root, 'server.cjs')], { cwd: root, windowsHide: true, env: { ...process.env, CLASSROOM_RELAY_PORT: String(settings.port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  serverChild = child;
  child.stdout.on('data', bytes => append(path.join(root, 'server-events.jsonl'), bytes.toString()));
  child.stderr.on('data', bytes => append(path.join(root, 'server-errors.log'), bytes.toString()));
  child.on('error', error => log('server-spawn-error', { message: error.message }));
  child.on('exit', (code, signal) => {
    if (serverChild === child) serverChild = null;
    log('server-exited', { code, signal }); writeStatus();
    if (!stopping) setTimeout(startServer, 1500);
  });
  log('server-started', { pid: child.pid }); writeStatus();
}
async function git(args, input, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', settings.gitRepo, ...args], { windowsHide: true, env: { ...process.env, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error('git ' + args[0] + ' failed: ' + stderr.slice(0, 1200))));
    child.stdin.end(input || '');
  });
}
async function publishUrl() {
  if (publishing || !latestUrl || latestUrl === publishedUrl || stopping) return;
  publishing = true;
  const url = latestUrl;
  try {
    const health = await fetch(url.replace(/^wss:/, 'https:').replace(/\/relay$/, '/health'), { signal: AbortSignal.timeout(12000) });
    if (!health.ok || !(await health.json()).ok) throw new Error('Public relay health is not ready');
    const config = JSON.stringify({ url }) + '\n';
    fs.writeFileSync(path.join(root, 'relay-config-latest.json'), config);
    for (let attempt = 0; attempt < 3; attempt++) {
      await git(['fetch', 'origin', 'main']);
      const parent = await git(['rev-parse', 'FETCH_HEAD']);
      const existing = JSON.parse(await git(['show', parent + ':relay-config.json']));
      if (existing.url === url) { publishedUrl = url; break; }
      const blob = await git(['hash-object', '-w', '--stdin'], config);
      const env = { GIT_INDEX_FILE: path.join(root, 'runtime-publish.index') };
      await git(['read-tree', parent], null, env);
      await git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',relay-config.json'], null, env);
      const tree = await git(['write-tree'], null, env);
      const commit = await git(['-c', 'user.name=haolvq13-bot', '-c', 'user.email=haolvq13-bot@users.noreply.github.com', 'commit-tree', tree, '-p', parent], 'Update classroom relay endpoint after tunnel recovery\n');
      try {
        await git(['push', 'origin', commit + ':refs/heads/main']);
        publishedUrl = url;
        log('relay-config-published', { commit, url });
        break;
      } catch (error) { if (attempt === 2) throw error; }
    }
    log('relay-ready', { url });
    writeStatus();
  } catch (error) { log('relay-config-retry', { message: error.message }); }
  finally { publishing = false; }
}
function startTunnel() {
  if (stopping || tunnelChild) return;
  const child = spawn(settings.cloudflared, ['tunnel', '--url', 'http://127.0.0.1:' + settings.port, '--protocol', 'http2', '--no-autoupdate'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  tunnelChild = child;
  let tail = '';
  const data = bytes => {
    const text = bytes.toString();
    append(path.join(root, 'tunnel-current.log'), text);
    tail = (tail + text).slice(-32768);
    const found = tail.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/);
    if (found) {
      const next = 'wss://' + found[1] + '/relay';
      if (next !== latestUrl) { latestUrl = next; log('tunnel-url', { url: next }); writeStatus(); }
    }
  };
  child.stdout.on('data', data); child.stderr.on('data', data);
  child.on('error', error => log('tunnel-spawn-error', { message: error.message }));
  child.on('exit', (code, signal) => {
    if (tunnelChild === child) tunnelChild = null;
    log('tunnel-exited', { code, signal }); writeStatus();
    if (!stopping) setTimeout(startTunnel, 2500);
  });
  log('tunnel-started', { pid: child.pid }); writeStatus();
}
async function checkHealth() {
  if (checkingHealth || stopping) return;
  checkingHealth = true;
  try {
    const response = await fetch('http://127.0.0.1:' + settings.port + '/health', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
  } catch (error) {
    log('local-health-failed', { message: error.message });
    if (serverChild) serverChild.kill();
    else startServer();
  } finally { checkingHealth = false; }
}
function shutdown() {
  if (stopping) return;
  stopping = true; log('supervisor-stopping');
  serverChild?.kill(); tunnelChild?.kill();
  try { if (fs.readFileSync(lockPath, 'utf8') === String(process.pid)) fs.unlinkSync(lockPath); } catch (error) { log('lock-cleanup', { message: error.message }); }
  setTimeout(() => process.exit(0), 800);
}
if (!acquireLock()) process.exit(0);
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
process.on('uncaughtException', error => { log('supervisor-error', { message: error.stack }); shutdown(); });
log('supervisor-started', { pid: process.pid });
startServer(); startTunnel();
setInterval(checkHealth, 5000);
setInterval(publishUrl, 10000);
