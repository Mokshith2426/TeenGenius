# TeenGenius Production Migration & Deployment Manual

This comprehensive guide serves as the ultimate off-boarding blueprint to transition **TeenGenius** from the sandbox Google AI Studio hosting environment into your chosen production-ready, enterprise-grade cloud provider (e.g., standard Google Cloud Platform, AWS, or Vercel/Render hosting) and package it as a native Android app via Capacitor for Google Play Store.

---

## 1. Core Architecture Blueprint
TeenGenius is built upon a high-performance **Full-Stack (Vite + Express)** system powered by **TypeScript**.

* **Client Engine**: Single Page Architecture (SPA) compiled through Vite into `/dist`.
* **Backend Ingress**: Express server running natively in host memory or contained inside a standard Alpine Docker wrapper.
* **Database Layer**: Firebase Firestore (or optionally transactional Cloud SQL PostgreSQL).
* **Identity Management**: Firebase Authentication.

---

## 2. Infrastructure Backup Checklist

Prior to beginning host transition, perform backups of metadata collections:

### A. Firebase Authentication Credentials Export
Ensure your local terminal has the `firebase-tools` CLI authenticated:
```bash
# Export all accounts including salted password hashes to local secure JSON
firebase auth:export students_accounts_backup.json --format=json --project=<YOUR_FIREBASE_PROJECT_ID>
```

### B. Firestore Collections Backup
The optimal offline-first method uses the official Google Cloud SDK toolkit:
```bash
# Create automated cloud bucket snapshot export
gcloud firestore export gs://<YOUR_BACKUP_BUCKET_NAME> --project=<YOUR_FIREBASE_PROJECT_ID>
```

---

## 3. Production Deployment Plan (Dockerised Cloud Run / AWS ECS)

The application includes robust Type Stripping and Bundling protocols which prepare self-contained deliverables. Under optimal configuration, your Docker entry point should deploy via this standard manifest:

### A. Production `Dockerfile`
Create the following Docker wrapper in your root workspace:
```dockerfile
# Use precise Node LTS base image for slim execution
FROM node:20-alpine AS builder
WORKDIR /app

# Cache packages layer
COPY package*.json ./
RUN npm ci

# Copy logic and build optimized bundle chunks
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 4. Absolute Environment Secrets Directory
Configure these keys in your target host environment variables panel. **Do not embed them in code repositories.**

| Secret Variable | Recommended Target Service | Purpose |
| :--- | :--- | :--- |
| `PORT` | Set to `3000` or fallback variable | App Host bind port |
| `NODE_ENV` | Set to `production` | Enables optimized fast serving |
| `GEMINI_API_KEY` | Google AI Studio or GCP Vertex AI | Power interactive AI Tutor & doubt solving |
| `VITE_FIREBASE_API_KEY` | Firebase Console | Client authentication and db read/write |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Console | Secure authorization routing |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Console | Correlation of active Firestore instances |

---

## 5. Recovery & Stability Operational Rules
In case of connectivity failures:
1. **Fallback Modes**: The client utilizes immediate Local Storage caching layer for both user missions and educational statistics tracking, maintaining active sessions when Firebase servers fluctuate.
2. **Gemini Network Throttle**: In case of Vertex/Gemini exhaustion, Express endpoints serve standard, helpful educational prompts explaining rate limits rather than crashing the thread.
3. **Database Guardrails**: Standard checks are applied prior to CRUD collections actions to prevent breaking layouts.

---

## 6. PWA & Play Store Android Readiness Report

### A. Progressive Web App (PWA) Audit
* **Installability**: Fully operational. Realized via a responsive standalone mode within `/public/manifest.json`.
* **Caching Strategy**: Controlled via the static Service Worker (`/public/sw.js`) utilizing Network-First algorithms for critical assets and Cache-First fallback routines for lightning-fast reload operations.
* **Asset Mapping**: Custom iOS apple-touch headers and startup meta viewports are explicitly configured under `/index.html`.

### B. Android build via Capacitor Checklist
To bundle the compiled Vite output (`/dist`) directly into an Android Gradle workspace, perform these CLI commands sequentially:

```bash
# 1. Install Capacitor Platform CLI tools if not present
npm install @capacitor/core @capacitor/android

# 2. Add the Android Studio project workspace
npx cap add android

# 3. Compile the production Vite application assets
npm run build

# 4. Sync web bundle assets and configurations safely into Gradle
npx cap sync android

# 5. Launch the Android platform IDE to compile APK
npx cap open android
```

### C. Google Play Store Submission Checklist
* **App Identifier**: Configured as `site.teengenius.app` (under `capacitor.config.ts`). Change this path if aligning with institution-specific domains.
* **Target Version Compatibility**: Android SDK 34 (Android 14) minimum compiler.
* **Privacy Policies**: Google Play requires a dedicated, publicly hosted policy URL detailing user accounts lifecycles.
* **Target Audience**: Since TeenGenius supports students/teens, verify strict COPPA/GDPR compliance profiles before enabling active marketing streams.
