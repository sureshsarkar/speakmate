/**
 * CallEngine: audio-only WebRTC calling + matchmaking client.
 *
 * Hard rules enforced here:
 *  - getUserMedia({ audio: true, video: false }); any video track is rejected and stopped.
 *  - No <video> elements: remote audio plays through a detached HTMLAudioElement.
 *  - Incoming SDP that negotiates video is rejected.
 *  - Microphone tracks, the AudioContext and the RTCPeerConnection are released after every call.
 *  - Nothing is recorded; audio only flows peer-to-peer.
 */
import { useCallStore, initialCall } from '../store/callStore';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { onSocketCreated } from './socket';

const FOUND_SCREEN_MS = 2200;
const QUALITY_INTERVAL_MS = 3000;
const RECONNECT_WAIT_MS = 2500;
const RECONNECT_DEADLINE_MS = 20000;

export function describeMicError(err) {
  const name = err?.name || '';
  if (!window.isSecureContext) {
    return { code: 'MIC_INSECURE', message: 'Microphone access needs a secure (HTTPS) connection.' };
  }
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) {
    return {
      code: 'MIC_DENIED',
      message: 'Microphone access is blocked. Tap the lock icon in your browser address bar, allow the microphone, then try again.',
    };
  }
  if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name)) {
    return { code: 'MIC_NOT_FOUND', message: 'No microphone was found. Connect or enable a microphone and try again.' };
  }
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) {
    return { code: 'MIC_BUSY', message: 'Your microphone is being used by another app. Close it and try again.' };
  }
  if (name === 'UNSUPPORTED') {
    return { code: 'MIC_UNSUPPORTED', message: 'This browser cannot use the microphone. Try a recent Chrome, Edge, Firefox or Safari.' };
  }
  return { code: 'MIC_ERROR', message: 'We could not start your microphone. Please try again.' };
}

class CallEngine {
  constructor() {
    this.socket = null;
    this.call = null; // { id, initiator, kind, iceServers }
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.audioEl = null;
    this.audioCtx = null;
    this.localSource = null;
    this.remoteSource = null;
    this.pendingIce = [];
    this.timers = {};
    this.skipping = false;
    this.localReason = null;
    this.restarting = false;
    this.statsPrev = null;
    this.reportedQuality = null;
    this.retries = 0;
    this.wakeLock = null;

    onSocketCreated((s) => this.attach(s));
    window.addEventListener('pagehide', (e) => {
      if (e.persisted) return;
      if (this.call) this.socket?.emit('call:end', { callId: this.call.id });
      this.teardown();
    });
  }

  get state() {
    return useCallStore.getState();
  }
  set(p) {
    useCallStore.setState(p);
  }
  get app() {
    return useAppStore.getState();
  }

  // ------------------------------------------------------------------ socket
  attach(socket) {
    this.socket = socket;
    const app = () => useAppStore.getState();

    socket.on('connect', () => {
      app().setSocketState('connected');
      this.onReconnected();
    });
    socket.on('disconnect', () => app().setSocketState('reconnecting'));
    socket.on('connect_error', (err) => {
      if (['TOKEN_INVALID', 'ACCOUNT_BLOCKED', 'ACCOUNT_SUSPENDED', 'UNAUTHORIZED'].includes(err.message)) {
        useAuthStore.getState().logout('Your session has ended. Please sign in again.');
      } else {
        app().setSocketState('reconnecting');
      }
    });

    socket.on('presence:stats', (s) => app().setOnline(s));
    socket.on('account:restricted', () => useAuthStore.getState().logout('Your account has been restricted by an administrator.'));
    socket.on('notification:new', (n) => {
      app().bumpUnread();
      app().toast(n.title, 'info');
      this.notifyLocal(n.title, n.body);
    });
    socket.on('queue:error', (e) => {
      this.teardown();
      this.set({ phase: 'idle', error: { code: e.code, message: e.message } });
      app().toast(e.message, 'error');
    });

    socket.on('match:found', (d) => this.onMatchFound(d));
    socket.on('rtc:offer', (d) => this.onOffer(d));
    socket.on('rtc:answer', (d) => this.onAnswer(d));
    socket.on('rtc:ice', (d) => this.onIce(d));
    socket.on('rtc:restart-request', (d) => {
      if (this.call && d.callId === this.call.id && this.call.initiator) this.tryIceRestart();
    });
    socket.on('call:started', (d) => {
      if (!this.call || d.callId !== this.call.id) return;
      this.retries = 0;
      this.set({ phase: 'in_call', elapsedBase: d.elapsedSec, startedAtLocal: Date.now(), maxDurationSec: d.maxDurationSec });
      this.acquireWakeLock();
    });
    socket.on('call:ended', (d) => {
      if (this.call && d.callId === this.call.id) this.handleEnded(d);
    });
    socket.on('partner:status', (d) => {
      if (this.call && d.callId === this.call.id) this.set({ partnerStatus: d.state });
    });

    socket.on('direct:incoming', (d) => this.onDirectIncoming(d));
    socket.on('direct:ended', (d) => this.onDirectEnded(d));
  }

  emit(event, payload = {}, timeout = 8000) {
    return new Promise((resolve) => {
      const s = this.socket;
      if (!s || !s.connected) return resolve({ ok: false, code: 'OFFLINE', message: 'You are offline. Reconnecting...' });
      const t = setTimeout(() => resolve({ ok: false, code: 'TIMEOUT', message: 'The server did not respond. Please try again.' }), timeout);
      s.emit(event, payload, (res) => {
        clearTimeout(t);
        resolve(res || { ok: false });
      });
    });
  }

  async onReconnected() {
    const { phase } = this.state;
    if (this.call && ['found', 'connecting', 'in_call'].includes(phase)) {
      const res = await this.emit('call:rejoin', { callId: this.call.id });
      if (res.ok) {
        if (res.status === 'in_call') this.set({ phase: 'in_call', elapsedBase: res.elapsedSec, startedAtLocal: Date.now() });
        if (this.pc?.connectionState === 'connected') this.socket.emit('call:connected', { callId: this.call.id });
        else if (this.pc && ['failed', 'disconnected'].includes(this.pc.connectionState)) this.tryIceRestart();
      } else if (res.code === 'CALL_ENDED' && res.ended) {
        this.handleEnded(res.ended);
      } else {
        this.handleEnded(this.localSummary('connection_lost'));
      }
    } else if (phase === 'searching') {
      const res = await this.emit('queue:join', { topicId: this.state.topicSlug });
      if (!res.ok) this.abortSearch(res);
    } else if (['inviting'].includes(phase)) {
      this.teardown();
      this.set({ phase: 'idle', outgoing: null });
    }
  }

  // --------------------------------------------------------------- microphone
  async acquireMic() {
    this.releaseLocal();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'UNSUPPORTED' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (stream.getVideoTracks().length) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Video tracks are not allowed in SpeakMate');
    }
    this.localStream = stream;
    stream.getAudioTracks().forEach((t) => {
      try {
        t.contentHint = 'speech';
      } catch {
        /* optional */
      }
      t.onended = () => this.onMicLost();
    });
    this.ensureAudioContext();
    this.localSource = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.makeAnalyser();
    this.localSource.connect(analyser); // analysis only, never routed to the speakers
    this.set({ analysers: { ...this.state.analysers, local: analyser } });
  }

  onMicLost() {
    if (!this.localStream) return;
    this.app.toast('Your microphone was disconnected.', 'error');
    if (this.call) this.endCall('microphone_lost');
    else this.cancelSearch();
  }

  ensureAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new Ctx();
    }
    this.audioCtx.resume?.().catch(() => {});
  }

  makeAnalyser() {
    const a = this.audioCtx.createAnalyser();
    a.fftSize = 256;
    a.smoothingTimeConstant = 0.78;
    return a;
  }

  releaseLocal() {
    try {
      this.localSource?.disconnect();
    } catch {
      /* ignore */
    }
    this.localSource = null;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localStream = null;
    }
  }

  setMuted(muted) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.set({ muted });
  }
  toggleMute() {
    this.setMuted(!this.state.muted);
  }

  // ------------------------------------------------------------------ search
  async startSearch({ topicSlug } = {}) {
    const { phase } = this.state;
    if (!['idle', 'ended'].includes(phase)) return false;
    this.set({
      ...initialCall,
      incoming: this.state.incoming,
      topicSlug: topicSlug === undefined ? this.state.topicSlug : topicSlug,
      phase: 'requesting_mic',
      searchStartedAt: Date.now(),
    });
    try {
      await this.acquireMic();
    } catch (e) {
      return this.failStart(describeMicError(e));
    }
    this.set({ phase: 'searching' });
    const res = await this.emit('queue:join', { topicId: this.state.topicSlug });
    if (!res.ok) return this.abortSearch(res);
    return true;
  }

  failStart(error) {
    this.teardown();
    this.set({ phase: 'idle', error });
    this.app.toast(error.message, 'error', 6000);
    return false;
  }

  abortSearch(res) {
    this.teardown();
    this.set({ phase: 'idle', error: { code: res.code, message: res.message } });
    if (res.message) this.app.toast(res.message, 'error', 6000);
    return false;
  }

  cancelSearch() {
    const { phase } = this.state;
    if (['searching', 'requesting_mic'].includes(phase)) this.socket?.emit('queue:leave', {});
    if (phase === 'inviting' && this.state.outgoing && !this.state.outgoing.accepting) {
      this.socket?.emit('direct:cancel', { inviteId: this.state.outgoing.inviteId });
    }
    this.teardown();
    this.set({ ...initialCall, topicSlug: this.state.topicSlug, incoming: this.state.incoming });
  }

  // ------------------------------------------------------------ match found
  onMatchFound(d) {
    if (this.call) return; // already in a call
    if (!this.localStream) {
      // We lost the microphone between queueing and matching: leave politely.
      this.socket?.emit('call:end', { callId: d.callId });
      return;
    }
    clearTimeout(this.timers.found);
    this.call = { id: d.callId, initiator: d.initiator, kind: d.kind, iceServers: d.iceServers };
    this.pendingIce = [];
    this.statsPrev = null;
    this.reportedQuality = null;
    this.localReason = null;
    this.set({
      phase: 'found',
      callId: d.callId,
      kind: d.kind,
      partner: d.partner,
      topic: d.topic,
      initiator: d.initiator,
      maxDurationSec: d.maxDurationSec,
      connection: 'connecting',
      quality: 'unknown',
      elapsedBase: 0,
      startedAtLocal: null,
      partnerStatus: 'connected',
      audioBlocked: false,
      muted: false,
      summary: null,
      error: null,
      outgoing: null,
      incoming: null,
    });
    this.notifyLocal('Partner found!', `${d.partner.displayName} is ready to talk.`);
    this.createPeer(d.iceServers);
    this.timers.found = setTimeout(() => {
      if (!this.call) return;
      if (this.state.phase === 'found') this.set({ phase: 'connecting' });
      if (this.call.initiator) this.makeOffer();
    }, FOUND_SCREEN_MS);
  }

  // ------------------------------------------------------------------ WebRTC
  createPeer(iceServers) {
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });
    this.pc = pc;
    this.localStream.getAudioTracks().forEach((t) => pc.addTrack(t, this.localStream));
    pc.onicecandidate = (e) => {
      if (pc !== this.pc || !this.call || !e.candidate) return;
      this.socket?.emit('rtc:ice', { callId: this.call.id, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (pc === this.pc) this.onRemoteTrack(e);
    };
    pc.onconnectionstatechange = () => {
      if (pc === this.pc) this.onPcState(pc.connectionState);
    };
  }

  async makeOffer() {
    const pc = this.pc;
    if (!pc || !this.call) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('rtc:offer', { callId: this.call.id, sdp: { type: offer.type, sdp: offer.sdp } });
    } catch (err) {
      console.error('createOffer failed', err);
      this.failCall('network_failure');
    }
  }

  hasVideo(sdp) {
    return /^m=video/m.test(sdp?.sdp || '');
  }

  async onOffer({ callId, sdp }) {
    if (!this.call || callId !== this.call.id || !this.pc) return;
    if (this.hasVideo(sdp)) return this.failCall('protocol_error');
    try {
      await this.pc.setRemoteDescription(sdp);
      await this.flushIce();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.socket.emit('rtc:answer', { callId, sdp: { type: answer.type, sdp: answer.sdp } });
    } catch (err) {
      console.error('handling offer failed', err);
      this.failCall('network_failure');
    }
  }

  async onAnswer({ callId, sdp }) {
    if (!this.call || callId !== this.call.id || !this.pc) return;
    if (this.hasVideo(sdp)) return this.failCall('protocol_error');
    try {
      await this.pc.setRemoteDescription(sdp);
      await this.flushIce();
    } catch (err) {
      console.error('handling answer failed', err);
    }
  }

  async onIce({ callId, candidate }) {
    if (!this.call || callId !== this.call.id || !this.pc || !candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* stale candidates are harmless */
    }
  }

  async flushIce() {
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }

  onRemoteTrack(e) {
    if (e.track.kind !== 'audio') {
      e.track.stop();
      return;
    }
    const stream = e.streams[0] || new MediaStream([e.track]);
    this.remoteStream = stream;
    if (!this.audioEl) {
      this.audioEl = new Audio(); // detached audio element: never a video element
      this.audioEl.autoplay = true;
      this.audioEl.setAttribute('playsinline', '');
    }
    this.audioEl.srcObject = stream;
    this.audioEl.volume = this.state.volume;
    this.audioEl.muted = this.state.speakerMuted;
    this.audioEl
      .play()
      .then(() => this.set({ audioBlocked: false }))
      .catch(() => this.set({ audioBlocked: true }));

    this.ensureAudioContext();
    try {
      this.remoteSource?.disconnect();
    } catch {
      /* ignore */
    }
    this.remoteSource = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.makeAnalyser();
    this.remoteSource.connect(analyser);
    this.set({ analysers: { ...this.state.analysers, remote: analyser } });
  }

  /** Called from a tap when the browser blocked autoplay. */
  resumeAudio() {
    this.ensureAudioContext();
    this.audioEl
      ?.play()
      .then(() => this.set({ audioBlocked: false }))
      .catch(() => {});
  }

  onPcState(state) {
    if (!this.call) return;
    if (state === 'connecting') {
      if (this.state.connection !== 'reconnecting') this.set({ connection: 'connecting' });
    } else if (state === 'connected') {
      clearTimeout(this.timers.reconnect);
      clearTimeout(this.timers.fail);
      this.timers.fail = null;
      this.set({ connection: 'connected' });
      this.socket?.emit('call:connected', { callId: this.call.id });
      this.startQualityLoop();
      this.tuneSender();
    } else if (state === 'disconnected') {
      this.set({ connection: 'reconnecting', quality: 'poor' });
      clearTimeout(this.timers.reconnect);
      this.timers.reconnect = setTimeout(() => this.tryIceRestart(), RECONNECT_WAIT_MS);
    } else if (state === 'failed') {
      this.set({ connection: 'reconnecting', quality: 'poor' });
      this.tryIceRestart();
    }
  }

  async tuneSender() {
    try {
      const sender = this.pc?.getSenders().find((s) => s.track?.kind === 'audio');
      if (!sender) return;
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = 40000; // plenty for wideband speech
      await sender.setParameters(p);
    } catch {
      /* optional optimisation */
    }
  }

  /** Automatic reconnection: the initiator renegotiates with an ICE restart. */
  async tryIceRestart() {
    if (!this.pc || !this.call || this.restarting) return;
    this.set({ connection: 'reconnecting' });
    if (!this.timers.fail) {
      this.timers.fail = setTimeout(() => {
        this.timers.fail = null;
        if (this.state.connection !== 'connected') this.failCall('network_failure');
      }, RECONNECT_DEADLINE_MS);
    }
    if (this.call.initiator) {
      this.restarting = true;
      try {
        const offer = await this.pc.createOffer({ iceRestart: true });
        await this.pc.setLocalDescription(offer);
        this.socket?.emit('rtc:offer', { callId: this.call.id, sdp: { type: offer.type, sdp: offer.sdp } });
      } catch (err) {
        console.error('ICE restart failed', err);
      } finally {
        this.restarting = false;
      }
    } else {
      this.socket?.emit('rtc:restart-request', { callId: this.call.id });
    }
  }

  failCall(reason) {
    if (!this.call) return;
    this.endCall(reason);
  }

  // ------------------------------------------------------------ quality loop
  startQualityLoop() {
    if (this.timers.quality) return;
    this.timers.quality = setInterval(() => this.sampleQuality(), QUALITY_INTERVAL_MS);
  }

  async sampleQuality() {
    const pc = this.pc;
    if (!pc || !this.call || this.state.connection !== 'connected') return;
    try {
      const stats = await pc.getStats();
      let rtt = null;
      let lost = 0;
      let received = 0;
      let jitter = 0;
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected) && r.currentRoundTripTime != null) {
          rtt = r.currentRoundTripTime * 1000;
        }
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          lost = r.packetsLost || 0;
          received = r.packetsReceived || 0;
          jitter = (r.jitter || 0) * 1000;
        }
      });
      const prev = this.statsPrev || { lost: 0, received: 0 };
      const dLost = Math.max(0, lost - prev.lost);
      const dRecv = Math.max(0, received - prev.received);
      this.statsPrev = { lost, received };
      const total = dLost + dRecv;
      if (rtt == null && total === 0) return;
      const loss = total ? dLost / total : 0;
      let q = 'good';
      if ((rtt ?? 0) > 300 || loss > 0.08 || jitter > 60) q = 'poor';
      else if ((rtt ?? 0) > 150 || loss > 0.03 || jitter > 30) q = 'fair';
      this.set({ quality: q });
      if (q !== this.reportedQuality) {
        this.reportedQuality = q;
        this.socket?.emit('call:quality', { callId: this.call.id, quality: q });
      }
    } catch {
      /* stats are best-effort */
    }
  }

  // ------------------------------------------------------------- user actions
  endCall(reason = null) {
    if (!this.call) return;
    this.localReason = reason;
    clearTimeout(this.timers.endFallback);
    this.timers.endFallback = setTimeout(() => this.handleEnded(this.localSummary(reason || 'ended')), 2500);
    this.emit('call:end', { callId: this.call.id }, 2000);
  }

  nextPartner() {
    if (!this.call) return this.startSearch();
    this.skipping = true;
    this.endCall();
  }

  localSummary(reason) {
    const s = this.state;
    const elapsed = s.startedAtLocal ? Math.round(s.elapsedBase + (Date.now() - s.startedAtLocal) / 1000) : 0;
    return {
      callId: this.call?.id || s.callId,
      callKey: this.call?.id || s.callId,
      reason,
      endedByMe: true,
      connected: Boolean(s.startedAtLocal),
      durationSec: elapsed,
      practiceMinutes: Math.round((elapsed / 60) * 10) / 10,
      topic: s.topic,
      partner: s.partner,
      kind: s.kind,
    };
  }

  handleEnded(data) {
    if (!this.call) return;
    clearTimeout(this.timers.endFallback);
    const skipping = this.skipping;
    this.skipping = false;
    const reason = this.localReason || data.reason;
    this.localReason = null;
    this.teardown();

    if (skipping) {
      this.set({ ...initialCall, topicSlug: this.state.topicSlug, incoming: this.state.incoming });
      this.startSearch();
      return;
    }
    // The partner left (or the link failed) before the call ever started: just find someone new.
    const lostBeforeStart = !data.connected && (reason === 'connect_failed' || (!data.endedByMe && ['ended', 'skipped', 'partner_disconnected'].includes(reason)));
    if (lostBeforeStart && this.retries < 3) {
      this.retries += 1;
      this.app.toast(reason === 'connect_failed' ? 'Could not connect. Finding a new partner...' : 'Your partner left. Finding someone new...', 'info');
      this.set({ ...initialCall, topicSlug: this.state.topicSlug, incoming: this.state.incoming });
      this.startSearch();
      return;
    }
    this.retries = 0;
    this.set({
      phase: 'ended',
      summary: { ...data, reason },
      connection: 'new',
      callId: null,
      analysers: { local: null, remote: null },
    });
  }

  // ------------------------------------------------------------ speaker/output
  setVolume(volume) {
    if (this.audioEl) this.audioEl.volume = volume;
    this.set({ volume });
  }
  toggleSpeaker() {
    const speakerMuted = !this.state.speakerMuted;
    if (this.audioEl) this.audioEl.muted = speakerMuted;
    this.set({ speakerMuted });
  }
  get supportsOutputSelection() {
    return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  }
  async listOutputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audiooutput');
  }
  async setOutput(deviceId) {
    if (!this.audioEl || !this.supportsOutputSelection) return false;
    try {
      await this.audioEl.setSinkId(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------ direct calls
  async startDirect(partner) {
    if (!['idle', 'ended'].includes(this.state.phase)) return false;
    this.set({ ...initialCall, topicSlug: this.state.topicSlug, phase: 'requesting_mic', searchStartedAt: Date.now() });
    try {
      await this.acquireMic();
    } catch (e) {
      return this.failStart(describeMicError(e));
    }
    this.set({ phase: 'inviting', outgoing: { inviteId: null, to: partner, accepting: false } });
    const res = await this.emit('direct:invite', { toPublicId: partner.publicId });
    if (!res.ok) return this.abortSearch(res);
    if (res.state === 'notified') {
      this.teardown();
      this.set({ ...initialCall, topicSlug: this.state.topicSlug });
      this.app.toast(`${partner.displayName} is offline. We sent them a practice request.`, 'success', 6000);
      return true;
    }
    this.set({ outgoing: { inviteId: res.inviteId, to: partner, accepting: false } });
    return true;
  }

  onDirectIncoming({ inviteId, from, expiresInSec }) {
    if (this.state.phase !== 'idle' || this.state.incoming) {
      this.socket?.emit('direct:decline', { inviteId });
      return;
    }
    clearTimeout(this.timers.incoming);
    this.set({ incoming: { inviteId, from, expiresAt: Date.now() + expiresInSec * 1000 } });
    this.notifyLocal(`${from.displayName} is calling you`, 'Open SpeakMate to answer.');
    this.timers.incoming = setTimeout(() => this.set({ incoming: null }), expiresInSec * 1000);
  }

  async acceptDirect() {
    const inc = this.state.incoming;
    if (!inc) return;
    clearTimeout(this.timers.incoming);
    this.set({ ...initialCall, topicSlug: this.state.topicSlug, phase: 'requesting_mic' });
    try {
      await this.acquireMic();
    } catch (e) {
      this.socket?.emit('direct:decline', { inviteId: inc.inviteId });
      return this.failStart(describeMicError(e));
    }
    this.set({ phase: 'inviting', outgoing: { inviteId: inc.inviteId, to: inc.from, accepting: true } });
    const res = await this.emit('direct:accept', { inviteId: inc.inviteId });
    if (!res.ok) this.abortSearch(res);
  }

  declineDirect() {
    const inc = this.state.incoming;
    if (!inc) return;
    clearTimeout(this.timers.incoming);
    this.socket?.emit('direct:decline', { inviteId: inc.inviteId });
    this.set({ incoming: null });
  }

  onDirectEnded({ inviteId, reason }) {
    const { incoming, outgoing } = this.state;
    if (incoming?.inviteId === inviteId) this.set({ incoming: null });
    if (outgoing?.inviteId === inviteId && !this.call) {
      const name = outgoing.to?.displayName || 'Your partner';
      this.teardown();
      this.set({ ...initialCall, topicSlug: this.state.topicSlug, incoming: this.state.incoming });
      const msg =
        reason === 'declined' ? `${name} declined the call.` : reason === 'timeout' ? `${name} did not answer.` : reason === 'failed' ? 'The call could not be started.' : 'Call cancelled.';
      this.app.toast(msg, 'info');
    }
  }

  // ----------------------------------------------------------------- utilities
  async notifyLocal(title, body) {
    try {
      if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'speakmate-live', data: { url: '/practice' } });
      else new Notification(title, { body, icon: '/icons/icon-192.png' });
    } catch {
      /* notifications are optional */
    }
  }

  async acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => (this.wakeLock = null));
      }
    } catch {
      /* optional */
    }
  }

  /** Clears call timers. The "incoming direct call" expiry timer is independent of any call. */
  stopTimers() {
    for (const k of Object.keys(this.timers)) {
      if (k === 'incoming') continue;
      if (k === 'quality') clearInterval(this.timers[k]);
      else clearTimeout(this.timers[k]);
      delete this.timers[k];
    }
  }

  /** Releases the microphone, peer connection, audio graph and timers. Safe to call repeatedly. */
  teardown() {
    this.stopTimers();
    if (this.pc) {
      const pc = this.pc;
      this.pc = null;
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      try {
        pc.getSenders().forEach((s) => s.track && s.track.stop());
        pc.close();
      } catch {
        /* ignore */
      }
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
    try {
      this.remoteSource?.disconnect();
    } catch {
      /* ignore */
    }
    this.remoteSource = null;
    this.remoteStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream = null;
    this.releaseLocal();
    if (this.audioCtx && this.audioCtx.state !== 'closed') this.audioCtx.close().catch(() => {});
    this.audioCtx = null;
    this.wakeLock?.release?.().catch(() => {});
    this.wakeLock = null;
    this.call = null;
    this.pendingIce = [];
    this.restarting = false;
    this.set({ analysers: { local: null, remote: null }, audioBlocked: false });
  }

  /** "Back home" from the call-ended screen. */
  reset() {
    this.set({ ...initialCall, topicSlug: this.state.topicSlug, incoming: this.state.incoming });
  }

  /** On logout or account restriction. */
  hardReset() {
    clearTimeout(this.timers.incoming);
    this.teardown();
    this.skipping = false;
    this.localReason = null;
    this.retries = 0;
    this.set({ ...initialCall });
  }
}

export const engine = new CallEngine();
