import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as ioClient } from 'socket.io-client';

process.env.USE_MEMORY_DB = 'true';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const { connectDb, disconnectDb } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { initSockets } = await import('../src/sockets/index.js');
const { ensureSeed } = await import('../src/seed/seed.js');
const { callService } = await import('../src/services/callService.js');

let server;
let base;
let ioServer;
const sockets = [];

const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

function connect(token) {
  const socket = ioClient(base, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  socket.ack = (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
  socket.next = (event, ms = 6000) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
      socket.once(event, (d) => {
        clearTimeout(t);
        resolve(d);
      });
    });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (e) => reject(e));
  });
}

async function makeUser(name, email, profile = {}) {
  const reg = await api('/auth/register', { method: 'POST', body: { name, email, password: 'Passw0rd!x' } });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const token = reg.body.token;
  const prof = await api('/profile', {
    method: 'PUT',
    token,
    body: { country: 'India', nativeLanguage: 'Hindi', learningGoals: ['fluency'], completeOnboarding: true, ...profile },
  });
  assert.equal(prof.status, 200, JSON.stringify(prof.body));
  return { token, user: prof.body.user };
}

before(async () => {
  await connectDb();
  await ensureSeed();
  server = http.createServer(createApp());
  ioServer = await initSockets(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  for (const s of sockets) s.close();
  callService.endAll();
  ioServer.close();
  server.close();
  await disconnectDb();
});

const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

test('auth: guests, validation, duplicate-account protection', async () => {
  const g = await api('/auth/guest', { method: 'POST' });
  assert.equal(g.status, 201);
  assert.ok(g.body.token);
  assert.equal(g.body.user.kind, 'guest');
  assert.equal(g.body.user.email, null);

  const bad = await api('/auth/register', { method: 'POST', body: { name: 'X', email: 'nope', password: '123' } });
  assert.equal(bad.status, 422);

  await makeUser('Dupe One', 'dupe.one+a@gmail.com');
  const dup = await api('/auth/register', { method: 'POST', body: { name: 'Dupe Two', email: 'dupeone+b@gmail.com', password: 'Passw0rd!x' } });
  assert.equal(dup.status, 409, 'gmail dots and +tags must collapse to the same mailbox');

  const phone = await api('/auth/register', { method: 'POST', body: { name: 'Call 9876543210', email: 'ph@x.com', password: 'Passw0rd!x' } });
  assert.equal(phone.status, 422, 'display names may not contain phone numbers');

  const wrong = await api('/auth/login', { method: 'POST', body: { email: 'dupe.one+a@gmail.com', password: 'wrong-pass1' } });
  assert.equal(wrong.status, 401);
  const unauth = await api('/stats/summary');
  assert.equal(unauth.status, 401);
});

test('socket requires a valid token', async () => {
  await assert.rejects(connect('not-a-token'));
});

test('random audio call: match, signalling, end, history, privacy', async () => {
  const a = await makeUser('Alice Tester', 'alice@test.dev');
  const b = await makeUser('Bob Tester', 'bob@test.dev', { country: 'Brazil' });
  const sa = await connect(a.token);
  const sb = await connect(b.token);

  const foundA = sa.next('match:found');
  const foundB = sb.next('match:found');
  const [ra, rb] = await Promise.all([sa.ack('queue:join', {}), sb.ack('queue:join', {})]);
  assert.equal(ra.ok, true);
  assert.equal(rb.ok, true);

  // double join must be rejected / idempotent, never create a second queue entry
  const [ma, mb] = await Promise.all([foundA, foundB]);
  assert.equal(ma.partner.displayName, 'Bob Tester');
  assert.equal(mb.partner.displayName, 'Alice Tester');
  assert.notEqual(ma.initiator, mb.initiator);
  assert.equal(ma.callId, mb.callId);
  assert.ok(ma.iceServers.length >= 1);

  // privacy: partner payload contains only public fields
  const keys = Object.keys(ma.partner).sort();
  assert.deepEqual(keys, ['avatarUrl', 'country', 'displayName', 'englishLevel', 'isGuest', 'publicId']);
  assert.ok(!JSON.stringify(ma).includes('alice@test.dev'));

  // joining again while in a call is refused
  const again = await sa.ack('queue:join', {});
  assert.equal(again.ok, false);
  assert.equal(again.code, 'ALREADY_IN_CALL');

  // signalling: offer from the initiator is relayed to the other side only
  const [init, resp] = ma.initiator ? [sa, sb] : [sb, sa];
  const gotOffer = resp.next('rtc:offer');
  const okOffer = await init.ack('rtc:offer', { callId: ma.callId, sdp: { type: 'offer', sdp: SDP } });
  assert.equal(okOffer.ok, true);
  assert.equal((await gotOffer).sdp.type, 'offer');

  // video is refused at the signalling layer
  const video = await init.ack('rtc:offer', { callId: ma.callId, sdp: { type: 'offer', sdp: `${SDP}m=video 9 UDP/TLS/RTP/SAVPF 96\r\n` } });
  assert.equal(video.ok, false);
  // non-initiator may not send offers
  const wrongSide = await resp.ack('rtc:offer', { callId: ma.callId, sdp: { type: 'offer', sdp: SDP } });
  assert.equal(wrongSide.ok, false);

  const gotAnswer = init.next('rtc:answer');
  await resp.ack('rtc:answer', { callId: ma.callId, sdp: { type: 'answer', sdp: SDP } });
  assert.equal((await gotAnswer).sdp.type, 'answer');

  const startedA = sa.next('call:started');
  const startedB = sb.next('call:started');
  await sa.ack('call:connected', { callId: ma.callId });
  await sb.ack('call:connected', { callId: ma.callId });
  await Promise.all([startedA, startedB]);

  // a third party cannot inject signalling into someone else's call
  const c = await makeUser('Carol Tester', 'carol@test.dev');
  const sc = await connect(c.token);
  const intruder = await sc.ack('rtc:ice', { callId: ma.callId, candidate: { candidate: 'x' } });
  assert.equal(intruder.ok, false);

  await new Promise((r) => setTimeout(r, 5600)); // calls under 5s are not recorded

  const endedA = sa.next('call:ended');
  const endedB = sb.next('call:ended');
  await sa.ack('call:end', { callId: ma.callId });
  const [ea, eb] = await Promise.all([endedA, endedB]);
  assert.equal(ea.endedByMe, true);
  assert.equal(eb.endedByMe, false);
  assert.ok(ea.durationSec >= 5);
  assert.ok(ea.topic.title);

  await new Promise((r) => setTimeout(r, 400));
  const hist = await api('/stats/history', { token: a.token });
  assert.equal(hist.body.total, 1);
  assert.equal(hist.body.items[0].partner.displayName, 'Bob Tester');
  const sum = await api('/stats/summary', { token: b.token });
  assert.equal(sum.body.stats.totalCalls, 1);
  assert.ok(sum.body.stats.totalSeconds >= 5);

  // feedback + favorites + connection flow
  const fb = await api(`/calls/${ea.callKey}/feedback`, { method: 'POST', token: a.token, body: { friendly: true, comfortable: true, connectAgain: true, rating: 5 } });
  assert.equal(fb.status, 200);
  const fav = await api('/favorites', { method: 'POST', token: a.token, body: { publicId: ea.partner.publicId } });
  assert.equal(fav.status, 201);
  const favs = await api('/favorites', { token: a.token });
  assert.equal(favs.body.items.length, 1);
  assert.ok(!JSON.stringify(favs.body).includes('bob@test.dev'));

  const req = await api('/connections', { method: 'POST', token: a.token, body: { publicId: ea.partner.publicId } });
  assert.equal(req.status, 201);
  const bNotifs = await api('/notifications', { token: b.token });
  assert.equal(bNotifs.body.items[0].type, 'friend_request');
  const accept = await api(`/connections/${bNotifs.body.items[0].data.connectionId}/respond`, { method: 'POST', token: b.token, body: { accept: true } });
  assert.equal(accept.body.status, 'accepted');

  // report + block, then they must never be matched again
  const rep = await api('/reports', { method: 'POST', token: a.token, body: { reportedPublicId: ea.partner.publicId, reason: 'other', details: 'test' } });
  assert.equal(rep.status, 201);
  const blk = await api('/blocks', { method: 'POST', token: a.token, body: { publicId: ea.partner.publicId } });
  assert.equal(blk.status, 201);

  let matched = false;
  sa.once('match:found', () => (matched = true));
  await sa.ack('queue:join', {});
  await sb.ack('queue:join', {});
  await new Promise((r) => setTimeout(r, 3500));
  assert.equal(matched, false, 'blocked users must not match');
  await sa.ack('queue:leave');
  await sb.ack('queue:leave');
});

test('disconnecting while searching removes the user from the queue', async () => {
  const d = await makeUser('Dave Tester', 'dave@test.dev');
  const sd = await connect(d.token);
  assert.equal((await sd.ack('queue:join', {})).ok, true);
  sd.close();
  await new Promise((r) => setTimeout(r, 300));
  const e = await makeUser('Erin Tester', 'erin@test.dev');
  const se = await connect(e.token);
  let matched = false;
  se.once('match:found', () => (matched = true));
  await se.ack('queue:join', {});
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal(matched, false);
  await se.ack('queue:leave');
});

test('next partner ends the call and requeues; partner is told', async () => {
  const f = await makeUser('Frank Tester', 'frank@test.dev');
  const g = await makeUser('Gina Tester', 'gina@test.dev');
  const sf = await connect(f.token);
  const sg = await connect(g.token);
  const mf = sf.next('match:found');
  await Promise.all([sf.ack('queue:join', {}), sg.ack('queue:join', {})]);
  const found = await mf;
  const endedG = sg.next('call:ended');
  const r = await sf.ack('call:next', { callId: found.callId });
  assert.equal(r.ok, true);
  const e = await endedG;
  assert.equal(e.endedByMe, false);
  assert.equal(e.reason, 'skipped');
  await sf.ack('queue:leave');
});

test('admin: login, permissions, dashboard, user management, settings', async () => {
  const login = await api('/admin/auth/login', { method: 'POST', body: { email: 'admin@speakmate.app', password: 'Admin@12345' } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const t = login.body.token;

  const noAuth = await api('/admin/dashboard');
  assert.equal(noAuth.status, 401);
  const userToken = (await makeUser('Hank Tester', 'hank@test.dev')).token;
  assert.equal((await api('/admin/dashboard', { token: userToken })).status, 401, 'user tokens are not admin tokens');

  const dash = await api('/admin/dashboard', { token: t });
  assert.equal(dash.status, 200);
  assert.ok(dash.body.stats.registeredUsers >= 5);
  assert.ok(dash.body.stats.totalCalls >= 1);

  const list = await api('/admin/users?q=Hank', { token: t });
  assert.equal(list.body.items.length, 1);
  const id = list.body.items[0].id;

  const susp = await api(`/admin/users/${id}/status`, { method: 'POST', token: t, body: { status: 'suspended', reason: 'test', days: 1 } });
  assert.equal(susp.body.user.status, 'suspended');
  assert.equal((await api('/auth/me', { token: userToken })).status, 403);
  await api(`/admin/users/${id}/status`, { method: 'POST', token: t, body: { status: 'active' } });
  assert.equal((await api('/auth/me', { token: userToken })).status, 200);

  const prem = await api(`/admin/users/${id}/premium`, { method: 'POST', token: t, body: { grant: true, days: 30 } });
  assert.equal(prem.body.user.plan, 'premium');

  const reports = await api('/admin/reports', { token: t });
  assert.ok(reports.body.items.length >= 1);
  const inv = await api(`/admin/reports/${reports.body.items[0].id}`, { token: t });
  assert.equal(inv.status, 200);

  const health = await api('/admin/calls/health', { token: t });
  assert.equal(health.body.health.dbState, 'connected');

  const topic = await api('/admin/content/topics', { method: 'POST', token: t, body: { slug: 'test-topic', title: 'Test Topic', starters: ['Hello?'] } });
  assert.equal(topic.status, 201);
  const topics = await api('/content/topics');
  assert.ok(topics.body.topics.some((x) => x.slug === 'test-topic'));

  const maint = await api('/admin/settings', { method: 'PUT', token: t, body: { maintenance: { enabled: true, message: 'Down for tests' } } });
  assert.equal(maint.body.settings.maintenance.enabled, true);
  assert.equal((await api('/stats/summary', { token: userToken })).status, 503);
  assert.equal((await api('/config')).status, 200, 'public config stays reachable in maintenance');
  await api('/admin/settings', { method: 'PUT', token: t, body: { maintenance: { enabled: false } } });

  // a support admin cannot change settings
  await api('/admin/admins', { method: 'POST', token: t, body: { email: 'support@test.dev', name: 'Sup', password: 'Passw0rd!x', role: 'support' } });
  const sup = await api('/admin/auth/login', { method: 'POST', body: { email: 'support@test.dev', password: 'Passw0rd!x' } });
  assert.equal((await api('/admin/settings', { token: sup.body.token })).status, 403);
  assert.equal((await api('/admin/users', { token: sup.body.token })).status, 200);
});
