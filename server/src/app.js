import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { maintenanceGate } from './middleware/maintenance.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import statsRoutes from './routes/stats.routes.js';
import contentRoutes from './routes/content.routes.js';
import socialRoutes from './routes/social.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://accounts.google.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'connect-src': ["'self'", 'ws:', 'wss:', 'https://accounts.google.com'],
          'media-src': ["'self'", 'blob:'],
          'frame-src': ['https://accounts.google.com'],
          // Microphone only; no camera anywhere
        },
      },
      // Permissions are set explicitly below
    })
  );
  // Audio only: microphone allowed for this origin, camera is denied outright.
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
    next();
  });
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(compression());
  if (!env.isProd) app.use(morgan('dev', { stream: { write: (m) => logger.debug(m.trim()) } }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, db: mongoose.connection.readyState === 1, uptime: Math.round(process.uptime()) })
  );

  app.use('/api', apiLimiter);
  app.use('/api/admin', adminRoutes);
  app.use('/api', maintenanceGate);
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api', contentRoutes);
  app.use('/api', socialRoutes);

  // Optionally serve the built React app (single-service deployments)
  if (env.serveClient) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dist = path.resolve(here, '../../client/dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist, { maxAge: '1h', index: false }));
      app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    } else {
      logger.warn('SERVE_CLIENT is on but client/dist was not found. Run `npm run build` in client/.');
    }
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
