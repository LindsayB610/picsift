# Security Checklist Verification

This document verifies each item in the [Security Checklist](PROJECT_PLAN.md#security-checklist) against the codebase. Use it before deploying and when auditing security.

---

## 1. No secrets in code (grep for API keys, tokens, passwords)

**Status: PASS**

- All Dropbox credentials are read from `process.env` (e.g. `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`) in `netlify/functions/auth_start.ts`, `auth_callback.ts`, and `_dropbox.ts`.
- No hardcoded API keys, tokens, or passwords found in `.ts`/`.tsx`/`.js` files.
- The only string containing `refresh_token` in a non-env context is in `auth_callback.ts` when logging or writing to `.env` in local dev (server-side only).

---

## 2. `.env` file in `.gitignore`

**Status: PASS**

- `.gitignore` includes `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` (lines 15–19).

---

## 3. `.env.example` exists with placeholder values

**Status: PASS**

- `.env.example` exists with placeholders for `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `AUTHORIZED_DROPBOX_ACCOUNT_ID` (and optional vars). No real secrets.

---

## 4. All Dropbox API calls happen server-side

**Status: PASS**

- Frontend (`src/`) only calls `fetch()` to `/.netlify/functions/*`. No Dropbox SDK or `api.dropbox.com` usage in `src/`.
- All Dropbox API usage is in `netlify/functions/` (`_dropbox.ts`, `list.ts`, `temp_link.ts`, `temp_links.ts`, `trash.ts`, `undo.ts`, `discover_folders.ts`, `auth_callback.ts`).

---

## 5. Access tokens never sent to browser

**Status: PASS**

- `auth_callback.ts` redirects after OAuth to `?auth=success&account_id=...` only (line 305). No `access_token` or `refresh_token` in URL or response body.
- In production the refresh token is stored in Netlify Blob only; it is never logged or sent to the client.
- Frontend `AuthState` (`src/types.ts`) only has `is_authenticated` and `account_id`; no token fields. `localStorage` and `sessionStorage` are not used to store tokens in the current success flow.

**Note:** `App.tsx` has a legacy branch (lines 497–522) that reads `refresh_token` from the URL hash and stores it in `sessionStorage` under `SETUP_TOKENS_KEY`. The current `auth_callback` never redirects with tokens in the hash, so this path is unused. Consider removing or guarding this branch to avoid future risk if the callback were ever changed to send tokens to the client.

---

## 6. Refresh token stored securely (Netlify Blob or env var)

**Status: PASS**

- In production the refresh token is stored in Netlify Blob (`_auth_store.ts`); `_dropbox.ts` reads from Blob first, then falls back to `process.env.DROPBOX_REFRESH_TOKEN` for initial setup. `auth_callback` writes to Blob only; the token is never logged. In local dev the token is written to `.env` only. It is never included in redirects or API responses to the browser. Logout clears the Blob entry.

---

## 7. OAuth state parameter validated

**Status: PASS**

- `auth_start.ts`: generates state with `generateState()`, stores it in cookie `picsift_oauth_state` and returns it in the redirect URL.
- `auth_callback.ts`: reads state from cookie and from query param (lines 203–204), then requires both to be present and equal (lines 211–215). On mismatch it redirects with an error and logs `[SECURITY] OAuth state mismatch`.

---

## 8. User access control configured (`AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` set)

**Status: CONFIG (deploy-time)**

- Code supports both env vars in `_dropbox.ts` (`getAuthorizedAccountId()`, `getAuthorizedEmail()`) and in `auth_callback.ts` (`AUTHORIZED_DROPBOX_ACCOUNT_ID`, `AUTHORIZED_DROPBOX_EMAIL`).
- In production (`process.env.NETLIFY` set), at least one must be set or all requests are rejected (fail closed). Documented in `.env.example` and [DEPLOYMENT.md](DEPLOYMENT.md). Actual configuration is done in Netlify dashboard.

---

## 9. Access control check implemented in auth callback

**Status: PASS**

- `auth_callback.ts`: after `exchangeCodeForTokens()`, calls `isAuthorizedAccount(account_id, email)` (lines 221–232). If not authorized and not local dev, redirects with “Access denied. This app is restricted to authorized users only.” and does not store tokens. Unauthorized attempts are logged with `[SECURITY] Unauthorized access attempt`.

---

## 10. Token validation in `_dropbox.ts` (validates tokens belong to authorized user on every API call)

**Status: PASS**

- `getAccessToken()` in `_dropbox.ts`: after refresh, in production calls `validateTokenAccount(access_token, account_id)` (lines 177–189). If invalid, throws “Unauthorized: Token does not belong to authorized user” and does not return the token.
- Cached tokens are re-validated before use (lines 163–171). Invalid cache is cleared and token is refreshed and validated again.
- All API functions use `createDropboxClient()` → `getAccessToken()`, so every Dropbox call goes through this validation.

---

## 11. Account ID stored with tokens for validation

**Status: PASS**

- `_dropbox.ts`: `TokenCache` includes `account_id` (lines 21–25). After refresh, `account_id` is set from Dropbox response or from `usersGetCurrentAccount()` (lines 95–106). Cache stores `{ access_token, account_id, expires_at }` (lines 195–199). Cached token is validated with `validateTokenAccount(tokenCache.access_token, tokenCache.account_id)` (lines 164–166).

---

## 12. Path validation prevents traversal attacks

**Status: PASS**

- **list.ts:** `validatePath()` rejects empty/non-string, `".."`, and paths that are not `""` or starting with `"/"` (lines 39–44). Used before listing.
- **temp_link.ts:** Same style `validatePath()` (no `".."`, must start with `"/"`) (lines 22–26).
- **temp_links.ts:** Same style `validatePath()` on each path in `paths` array; max 10 paths (lines 25–76).
- **trash.ts:** `validatePath()` (no `".."`, must start with `"/"`) and `validateSessionId()` (length ≤ 128, alphanumeric + hyphen + underscore only) (lines 26–36).
- **undo.ts:** `validatePath()` on both `trashed_path` and `original_path`; additionally requires `trashed_path.startsWith("/_TRASHME/")` (lines 22–26, 58–80).

---

## 13. Error messages don't leak sensitive info

**Status: PASS**

- Auth failure: generic “Access denied. This app is restricted to authorized users only.” (no account details). Unauthorized attempt details only in server logs.
- Token validation failure: user sees “Unauthorized: Token does not belong to authorized user” (no token or account ID in response). Sensitive details only in server logs.
- Path/validation errors: generic “Invalid or missing path”, “Invalid or missing session_id”, etc. No internal paths or secrets in client-facing messages.
- Dropbox/API errors: normalized via `normalizeError`; raw error details logged server-side, not echoed verbatim to client.

---

## 14. HTTPS enforced (Netlify default)

**Status: PASS (platform)**

- Netlify serves over HTTPS by default. `auth_callback.ts` forces HTTPS for non-localhost base URLs (e.g. `getBaseUrl()`, `getAppBaseUrl()` replace `http://` with `https://` for production). No code disables HTTPS.

---

## 15. CORS configured correctly (if needed)

**Status: PASS (N/A)**

- Same-origin: frontend and Netlify functions are on the same site, so CORS is not required for normal browser requests. Documented in [DECISIONS.md](DECISIONS.md) and [PRE_BUILD_QUESTIONS.md](PRE_BUILD_QUESTIONS.md). No CORS headers needed; none are misconfigured.

---

## Summary

| # | Item                                      | Status   |
|---|-------------------------------------------|----------|
| 1 | No secrets in code                        | PASS     |
| 2 | `.env` in `.gitignore`                   | PASS     |
| 3 | `.env.example` with placeholders         | PASS     |
| 4 | Dropbox API server-side only              | PASS     |
| 5 | Access tokens never sent to browser      | PASS     |
| 6 | Refresh token in Netlify env var         | PASS     |
| 7 | OAuth state validated                     | PASS     |
| 8 | User access control configured           | CONFIG   |
| 9 | Access control in auth callback          | PASS     |
| 10| Token validation in `_dropbox.ts`        | PASS     |
| 11| Account ID stored with tokens            | PASS     |
| 12| Path validation (traversal)              | PASS     |
| 13| Error messages don’t leak secrets        | PASS     |
| 14| HTTPS enforced                           | PASS     |
| 15| CORS                                     | PASS (N/A)|

**Recommendation:** Before deploy, ensure item 8 is done in Netlify (set `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL`).

---

## Additional hardening (from full security review)

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the full review. The following hardening has been applied:

- **current_account**: In production, when `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` is set, the endpoint returns 404 and does not expose account_id/email (setup-only use).
- **logout**: Accepts POST only (GET no longer allowed) to prevent logout via link/redirect.
- **discover_folders**: Error responses no longer include `stack` in the JSON body (server logs only).
- **App.tsx hash branch**: The legacy path that could store `refresh_token` from the URL hash now runs only on localhost, so production never stores tokens from the URL.
- **Session binding**: Only devices that completed OAuth can call list/temp_link/temp_links/trash/undo/discover_folders. A session cookie (`picsift_session`) is set on successful login and required by those functions; without it they return 401. Multiple devices (e.g. phone + desktop) are supported; each login adds that device's session. Logout removes only the current device's session.
