/**
 * Pure, synchronous matchmaking queue.
 *
 * Node runs this in a single thread, and `tick()` removes both members of a pair from
 * the queue before it returns, so a user can never be matched twice (no race window).
 * Async work (DB writes, signalling) happens afterwards in `onMatch`.
 *
 * Entry shape:
 *  { key, socketId, level (0-4), practiceLanguage, goals[], premium, blocked:Set, recent:Map(key->ts),
 *    enqueuedAt, ... }
 */
export class Matchmaker {
  constructor({ getRules, isAlive = () => true, onMatch }) {
    this.queue = new Map();
    this.getRules = getRules;
    this.isAlive = isAlive;
    this.onMatch = onMatch;
    this.timer = null;
  }

  start(intervalMs = 1500) {
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), intervalMs);
      this.timer.unref?.();
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  has(key) {
    return this.queue.has(key);
  }
  get(key) {
    return this.queue.get(key);
  }
  size() {
    return this.queue.size;
  }

  join(entry) {
    entry.enqueuedAt = entry.enqueuedAt || Date.now();
    this.queue.set(entry.key, entry);
    this.tick();
  }

  leave(key) {
    return this.queue.delete(key);
  }

  /** Eligibility is symmetric. `waitedMs` of the pair is the longer wait. */
  eligible(a, b, now, rules) {
    if (a.key === b.key) return false;
    if (a.blocked.has(b.key) || b.blocked.has(a.key)) return false;

    const waited = Math.max(now - a.enqueuedAt, now - b.enqueuedAt) / 1000;
    const diff = Math.abs(a.level - b.level);
    const allowedDiff = rules.initialLevelDiff + Math.floor(waited / rules.relaxEverySec);
    if (diff > allowedDiff) return false;

    const langMismatch = this.languageMismatch(a, b);
    if (langMismatch && waited < rules.samePracticeLanguageSec) return false;

    const recent = a.recent.has(b.key) || b.recent.has(a.key);
    if (recent && waited < rules.avoidRecentPartnersSec) return false;

    return true;
  }

  languageMismatch(a, b) {
    return a.practiceLanguage !== b.practiceLanguage && a.practiceLanguage !== 'English' && b.practiceLanguage !== 'English';
  }

  score(a, b) {
    let s = Math.abs(a.level - b.level) * 10;
    if (this.languageMismatch(a, b)) s += 8;
    if (a.recent.has(b.key) || b.recent.has(a.key)) s += 20;
    // Premium "advanced matching": reward shared learning goals
    if (a.premium || b.premium) {
      const shared = a.goals.filter((g) => b.goals.includes(g)).length;
      s -= shared * 3;
    }
    if (a.country && a.country === b.country) s += 1; // slight preference for meeting someone from elsewhere
    return s + Math.random();
  }

  tick() {
    // drop dead sockets first
    for (const [key, e] of this.queue) {
      if (!this.isAlive(e)) this.queue.delete(key);
    }
    if (this.queue.size < 2) return [];

    const rules = this.getRules();
    const now = Date.now();
    const entries = [...this.queue.values()].sort(
      (x, y) => Number(y.premium) - Number(x.premium) || x.enqueuedAt - y.enqueuedAt
    );
    const used = new Set();
    const pairs = [];

    for (const a of entries) {
      if (used.has(a.key)) continue;
      let best = null;
      let bestScore = Infinity;
      for (const b of entries) {
        if (b === a || used.has(b.key)) continue;
        if (!this.eligible(a, b, now, rules)) continue;
        const sc = this.score(a, b);
        if (sc < bestScore) {
          best = b;
          bestScore = sc;
        }
      }
      if (best) {
        used.add(a.key);
        used.add(best.key);
        pairs.push([a, best]);
      }
    }

    for (const [a, b] of pairs) {
      this.queue.delete(a.key);
      this.queue.delete(b.key);
    }
    for (const [a, b] of pairs) this.onMatch(a, b);
    return pairs;
  }
}
