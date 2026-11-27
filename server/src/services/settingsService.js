import Setting, { DEFAULT_SETTINGS } from '../models/Setting.js';

let cache = null;
let cachedAt = 0;
const TTL = 5000;

const plain = (doc) => {
  const o = doc.toObject();
  delete o._id;
  delete o.__v;
  delete o.key;
  return o;
};

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  let doc = await Setting.findOne({ key: 'app' });
  if (!doc) doc = await Setting.create({ key: 'app' });
  cache = plain(doc);
  cachedAt = Date.now();
  return cache;
}

export async function updateSettings(patch) {
  const doc = (await Setting.findOne({ key: 'app' })) || new Setting({ key: 'app' });
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) doc.set(`${k}.${k2}`, v2);
    } else {
      doc.set(k, v);
    }
  }
  await doc.save();
  cache = plain(doc);
  cachedAt = Date.now();
  return cache;
}

export const publicSettings = (s) => ({
  appName: s.appName,
  tagline: s.tagline,
  logoUrl: s.logoUrl,
  supportEmail: s.supportEmail,
  theme: s.theme,
  guestEnabled: s.guest.enabled,
  maintenance: s.maintenance,
  maxCallMinutes: s.limits.maxCallMinutes,
});

export { DEFAULT_SETTINGS };
