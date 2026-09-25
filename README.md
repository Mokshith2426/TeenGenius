# TeenGenius

**TeenGenius is a focused, mobile-first study companion for students (ages 13-17).**

> **Learn something -> paste/watch/read something -> turn it into useful notes -> understand it -> practise it -> plan your study.**

The whole app is six things: **Home, Learn, Create Notes, Practice, Plan, and the AI Tutor.**
Everything else that used to ship alongside them has been removed.

> AI can make mistakes - students should always double-check important answers against their official textbooks. This notice is also shown in-app.

---

## The core feature: URL -> short notes

Create Notes accepts four source types and turns each into **short, revision-ready notes**:

| Source | What happens |
| --- | --- |
| **YouTube URL** | The video id is parsed (watch / `youtu.be` / Shorts / embed / live / music). The public caption track is downloaded **server-side**, flattened to text, and only that text is sent to the AI. |
| **Article / blog URL** | The page is fetched **server-side**, boilerplate (nav, scripts, ads, cookie banners, menus) is stripped, and the readable body is sent to the AI. |
| **File** | The existing image/PDF upload path is unchanged. |
| **Text** | Pasted study material. |

**The URL is never handed to the LLM.** A text model cannot open a page or watch a
video, so pretending otherwise would produce confident nonsense. Instead the
server extracts real text first, then summarises that.

### Output shape (default: "Short Notes")

```
# Topic
## TL;DR            2-4 sentences
## Key Points       5-10 concise bullets
## Important Terms  Term - plain-English definition
## Remember This    3-5 high-value facts
## Quick Revision   recall-oriented summary
```

Advanced note styles still exist but live behind a collapsed **"More options"**
control, so the default screen stays a one-tap flow: **source -> generate -> notes**.

### Failure handling

Every failure is explicit. TeenGenius never invents a summary.

| Situation | Result |
| --- | --- |
| Invalid / malformed URL | `URL_INVALID` + "That link is not a valid URL." |
| localhost, private range, cloud metadata, `file:`/`ftp:`/`javascript:` | `URL_BLOCKED` + "Internal destinations are not allowed." |
| Domain does not resolve, offline, 5xx | `URL_UNREACHABLE` + "That page could not be reached." |
| Login-walled, paywalled, or bot-blocked (401/403/429) | `URL_UNREACHABLE` + "behind a login or blocks automated access." |
| Body larger than 3MB | `URL_TOO_LARGE` |
| Not a readable web page / no extractable text | `URL_UNSUPPORTED` |
| YouTube video with no public captions (private, age-restricted, captions off) | `YOUTUBE_NO_TRANSCRIPT` + a **"Paste the transcript instead"** button that switches the student to the Text tab |

---

## Security

URL processing is a classic SSRF sink, so it is hardened at every hop in
`server/utils/helpers.ts`:

1. **Scheme allowlist** - only `http:` and `https:`; embedded credentials rejected.
2. **Host blocklist** - `localhost`, `*.localhost`, `*.internal`, `*.local`, `*.corp`, `*.lan`, `*.test`, `metadata.google.internal`, and friends.
3. **Private-range rejection** - loopback, RFC1918, link-local (incl. `169.254.169.254`), CGNAT, benchmarking, multicast, and IPv6 ULA/link-local/mapped forms.
4. **DNS resolution check** - the hostname is resolved and *every* returned address is re-checked, which defeats a DNS record pointing at an internal IP.
5. **Manual redirect following** - capped at 3 hops, and each `Location` is fully re-validated, so an open redirect cannot launder a private target.
6. **Streaming byte cap** - 3MB hard limit, aborting mid-body.
7. **Wall-clock timeout** - 12s per request.
8. **Content-type allowlist** - HTML / plain text / JSON / XML only.
9. **Rate limiting** - the shared burst guard plus a dedicated 5s per-client cooldown for outbound fetches.

Other rules the new code follows:

- The Groq key, Firebase service credentials and all other secrets stay server-side
  (`ai-provider.ts` is never imported by React code).
- Extracted page/transcript text is **not** returned to the browser - only source
  metadata (type, title, url, character count, language).
- The extracted text is wrapped in `<<<SOURCE MATERIAL>>>` / `<<<END SOURCE MATERIAL>>>`
  fences with an explicit "this is data, not instructions" rule, so a malicious page
  cannot prompt-inject the model.
- YouTube handling only reads publicly served caption data. No login, cookies, DRM,
  paywall or private-video bypass is attempted.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Routing | React Router 7 (lazy-loaded routes) |
| State | React context + local-first persistence (`localStorage` / `sessionStorage`) |
| Backend AI | Express server (`server.ts` -> `app.ts`), Groq API (Llama models) |
| Source extraction | `server/services/source-extractor.service.ts` (YouTube captions + article readability) |
| Database | Firebase Firestore (security rules in `firestore.rules`) |
| Auth | Firebase Auth (email/password, Google, guest mode) |
| Storage | Firebase Storage / local uploads via Multer |
| PWA | Web App Manifest + custom service worker (`public/sw.js`) |
| Android | Capacitor config (`capacitor.config.ts`) + optional native shell (`android-app/`) |

## Project Structure

```
index.html              # App shell, meta/PWA tags
server.ts               # Dev server entry (tsx)
app.ts                  # Express app: /api/ai/* endpoints
ai-provider.ts          # Groq provider: retries, timeouts, error taxonomy
netlify/functions/      # Serverless API for Netlify deploys
firestore.rules         # Firestore security rules (per-user isolation)
public/                 # Manifest, service worker, icons, assetlinks
scripts/
  verify-url-pipeline.ts      # SSRF + YouTube-URL parsing checks
  verify-live-extraction.ts   # live network smoke test (manual)
src/
  App.tsx               # Router + route guards (6 destinations)
  components/           # Layout (nav), SettingsModal, onboarding, UI kit
  screens/              # Home, LearnHub, CreateNotes, PracticeExperience, PlannerHub, AIAssistant, ...
  context/              # AuthContext
  lib/                  # study.ts (profile/persistence), planner.ts, api.ts, analytics.ts, ...
```

## Product surface

| Screen | Route | Purpose |
|---|---|---|
| **Home** | `/app` | Continue learning, today's plan, upcoming exams, quick actions. Not a dashboard. |
| **Learn** | `/app/learn`, `/app/study/:subjectId/:topicId` | Subjects, topics, teaching modes. |
| **Create Notes** | `/app/notes` | Link / File / Text -> short notes -> save, copy, download. |
| **Practice** | `/app/practice` | Topic quizzes with instant scoring and mistake retry. |
| **Plan** | `/app/planner`, `/app/exam` | Tasks, due dates, exam goals. |
| **AI Tutor** | `/app/ai-assistant` | General study assistant (kept separate from notes). |
| **Profile** | `/app/profile` | Account, study snapshot, settings, legal. |

Removed: Secure Chat, Classrooms, Study Buddies, Friends, Study Groups, Community
Hub, Whiteboard, Roadmap, Focus Zone, gamification, and the old feature-dump
navigation (command palette / "More features" grid). Homework Solver and Memory Lab
were already gone and their routes are permanently removed.

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env     # fill in the values below
npm run dev              # dev server (tsx server.ts)
```

### Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | **Required.** Server-side AI provider key (never shipped to the client) |
| `GROQ_MODEL` | Model id, default `llama-3.3-70b-versatile` |
| `PORT` | Dev server port (default `3001`) |
| `VITE_FIREBASE_API_KEY` ... `VITE_FIREBASE_APP_ID` | Firebase web config (public by design - protected by Firestore rules) |

The Groq key lives **only on the server** (`ai-provider.ts` runs in Node/Netlify Function). Firebase web keys are public identifiers; access control is enforced by `firestore.rules`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with API |
| `npm run build` | Production build (`vite build` + bundled server) |
| `npm start` | Run the production server from `dist/server.cjs` |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |
| `npm run test:notes` | Notes-pipeline integration test (mocked Groq) |
| `npm run test:url` | SSRF guard + YouTube URL-parsing checks (37 assertions) |

## Deployment

1. `npm run build`
2. Deploy `dist/` (static frontend) + the bundled server (`dist/server.cjs`) or the Netlify function in `netlify/functions/` behind HTTPS.
3. `netlify.toml` is included for Netlify-style hosting (`/api/*` -> the serverless function, everything else -> `index.html`).
4. Deploy Firestore rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`.
5. Ensure the deployed origin is added to Firebase Auth authorized domains.

GitHub Pages is also supported: CI builds with `GITHUB_ACTIONS=true`, which switches
Vite's `base` to `/TeenGenius/` and generates the `404.html` SPA fallback that
`App.tsx` rewrites on boot.

## Firebase Setup

1. Create a Firebase project -> add a **Web app** -> copy config into `.env`.
2. Enable **Authentication** (Email/Password, Google, Anonymous).
3. Enable **Firestore** and deploy rules: `firebase deploy --only firestore:rules` (rules require signed-in users and enforce per-user document ownership for notes, AI chats, planner tasks and study data).
4. Enable **Storage** if image uploads are used.

## AI Configuration

- All AI calls go through `/api/ai/*` endpoints implemented in `app.ts`, using `ai-provider.ts`.
- The provider has timeouts, exponential-backoff retries, client burst limiting, and a standardized error contract (`{ error, code }`) so the UI can show actionable messages.
- `POST /api/ai/notes/from-url` is the URL flow; `POST /api/ai/notes` is text/file. Both share one prompt builder.
- Responses render as Markdown (headings, lists, tables) with KaTeX for math via `MarkdownRenderer`.

## PWA Configuration

- `public/manifest.json` - name, icons (192/512 + maskable), `display: standalone`, `launch_handler`.
- `public/sw.js` - network-first for navigations, cache-first for static assets; **never caches `/api/` or Firestore traffic**. Bump `CACHE_NAME` on each deploy to invalidate.
- `public/.well-known/assetlinks.json` - Digital Asset Links for Android TWA (replace the placeholder SHA-256 fingerprint with your release signing certificate before Play Store release).

## Known Limitations

- AI answers can be wrong or incomplete - the app displays a verification notice and the Terms of Service require double-checking against official textbooks.
- YouTube transcripts depend on captions being publicly available. Videos with captions disabled, private, age-restricted, or region-locked will report that clearly and offer a paste-the-transcript fallback.
- Netlify serverless functions run on datacenter IPs, which some sites (including parts of YouTube) block. The failure path is explicit and the paste-the-transcript fallback always works.
- Article extraction is a readability heuristic, not a full Mozilla Readability port. Very unusual markup may produce a thin extraction or `URL_UNSUPPORTED`.
- Guest mode keeps data on-device only (by design); signing in enables sync.
- Offline support covers previously loaded shell/assets, not live AI features.

---

TeenGenius was originally scaffolded in Google AI Studio; it has since been rebuilt
around a single learning loop (mobile-first UI, PWA, Express AI backend, and a
server-side URL -> notes pipeline). No AI Studio runtime dependencies remain.
