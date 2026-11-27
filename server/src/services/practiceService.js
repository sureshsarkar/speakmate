import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import PracticeHistory from '../models/PracticeHistory.js';
import { dayKey, shiftDay } from '../utils/time.js';
import { logger } from '../config/logger.js';
import { notify } from './notificationService.js';

const MIN_RECORDED_SECONDS = 5;

/** Persists history rows (metadata only) and updates stats for both participants. */
export async function recordCall(call, durationSec) {
  if (!call.connectedAt || durationSec < MIN_RECORDED_SECONDS) return;
  const endedAt = new Date();
  const startedAt = new Date(call.connectedAt);

  await Promise.all(
    Object.values(call.sides).map(async (side) => {
      const other = Object.values(call.sides).find((s) => s.key !== side.key);
      try {
        await PracticeHistory.create({
          ownerPublicId: side.key,
          ownerKind: side.kind,
          callKey: call.id,
          partner: {
            publicId: other.profile.publicId,
            displayName: other.profile.displayName,
            avatarUrl: other.profile.avatarUrl,
            englishLevel: other.profile.englishLevel,
            country: other.profile.country,
            isGuest: other.profile.isGuest,
          },
          topic: call.topic,
          kind: call.kind,
          durationSec,
          day: dayKey(endedAt, side.tz),
          startedAt,
          endedAt,
          endReason: call.endReason,
        });
        await updateStats(side, durationSec, endedAt);
      } catch (err) {
        logger.error('Failed to record practice history', err);
      }
    })
  );
}

async function updateStats(side, durationSec, now) {
  const Model = side.kind === 'user' ? User : GuestSession;
  const doc = await Model.findById(side.id);
  if (!doc) return;
  const today = dayKey(now, side.tz);
  const s = doc.stats;

  if (s.todayKey !== today) {
    s.todayKey = today;
    s.todaySeconds = 0;
  }
  s.todaySeconds += durationSec;
  s.totalSeconds += durationSec;
  s.totalCalls += 1;

  if (s.todaySeconds >= 60 && s.lastStreakDay !== today) {
    s.streak = s.lastStreakDay === shiftDay(today, -1) ? s.streak + 1 : 1;
    s.lastStreakDay = today;
    s.longestStreak = Math.max(s.longestStreak, s.streak);
  }

  let goalReached = false;
  if (s.todaySeconds >= doc.dailyGoalMinutes * 60 && s.goalNotifiedDay !== today) {
    s.goalNotifiedDay = today;
    goalReached = true;
  }
  await doc.save();

  if (goalReached && side.kind === 'user') {
    notify(side.key, {
      type: 'goal_completed',
      title: 'Daily goal completed! 🎉',
      body: `You spoke English for ${doc.dailyGoalMinutes} minutes today. Great work!`,
    }).catch((e) => logger.warn('goal notification failed', { error: e.message }));
  }
}
