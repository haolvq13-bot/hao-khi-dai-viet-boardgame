'use strict';
(() => {
  let socket = null;
  let ready = false;
  let teacherPresent = false;
  let conflict = false;
  let reconnectTimer = null;
  let configuredUrl = null;
  let connectedRoom = null;
  const releaseTimers = new Map();
  const previousSend = sendToAllWebRtcPeers;
  const previousConnect = connectToOtherDirectionalPeers;
  const previousRender = renderRoomConnectionStatus;
  const previousRoomConnect = connectToOnlineRoom;
  const send = packet => {
    if (!ready || !socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(packet));
    return true;
  };
  window.classroomRelayStatus = () => ({ ready, teacherPresent, conflict, roomCode: connectedRoom });
  window.isClassroomRelayTeacherReady = () => ready && myRole === 'TEACHER' && !conflict;
  sendToAllWebRtcPeers = packet => {
    if (!send(packet)) previousSend(packet);
  };
  connectToOtherDirectionalPeers = code => {
    if (!ready) previousConnect(code);
  };
  renderRoomConnectionStatus = () => {
    if (conflict && myRole === 'TEACHER') teacherRoomConflict = true;
    if (ready && myRole === 'TEACHER' && !conflict) teacherRoomConflict = false;
    previousRender();
    const banner = document.getElementById('roomConnectionBanner');
    if (!banner || !ready || conflict) return;
    banner.hidden = myRole === 'TEACHER' || teacherPresent;
    if (!banner.hidden) banner.textContent = '⏳ Đã nối máy chủ. Đang chờ cô giáo mở phòng #' + currentRoomCode + '.';
  };
  function requestSnapshot() {
    if (myRole === 'TEACHER') send(buildRoomStateSnapshotPayload());
    else {
      send({ type: 'REQUEST_SYNC', roomCode: currentRoomCode });
      if (hasClaimedCharacter) send(buildMySyncPayload());
    }
  }
  function onData(packet) {
    if (!packet || packet.roomCode !== currentRoomCode) return;
    if (packet.type === 'RELAY_READY') {
      ready = true; conflict = false; teacherPresent = Boolean(packet.teacherPresent);
      recordRoomDiagnostic('relay-connected');
      requestSnapshot(); renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'RELAY_CONFLICT') {
      if (packet.reason === 'client' && myRole === 'STUDENT' && !hasClaimedCharacter) {
        myClientId = 'client_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();
        try { sessionStorage.setItem('hkdv_session_client_id', myClientId); } catch (e) {}
        if (pendingTeamClaim) pendingTeamClaim.request.claimedBy = myClientId;
        socket.close(); setTimeout(connect, 300); return;
      }
      conflict = true; teacherRoomConflict = myRole === 'TEACHER';
      recordRoomDiagnostic('relay-room-conflict', { role: myRole });
      renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'RELAY_PRESENCE' || packet.type === 'RELAY_CLIENT_LEFT') {
      teacherPresent = Boolean(packet.teacherPresent);
      if (packet.type === 'RELAY_PRESENCE') {
        clearTimeout(releaseTimers.get(packet.clientId)); releaseTimers.delete(packet.clientId);
        requestSnapshot();
      } else if (myRole === 'TEACHER' && packet.role === 'STUDENT') {
        const leftRoom = currentRoomCode;
        const timer = setTimeout(() => {
          releaseTimers.delete(packet.clientId);
          if (leftRoom !== currentRoomCode || roomMatchState.status !== 'WAITING') return;
          for (const key of Object.keys(allFourLanesState)) {
            if (allFourLanesState[key].claimedBy === packet.clientId) allFourLanesState[key] = createInitialLaneState(key);
          }
          recordRoomDiagnostic('disconnected-team-released');
          updateAllUI(); send(buildRoomStateSnapshotPayload());
        }, 20000);
        releaseTimers.set(packet.clientId, timer);
      }
      renderRoomConnectionStatus(); return;
    }
    if (packet.type === 'REQUEST_SYNC') { requestSnapshot(); return; }
    if (['PLAYER_SYNC','TEAM_CLAIM_REQUEST','TEAM_CLAIM_RESULT','ROOM_STATE_SNAPSHOT','START_MATCH_CMD','ROOM_RESET_CMD'].includes(packet.type)) {
      applyIncomingPlayerSync(packet);
      if (myRole === 'TEACHER' && packet.type === 'PLAYER_SYNC') send(buildRoomStateSnapshotPayload());
    }
  }
  function connect() {
    if (!configuredUrl || conflict || (socket && socket.readyState <= WebSocket.OPEN && connectedRoom === currentRoomCode)) return;
    clearTimeout(reconnectTimer);
    const old = socket;
    socket = null;
    if (old) { old.onclose = null; old.close(); }
    ready = false; teacherPresent = false; connectedRoom = currentRoomCode;
    const active = new WebSocket(configuredUrl);
    socket = active;
    active.onopen = () => {
      active.send(JSON.stringify({ type: 'RELAY_JOIN', roomCode: currentRoomCode, role: myRole, clientId: myClientId }));
    };
    active.onmessage = event => {
      if (socket !== active) return;
      try { onData(JSON.parse(event.data)); } catch (error) { recordRoomDiagnostic('relay-message-error', { message: String(error) }); }
    };
    active.onerror = () => recordRoomDiagnostic('relay-transport-error');
    active.onclose = () => {
      if (socket !== active) return;
      socket = null; ready = false; teacherPresent = false;
      recordRoomDiagnostic('relay-disconnected'); renderRoomConnectionStatus();
      if (!conflict) reconnectTimer = setTimeout(connect, 1500);
    };
  }
  connectToOnlineRoom = code => {
    const changed = String(code || '1010').trim().toUpperCase() !== currentRoomCode;
    if (changed) { conflict = false; ready = false; }
    previousRoomConnect(code);
    if (changed) connect();
  };
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('relay-config.json?v=20261118-relay&t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Relay configuration unavailable');
      const config = await response.json();
      const url = new URL(config.url);
      const localTest = location.hostname === '127.0.0.1' && url.protocol === 'ws:' && url.hostname === '127.0.0.1';
      if (url.protocol !== 'wss:' && !localTest) throw new Error('Relay requires TLS');
      configuredUrl = url.href;
      connect();
    } catch (error) { recordRoomDiagnostic('relay-config-error', { message: String(error) }); }
  });
})();
