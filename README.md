# TeenGenius

**TeenGenius is an AI-powered study companion built for students (targeting ages 13–17).** It turns study material into explanations, revision notes, and practice quizzes, and adds focus timers, a secure chat, and study groups — all in a mobile-first, installable (PWA) web app.

> AI can make mistakes — students should always double-check important answers against their official textbooks. This notice is also shown in-app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Routing | React Router 7 (lazy-loaded routes) |
| State | React context + local-first persistence (`localStorage` / `sessionStorage`) |
| Backend AI | Express server (`server.ts` → `app.ts`), Groq API (Llama models) |
| Database | Firebase Firestore (security rules in `firestore.rules`) |
| Auth | Firebase Auth (email/password, Google, guest mode) |
| Storage | Firebase Storage / local uploads via Multer |
| PWA | Web App Manifest + custom service worker (`public/sw.js`) |
| Android | Capacitor config (`capacitor.config.ts`) + optional native shell (`android-app/`) |

## Project Structure

```
├── index.html              # App shell, meta/PWA tags
├── server.ts               # Dev server entry (tsx)
├── app.ts                  # Express app: /api/ai/* endpoints
├── ai-provider.ts          # Groq provider: retries, timeouts, error taxonomy
├── netlify/functions/      # Serverless API for Netlify deploys
├── firestore.rules         # Firestore security rules (user isolation)
├── public/                 # Manifest, service worker, icons, assetlinks
└── src/
    ├── App.tsx             # Router + route guards
    ├── components/         # Layout (nav), SettingsModal, onboarding, UI kit
    ├── screens/            # Home, AIAssistant, NotesGenerator, ExamPrep, FocusRoom, …
    ├── context/            # AuthContext, MusicContext
    └── lib/                # study.ts (profile/persistence), api.ts, analytics.ts, …
```

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
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Firebase web config (public by design — protected by Firestore rules) |

The Groq key lives **only on the server** (`ai-provider.ts` runs in Node/Netlify Function). Firebase web keys are public identifiers; access control is enforced by `firestore.rules`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with API |
| `npm run build` | Production build (`vite build` + bundled server) |
| `npm start` | Run the production server from `dist/server.cjs` |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Deployment

1. `npm run build`
2. Deploy `dist/` (static frontend) + the bundled server (`dist/server.cjs`) or the Netlify function in `netlify/functions/` behind HTTPS.
3. `netlify.toml` is included for Netlify-style hosting.
4. Ensure the deployed origin is added to Firebase Auth authorized domains.

## Firebase Setup

1. Create a Firebase project → add a **Web app** → copy config into `.env`.
2. Enable **Authentication** (Email/Password, Google, Anonymous).
3. Enable **Firestore** and deploy rules: `firebase deploy --only firestore:rules` (rules require signed-in users and enforce per-user document ownership for chats, notes, and progress).
4. Enable **Storage** if image uploads are used.

## AI Configuration

- All AI calls go through `/api/ai/*` endpoints implemented in `app.ts`, using `ai-provider.ts`.
- The provider has timeouts, exponential-backoff retries, client burst limiting, and a standardized error contract (`{ error, code }`) so the UI can show actionable messages ("Try again", rate-limit notices).
- Responses render as Markdown (headings, lists, tables) with KaTeX for math via `MarkdownRenderer`.

## PWA Configuration

- `public/manifest.json` — name, icons (192/512 + maskable), `display: standalone`, `launch_handler`.
- `public/sw.js` — network-first for navigations, cache-first for static assets; **never caches `/api/` or Firestore traffic**. Bump `CACHE_NAME` on each deploy to invalidate.
- `public/.well-known/assetlinks.json` — Digital Asset Links for Android TWA (replace the placeholder SHA-256 fingerprint with your release signing certificate before Play Store release).

## Known Limitations

- AI answers can be wrong or incomplete — the app displays a verification notice and the Terms of Service require double-checking against official textbooks.
- Guest mode keeps data on-device only (by design); signing in enables sync.
- Offline support covers previously loaded shell/assets, not live AI features.
- `android-app/` native shell is a starting point, not a published Play Store build; TWA is the recommended packaging path.
- Feedback and analytics collections are readable by any signed-in user to support moderation tooling — tighten if you expose them publicly.

---

TeenGenius was originally scaffolded in Google AI Studio; it has since been heavily rebuilt (mobile-first UI, PWA, Express AI backend). No AI Studio runtime dependencies remain.
