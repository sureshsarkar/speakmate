import User from '../models/User.js';
import { logger } from '../config/logger.js';
import { dayKey, localTime, shiftDay } from '../utils/time.js';
import { notify } from './notificationService.js';
import { effectiveStats } from '../utils/profile.js';

const STREAK_REMINDER_AT = '20:00';

/** Runs every minute: daily practice and streak reminders (each at most once per local day). */
async function tick() {
  const now = new Date();
  const cursor = User.find({
    status: 'active',
    onboardingCompleted: true,
    $or: [{ 'notifPrefs.dailyReminder': true }, { 'notifPrefs.streakReminder': true }],
  })
    .select('publicId tzOffset stats dailyGoalMinutes notifPrefs lastReminderDay lastStreakReminderDay')
    .cursor();

  for await (const u of cursor) {
    const today = dayKey(now, u.tzOffset);
    const time = localTime(now, u.tzOffset);
    const stats = effectiveStats(u);

    if (u.notifPrefs.dailyReminder && u.lastReminderDay !== today && time >= u.notifPrefs.reminderTime && stats.todaySeconds < u.dailyGoalMinutes * 60) {
      await User.updateOne({ _id: u._id }, { lastReminderDay: today });
      await notify(u.publicId, {
        type: 'daily_reminder',
        title: 'Time to speak English! 🗣️',
        body: `Your goal today is ${u.dailyGoalMinutes} minutes. Find a partner and start talking.`,
      });
    }

    const yesterdayPracticed = u.stats.lastStreakDay === shiftDay(today, -1);
    if (
      u.notifPrefs.streakReminder &&
      u.lastStreakReminderDay !== today &&
      time >= STREAK_REMINDER_AT &&
      yesterdayPracticed &&
      !stats.practicedToday
    ) {
      await User.updateOne({ _id: u._id }, { lastStreakReminderDay: today });
      await notify(u.publicId, {
        type: 'streak_reminder',
        title: `Keep your ${u.stats.streak}-day streak alive 🔥`,
        body: 'One short call today keeps your streak going.',
      });
    }
  }
}

export function startScheduler() {
  const run = () => tick().catch((e) => logger.error('scheduler tick failed', e));
  const timer = setInterval(run, 60_000);
  timer.unref?.();
  return timer;
}
