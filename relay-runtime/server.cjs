'use strict';
const http = require('node:http');
const { WebSocketServer, WebSocket } = require('C:/nodejs/node_modules/ws');
const port = Number(process.env.CLASSROOM_RELAY_PORT || 18769);
const rooms = new Map();
const log = (event, details = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));
const allowedOrigin = 'https://haolvq13-bot.github.io';
const send = (socket, message) => {
  if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 262144) socket.send(JSON.stringify(message));
};
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, version: 3, rooms: rooms.size, clients: [...rooms.values()].reduce((n, r) => n + r.clients.size, 0) }));
    return;
  }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
server.on('upgrade', (req, socket, head) => {
  const localTest = process.env.ALLOW_LOCAL_TEST === '1' && /^http:\/\/127\.0\.0\.1:\d+$/.test(req.headers.origin || '');
  if (req.url !== '/relay' || (req.headers.origin !== allowedOrigin && !localTest) || wss.clients.size >= 120) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
function presence(room, type, clientId, role) {
  for (const peer of room.clients.values()) send(peer, { type, clientId, role, teacherPresent: Boolean(room.teacher), roomCode: room.code });
}
wss.on('connection', socket => {
  let room, clientId, role;
  let budget = 100, lastRefill = Date.now();
  socket.alive = true;
  socket.on('pong', () => { socket.alive = true; });
  const joinDeadline = setTimeout(() => { if (!room) socket.close(1008, 'Join required'); }, 10000);
  socket.on('message', bytes => {
    let packet;
    try { packet = JSON.parse(bytes.toString()); } catch { socket.close(1008, 'Invalid message'); return; }
    budget = Math.min(100, budget + (Date.now() - lastRefill) / 20); lastRefill = Date.now();
    if (--budget < 0) { socket.close(1008, 'Rate limit'); return; }
    if (!room) {
      if (packet.type !== 'RELAY_JOIN' || !/^[A-Z0-9]{1,32}$/.test(packet.roomCode || '') ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(packet.clientId || '') || !['TEACHER','STUDENT'].includes(packet.role)) {
        socket.close(1008, 'Invalid join'); return;
      }
      if (!rooms.has(packet.roomCode)) {
        if (rooms.size >= 40) { socket.close(1013, 'Capacity'); return; }
        rooms.set(packet.roomCode, { code: packet.roomCode, clients: new Map(), teacher: null, snapshot: null, resetEpoch: 0, touched: Date.now() });
      }
      const target = rooms.get(packet.roomCode);
      if (packet.role === 'TEACHER' && target.teacher && target.teacher.readyState === WebSocket.OPEN) {
        if (packet.takeover !== true) {
          log('teacher-conflict', { roomCode: packet.roomCode, clientId: packet.clientId });
          send(socket, { type: 'RELAY_CONFLICT', reason: 'teacher', roomCode: packet.roomCode }); socket.close(1008, 'Teacher already connected'); return;
        }
        const previous = target.teacher;
        for (const [id, peer] of target.clients) if (peer === previous) target.clients.delete(id);
        target.teacher = null;
        previous.close(4002, 'Teacher replaced by explicit reset');
        log('teacher-replaced-by-reset', { roomCode: packet.roomCode, clientId: packet.clientId });
      }
      if (target.clients.has(packet.clientId)) {
        log('client-conflict', { roomCode: packet.roomCode, clientId: packet.clientId });
        send(socket, { type: 'RELAY_CONFLICT', reason: 'client', roomCode: packet.roomCode }); socket.close(1008, 'Client already connected'); return;
      }
      room = target; clientId = packet.clientId; role = packet.role;
      clearTimeout(joinDeadline);
      room.clients.set(clientId, socket); room.touched = Date.now();
      if (role === 'TEACHER') room.teacher = socket;
      log('client-joined', { roomCode: room.code, clientId, role });
      send(socket, { type: 'RELAY_READY', roomCode: room.code, teacherPresent: Boolean(room.teacher), resetEpoch: room.resetEpoch });
      if (room.snapshot) send(socket, room.snapshot);
      presence(room, 'RELAY_PRESENCE', clientId, role);
      return;
    }
    if (packet.roomCode !== room.code) return;
    // A reset revokes old sockets before their queued packets can claim a lane.
    if (room.clients.get(clientId) !== socket) return;
    room.touched = Date.now();
    if (packet.type === 'RELAY_PING') {
      send(socket, { type: 'RELAY_PONG', roomCode: room.code, resetEpoch: room.resetEpoch, teacherPresent: Boolean(room.teacher) });
      return;
    }
    if (role === 'STUDENT') {
      if (!['PLAYER_SYNC','TEAM_CLAIM_REQUEST','REQUEST_SYNC'].includes(packet.type)) return;
      if (packet.type === 'PLAYER_SYNC' && (packet.roomMatchState?.resetEpoch || 0) < room.resetEpoch) return;
      if (packet.type !== 'REQUEST_SYNC') packet.claimedBy = clientId;
      if (room.teacher) send(room.teacher, packet);
      return;
    }
    if (!['ROOM_STATE_SNAPSHOT','TEAM_CLAIM_RESULT','START_MATCH_CMD','ROOM_RESET_CMD'].includes(packet.type)) return;
    if (packet.type === 'ROOM_RESET_CMD') {
      const epoch = Number(packet.resetEpoch) || 0;
      if (epoch <= room.resetEpoch) return;
      room.resetEpoch = epoch;
      room.snapshot = { type: 'ROOM_STATE_SNAPSHOT', roomCode: room.code, roomMatchState: { ...packet.roomMatchState, status: 'WAITING', startedAt: 0, resetEpoch: epoch }, lanes: {}, ts: Date.now() };
      let evicted = 0;
      for (const [id, peer] of room.clients) {
        if (peer === socket) continue;
        send(peer, packet);
        room.clients.delete(id);
        peer.close(4001, String(epoch));
        evicted++;
      }
      log('room-reset', { roomCode: room.code, resetEpoch: epoch, evicted });
      return;
    }
    if (['ROOM_STATE_SNAPSHOT', 'START_MATCH_CMD'].includes(packet.type) && (packet.roomMatchState?.resetEpoch || 0) < room.resetEpoch) return;
    if (packet.type === 'ROOM_STATE_SNAPSHOT') {
      room.resetEpoch = Math.max(room.resetEpoch, packet.roomMatchState?.resetEpoch || 0);
      room.snapshot = packet;
    }
    if (packet.type === 'START_MATCH_CMD') log('match-started', { roomCode: room.code, resetEpoch: room.resetEpoch, participants: packet.roomMatchState?.participantDirections?.length || null });
    if (packet.type === 'TEAM_CLAIM_RESULT') log('team-claim-result', { roomCode: room.code, clientId: packet.claimedBy, accepted: packet.accepted, direction: packet.direction });
    for (const [id, peer] of room.clients) {
      if (peer === socket) continue;
      if (packet.type !== 'TEAM_CLAIM_RESULT' || packet.claimedBy === id) send(peer, packet);
    }
  });
  socket.on('close', () => {
    clearTimeout(joinDeadline);
    if (!room || room.clients.get(clientId) !== socket) return;
    room.clients.delete(clientId);
    if (room.teacher === socket) room.teacher = null;
    room.touched = Date.now();
    log('client-left', { roomCode: room.code, clientId, role });
    presence(room, 'RELAY_CLIENT_LEFT', clientId, role);
  });
  socket.on('error', () => {});
});
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.alive) { socket.terminate(); continue; }
    socket.alive = false; socket.ping();
  }
  for (const [code, room] of rooms) if (!room.clients.size && Date.now() - room.touched > 300000) rooms.delete(code);
}, 25000);
heartbeat.unref();
server.listen(port, '127.0.0.1', () => log('classroom-relay-listening', { version: 3, port }));
process.on('SIGTERM', () => { clearInterval(heartbeat); wss.close(); server.close(); });
