# TeenGenius — Continuation Log

**Last updated:** 2026-09-25 (Phase 11: Design-token colour repair)
**Branch:** main
**Status:** Build ✅ | TypeScript lint ✅ | Production server smoke test ✅

---

## PHASE 11 — DESIGN-TOKEN COLOUR REPAIR (this session)

**Theme:** a full-source audit found **216 colour utilities** using shade values that do not exist in this project's Tailwind palette, so Tailwind emitted **no CSS at all** for them. These were mostly custom zinc shades (such as `zinc-650`, `zinc-805`, `zinc-850`) mistakenly applied to other colour families, and a few malformed duplicates such as `bg-zinc-90`. Repaired the full set rather than only the two examples previously logged.

- **Grounding:** the project defines Tailwind's standard 50–950 palette plus **zinc-only** custom shades `150, 250, 350, 450, 805, 850, 905` in `src/index.css`. Extended families keep the standard palette; zinc uses both. The audit now reports **0 invalid colour utilities**, down from 216.
- **Repair scope:** **21 tracked source files**, all mechanical class-token replacements (no layout, logic, copy, route, data, or dependency changes). Examples: `text-rose-650` → `text-rose-600`, `bg-teal-55/10` → `bg-teal-500/10`, and `dark:bg-rose-955/*` → `dark:bg-rose-950/*`.
- **Malformed duplicate removed:** five elements contained a dead `bg-zinc-90` immediately before a valid `bg-zinc-900`; the dead token was removed rather than rounded, preserving the already-effective background.
- **Sibling branches kept consistent:** the two error-banner tint branches in `AIAssistant` now use matching `red-100` / `green-100` steps.
- **Safety checks:** every modified line is a 1:1 replacement; a structural same-property/state conflict comparison against `HEAD` found **0 new conflicts**; the five dead `bg-zinc-90` sites are now clean.
- **Documentation cleanup:** removed the stale "Timetable Maker" bullet from `android-app/README.md`; this was the sole remaining reference to a retired feature (the continuation log's historical note excluded).
- **Not retained:** the temporary repair script was deleted before commit; `_scan5.txt` and `filelist.txt` remain untracked as before.
- **Validated:** `npm run lint` → 0, `npm run build` → 0, production smoke `/` 200 + `/api/version` 200 with empty stderr; CSS emission rechecked after the final build.

---

## PHASE 10 — FOCUS ZONE POLISH & MOBILE TIMER FIX (this session)

**Theme:** the Focus screen already called itself **Focus Zone** in the nav, the page `<h1>`, and the command palette, but five other places still said "Focus Room" — so the feature seemed to have two names. Renamed consistently, and fixed two real rendering defects found while in the file.

- **One name everywhere**: `Layout.tsx` route title ("Focus Room" → **Focus Zone**), dashboard Study Tools card CTA and Focus Zone card subtitle (`Home.tsx`), Profile quick-action (`⏱️ Focus Room (+XP)` → **⏱️ Focus Zone (+XP)**), `MainWalkthrough` label ("Focus Zones" → **Focus Zone**), Terms of Service ("When you study in Focus Rooms or Classrooms…" → "When you use the **Focus Zone** or Classrooms…"), `analytics.ts` `featureUsage` keys in **both** `getLocalStats()` and `fetchRealtimeStats()` (so the Activity & Stats chart accumulates under one label instead of two), PWA `manifest.json` description + mobile screenshot label, `index.html` meta keywords ("focus room" → "focus timer"), and the server-side AI platform facts.
- **Bug: Streak chip had no tint.** The stats bar built its chip classes by string interpolation — `` `bg-${color}-100 dark:bg-${color}-950/40` `` and `` `text-${color}-600` `` — which Tailwind cannot see, so it never emits them. The other three chips happened to look right only because their literal classes exist elsewhere in the app; `orange` appears nowhere else, so the Streak chip rendered as a bare icon while its siblings had colour. Replaced with literal per-chip class strings (`chip` field) and dropped the interpolated `Icon` colour prop.
- **Bug: timer circle overflowed on phones.** The progress dial was a fixed `w-72 h-72` (288 px) inside a `p-8` card. On a 360–375 px viewport the Layout content padding is only 16 px each side, so 288 + 64 = 352 px plus padding exceeded the screen and pushed a horizontal scrollbar. Now `w-full max-w-[15rem] sm:max-w-[18rem] aspect-square` with card padding `p-6 sm:p-8 md:p-10` and corners `rounded-[2rem] sm:rounded-[2.5rem]`; the clock digits scale `text-6xl sm:text-7xl`. Dial is 240 px on a small phone, unchanged from before on tablet/desktop.
- **Copy**: screen subtitle "Deep Work Engine" → **"Pomodoro timer & study audio"** (says what the screen actually does); the "Cycle" stat no longer reads `3/4 SESSION` — value `3` with unit `OF 4`; dashboard card blurb "Procedural soundscapes and focus clocks…" → "Study audio and a Pomodoro timer…".
- **Accessibility**: the Pomodoro/Short Break/Long Break tabs conveyed selection by colour only — added `aria-pressed={timer.mode === m}`.
- **Dead class**: dashboard Focus Zone card used `dark:bg-rose-955/40` (no such shade in the `@theme`) → `dark:bg-rose-950/40`.
- **Notes / non-changes**: `src/lib/ai-prompts.ts` **is** live (imported by `server/services/ai.service.ts`) — an earlier suspicion that it was dead was wrong, so both prompt copies were updated deliberately. `MarkdownRenderer.tsx` keeps its defensive `'focus room'` matcher on purpose, so AI-generated links using the old wording still route to `/app/focus`. `src/components/AcademicCalendar.tsx` has **no importers** (dead file) and was left untouched — its line 627 is the only other stale "Focus Room" text in the repo and cannot reach users.
- **Logged for the next checkpoint**: two more dead shade utilities of the same kind fixed earlier in Profile.tsx still exist — `src/screens/Login.tsx:590` (`dark:bg-rose-955/25`, the sign-in error banner) and `src/screens/StudyGroupDetail.tsx:1624` (`dark:bg-rose-955/20`, the badge). Neither emits CSS, so those dark-mode tints are currently missing. Also `src/components/AcademicCalendar.tsx` is an unimported duplicate of the calendar screen and is a deletion candidate.
- Validated: `npm run lint` → 0, `npm run build` → 0, prod smoke `/` 200 + `/api/version` 200 + `/manifest.json` 200 with empty stderr; new strings confirmed in the client and server bundles, old strings confirmed gone.

---

## PHASE 9 — SETTINGS & PROFILE DE-JARGON + LEGAL PAGES (this session)

**Theme:** finished the app-wide voice cleanup on the remaining "network operator" surfaces, and rewrote the two legal pages that students actually reach from the login footer (linked in Phase 8). Copy/label pass + a few dead Tailwind classes; no logic, data, routing, or auth changes.

- **SettingsModal**: header "Student Preferences" → **Preferences**; sidebar footer "Exit Session" → **Log Out**; "Profile Credentials" → **Profile**; "Relaunch Walkthrough" → **Replay Tutorial**; "Communications & Language" → **Notifications & Language**; "App Typography Scaling" → **Text Size**; "Save Profile details" → **Save Changes**; "Current Security Key" → **Current Password**; FAQ "How do Study Circles work?" (with "secure node rooms…curate modules…sandbox quizzes") → **"How do Classrooms work?"** with plain wording; "Is my workspace information hidden?" → **"Is my data private?"**; the privacy/ToS info block rewritten plainly (was "database clusters", "feedback transmissions", "API shortcuts for system scraping").
- **PrivacyPolicy**: rewritten in plain student language — headings now "Our Commitment to Students / What We Collect / How We Protect Your Data / AI Chats and Questions / Deleting Your Data"; removed "offshore sandboxed educational companion" and "third-party public networks for marketing indexing". Header pill "Active Safeguards" → **Your Data**.
- **TermsOfService**: rewritten — "Acceptance of Terms / What the App Is For / Staying Respectful / AI Answers Can Be Wrong / Your Content"; removed "absolute consent", "pledge strictly", "verify ultimate exactness", "TeenGenius Inc.".
- **Profile**: menu labels de-jargoned — "Student Account Credentials / Inspect Secure Account Info" → **Account Information / "Email, ID, and sign-in details"**; "Instant Doubts Notifications" → **Notifications / "Study reminders"**; "Visual Interface Mode / Dark Screen" → **Appearance / "Dark mode"**; "System Walkthrough & Help / Restart Tutorial" → **Help & Tutorial / "Replay the app tour"**; "Student Performance Analytics / Institutional usage report" → **Activity & Stats / "How you use the app"**; "Institution Privacy & Security" → **Privacy & Security**; badge desc "…linked classmates and joined your study network." → "Unlocked when you add classmates to study with."
- **Profile → Account Information modal**: "Secure Study Portal Identity" → **Signed in as**; "Guest Learner Access / Verified Google Sign-In" → **Guest mode / Signed in with Google**; "Student Identifier" → **Student ID**; "Authorization Client" → **Sign-In Method**; "Anonymous mode / Google Identity Client" → **Guest mode / Google**; "Encryption Standard / AES-256 SSL Secure" → **Connection Security / Encrypted (AES-256)**; "Close Info" → **Close**.
- **Profile → Analytics modal**: "Institutional Usage Telemetry" → **Your Usage Stats**; "DAU / WAU" → **Daily / Weekly Users**; "System Logins" → **Logins**; "Active Sessions" → **Study Sessions**; "Average Depth" → **Avg. Session**; "Features usage analysis" → **Features used**; "{n} queries" → "{n} uses".
- **Profile → achievements & friends copy**: "Earn digital credentials by maintaining study routines and collaborating in classroom networks." → "Earn badges by keeping your study streak going and studying with classmates."; "Earn premium academy badges to showcase your diligence!…mega-bonus!" → "Keep your streak going to collect badges…bonus!"; "Start Your Study Network!" → **Add your first classmate**; "Wants to join your academy circle." → "Wants to be your study buddy."; "Link Peers (Earn Catalyst)" → **Find Friends**; "Focus Room (Earn Catalyst)" → **Focus Room**.
- **Dead CSS fixed** (proven by absence from the compiled `dist/assets/*.css`, and cross-checked against the custom zinc shades that ARE defined in `src/index.css` `@theme`: `zinc-150/250/350/450/805/850/905`): `text-rose-705`, `text-indigo-440`, `text-rose-450`, `text-emerald-405`, `text-emerald-550`, `border-emerald-550/25`, `text-red-650`, `bg-teal-55/10`, `bg-red-955/10`, `text-zinc-650`, and on the policy pages `text-blue-550`, `text-indigo-550`, `text-emerald-555`, `text-rose-550`, `text-pink-550`. Replaced with real shades so badge titles, icons, links, and hover states render in the intended colour.
- **Housekeeping**: dropped the unused `motion` import from both policy pages (they render plain `<div>`s).
- Validated: `npm run lint` → 0, `npm run build` → 0, prod smoke `/` 200, `/api/version` 200, `/privacy` 200, `/terms` 200; new strings verified present in `dist/assets/*.js` and 9 old jargon strings verified gone.

---

## PHASE 8 — AUTH & NAVIGATION DE-JARGON (this session)

**Theme:** the two highest-traffic surfaces a student sees — the login screen and the command palette / More menu — no longer speak in network-operator jargon. Copy/label pass only for auth; no logic, data, or routing behavior changed.

- **Login**: tagline "COGNITIVE NETWORK" → **STUDY COMPANION**; panel titles ("Authenticate Student" / "Initiate Node" / "Recover Credential") → **Welcome back** / **Create your account** / **Reset your password**; primary CTAs ("Verify Credentials" / "Initiate Node" / "Transmit Reset Link") → **Sign In** / **Create Account** / **Send Reset Link**; field labels "Network Password" & "Confirm Network Password" → **Password** / **Confirm Password**; trust row ("Secure Network" / "Verified Node") → "Private by design" / "Free for students".
- **Login footer (small UX fix)**: the "you agree to our terms" line previously had `select-none pointer-events-none` so it was inert; it now links to the existing `/terms` and `/privacy` routes (`Link` imported from `react-router-dom`).
- **CommandPalette**: categories ("Ecosystem Modules" / "System Utilities") → **Navigation** / **Actions**; command labels de-jargoned ("Toggle Visual Theme" → "Toggle Theme", "Open Account Registry" → "Open Settings", "Terminate Secure Session" → "Log Out"); descriptions shortened ("Go to X", "Switch to dark mode", "Sign out of your account"); empty state ("No execution targets found" / "No modules or system macros…") → "No results found" / "Nothing matches your search."; close tooltip.
- **Layout**: More-sheet headings ("Modules Portal" / "Ecosystem Space") → **Quick Access** / **More Features**; mobile menu tooltip "Toggle Menu Portal" → "More options"; online toast "Connected to active school networks! Restoring real-time sync." → "You're back online — syncing your data."; stale "module/node" code comments tidied.
- Remaining out-of-scope jargon for a later pass: `SettingsModal` ToS paragraph ("feedback transmissions", "API shortcuts for system scraping") and `Profile`'s "Secure Study Portal Identity" label.
- Validated: `npm run lint` → 0, `npm run build` → 0, prod smoke `/` 200 + `/api/version` 200, de-jargon strings confirmed in `dist/assets/*.js`.

---

## PHASE 7 — EMPTY / LOADING / ERROR STATE VOICE

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
