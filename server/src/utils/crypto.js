import crypto from 'node:crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
export const callKey = () => crypto.randomBytes(16).toString('base64url');
export const hashIp = (ip) => sha256(`speakmate:${ip || 'unknown'}`).slice(0, 32);

/** Strips +tags (all providers) and dots (gmail) so aliases of one mailbox collapse to one key. */
export function normalizeEmail(email) {
  const [localRaw, domainRaw] = String(email).trim().toLowerCase().split('@');
  let local = localRaw.split('+')[0];
  let domain = domainRaw;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}
