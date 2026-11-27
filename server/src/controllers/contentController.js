import ConversationTopic from '../models/ConversationTopic.js';
import Vocabulary from '../models/Vocabulary.js';
import Faq from '../models/Faq.js';
import LearningResource from '../models/LearningResource.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isPremiumDoc } from '../utils/profile.js';
import { env } from '../config/env.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';
import { getIceServers, turnConfigured } from '../config/ice.js';
import { getSettings, publicSettings } from '../services/settingsService.js';
import { pushEnabled } from '../services/notificationService.js';

export const publicConfig = asyncHandler(async (_req, res) => {
  const s = await getSettings();
  res.json({
    success: true,
    config: {
      ...publicSettings(s),
      googleClientId: env.googleClientId || null,
      vapidPublicKey: pushEnabled ? env.vapid.publicKey : null,
      avatarUploads: cloudinaryEnabled,
      turn: turnConfigured(),
      emailVerificationRequired: env.requireEmailVerification,
    },
  });
});

export const iceServers = (req, res) => res.json({ success: true, iceServers: getIceServers(req.actor.publicId) });

export const topics = asyncHandler(async (req, res) => {
  const premium = req.actor ? isPremiumDoc(req.actor.doc) : false;
  const list = await ConversationTopic.find({ active: true }).sort({ order: 1, title: 1 }).lean();
  res.json({
    success: true,
    topics: list.map((t) => ({
      id: String(t._id),
      slug: t.slug,
      title: t.title,
      description: t.description,
      icon: t.icon,
      premium: t.premium,
      locked: t.premium && !premium,
      starters: t.premium && !premium ? [] : t.starters,
    })),
  });
});

export const assist = asyncHandler(async (req, res) => {
  const slug = String(req.query.topic || '').toLowerCase();
  const topic = slug ? await ConversationTopic.findOne({ slug, active: true }).lean() : null;
  const [starters, phrases, words] = await Promise.all([
    Vocabulary.find({ active: true, kind: 'starter' }).select('word').lean(),
    Vocabulary.find({ active: true, kind: 'phrase' }).select('word meaning').lean(),
    Vocabulary.aggregate([
      { $match: { active: true, kind: 'word', $or: [{ topicSlug: slug || '__none__' }, { topicSlug: null }] } },
      { $sample: { size: 8 } },
      { $project: { word: 1, meaning: 1, example: 1, level: 1 } },
    ]),
  ]);
  res.json({
    success: true,
    topic: topic ? { slug: topic.slug, title: topic.title, icon: topic.icon, starters: topic.starters } : null,
    starters: starters.map((s) => s.word),
    phrases: phrases.map((p) => ({ text: p.word, note: p.meaning })),
    words: words.map((w) => ({ word: w.word, meaning: w.meaning, example: w.example, level: w.level })),
  });
});

export const faqs = asyncHandler(async (_req, res) => {
  const list = await Faq.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ success: true, faqs: list.map((f) => ({ id: String(f._id), question: f.question, answer: f.answer })) });
});

export const resources = asyncHandler(async (_req, res) => {
  const list = await LearningResource.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({
    success: true,
    resources: list.map((r) => ({ id: String(r._id), title: r.title, description: r.description, url: r.url, category: r.category })),
  });
});
