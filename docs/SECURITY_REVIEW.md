# Security Review

A full project security review. See also [SECURITY_CHECKLIST_VERIFICATION.md](SECURITY_CHECKLIST_VERIFICATION.md) for the checklist status.

---

## Summary: Is it secure?

**For a single-user, personal photo triage app:** the design is **largely secure** and aligns with the checklist. Secrets stay server-side, OAuth and path validation are solid, and access control is enforced. A few **hardening fixes** are recommended (see below) and one **architectural limitation** should be understood.

---

## What’s in good shape

- **Secrets**: No API keys, tokens, or passwords in code; all from `process.env`. `.env` is in `.gitignore`; `.env.example` uses placeholders only.
- **Dropbox server-side only**: All Dropbox API usage is in Netlify functions; the frontend only calls `/.netlify/functions/*`.
- **Tokens never to browser**: OAuth callback redirects with `?auth=success&account_id=...` only; refresh token is stored in Netlify Blob (production) or `.env` (local dev), never in URL or response body.
- **OAuth CSRF**: State is generated with `crypto.randomBytes(32)`, stored in an HttpOnly cookie and validated in the callback; mismatch is rejected and logged.
- **Access control**: `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` enforced in production; auth callback and `_dropbox.ts` validate token ownership on every use; account ID is stored with the token and re-validated from cache.
- **Path validation**: All path-taking functions reject `..`, require `/` or `""` where appropriate; `undo` additionally requires `trashed_path` under `/_TRASHME/`; `trash` validates `session_id` (length and character set).
- **Error messages**: No sensitive data (tokens, account IDs, paths) in client-facing messages; details only in server logs.
- **HTTPS**: Production base URLs forced to HTTPS; cookies use `Secure` when not localhost.
- **Logout**: Server-side logout clears Blob so the next request requires re-auth.

---

## Issues found and fixes

### 1. `current_account` is unauthenticated and leaks account info

- **Issue**: `GET /.netlify/functions/current_account` returns `account_id` and `email` for the configured refresh token. Anyone who can hit the URL (e.g. in production during or after setup) can see that data.
- **Fix**: In production, when `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` is already set, return 404 or 403 and do not return account details. Use `current_account` only during initial setup (before authorized identity is set).

### 2. `logout` accepts GET

- **Issue**: Logout is allowed via GET. A link or redirect to `/.netlify/functions/logout` could log the user out (e.g. from another site or email).
- **Fix**: Allow only POST for logout so casual link-follows or GET redirects do not trigger logout.

### 3. `discover_folders` leaks stack traces on 500

- **Issue**: On error, the handler sends `stack: errorStack` in the JSON response, exposing server paths and internals.
- **Fix**: Do not include `stack` in the client response; log it server-side only.

### 4. Legacy hash/setup branch in `App.tsx` (lines ~497–522)

- **Issue**: Code still reads `refresh_token` and `account_id` from the URL hash and can store the token in `sessionStorage`. The current OAuth callback never redirects with tokens in the hash, so this path is unused but would be dangerous if the callback were ever changed to send tokens to the client.
- **Recommendation**: Remove this branch or guard it (e.g. only in local dev) so tokens cannot be stored from the URL.

---

## Session binding (only your browser can use the API)

To make sure **no one else can access your Dropbox via PicSift** even though the login page is public:

1. **Only your account can complete login**  
   In production, `auth_callback` only stores tokens when `account_id` / `email` match `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL`. Anyone else gets “Access denied” and no token is stored.

2. **Only browsers that completed OAuth can call the API**  
   After a successful login, the server stores the token in Blob and sets an **HttpOnly session cookie** (`picsift_session`) containing a random secret. The server keeps a list of valid session secrets (one per device). The functions `list`, `temp_link`, `trash`, `undo`, and `discover_folders` **require this cookie** and return 401 if it is missing or invalid. So:
   - Someone visiting the login page and signing in with their own Dropbox never gets a token stored (fails the authorized-account check).
   - Someone opening a forged URL like `?auth=success&account_id=your_id` might see the app in “logged in” state locally, but **all API calls will return 401** because they don’t have the session cookie (only set when the server completes OAuth for you).
   - Only browsers/devices where you completed the Dropbox OAuth flow have a cookie in the list and can list, view, trash, or undo. **Multiple devices (e.g. phone and desktop) are supported:** each login adds that device's session.

3. **Logout** removes only this device's session and clears the cookie; other devices stay logged in. **Inactivity:** Sessions are forced logout after a period of no activity (default 30 minutes, configurable via `PICSIFT_SESSION_INACTIVITY_MINUTES`); the threshold is per device.

**After deploying:** You can log in from multiple devices (e.g. phone and desktop); each gets its own session. Logging out signs out only the current device. Session cookies last 30 days.

---

## Recommendations

1. **Before deploy**: Ensure `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` is set in production (see [DEPLOYMENT.md](DEPLOYMENT.md)).
2. **After first deploy with session binding**: Log in once so the server sets the session cookie; then only that browser can access your Dropbox via PicSift.
3. **Ongoing**: Run `npm run typecheck` and `npm run lint`; keep dependencies updated.
