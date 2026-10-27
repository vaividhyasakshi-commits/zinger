# ZINGER WEB D — GitHub Pages + Firebase

This is the **Firebase version**. No Node.js chat server is required. The previous `server/` folder is legacy and unused; don't deploy it.

## 1. Create a Firebase project

1. Open https://console.firebase.google.com/ and create a project (Spark/free plan is sufficient for light usage within its limits).
2. Project settings > Your apps > Add app > Web. Copy the Firebase Web config values (`apiKey`, `authDomain`, `projectId`, `appId`).
3. Authentication > Sign-in method: enable **Email/Password**.
4. Authentication > Users: **add exactly two users** with two email addresses and **new, strong passwords**. Do not reuse passwords posted in a chat. Copy their UIDs.
5. Authentication > Settings > Authorized domains: add your GitHub Pages domain (e.g. `yourname.github.io`) if needed.
6. Firestore Database > Create database, then publish the rules in `firestore.rules` **after replacing ALL occurrences** of `REPLACE_HOST_UID` and `REPLACE_PARTNER_UID` with the UIDs from step 4. Never use public test-mode rules.

## 2. Local development

1. Copy `.env.example` to `.env` and fill the Firebase config, both UIDs, and both email addresses.
2. Set `VITE_BASE_PATH=/` in local `.env`.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:5173`.

Login screen usernames:

- `zinghost345` — corresponding to `VITE_HOST_EMAIL`, with that Firebase user's password.
- `betu` — corresponding to `VITE_PARTNER_EMAIL`, with that Firebase user's password.

Account identity is verified by Firebase, and the user UID decides the UI: host gets desktop terminal, partner gets cute mobile chat. **Do not hardcode Firebase account passwords in React or GitHub repo.**

## 3. GitHub Pages deployment

1. Push the contents of this folder to a GitHub repository (the repository root must contain `package.json` and `.github/workflows/deploy.yml`).
2. In GitHub repo > Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. In Settings > Secrets and variables > Actions > **Variables**, add all the `VITE_...` variable names from `.env.example`, with your values. These values will be included in the publicly downloadable client bundle; never put passwords or service account secrets here.
4. Set `VITE_BASE_PATH=/<YOUR_REPOSITORY_NAME>/` for a standard GitHub Pages project site. Use `/` for a custom-domain root site.
5. Push to `main` or manually run the Deploy workflow from the Actions tab.
6. Open `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/` on your PC and partner's phone.

No PHP/Node.js backend hosting is needed; Firebase handles the realtime data exchange.

## Message retention & privacy

- The app shows only the 200 most recent messages, and hides messages older than 24 hours in the UI. **Older messages remain in Firestore unless deleted separately.**
- If you want real backend deletion, configure Firebase's Firestore TTL feature or a trusted scheduled cleanup job; UI expiry is **not** data erasure.
- Firebase is not end-to-end encryption. Don't treat this as an unmonitorable/secret channel on managed devices.
- Firestore's rules restrict reading/writing to only the two authorized user UIDs. Rules must be published before chatting will work.

## Common issues

- `Missing or insufficient permissions`: double-check the published Firestore rules and UID values.
- `auth/invalid-credential`: email mapping or password is incorrect.
- Blank GitHub Pages page: set `VITE_BASE_PATH` to the correct repo path and redeploy.
- Chat not updating: Firestore project/config/rules, internet connectivity, and browser console should be checked.
