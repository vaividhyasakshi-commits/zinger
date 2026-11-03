# ZINGER WEB D — Firebase chat, FCM, and GitHub Pages

The React/Vite app keeps the desktop workspace, fake terminal, secret chat shortcut, mobile Dudu & Bubu chat, replies, seen status, and Firebase email/password login. Firebase handles chat storage and authentication. **Background push additionally needs the `notification-server` worker running on a trusted, always-on Node.js 22+ host.** GitHub Pages cannot run this backend. Firebase Cloud Functions and a Blaze upgrade are not required by this implementation; Firebase usage still counts against your project's quotas.

## GitHub Pages: fix the missing VAPID key

Vite embeds `VITE_` settings **during the build**. An ignored local `.env` is unavailable to GitHub Actions. The actual deployment workflow is [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Open [this repository's Actions variables](https://github.com/vaividhyasakshi-commits/zinger/settings/variables/actions): **Settings → Secrets and variables → Actions → Variables → New repository variable**. Keep the existing values and add the two messaging values from the same Firebase project:

| Repository variable | Value / source |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase Project settings → General → Web app config → `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web app config → `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Web app config → `projectId` |
| `VITE_FIREBASE_APP_ID` | Web app config → `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Web app config → `messagingSenderId` (project number; must match the number in `appId`) |
| `VITE_FIREBASE_VAPID_KEY` | Project settings → Cloud Messaging → Web Push certificates → **public** key; use the verified key in local `.env` |
| `VITE_HOST_UID` | `J7Q21mlsF5NcPUJrA9llqasbt0y1` |
| `VITE_PARTNER_UID` | `yvc9aqXcYUYTh9LcLcyAVgn3xLj1` |
| `VITE_HOST_EMAIL` | Existing host Firebase Authentication email |
| `VITE_PARTNER_EMAIL` | Existing partner Firebase Authentication email |
| `VITE_BASE_PATH` | `/zinger/` for this repository; `/` for a custom-domain root |

The two messaging settings also support Actions **Secrets** with the same names; repository Variables take precedence. These are public browser settings either way. Never put account passwords, service-account JSON, or private keys into `VITE_` settings or this repository. `.env` and credential files remain ignored.

For this repository, both messaging repository variables were added and verified from the existing ignored local `.env` during this fix. The other repository variables were preserved. The table above is also the setup checklist for another deployment.

In **Settings → Pages**, select **GitHub Actions** as the source. After changing variables, run **Actions → Deploy ZINGER WEB D to GitHub Pages → Run workflow**, or push a new commit to `main`. A previously built bundle does not pick up new variables until rebuilt. Check the workflow's build and deployment steps, then open `https://vaividhyasakshi-commits.github.io/zinger/`.

Production builds now reject missing/invalid messaging settings. Vite emits `dist/firebase-config.js` using only five public web config fields, with the installed Firebase SDK version. The worker imports this generated file relative to its own `/zinger/` scope; no hand-edited Firebase placeholders are needed. `dist/firebase-messaging-sw.js`, `dist/firebase-config.js`, and `dist/favicon.svg` must all return JavaScript/config/icon content rather than the GitHub Pages 404 page.

## Firebase Console setup

1. Keep Email/Password authentication and the two existing accounts. Login aliases remain `zinghost345` and `betu`; use their existing Firebase passwords. Add `vaividhyasakshi-commits.github.io` to Authentication → Settings → Authorized domains if absent.
2. Confirm the Web app config, project number, and Cloud Messaging Web Push certificate all belong to the same project. Enable the **FCM Registration API** and **Firebase Cloud Messaging API (HTTP v1)** in Google Cloud APIs if disabled.
3. Publish the updated [`firestore.rules`](firestore.rules) in Firestore → Rules. The authorized UIDs are already populated. The rules allow only participants to read messages, enforce the authenticated sender's identity and reply shape, restrict presence/read receipts/token writes to the owner, and deny client access to notification jobs/state. Admin SDK bypasses client rules and must stay on the server.
4. Create a server service-account key only if you do not already have a suitable trusted-server credential. Store it **outside the checkout** or in the hosting provider's secret manager. Use a service account with permission to read/write the required Firestore data and send FCM messages. Never add it to GitHub Pages configuration.
5. Queries use the default single-field `createdAt` index. No extra composite index is required by this implementation. Re-enable that index if it was explicitly disabled.

## Local app commands

Use Node.js 22+. Populate ignored `.env` from `.env.example`, including both messaging values. Use `VITE_BASE_PATH=/` for root-path local development or retain `/zinger/` to reproduce Pages paths.

```powershell
npm ci
npm test
npm run build
npm run dev
```

The dev server serves generated worker configuration too. To inspect the production build:

```powershell
npm run preview -- --host 127.0.0.1
```

Open the printed URL with the configured base, usually `http://localhost:4173/zinger/`. HTTP localhost is allowed for service workers; an arbitrary HTTP LAN address is not a secure web-push origin.

## Notification backend: local test and hosting

Install and run from this full repository. The worker imports shared chat-window rules from `shared/chatState.js`; include that folder when hosting instead of uploading only `notification-server/`.

```powershell
npm ci --prefix notification-server
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path-outside-repository\firebase-service-account.json'
# Optional when using Application Default Credentials:
# $env:FIREBASE_PROJECT_ID = 'your-firebase-project-id'
npm --prefix notification-server run check-config
npm --prefix notification-server test
npm --prefix notification-server start
```

Alternatively set the hosting provider's **server-only** `FIREBASE_SERVICE_ACCOUNT_JSON` secret to the entire service-account JSON. A `notification-server/.env` is supported locally and ignored. `check-config` validates and initializes credentials offline; it does not prove access to Firestore/FCM. No credentials are bundled into the web app.

The worker listens for genuine host messages and partner read receipts, computes unread counts using the same latest-200-message/24-hour window as the UI, and sends data-only FCM payloads. Payloads contain count/timestamp/event metadata, never message text or sender details. The service worker alone renders **Beauty Deals • 20% OFF 💗**, with `1 product waiting for you! ✨` or `N products waiting for you! ✨`.

Processing claims and a startup watermark are persisted in server-only `_notificationJobs` and `_notificationState` collections. First startup does not notify historical messages. Restarts can resume unprocessed messages since that first start within the 24-hour window. Temporary failures retry with backoff; expired leases can be reclaimed. Confirmed invalid tokens are removed only if the stored token still matches the failed delivery. Logs include status/error codes and counts, never chat contents, tokens, or credential values.

Use an always-on worker process with restart supervision and outbound access to Firestore/FCM. A sleeping free host, terminated laptop process, long outage, or exhausted Spark quota can delay or prevent notifications. Sending to FCM and recording success are separate operations, so exactly-once delivery cannot be promised; persistent claims, payload event deduplication, a Web Push Topic, and a stable notification tag reduce duplicates. Server-only job documents need periodic trusted cleanup if their growth becomes significant; keep recent job records at least 24 hours for replay protection.

## Android Chrome acceptance test

1. Start the backend and wait for its listening log. Deploy the updated Pages build and publish the rules. On Android Chrome, sign in as the partner and tap **Enable Beauty Offers**, then allow notifications. No permission prompt should appear on page load. The button disappears only after token storage and worker activation succeed; failures leave it available with an error.
2. In Firebase Console, verify the partner's `pushTokens/<partner UID>` document has `enabled: true` and a nonempty token. Do not copy tokens into logs or screenshots. In Chrome remote DevTools, confirm the worker scope is `https://vaividhyasakshi-commits.github.io/zinger/`.
3. Background the partner tab, then send one host message. Check the beauty title/body and that actual chat text and sender details are absent. Send another unread message; the same tag should replace the offer and show **2 products** on browsers that support replacement.
4. Repeat while using another app and with the screen locked. This must be tested on the physical phone; an automated unit test is not delivery evidence. Chrome, Android notification settings, battery restrictions, connectivity, and force-stopping Chrome can affect delivery. Check Chrome site notification permission and Android's Chrome notification settings.
5. Tap the notification: the existing ZINGER tab should focus, or a new tab should open inside the same app scope. Scroll to the latest messages to mark them read. The page tells its service worker to close the offer, and the next host message should show **1 product** again. The backend skips zero-unread pushes to avoid a silent web push causing Chrome's generic background-update notification.
6. Refresh or sign out/in with permission already granted: registration should restore without another permission prompt. Revoking site permission should leave the Enable button available. Sign out, then send a host message: this worker must not render further offers for the disabled session. With several tabs, Firebase Auth shares the same browser session.

The current schema stores **one token per user**, preserving the existing rules and data layout; registering another partner device replaces the previous device's delivery target. Use one partner device for acceptance testing.

## Desktop sound, presence, and UI checks

- Sign in as host and interact once with the page (or toggle Sound ON). A new partner message plays a soft two-tone blip; initial history, outgoing messages, metadata updates, and replayed IDs do not. Sound preference persists, and logout cancels scheduled oscillators. Browsers can suspend Web Audio in background/frozen tabs; playback is conditional on browser policy.
- **Ctrl+K** toggles desktop chat. The existing Ctrl+M shortcut remains supported. Fake terminal activity, mobile bears, replies, bubbles, sent/seen state, and tab unread badges remain in place.
- Presence sends a 12-second heartbeat only while the chat is active, expires after 35 seconds, and clears typing after inactivity. Backgrounding/offline/page exit sends a best-effort inactive state; `lastActiveAt` retains the last active time instead of being overwritten by offline heartbeats. A closed tab/crashed browser can appear active until the heartbeat expires. This is a Firestore approximation, not Realtime Database `onDisconnect` presence.
- Test mobile keyboard resizing, paragraph composition, swipe-to-reply, scroll position, and seen indicators on the real phone. Notification setup now occupies its own row below the header so it does not cover the composer.

## Automated verification

```powershell
npm test
npm run build
npm --prefix notification-server test
# Requires Java 21+; uses demo-zinger and does not touch production data:
npm exec --yes --package=firebase-tools@15.34.2 -- firebase emulators:exec --only firestore --project demo-zinger 'npm run test:rules'
```

The regular test suite covers config/workflow wiring, Pages base paths, credential exclusion, unread/sound filtering, permission behavior, concurrent token registration, immediate logout and re-login, notification replay/read clearing, backend retry/leases, and invalid-token replacement. Rule tests run only when `FIRESTORE_EMULATOR_HOST` is set (the command above sets it); otherwise they report a skip.

No physical Android delivery, real FCM token generation, or credentialed production backend connection should be considered verified merely because these tests pass. Local `.env` values and server credentials are deliberately excluded from Git. Messages hidden after 24 hours remain in Firestore until separately deleted; UI expiry is not database deletion.

Firebase Admin now uses the Node.js 22+ compatible 14.x SDK. The frontend dependency tree overrides Firestore's older pinned gRPC package with the compatible patched 1.14.x line. The backend dependency audit still reports six moderate advisories through Google SDK dependencies (`glob`/`minimatch`); a compatible `npm audit fix` did not resolve them. Review upstream patches before changing those transitive major versions. The production JavaScript bundle also retains Vite's large-chunk warning.

## Changed file inventory

Verification for this change: **31 ordinary tests passed**, plus **5 Firestore emulator/integration tests passed** separately. Production build and HTTP checks for the Pages base, JavaScript/CSS assets, service worker, generated config, and icon passed. Root dependency audit reports zero vulnerabilities. Browser automation was unavailable, and neither real Android delivery nor a credentialed production worker was tested. This machine has no signed-in Firebase CLI account or server credential, so publish the updated rules in Firebase Console and configure/start the trusted worker before end-to-end testing.

| Area | Files |
| --- | --- |
| Build/deployment | `.github/workflows/deploy.yml`, `.env.example`, `.gitignore`, `vite.config.js`, `package.json`, `package-lock.json`, new `scripts/firebaseWorkerConfig.js`, new `firebase.json` |
| Browser app | `src/App.jsx`, `src/style.css`, `src/config.js`, `src/firebase.js`, `src/notifications.js`, `src/pushNotifications.js`, new `src/pushRegistration.js`, new `shared/chatState.js` |
| Service workers | Replaced `public/firebase-messaging-sw.js`; removed unused `public/zinger-sw.js` to keep one notification renderer |
| Trusted worker | `notification-server/index.js`, `notification-server/package.json`, new `notification-server/config.js`, `notification-server/worker.js`, `notification-server/package-lock.json` |
| Verification/docs | `tests/config.test.js`; new `tests/backend.test.js`, `tests/backend.integration.test.js`, `tests/chatState.test.js`, `tests/pushRegistration.test.js`, `tests/serviceWorker.test.js`, `tests/firestore.rules.test.js`; `firestore.rules`; `README.md` |

## References

- [Vite: environment values are replaced at build time](https://vite.dev/guide/env-and-mode)
- [Firebase: web FCM setup, permissions and registration](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Firebase: foreground/background receipt and custom notification clicks](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)
- [Firebase: invalid and stale registration tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Firebase: Firestore presence and Realtime Database disconnect behavior](https://firebase.google.com/docs/firestore/solutions/presence)
