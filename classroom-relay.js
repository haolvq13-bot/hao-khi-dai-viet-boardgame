'use strict';
(() => {
  // Stored reservations do not prove that a student is still connected.
  window.classroomRelayEnabled = true;
  const LIVE_LEASE_MS = 6500;
  const RELEASE_AFTER_MS = 9500;
  let socket = null, ready = false, teacherPresent = false, conflict = false;
  let reconnectTimer = null, configuredUrl = null, connectedRoom = null;
  let connectedRole = null, connectedClientId = null, connectedAt = 0;
  let lastOnboardingConnection = '';
  const lastSeen = new Map(), departedAt = new Map();
  const previousSend = sendToAllWebRtcPeers;
  const previousRender = renderRoomConnectionStatus;
  const previousRoomConnect = connectToOnlineRoom;
  const identityMatches = () => connectedRoom === currentRoomCode && connectedRole === myRole && connectedClientId === myClientId;
  const live = lane => {
    if (!lane || !lane.online || !ready || !identityMatches() || conflict) return false;
    if (myRole !== 'TEACHER') return teacherPresent && ((hasClaimedCharacter && lane.claimedBy === myClientId) || lane.connected === true);
    const seen = lastSeen.get(lane.claimedBy);
    return seen !== undefined && !departedAt.has(lane.claimedBy) && performance.now() - seen < LIVE_LEASE_MS;
  };
  const send = packet => {
    if (!ready || !identityMatches() || !socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(packet));
    return true;
  };
  window.classroomLaneIsLive = live;
  window.classroomSnapshotLaneIsDeparted = lane => myRole === 'TEACHER' && departedAt.has(lane.claimedBy);
  window.classroomPrepareTeamClaim = refreshPresence;
  window.classroomRelayStatus = () => ({ ready, teacherPresent, conflict, roomCode: connectedRoom, role: connectedRole, clientId: connectedClientId });
  window.isClassroomRelayTeacherReady = () => ready && identityMatches() && myRole === 'TEACHER' && !conflict;
  function refreshPresence() {
    if (myRole !== 'TEACHER') return false;
    let changed = false;
    for (const [key, lane] of Object.entries(allFourLanesState)) {
      const connected = live(lane);
      if (lane.connected !== connected) {
        lane.connected = connected;
        if (!connected) lane.isReady = false;
        changed = true;
      }
      if (!lane.online || connected || !ready || roomMatchState.status !== 'WAITING') continue;
      const left = departedAt.get(lane.claimedBy);
      const since = lastSeen.get(lane.claimedBy) ?? connectedAt;
      if (left !== undefined || performance.now() - since >= RELEASE_AFTER_MS) {
        lastSeen.delete(lane.claimedBy);
        allFourLanesState[key] = createInitialLaneState(key);
        changed = true;
        recordRoomDiagnostic('disconnected-team-released', { direction: key });
      }
    }
    return changed;
  }
  sendToAllWebRtcPeers = packet => {
    if (myRole === 'TEACHER') refreshPresence();
    if (!send(packet) && !configuredUrl) previousSend(packet);
  };
  // HTTPS relay owns the session; do not open a second P2P identity.
  connectToOtherDirectionalPeers = () => ready;
  renderRoomConnectionStatus = () => {
    if (conflict && myRole === 'TEACHER') teacherRoomConflict = true;
    if (window.isClassroomRelayTeacherReady()) teacherRoomConflict = false;
    previousRender();
    const onboardingConnection = [currentRoomCode, ready, teacherPresent, conflict, connectedRole].join('|');
    if (onboardingConnection !== lastOnboardingConnection) {
      lastOnboardingConnection = onboardingConnection;
      renderOnboardingDirectionCards();
    }
    const banner = document.getElementById('roomConnectionBanner');
    if (!banner) return;
    if (!ready || !identityMatches()) {
      if (!conflict) {
        banner.hidden = false;
        banner.textContent = '⏳ Đang nối máy chủ phòng #' + currentRoomCode + '. Giữ trang mở để tự kết nối lại.';
      }
      return;
    }
    if (conflict) return;
    banner.hidden = myRole === 'TEACHER' || teacherPresent;
    if (!banner.hidden) banner.textContent = '⏳ Đã nối máy chủ. Đang chờ cô giáo mở phòng #' + currentRoomCode + '.';
  };
  function requestSnapshot() {
    if (myRole === 'TEACHER') {
      refreshPresence();
      send(buildRoomStateSnapshotPayload());
    } else {
      send({ type: 'REQUEST_SYNC', roomCode: currentRoomCode });
      if (hasClaimedCharacter) send(buildMySyncPayload());
    }
  }
  function onData(packet) {
    if (!packet || packet.roomCode !== currentRoomCode || !identityMatches()) return;
    if (packet.type === 'RELAY_READY') {
      ready = true; conflict = false; teacherPresent = Boolean(packet.teacherPresent);
      connectedAt = performance.now();
      recordRoomDiagnostic('relay-connected', { role: connectedRole });
      requestSnapshot(); updateAllUI(); renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'RELAY_CONFLICT') {
      if (packet.reason === 'client' && myRole === 'STUDENT' && !hasClaimedCharacter) {
        myClientId = 'client_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
        try { sessionStorage.setItem('hkdv_session_client_id', myClientId); } catch (error) { recordRoomDiagnostic('session-storage-unavailable'); }
        if (pendingTeamClaim) pendingTeamClaim.request.claimedBy = myClientId;
        connect(); return;
      }
      conflict = true; ready = false; teacherRoomConflict = myRole === 'TEACHER';
      recordRoomDiagnostic('relay-room-conflict', { role: myRole });
      updateAllUI(); renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'RELAY_PRESENCE' || packet.type === 'RELAY_CLIENT_LEFT') {
      teacherPresent = Boolean(packet.teacherPresent);
      if (packet.role === 'STUDENT' && myRole === 'TEACHER') {
        if (packet.type === 'RELAY_CLIENT_LEFT') {
          lastSeen.delete(packet.clientId); departedAt.set(packet.clientId, performance.now());
        } else departedAt.delete(packet.clientId);
        refreshPresence(); updateAllUI();
      }
      requestSnapshot(); renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'REQUEST_SYNC') { requestSnapshot(); return; }
    if (!['PLAYER_SYNC', 'TEAM_CLAIM_REQUEST', 'TEAM_CLAIM_RESULT', 'ROOM_STATE_SNAPSHOT', 'START_MATCH_CMD', 'ROOM_RESET_CMD'].includes(packet.type)) return;
    if (myRole === 'TEACHER' && (packet.type === 'PLAYER_SYNC' || packet.type === 'TEAM_CLAIM_REQUEST')) {
      lastSeen.set(packet.claimedBy, performance.now());
      departedAt.delete(packet.claimedBy); refreshPresence();
    }
    if (myRole === 'TEACHER' && packet.type === 'ROOM_STATE_SNAPSHOT') {
      packet = { ...packet, lanes: Object.fromEntries(Object.entries(packet.lanes || {}).map(([key, lane]) => [key, { ...lane, connected: live(lane), isReady: live(lane) && lane.isReady === true }])) };
    }
    applyIncomingPlayerSync(packet);
    if (myRole === 'TEACHER') {
      refreshPresence(); renderTeacherHostSidebar(); updateHostLobbyOverlayUI();
      if (packet.type === 'PLAYER_SYNC') send(buildRoomStateSnapshotPayload());
    }
  }
  function connect() {
    if (!configuredUrl || (conflict && identityMatches()) || (socket && socket.readyState <= WebSocket.OPEN && identityMatches())) return;
    clearTimeout(reconnectTimer);
    const old = socket;
    socket = null;
    if (old) { old.onclose = null; old.close(); }
    ready = false; teacherPresent = false; conflict = false;
    connectedRoom = currentRoomCode; connectedRole = myRole; connectedClientId = myClientId;
    lastSeen.clear(); departedAt.clear(); refreshPresence();
    const active = new WebSocket(configuredUrl);
    socket = active;
    active.onopen = () => {
      if (!identityMatches()) { connect(); return; }
      active.send(JSON.stringify({ type: 'RELAY_JOIN', roomCode: connectedRoom, role: connectedRole, clientId: connectedClientId }));
    };
    active.onmessage = event => {
      if (socket !== active) return;
      try { onData(JSON.parse(event.data)); } catch (error) { recordRoomDiagnostic('relay-message-error', { message: String(error) }); }
    };
    active.onerror = () => recordRoomDiagnostic('relay-transport-error');
    active.onclose = () => {
      if (socket !== active) return;
      socket = null; ready = false; teacherPresent = false; refreshPresence();
      recordRoomDiagnostic('relay-disconnected'); updateAllUI(); renderRoomConnectionStatus();
      if (!conflict) reconnectTimer = setTimeout(connect, 1500);
    };
  }
  connectToOnlineRoom = code => {
    previousRoomConnect(code);
    if (!identityMatches()) { conflict = false; connect(); }
  };
  async function loadConfiguration() {
    try {
      const response = await fetch('relay-config.json?v=20261118-fixed1010&t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Relay configuration unavailable');
      const config = await response.json(), url = new URL(config.url);
      const localTest = location.hostname === '127.0.0.1' && url.protocol === 'ws:' && url.hostname === '127.0.0.1';
      if (url.protocol !== 'wss:' && !localTest) throw new Error('Relay requires TLS');
      configuredUrl = url.href; connect();
    } catch (error) {
      recordRoomDiagnostic('relay-config-error', { message: String(error) });
      reconnectTimer = setTimeout(loadConfiguration, 2500);
    }
  }
  window.addEventListener('DOMContentLoaded', () => {
    loadConfiguration();
    setInterval(() => {
      if (refreshPresence()) { updateAllUI(); send(buildRoomStateSnapshotPayload()); }
      if (ready && !identityMatches()) connect();
    }, 500);
    window.addEventListener('online', () => { conflict = false; connect(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { connect(); requestSnapshot(); } });
  });
})();
