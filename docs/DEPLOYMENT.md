# PicSift Deployment Guide

Quick reference for deploying PicSift to Netlify. For full setup (first-time Dropbox app, DNS, OAuth), see [SETUP_GUIDE.md](SETUP_GUIDE.md).

---

## Phase 9: Deployment Checklist

Use this checklist to deploy and verify the app (see [PROJECT_PLAN.md](PROJECT_PLAN.md) Phase 9).

### 1. Netlify setup

- [ ] **Connect GitHub repository**
  - Netlify → **Add new site** → **Import an existing project** → GitHub → select `picsift` repo.
- [ ] **Configure build settings** (Netlify usually auto-detects from `netlify.toml`):
  - **Build command:** `npm run build`
  - **Publish directory:** `dist`
  - **Functions directory:** `netlify/functions`
- [ ] **Set environment variables** (see [Environment variables](#environment-variables) below).
- [ ] **Configure custom domain** (optional): e.g. `picsift.lindsaybrunner.com` in **Domain settings** → Add custom domain. See [SETUP_GUIDE.md](SETUP_GUIDE.md) Step 0 for DNS and HTTPS.

### 2. Environment variables

Set in **Netlify** → **Site configuration** → **Environment variables**. Required for production:

- [ ] `DROPBOX_APP_KEY`
- [ ] `DROPBOX_APP_SECRET`
- [ ] `AUTHORIZED_DROPBOX_ACCOUNT_ID` (or `AUTHORIZED_DROPBOX_EMAIL`) for single-user access control
- [ ] `DROPBOX_REFRESH_TOKEN` optional in production: after first OAuth the token is stored in Netlify Blob; re-login updates it. Set only if you need `current_account` before first login.
- [ ] `NETLIFY_URL` (recommended): your site URL, e.g. `https://picsift.lindsaybrunner.com` — ensures correct OAuth redirect

After changing env vars: **Deploys** → **Trigger deploy** → **Deploy site**.

### 3. Deploy and verify

- [ ] **Deploy:** Push to `main` (or your connected branch); Netlify auto-deploys. Or trigger deploy from the Netlify dashboard.
- [ ] **Test OAuth:** Visit the site → Log in with Dropbox → complete redirect and return to app.
- [ ] **Test complete user flow:** Select folder → start session → keep/delete images → undo → finish session.
- [ ] **Verify security:** From a different Dropbox account, attempt login — you should see "Access denied" and no tokens stored. Confirm no tokens appear in browser (e.g. DevTools → Application/Storage).

**Deliverables:** Live app on Netlify, working OAuth, secure deployment. See [Security checklist](PROJECT_PLAN.md#security-checklist) in PROJECT_PLAN before going live.

---

## Build & Deploy

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`

Netlify runs `npm run build` (which typechecks functions then runs the Vite build). Push to your connected branch (e.g. `main`) to trigger an automatic deploy.

---

## Environment Variables

Set these in **Netlify** → **Site configuration** → **Environment variables**. Never commit secrets.

| Variable                        | Required         | Description                                                                                      |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `DROPBOX_APP_KEY`               | Yes              | From [Dropbox App Console](https://www.dropbox.com/developers/apps)                               |
| `DROPBOX_APP_SECRET`            | Yes              | From Dropbox App Console                                                                          |
| `AUTHORIZED_DROPBOX_ACCOUNT_ID` | Yes (production) | Your account ID, e.g. `dbid:xxxxxxxxxxxxx` — only this account can use the app                    |
| `NETLIFY_URL`                   | Recommended      | `https://picsift.lindsaybrunner.com` — ensures correct OAuth redirect                             |
| `DROPBOX_REFRESH_TOKEN`         | Optional         | In production the token is stored in Netlify Blob after first OAuth; re-login updates it. No logs. |

**Optional:** `DROPBOX_SOURCE_PATH`, `URL` (auto-set by Netlify), `PICSIFT_SESSION_INACTIVITY_MINUTES` (default 30 — force logout after this many minutes without using the app on that device).

**Security:** Tokens are never logged. Logout clears the session for that device. Sessions also expire after inactivity (default 30 min; see `PICSIFT_SESSION_INACTIVITY_MINUTES`).

**Getting your account ID:** After your first OAuth (or if `DROPBOX_REFRESH_TOKEN` is set), open  
`https://your-site.netlify.app/.netlify/functions/current_account`  
(or your custom domain + `/.netlify/functions/current_account`) in a browser. The response includes `account_id` and `email`. Copy the `account_id` value into `AUTHORIZED_DROPBOX_ACCOUNT_ID` in Netlify. Alternatively, use `AUTHORIZED_DROPBOX_EMAIL` with the returned `email` and skip the ID.

After changing environment variables, trigger a new deploy: **Deploys** → **Trigger deploy** → **Deploy site**.

---

## Post-Deploy Verification

1. Visit your site (e.g. `https://picsift.lindsaybrunner.com`) and confirm the app loads.
2. Log in with Dropbox and complete OAuth (token is stored in Netlify Blob; no manual copy from logs).
3. Select a folder and start a session; confirm list, temp link, keep/delete, and undo work.
4. Log out, then log in again — should work without touching Netlify (re-auth updates Blob).
5. Test from a different Dropbox account: you should see "Access denied" and no tokens stored.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) Step 5 and Step 6 for detailed verification and troubleshooting.
