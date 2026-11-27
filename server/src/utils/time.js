/** YYYY-MM-DD for `date` in a timezone given as JS getTimezoneOffset() minutes (UTC - local). */
export function dayKey(date = new Date(), tzOffsetMin = 0) {
  return new Date(date.getTime() - tzOffsetMin * 60000).toISOString().slice(0, 10);
}

export function shiftDay(key, days) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "HH:MM" of `date` in the timezone. */
export function localTime(date = new Date(), tzOffsetMin = 0) {
  return new Date(date.getTime() - tzOffsetMin * 60000).toISOString().slice(11, 16);
}

export const clampTz = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.round(n) : 0;
};
