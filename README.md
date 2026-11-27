# SpeakMate

**Don't learn English alone. Speak English with the world.**

SpeakMate connects English learners through **random, audio-only calls**. Tap *Start Speaking*, get matched with another learner at a similar level, talk, then rate the call or jump to the next partner. Built with the MERN stack, Socket.IO matchmaking and WebRTC.

> **Audio only, by design.** There is no video, no camera access, no text chat, no phone numbers and no call recording anywhere in the code base. See [How audio-only is enforced](#how-audio-only-is-enforced).

---

## Contents
1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Quick start](#quick-start)
5. [Configuration](#configuration)
6. [How it works](#how-it-works)
7. [How audio-only is enforced](#how-audio-only-is-enforced)
8. [Privacy and safety](#privacy-and-safety)
9. [Admin console](#admin-console)
10. [API and socket reference](#api-and-socket-reference)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Scaling notes and known limits](#scaling-notes-and-known-limits)
14. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What is included |
|---|---|
| **Calling** | Random audio calls over WebRTC (`RTCPeerConnection`), mic permission handling, mute, speaker volume/mute + output-device picker (where the browser supports `setSinkId`), call timer, connection-quality indicator (RTT / packet loss / jitter), End call, Next partner, automatic ICE-restart reconnection |
| **Matchmaking** | Real-time Socket.IO queue: level proximity (widens the longer you wait), same practice language, avoids recent partners, never matches blocked users or people already in a call, race-condition-safe, dead sockets removed automatically, premium "advanced matching" (goal overlap + queue priority) |
| **Voice UI** | Web Audio `AnalyserNode` waveforms for you and your partner, speaking rings, "tap to hear partner" fallback when the browser blocks autoplay |
| **Learning helpers** | 12 conversation topics, conversation starters, useful sentences, vocabulary helper (all admin-editable) shown in a private bottom sheet. It is not a chat. |
| **After the call** | Feedback (rating, friendly?, comfortable?, connect again?), report, block, add to favorites, find next partner |
| **Progress** | Total calls/minutes, average duration, daily goal ring, streak, weekly chart, monthly progress, 28-day activity grid, history, favorite partners |
| **Social (no chat)** | Favorites, previous partners, practice requests, accepted connections can **direct-call** each other (ringing screen), online status with privacy control |
| **Auth** | Register/login, JWT (1 day or 30 days with *Remember me*), **guest mode** with secure temporary guest IDs, Google sign-in (optional), forgot/reset password, email verification, change password, delete account |
| **Notifications** | In-app + browser + Web Push: partner found, friend/practice request, request accepted, daily reminder, goal completed, streak reminder |
| **PWA** | Installable, manifest, generated icons, splash screen, safe-area support, service worker, push handler, page transitions |
| **Admin** | Separate console: dashboard, users, audio calls and system health, moderation, content, settings, admin roles |
| **Monetization (ready)** | Free vs Premium plans, daily limits, `Subscription` model, admins can grant premium. No payment gateway in the MVP. |

## Tech stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios, Socket.IO client, Zustand, Lucide icons, `vite-plugin-pwa`
- **Backend:** Node.js, Express, MongoDB + Mongoose, Socket.IO (+ optional Redis adapter), Zod validation, JWT, bcrypt (`bcryptjs`), Helmet, express-rate-limit, Nodemailer, web-push, Cloudinary
- **Real-time audio:** WebRTC audio-only, Socket.IO signalling, STUN + TURN (coturn)

## Project structure

```
speakmate/
├── client/                      React app (Vite)
│   ├── public/                  favicon, PWA icons, push-sw.js (Web Push handler)
│   └── src/
│       ├── lib/                 callEngine.js (WebRTC + matchmaking client), api, socket, push, theme
│       ├── store/               Zustand stores: auth, app, call, admin
│       ├── components/          Avatar, Waveform, BottomNav, Overlays, ui kit ...
│       └── pages/               Landing, Auth, Onboarding, Home, Practice (search/found), CallScreen,
│                                CallEnded, History, Favorites, Profile, Settings, Notifications, Help,
│                                admin/ (Login, Dashboard, Users, Calls, Reports, Content, Settings, Admins)
├── server/
│   ├── src/
│   │   ├── config/              env, db, logger, ICE (STUN/TURN), cloudinary, admin permissions
│   │   ├── models/              User, GuestSession, CallSession, PracticeHistory, FavoritePartner,
│   │   │                        UserReport, BlockedUser, Notification, ConversationTopic, Vocabulary,
│   │   │                        Admin, Subscription (+ Connection, Setting, Faq, LearningResource)
│   │   ├── middleware/          auth, adminAuth, validate (zod), rate limits, maintenance, error handler
│   │   ├── controllers/         auth, profile, stats, content, social, admin
│   │   ├── routes/              route tables
│   │   ├── services/            matchmaker (pure queue), matchHub, callService (signalling + lifecycle),
│   │   │                        presence, practiceService (stats), notificationService, scheduler, settings
│   │   ├── sockets/             Socket.IO auth + event handlers
│   │   ├── seed/                topics, vocabulary, FAQs, resources, first Super Admin
│   │   └── utils/
│   └── test/                    matchmaker unit tests + full end-to-end API/socket tests
├── deploy/                      nginx + coturn example configs
├── docker-compose.yml           MongoDB, Redis and coturn for local development
└── scripts/gen-icons.mjs        regenerates the PWA icons (no dependencies)
```

> There is intentionally **no `Message` model**. The `Connection`, `Setting`, `Faq` and `LearningResource` models are small additions that power practice requests, admin settings and content management.

## Quick start

Requirements: **Node.js 18.18+** (tested on 22). MongoDB is optional for a first look.

### Option 1: fastest (throwaway in-memory MongoDB)
```bash
npm run install:all
npm --prefix server run dev:memory      # API on http://localhost:5000
npm run dev:client                      # app on http://localhost:5173   (second terminal)
```
The first run downloads a MongoDB binary (~100 MB). Data is lost when the server stops.

### Option 2: real MongoDB
```bash
docker compose up -d mongo              # or use a local install / MongoDB Atlas
cp server/.env.example server/.env      # set MONGODB_URI, JWT_SECRET, ADMIN_JWT_SECRET
npm run install:all
npm run dev:server
npm run dev:client
```
On first start the server seeds topics, vocabulary, FAQs and learning resources and creates the **Super Admin** from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. In development (no password set) it uses `admin@speakmate.app` / `Admin@12345`. **Change this before deploying.** The admin console is at `/admin/login`.

### Trying a call on one computer
Browsers share `localStorage` per origin, so open two *different* profiles (or one normal + one incognito window), start as a guest in each and press **Start Speaking**. Use headphones to avoid echo. Microphone access works on `localhost` without HTTPS.

## Configuration

Everything is configured through environment variables. See [`server/.env.example`](server/.env.example) (fully commented) and [`client/.env.example`](client/.env.example).

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET`, `ADMIN_JWT_SECRET` | **Required in production** (min 16 chars). Users and admins use separate secrets |
| `CLIENT_URL` | Allowed browser origin(s) for CORS/Socket.IO and links in emails |
| `TURN_URLS` + `TURN_SECRET` (or `TURN_USERNAME`/`TURN_PASSWORD`) | TURN relay. **Required for production reliability** |
| `REDIS_URL` | Enables the Socket.IO Redis adapter |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in (button hidden when empty) |
| `CLOUDINARY_*` | Enables profile-picture uploads (button hidden when empty) |
| `SMTP_*`, `MAIL_FROM` | Verification and reset emails. Without SMTP the link is printed in the server log |
| `VAPID_*` | Web Push. Generate with `npm --prefix server run gen:vapid` |
| `REQUIRE_EMAIL_VERIFICATION` | Block login until email is verified |

Runtime settings (app name, logo, theme colors, matching rules, daily/maximum call limits, guest access, maintenance mode) are edited in the **Admin > Settings** page and stored in MongoDB.

## How it works

```
OPEN APP -> START SPEAKING -> getUserMedia(audio only) -> queue:join
   -> matchmaker pairs two compatible users -> match:found (partner profile, topic, ICE servers)
   -> offer / answer / ICE relayed by the server -> peer-to-peer audio -> call:started
   -> End call (feedback screen)  or  Next partner (new search)  -> history + stats saved
```

1. **Mic first.** The microphone is requested *before* searching, so permission problems are caught up front.
2. **Matchmaking.** `services/matchmaker.js` is a pure synchronous queue. `tick()` removes both members of a pair before returning, so a user can never be matched twice. Async work (database, signalling) happens afterwards. `matchHub.js` adds per-user locks to guard against double clicks and multiple tabs.
3. **Signalling.** The server relays `rtc:offer|answer|ice` only between the two participants of a call, validates payloads and **rejects any SDP containing a video m-line**. Audio itself never touches the server.
4. **Resilience.** If a socket drops mid-call the call survives a 15-second grace period and can be re-joined. If the media path fails, the caller performs an ICE restart; after 20 s without recovery the call ends cleanly.
5. **Cleanup.** After every call the client stops all mic tracks, closes the `RTCPeerConnection` and the `AudioContext`, and the server releases presence and call state. Calls have a connect timeout (40 s) and a maximum length (admin-configurable).

### Matching rules (editable in Admin > Settings)
- Level gap starts at `initialLevelDiff` and grows by 1 every `relaxEverySec` seconds waited, so nobody waits forever.
- Same practice language is required for the first `samePracticeLanguageSec` seconds ("English" matches any).
- Recent partners (last `recentPartnerMemory`) are avoided until the user has waited `avoidRecentPartnersSec`.
- Blocked users (either direction) are **never** matched. Users in a call/connecting are never in the queue.
- Premium: queue priority plus a preference for shared learning goals.

## How audio-only is enforced

| Layer | Enforcement |
|---|---|
| Capture | `navigator.mediaDevices.getUserMedia({ audio: true, video: false })`. If a stream ever contains a video track it is stopped and rejected |
| WebRTC | Only audio tracks are added. Incoming video tracks are stopped. Incoming SDP with a video section ends the call |
| Signalling | The server refuses to relay SDP with `m=video` |
| UI | No `<video>` element exists anywhere. Remote audio plays through a detached `Audio` object |
| Browser policy | `Permissions-Policy: microphone=(self), camera=()` header |
| Product | No chat, no messages model, no phone numbers, no camera settings, no recording code |

## Privacy and safety

- Other users only ever see: display name, profile picture, English level and (optionally) country. **Never** email, phone number, internal IDs, tokens or password. Users are referenced by a random public ID.
- No phone numbers are collected at all.
- Calls are **never recorded**. Only metadata is stored (participants, duration, timestamps, status, quality). Admins cannot access live audio or recordings. They do not exist.
- JWT auth for REST and Socket.IO handshake. Admin tokens use a separate secret, 12 h expiry and `sessionStorage`.
- Rate limiting: global API limiter, strict auth limiter, registration limiter, guest-creation limiter, report limiter, admin-login limiter, plus per-socket event limits.
- Duplicate-account protection: normalised email (Gmail dots and `+tags` collapse), registration rate limit per IP, hashed IP stored only for abuse checks.
- Guests: secure random guest ID, 24 h token, auto-expiring server record, smaller daily limit.
- Report, block, end call at any time. You can only report/block/favorite people you actually spoke with.
- Display names containing emails or phone-like numbers are rejected.
- Helmet, strict CORS, request size limits, centralised error handling that never leaks stack traces in production.

## Admin console

`/admin/login`: separate from the user app.

| Role | Can do |
|---|---|
| **Super Admin** | Everything: settings, admin accounts, deleting users, granting premium |
| **Moderator** | View users, suspend/block, handle reports, end active calls |
| **Support Admin** | View/edit users, manage topics, vocabulary, resources and FAQs |

Pages: **Dashboard** (registered/guest users, online, searching, active calls, total calls, speaking minutes, daily registrations, reports), **Users** (search, edit, suspend/block/unblock, delete, premium), **Audio calls** (active call metadata, history, system health with connect success rate, TURN/Redis status), **Moderation** (investigate reports, warn/suspend/block), **Content**, **Settings**, **Admins**.

## API and socket reference

REST (all under `/api`): `auth/*`, `profile/*`, `stats/*` (summary, history, charts, partners), `content/*` (topics, assist, faqs, resources), `config`, `webrtc/ice-servers`, `favorites`, `connections`, `blocks`, `reports`, `notifications`, `calls/:id/feedback`, `admin/*`, `health`.

Socket.IO (auth via `auth: { token }` in the handshake):

| Client -> server | Purpose |
|---|---|
| `queue:join` / `queue:leave` | start / cancel matchmaking |
| `rtc:offer` / `rtc:answer` / `rtc:ice` / `rtc:restart-request` | WebRTC signalling (relayed to the partner only) |
| `call:connected` / `call:quality` / `call:end` / `call:next` / `call:rejoin` | call lifecycle |
| `direct:invite` / `direct:accept` / `direct:decline` / `direct:cancel` | direct calls between accepted connections |

| Server -> client | Purpose |
|---|---|
| `match:found`, `call:started`, `call:ended`, `partner:status` | call lifecycle |
| `presence:stats` | online / searching counts |
| `direct:incoming`, `direct:ended` | direct-call ringing |
| `notification:new`, `account:restricted`, `queue:error` | misc |

## Testing

```bash
npm test          # 15 tests: matchmaker unit tests + end-to-end API/socket tests (uses an in-memory MongoDB)
```
The end-to-end suite registers users, matches them over real sockets, relays signalling, rejects video SDP, ends the call, checks history/stats/privacy, favorites, connections, reports, blocking (blocked users never match), disconnect handling, Next partner, and the admin API (permissions, suspension, premium, maintenance mode).

> What automated tests cannot cover: real microphones, real network conditions and TURN. See [Troubleshooting](#troubleshooting) and test calls across two real devices/networks before launch.

## Deployment

**Requirements for production:** HTTPS (browsers only allow the microphone on HTTPS or localhost), MongoDB, a **TURN server**, strong secrets.

### A) Single service (simplest)
```bash
npm run install:all
npm run build                                    # builds client/dist
# server/.env: NODE_ENV=production, SERVE_CLIENT=true, CLIENT_URL=https://your.domain, TRUST_PROXY=1,
#              MONGODB_URI, JWT_SECRET, ADMIN_JWT_SECRET, SUPER_ADMIN_PASSWORD, TURN_*
npm start
```
Put it behind an HTTPS reverse proxy. [`deploy/nginx.conf`](deploy/nginx.conf) is a ready example, including the WebSocket upgrade for `/socket.io/`.

### B) Split frontend / backend
Host `client/dist` on a static host (Netlify, Vercel, S3 + CDN) and the API on Render/Railway/Fly/VPS. Build the client with `VITE_API_URL=https://api.example.com` and `VITE_SOCKET_URL=https://api.example.com`, and set the API's `CLIENT_URL` to the static site's origin. Make sure the static host rewrites unknown paths to `index.html`.

### TURN server (coturn)
Without TURN, calls fail for users behind symmetric NATs or strict corporate/mobile networks.
1. Run coturn using [`deploy/coturn/turnserver.conf`](deploy/coturn/turnserver.conf) (open UDP/TCP 3478, 5349 and the relay range 49160-49200).
2. Set `TURN_URLS=turn:turn.yourdomain.com:3478,turns:turn.yourdomain.com:5349?transport=tcp` and `TURN_SECRET` equal to coturn's `static-auth-secret`.
SpeakMate then issues **short-lived per-user credentials** (HMAC, 6 h). A hosted TURN service works too: set `TURN_URLS`, `TURN_USERNAME`, `TURN_PASSWORD`.

### Web Push
`npm --prefix server run gen:vapid`, put the keys in `server/.env`, serve over HTTPS. Users enable push in *Settings > Notifications*.

### Production checklist
- [ ] `NODE_ENV=production`, strong `JWT_SECRET` / `ADMIN_JWT_SECRET` (the server refuses to start without them)
- [ ] Changed the Super Admin password (the first admin is only created if none exists)
- [ ] HTTPS everywhere, `TRUST_PROXY` matches your proxy depth
- [ ] TURN configured (check *Admin > Audio calls > System health*)
- [ ] SMTP configured, so verification and reset emails are delivered
- [ ] MongoDB backups enabled

## Scaling notes and known limits

Be aware of these before a large launch:

- **Matchmaking queue is in-memory** inside one API process. That is what makes pairing atomic and fast. `REDIS_URL` enables the Socket.IO Redis adapter so sockets on several nodes can exchange events, but the queue and live-call state still live in the process that owns them. Run **one matchmaking/API instance** (vertical scaling handles many thousands of concurrent sockets), or move the queue/state to Redis (the `Matchmaker` class is isolated for exactly that change) before running several instances.
- **WebRTC is peer to peer**, so server cost is only signalling. TURN relay bandwidth is the main cost driver at scale.
- **Audio autoplay rules:** on iOS Safari remote audio can be blocked until a tap. The call screen shows a *Tap to hear your partner* button in that case.
- **Background calling:** browsers suspend microphone/network for background tabs on some platforms. The app keeps the screen awake during calls (Wake Lock where supported) but cannot override OS restrictions.
- **Payments** are intentionally not implemented. The plan/limit logic, `Subscription` model and admin "grant premium" are in place for a future gateway.
- Output-device selection (`setSinkId`) is Chromium-only. Other browsers show a note to use system sound settings.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Microphone access is blocked" | Allow the microphone in the browser address bar (lock icon). The app shows OS/browser-specific steps |
| Mic works on localhost but not on a server | Needs **HTTPS** |
| Stuck on *Connecting* for ~40 s and the search restarts | Usually NAT/firewall: configure **TURN** |
| Search never finds anyone | Only one user online, or the only other user is a recent partner (waits `avoidRecentPartnersSec`), or levels are far apart (widens over time) |
| `MONGODB_URI is not set` | Create `server/.env` or use `npm --prefix server run dev:memory` |
| Emails not arriving | Without SMTP the verification/reset link is printed in the server log |
| Two tabs behave as one user | They share storage. Use another browser profile / incognito |

## License
Private project. All rights reserved by the owner.
