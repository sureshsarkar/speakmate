import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const list = (v, d = []) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const bool = (v, d = false) =>
  v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

function secret(name, devDefault) {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (isProd) throw new Error(`${name} must be set (min 16 chars) in production`);
  return devDefault;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: num(process.env.PORT, 5000),
  trustProxy: num(process.env.TRUST_PROXY, 0),
  clientOrigins: list(process.env.CLIENT_URL, ['http://localhost:5173']),
  serveClient: bool(process.env.SERVE_CLIENT, false),

  mongoUri: process.env.MONGODB_URI || '',
  useMemoryDb: bool(process.env.USE_MEMORY_DB, false) && !isProd,
  redisUrl: process.env.REDIS_URL || '',

  jwtSecret: secret('JWT_SECRET', 'dev-only-user-secret-change-me'),
  adminJwtSecret: secret('ADMIN_JWT_SECRET', 'dev-only-admin-secret-change-me'),

  requireEmailVerification: bool(process.env.REQUIRE_EMAIL_VERIFICATION, false),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'SpeakMate <no-reply@speakmate.app>',
  },

  stunUrls: list(process.env.STUN_URLS, ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']),
  turn: {
    urls: list(process.env.TURN_URLS),
    // Option A (coturn `use-auth-secret`): ephemeral credentials
    secret: process.env.TURN_SECRET || '',
    ttl: num(process.env.TURN_TTL_SECONDS, 6 * 3600),
    // Option B (static long-term credentials, e.g. hosted TURN providers)
    username: process.env.TURN_USERNAME || '',
    password: process.env.TURN_PASSWORD || '',
  },

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@speakmate.app',
  },

  seedAdmin: {
    email: (process.env.SUPER_ADMIN_EMAIL || 'admin@speakmate.app').toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || (isProd ? '' : 'Admin@12345'),
    name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
  },
};

export const clientUrl = env.clientOrigins[0];
