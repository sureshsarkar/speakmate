import { create } from 'zustand';

/**
 * Phases: idle | requesting_mic | searching | inviting | found | connecting | in_call | ended
 * The CallEngine (lib/callEngine.js) owns the WebRTC objects and mirrors what the UI needs here.
 */
export const initialCall = {
  phase: 'idle',
  error: null, // { code, message }
  topicSlug: null, // topic the user wants to talk about
  searchStartedAt: null,

  callId: null,
  kind: 'random',
  partner: null,
  topic: null,
  initiator: false,
  maxDurationSec: 0,

  // live call state
  connection: 'new', // new | connecting | connected | reconnecting
  quality: 'unknown', // unknown | good | fair | poor
  elapsedBase: 0, // seconds already elapsed when `startedAtLocal` was captured
  startedAtLocal: null,
  muted: false,
  speakerMuted: false,
  volume: 1,
  audioBlocked: false,
  partnerStatus: 'connected', // connected | reconnecting
  analysers: { local: null, remote: null },
  summary: null, // payload of call:ended

  // direct calls
  incoming: null, // { inviteId, from, expiresAt }
  outgoing: null, // { inviteId, to }
};

export const useCallStore = create((set) => ({
  ...initialCall,
  patch: (p) => set(p),
}));
