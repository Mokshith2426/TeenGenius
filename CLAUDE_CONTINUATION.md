# TeenGenius — Continuation Log

**Last updated:** 2026-09-25 (Phase 7: Empty / Loading / Error State Voice)
**Branch:** main
**Status:** Build ✅ | TypeScript lint ✅ | Production server smoke test ✅

---

## PHASE 7 — EMPTY / LOADING / ERROR STATE VOICE (this session)

**Theme:** every "nothing here", "working…", "failed", and "are you sure?" message in the core screens now sounds like a study app, not a sci-fi terminal. Copy only — 24 lines across 6 files, zero logic changes.

- **ChatList**: "Communication Array Empty" → **No friends yet** (+ plain explanation, CTA **Find Friends**); chat-row fallback "Channel established... awaiting comms." → **No messages yet — say hi!**; "Unit 3" fallback → **New Chat**; "No peers match" → "No friends match".
- **AIAssistant**: delete confirms now say what actually happens ("Delete this chat?…", "Delete all chats?…"); offline queued-message banner rewritten plainly (was "Study-Pod Offline Cache Active … neural histories"); chat placeholders ("New Chat" / "No messages yet"); voice-input processing text; quiz result copy ("Perfect score — you got every question right!").
- **ChatRoom**: decrypting state "Decrypting Tunnel..." → "Decrypting message…"; decrypt-error card rewritten in plain language.
- **StudyGroupDetail**: locked-room screen "Access Locked or Circle Not Found / …neural node space…" → **Classroom Unavailable** + one plain sentence.
- **Feedback**: button "Transmit Feedback" / "Transmitting Module..." → **Send Feedback** / **Sending…**.
- **NotesGenerator**: saved-notes empty state de-jargoned ("Alter your filter query sets." → "No saved notes match your search or filters.").
- Remaining jargon deliberately left for a later pass: Login auth buttons ("Initiate Node"), Layout More-sheet title ("Ecosystem Space"), CommandPalette category ("Ecosystem Modules").
- Validated: `npm run lint` → 0, `npm run build` → 0, prod smoke `/` 200 + `/api/version` 200, 6 spot-checked strings confirmed in `dist/assets/*.js`.

---

## PHASE 6 — DASHBOARD COPY PASS (previous session)

**Theme:** the Home dashboard should read like a study app, not a brochure. Copy/label pass only — zero logic, layout, or data changes (`src/screens/Home.tsx`, 26 lines changed).

- Section pills shortened: "Interactive Custom Planner & Active Assignments" → **Today's Plan**; "Reminders & Class Announcements" → **Coming Up**; "Core Academic Workspace Portals" → **Study Tools**.
- Task card unified on "task" wording: **Daily Checklist / Today's Tasks**, button **Add Task** (was "Add Goal"), tooltip "Remove task"; empty state rewritten as two plain lines (honest: tasks are saved on this device — no more "school profile / growth badges" claims).
- Blue goal card: **Today's Progress / Daily Study Goal**; progress copy now states the real remaining minutes (`Xm more to hit your Ym goal`); "Accumulated" → **Today**; "Streak Live: 5 days" → **Streak · 5 days**.
- Timer card: "Live Session Clock" → **Study Timer**; dropped the "growth credits" line for plain guidance.
- Section 3 button "All Platforms" → **Open Learn Hub** (matches its destination).
- Also normalized two mis-indented `<p>` blocks in the section headers.
- Validated: `npm run lint` → 0, `npm run build` → 0, prod smoke `/` 200 + `/api/version` 200, new strings confirmed present in `dist/assets/Home-*.js`.

---

## PHASE 5 — NAVIGATION DISCOVERABILITY (previous session)

**Theme:** every core screen is now one tap away.

- Added **Exam Prep** (`/app/exam`) and **Practice** (`/app/practice`) to all three navigation surfaces in `Layout.tsx`:
  - desktop sidebar "📚 Learn & Plan" section (`dynamicNavSections`)
  - mobile **More** bottom-sheet launcher grid (`navItems`, now 12 tiles = clean 3×4 grid)
  - **Command Palette** ⌘K (receives the same `navItems`)
- Icons: `GraduationCap` (Exam Prep, distinct from Planner's calendar), `ClipboardCheck` (Practice). Active-state detection reuses the existing `startsWith` logic — verified no path collisions (`/app/planner` vs `/app/practice`, `/app/exam` vs `/app/explore`).
- Fixed stale launcher comment ("14 … options" → "Launcher grid for every core module").
- Validated: `npm run lint` → 0, `npm run build` → 0, prod server smoke `/` 200 + `/api/version` 200.

---

## PHASE 4 — FOCUSED CORE POLISH (previous session)

**Theme:** keep the feature declutter (Homework Solver / AI Timetable Maker / Memory Lab / Exam Lab stay removed) and make the existing core feel intentional.

### Completed
1. **First-run onboarding consolidated (dashboard UX).** Previously a brand-new user could get **three stacked modals at once**: `OnboardingFlow` (profile setup), a legacy 3-step "Quick Tour" overlay in `Home.tsx` (`TEENGENIUS_ONBOARDED_1`, stale copy like "Four Study Tools"), and `MainWalkthrough` (z-10000). Now:
   - Removed the legacy Quick Tour entirely from `Home.tsx` — `OnboardingFlow` is the single profile-setup entry point.
   - `Layout.tsx` only auto-opens `MainWalkthrough` after onboarding is complete (`isOnboardingComplete()` gate), so modals never stack.
   - `OnboardingFlow.finish()` hands off to the walkthrough (`trigger-walkthrough` event, only if not skipped and not already completed) — sequential, not simultaneous.
2. **Mobile nav consistency:** `/app/practice` and `/app/exam` now have proper mobile header titles ("Practice", "Exam Prep") and correct bottom-nav active states (Practice → Learn tab, Exam → Plan tab).
3. **Dashboard layout fix:** "Where can I continue studying?" tool grid was `lg:grid-cols-5` with only 3 cards (2 empty columns on desktop) → `lg:grid-cols-3`.
4. **Removed-feature leftovers:** deleted the stale empty `EXAM LAB PROMPTS` section header in `src/lib/ai-prompts.ts`. Remaining references to removed features are only the intentional legacy-route redirects in `App.tsx` (`timetable`, `homework-solver`, `memory-lab` → current equivalents).

### Validated this session
- `npm run lint` (tsc --noEmit) → exit 0
- `npm run build` (vite build + esbuild server) → exit 0
- Production server smoke test: `/` → 200, `/api/version` → 200
- Secret scan over new/changed files → no keys (only the key-redaction regex in `ai-provider.ts`)

---

## PHASE 3 — LAUNCH READINESS (previous session)

### Completed
1. **README.md rewritten** — removed leftover Google AI Studio template branding (GHBanner image, ai.studio link, GEMINI_API_KEY instructions). Now documents: what TeenGenius is, tech stack, project structure, install/env vars/commands, deployment, Firebase setup, AI configuration, PWA configuration, and known limitations (including honest AI-accuracy disclaimer).
2. **In-chat AI transparency note added** (`AIAssistant.tsx`) — subtle always-visible line under the composer: "AI can make mistakes — double-check important answers against your textbook." Complements the existing Terms of Service clause.
3. **Chat composer keyboard UX** — added `enterKeyHint="send"` and `autoComplete="off"` so Android keyboards show a Send action key.

### Verified already-good (no changes needed)
- **Onboarding**: 4-step, skip-able flow (subjects → goal → help focus) mounts on first Home visit; saves to study profile; guest-safe local fallback. No giant questionnaire.
- **First-session guidance**: Home shows a computed "next step" recommendation rather than a text tutorial.
- **Zero-data states**: Planner ("Your planner is empty"), Notes ("No notes found" + guidance), ChatList ("No Chats Yet"), Focus ("No sessions yet"), ExamPrep ("No exams yet") all have informative empty states.
- **Error recovery**: standardized AI error contract (`{ error, code }`) in `ai-provider.ts`/`app.ts`; retry with exponential backoff (`src/lib/retry.ts`); friendly, actionable messages; server burst limiting + 429 handling.
- **Security**: Firestore rules enforce per-user ownership on `aiChats`, `notesLab`, etc.; Groq key stays server-side; Firebase web keys are public-by-design and protected by rules.
- **Feedback system**: `/app/feedback` screen + `feedbacks` Firestore collection (create-only for users).
- **Analytics**: event-based `trackEvent` (`src/lib/analytics.ts`) — product-level events, no invasive tracking.
- **Install prompt**: single dismissible in-flow banner (no intrusive loops), gated on `beforeinstallprompt` + not-already-installed.
- **No fabricated claims**: landing has no fake user counts/testimonials; ToS contains real AI-limitations language; Privacy Policy and Terms exist as public pages.

### Release checklist status
- AUTH: signup/login/logout/reset implemented (Login.tsx), guest mode supported — password recovery requires Firebase to have email sending configured on the project.
- CORE: all routes lazy-loaded; core screens verified to build and render.
- MOBILE: bottom nav + safe areas + dvh + keyboard handling (Phase 2 work) in place.
- BACKEND: build outputs `dist/server.cjs`; Netlify function exists; Firestore rules ready to deploy.
- QUALITY: no template branding remaining; console clean at build time.

### Remaining (recommended before broad rollout)
1. **Manual real-device test pass** (Android Chrome + installed PWA) of the full student workflow: signup → onboarding → ask AI → generate notes → quiz → flashcards → schedule → focus session.
2. **Deploy + verify in production** (this environment cannot complete a real deploy; Netlify/Firebase config must be supplied and tested — do not claim "deployed" until done).
3. **`assetlinks.json`** — replace placeholder SHA-256 with the actual release signing cert fingerprint for TWA/Play Store.
4. **Password-reset email template/sender** configured in Firebase console.
5. **Consider tightening** `feedbacks`/`analytics_events` read rules (currently any signed-in user can read).
6. **Beta program**: hand to 5–20 students with the checklist in README/continuation (signup works? dashboard clear? AI useful? phone performance OK? where do they get confused?).

---

## PHASE 2 — ANDROID OPTIMIZATION (previous session, summary)
- Regenerated corrupted PWA icons (192/512/maskable) + manifest screenshots (1280×720, 640×1136).
- `viewport-fit=cover` + `interactive-widget=resizes-content` meta; `h-screen` → `h-[100dvh]` on chat/whiteboard screens (keyboard-safe).
- Service worker v3 with `SW_UPDATED` client notification → "New version available → Refresh" toast.
- Offline banner in Layout; AI chat draft persistence (sessionStorage); manifest `id`/`scope`/`launch_handler`.
- Vendor chunk splitting: main 1,425 kB → 554 kB (react/firebase/motion cached separately).
- Accessibility: `touch-action: manipulation`, 16px inputs (no focus zoom), `prefers-reduced-motion`.
- Fixed pre-existing `Profile.tsx` syntax corruption that broke the build.

## PWA/TWA notes
- Manifest: `display: standalone`, portrait, theme `#2563eb`, icons + maskable + screenshots present.
- SW: network-first HTML, cache-first assets, API/Firestore explicitly excluded from caching (no private data cached).
- TWA: Capacitor config + assetlinks present; **fingerprint is a placeholder** — must be replaced before Play Store release.

## Key files
- `src/components/Layout.tsx` — nav, install banner, offline state, Capacitor back button
- `src/screens/AIAssistant.tsx` — AI tutor chat (88 KB, largest screen)
- `src/lib/study.ts` — study profile + persistence layer
- `app.ts` / `ai-provider.ts` — AI endpoints, error taxonomy, retries, burst guard
- `firestore.rules` — data isolation
- `public/sw.js` + `public/manifest.json` — PWA

---

## 📦 EXPORT

Full project (excluding `node_modules`, `dist`, `.claude/worktrees`, `.kilo/worktrees`) exported as `teengenius-android-optimized.zip` in the project parent directory. Re-exported after Phase 3 as `teengenius-phase3-launch-ready.zip`.
