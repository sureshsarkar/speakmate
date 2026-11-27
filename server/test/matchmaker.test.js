import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matchmaker } from '../src/services/matchmaker.js';

const rules = { initialLevelDiff: 1, relaxEverySec: 10, samePracticeLanguageSec: 20, avoidRecentPartnersSec: 40, recentPartnerMemory: 6 };

const entry = (key, over = {}) => ({
  key,
  socketId: `s-${key}`,
  level: 0,
  practiceLanguage: 'English',
  goals: [],
  country: '',
  premium: false,
  blocked: new Set(),
  recent: new Map(),
  ...over,
});

function make() {
  const matches = [];
  const mm = new Matchmaker({ getRules: () => rules, onMatch: (a, b) => matches.push([a.key, b.key].sort().join('+')) });
  return { mm, matches };
}

test('pairs two compatible users and removes both from the queue', () => {
  const { mm, matches } = make();
  mm.join(entry('a'));
  mm.join(entry('b'));
  assert.deepEqual(matches, ['a+b']);
  assert.equal(mm.size(), 0);
});

test('never matches the same user twice (no duplicates) with three users', () => {
  const { mm, matches } = make();
  mm.join(entry('a'));
  mm.join(entry('b'));
  mm.join(entry('c'));
  assert.equal(matches.length, 1);
  assert.equal(mm.size(), 1);
});

test('blocked users are never matched, in either direction', () => {
  const { mm, matches } = make();
  mm.join(entry('a', { blocked: new Set(['b']) }));
  mm.join(entry('b'));
  // wait long enough that every other rule would be relaxed
  for (const e of mm.queue.values()) e.enqueuedAt -= 10 * 60_000;
  mm.tick();
  assert.equal(matches.length, 0);
  assert.equal(mm.size(), 2);
});

test('level gap is respected at first and relaxes over time', () => {
  const { mm, matches } = make();
  mm.join(entry('a', { level: 0 }));
  mm.join(entry('b', { level: 4 }));
  assert.equal(matches.length, 0);
  for (const e of mm.queue.values()) e.enqueuedAt -= 25_000; // allowed gap = 1 + floor(25/10) = 3
  mm.tick();
  assert.equal(matches.length, 0, 'gap of 4 is still too wide after 25s');
  for (const e of mm.queue.values()) e.enqueuedAt -= 10_000; // 35s -> allowed gap 4
  mm.tick();
  assert.equal(matches.length, 1);
});

test('prefers the closest level among candidates', () => {
  const { mm, matches } = make();
  const now = Date.now();
  // insert without ticking so all three are present when the matcher runs
  mm.queue.set('me', entry('me', { level: 1, enqueuedAt: now - 3000 }));
  mm.queue.set('far', entry('far', { level: 2, enqueuedAt: now - 2000 }));
  mm.queue.set('close', entry('close', { level: 1, enqueuedAt: now - 1000 }));
  mm.tick();
  assert.equal(matches.length, 1);
  assert.equal(matches[0], 'close+me');
});

test('avoids recent partners until the user has waited long enough', () => {
  const { mm, matches } = make();
  mm.join(entry('a', { recent: new Map([['b', Date.now()]]) }));
  mm.join(entry('b'));
  assert.equal(matches.length, 0);
  for (const e of mm.queue.values()) e.enqueuedAt -= 41_000;
  mm.tick();
  assert.equal(matches.length, 1);
});

test('different non-English practice languages wait for the relax window', () => {
  const { mm, matches } = make();
  mm.join(entry('a', { practiceLanguage: 'British English' }));
  mm.join(entry('b', { practiceLanguage: 'American English' }));
  assert.equal(matches.length, 0);
  for (const e of mm.queue.values()) e.enqueuedAt -= 21_000;
  mm.tick();
  assert.equal(matches.length, 1);
});

test('drops disconnected users from the queue', () => {
  const matches = [];
  const alive = new Set(['a']);
  const mm = new Matchmaker({ getRules: () => rules, isAlive: (e) => alive.has(e.key), onMatch: (a, b) => matches.push([a.key, b.key]) });
  mm.join(entry('a'));
  mm.join(entry('b'));
  assert.equal(matches.length, 0);
  assert.equal(mm.size(), 1);
});

test('a user cannot be matched with themselves', () => {
  const { mm, matches } = make();
  mm.join(entry('a'));
  mm.join(entry('a')); // same key replaces the entry
  assert.equal(matches.length, 0);
  assert.equal(mm.size(), 1);
});
