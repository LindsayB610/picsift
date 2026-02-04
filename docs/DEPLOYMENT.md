# PicSift Deployment Guide

Quick reference for deploying PicSift to Netlify. For full setup (first-time Dropbox app, DNS, OAuth), see [SETUP_GUIDE.md](SETUP_GUIDE.md).

---

## Build & Deploy

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`

Netlify runs `npm run build` (which typechecks functions then runs the Vite build). Push to your connected branch (e.g. `main`) to trigger an automatic deploy.

---

## Environment Variables

Set these in **Netlify** → **Site configuration** → **Environment variables**. Never commit secrets.

| Variable                        | Required         | Description                                                                    |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `DROPBOX_APP_KEY`               | Yes              | From [Dropbox App Console](https://www.dropbox.com/developers/apps)            |
| `DROPBOX_APP_SECRET`            | Yes              | From Dropbox App Console                                                       |
| `DROPBOX_REFRESH_TOKEN`         | Yes              | Set after first OAuth (see SETUP_GUIDE)                                        |
| `AUTHORIZED_DROPBOX_ACCOUNT_ID` | Yes (production) | Your account ID, e.g. `dbid:xxxxxxxxxxxxx` — only this account can use the app |
| `NETLIFY_URL`                   | Recommended      | `https://picsift.lindsaybrunner.com` — ensures correct OAuth redirect          |

**Optional:** `DROPBOX_SOURCE_PATH`, `URL` (auto-set by Netlify).

After changing environment variables, trigger a new deploy: **Deploys** → **Trigger deploy** → **Deploy site**.

---

## Post-Deploy Verification

1. Visit your site (e.g. `https://picsift.lindsaybrunner.com`) and confirm the app loads.
2. Log in with Dropbox and complete OAuth.
3. Select a folder and start a session; confirm list, temp link, keep/delete, and undo work.
4. Test from a different Dropbox account: you should see "Access denied" and no tokens stored.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) Step 5 and Step 6 for detailed verification and troubleshooting.
