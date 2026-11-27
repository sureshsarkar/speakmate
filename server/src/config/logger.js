import { env } from './env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const min = LEVELS[process.env.LOG_LEVEL || (env.isProd ? 'info' : 'debug')] ?? 20;

function emit(level, msg, meta) {
  if (LEVELS[level] < min) return;
  const time = new Date().toISOString();
  const extra = meta instanceof Error ? { error: meta.message, stack: env.isProd ? undefined : meta.stack } : meta;
  if (env.isProd) {
    process.stdout.write(JSON.stringify({ time, level, msg, ...(extra || {}) }) + '\n');
  } else {
    const line = `[${time.slice(11, 19)}] ${level.toUpperCase().padEnd(5)} ${msg}`;
    // eslint-disable-next-line no-console
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(
      line,
      extra && Object.keys(extra).length ? extra : ''
    );
  }
}

export const logger = {
  debug: (m, x) => emit('debug', m, x),
  info: (m, x) => emit('info', m, x),
  warn: (m, x) => emit('warn', m, x),
  error: (m, x) => emit('error', m, x),
};
