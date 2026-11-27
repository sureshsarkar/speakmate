import { Router } from 'express';
import * as c from '../controllers/contentController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const r = Router();
r.get('/config', c.publicConfig);
r.get('/content/topics', optionalAuth, c.topics);
r.get('/content/assist', c.assist);
r.get('/content/faqs', c.faqs);
r.get('/content/resources', c.resources);
r.get('/webrtc/ice-servers', authenticate, c.iceServers);

export default r;
