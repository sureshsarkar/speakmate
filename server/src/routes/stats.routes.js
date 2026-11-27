import { Router } from 'express';
import * as c from '../controllers/statsController.js';
import { authenticate } from '../middleware/auth.js';

const r = Router();
r.use(authenticate);
r.get('/summary', c.summary);
r.get('/history', c.history);
r.get('/charts', c.charts);
r.get('/partners', c.partners);

export default r;
