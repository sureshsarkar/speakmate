import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { ensureSeed } from './seed/seed.js';
import { startScheduler } from './services/scheduler.js';
import { callService } from './services/callService.js';

async function main() {
  await connectDb();
  await ensureSeed();

  const app = createApp();
  const server = http.createServer(app);
  const io = await initSockets(server);
  startScheduler();

  server.listen(env.port, () => logger.info(`SpeakMate API listening on http://localhost:${env.port} (${env.nodeEnv})`));

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info(`${signal} received, shutting down`);
    callService.endAll('server_shutdown');
    io.close();
    server.close();
    await new Promise((r) => setTimeout(r, 300));
    await disconnectDb().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection', err instanceof Error ? err : new Error(String(err))));

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
