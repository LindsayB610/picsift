# Access Request & Approval Plan

**Goal:** Let anyone request access to PicSift; you approve them (minimal manual step); they then set up PicSift with their own Dropbox account. No ongoing manual work (e.g. no editing env vars per user).

**Status:** Plan only — for review. Not implemented.

---

## 1. Current State (Single-User)

- **Access control:** `AUTHORIZED_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_EMAIL` in Netlify env. Only that one account can complete OAuth; everyone else sees "Access denied."
- **Auth storage:** One Netlify Blob (`picsift-auth` / key `dropbox`) holds a single refresh token, account ID, and session entries (one per device).
- **Session:** Cookie identifies the device; backend assumes there is exactly one account. All API calls use that one token.

To support multiple approved users, we need: (1) a way to request and approve users without editing env, and (2) per-user auth storage and session handling.

---

## 2. High-Level Flows

### 2.1 Request access (unauthenticated)

1. User visits the app and sees a "Request access" option (e.g. on the login/blocked screen).
2. They submit a form: at minimum **email** (required for approval and to match Dropbox after OAuth); optionally name or message.
3. A Netlify function stores the request as **pending** (see Data store below) and optionally notifies you (see Notifications).
4. User sees a confirmation: "Request sent. You'll be notified when approved."

No login required for this step.

### 2.2 Approve (you, minimal manual step)

**Option A — In-app admin (recommended)**  
- You log in with Dropbox as today. The app treats one identity as "owner" (e.g. `OWNER_DROPBOX_ACCOUNT_ID` or `AUTHORIZED_DROPBOX_ACCOUNT_ID` in env).  
- Only the owner sees an **Admin** entry (e.g. in nav or settings) that shows **Pending access requests** (email, date, optional message).  
- Each request has an **Approve** (and optionally **Deny**) action.  
- Approve → move that email from "pending" to "approved" in the data store. No env edit, no manual copy/paste.

**Option B — Email-based approval**  
- When a request is created, you receive an email (e.g. via SendGrid/Resend) with a secure link: "Approve [email] for PicSift."  
- Clicking the link calls a Netlify function (token in URL, one-time or short-lived) that adds that email to the approved list.  
- No admin UI needed; you never have to open the app to approve.  
- Requires configuring an email provider and keeping the approval link secret/unguessable.

**Option C — Hybrid**  
- In-app admin as primary; optional email notification when there are pending requests so you know to open the app and approve.

Recommendation: start with **Option A** (in-app admin). Add Option B later if you want approval without opening the app.

### 2.3 Use PicSift after approval (approved user)

1. Approved user visits the app and clicks "Log in with Dropbox" (same as today).
2. They complete the Dropbox OAuth flow.
3. In the OAuth callback we get `account_id` and `email` from Dropbox.
4. **Authorization check:**  
   - If `email` (or `account_id`, if we already have it in an approved list) is in the **approved** list → allow.  
   - Otherwise → show "Access denied" (same as today), do not store tokens.
5. If allowed: store refresh token and session for **this** account (multi-tenant auth store, see below); set session cookie; redirect into the app.
6. From then on they use PicSift with their own Dropbox (folder selection, triage, etc.) exactly like today, but scoped to their account.

No action required from you after approval.

---

## 3. Data Store

All of this should live in Netlify Blob (or, if you prefer, a small external DB) so that no env vars need to change when approving or revoking users.

### 3.1 Access requests and approved list

- **Pending requests:** e.g. blob key `access-requests:pending` or a store of records `{ email, requestedAt, optionalMessage }`.  
- **Approved list:** e.g. blob key `access:approved` — a list (or set) of emails. When you approve, we add the email here and remove it from pending (or mark the request approved).  
- **Owner identity:** Keep using env: `OWNER_DROPBOX_ACCOUNT_ID` or reuse `AUTHORIZED_DROPBOX_ACCOUNT_ID` as "the owner who can approve." Only that account can see the admin UI and call approve/deny.

Optional: store `account_id` for each approved user after first login, so we can also key by `account_id` (e.g. for revoking by account later). Not required for the first version.

### 3.2 Multi-tenant auth storage

Today there is a single blob (one refresh token, one account, many sessions). We need:

- **Per-account tokens:** For each Dropbox account we need to store refresh token and session entries. Options:
  - **One blob per account:** e.g. key `auth:${account_id}` with `{ refresh_token, session_entries }`. Session cookie must identify which account (e.g. cookie value is still a session secret, but we need a way to resolve session → account_id).
  - **Single structured blob:** e.g. one blob with `{ accounts: { [account_id]: { refresh_token, session_entries } }, sessionToAccount: { [session_secret]: account_id } }`. Lookup: cookie → session_secret → account_id → token/sessions.

Either way, the rest of the app (list, temp_link, trash, undo, discover_folders) must:

- Read the session cookie.
- Resolve it to an `account_id` (and optionally verify that account is still approved).
- Load that account’s refresh token and use it for Dropbox API calls.

So the changes touch: `_auth_store.ts` (multi-tenant read/write, session → account resolution), `auth_callback.ts` (check approved list, write to per-account storage), and any function that currently calls `getAuthFromBlob()` / `requireSession()` (so they use the account implied by the session).

---

## 4. Authorization Logic (OAuth callback)

Replace the current "single env allowlist" check with:

- **Approved list** (from Blob): set of emails (and optionally account_ids after first login).
- In production, if the Dropbox `email` (or `account_id` if we already have it in the approved set) is **not** in the approved list → same as today: redirect with "Access denied", do not store any token.
- If approved → store token and sessions under that `account_id` and set the session cookie.

Local dev can keep "allow all if no list configured" for easier testing.

---

## 5. Owner vs. Approved Users

- **Owner:** One identity (env: `OWNER_DROPBOX_ACCOUNT_ID` or keep `AUTHORIZED_DROPBOX_ACCOUNT_ID`). This account can:
  - Use the app normally (their own Dropbox).
  - See the Admin UI and approve/deny pending requests.
- **Approved users:** Any email you’ve approved. They can only use the app with their own Dropbox; they do not see the admin UI.

So the "approved" list includes the owner’s email (or you add it once during setup) so the owner can log in without being in a separate code path. Alternatively, the code can say: "if account_id === OWNER, always allow and show admin; for everyone else, require email in approved list."

---

## 6. Notifications (Optional)

- **In-app:** When the owner loads the app, show a badge or message: "You have N pending access requests." No new infra.
- **Email:** On new request, send you an email ("X requested access to PicSift") and optionally include an "Approve" link (Option B above). Requires an email API (e.g. Resend, SendGrid) and an env var for the API key; keep approval links one-time or short-lived and unguessable.

---

## 7. Security Considerations

- **Approval link (if used):** Use a long, random token; verify it server-side and invalidate after use (or after a short TTL). Do not expose who was approved in the URL in a way that could be enumerated.
- **Rate limiting:** Throttle "request access" (and maybe approve) by IP or email to avoid abuse (e.g. spam or filling the pending list).
- **Admin-only endpoints:** Approve/deny and "list pending" must be callable only by the owner (same session check as other API, plus account_id === owner).
- **Revocation:** Later you may want "revoke access" for an approved user. That would remove their email from the approved list and optionally delete their auth blob so they must request again; document this as a future phase if you like.

---

## 8. Implementation Phases (Outline Only)

1. **Data model and storage**  
   - Define blob keys/shape for pending requests and approved list.  
   - Implement read/write helpers (no UI yet).

2. **Multi-tenant auth**  
   - Extend `_auth_store` (or equivalent) so auth is keyed by `account_id` and session cookie resolves to one account.  
   - Update `auth_callback` to check the approved list (from Blob) and write to per-account storage.  
   - Update API functions to resolve session → account and use that account’s token.

3. **Request-access flow**  
   - Frontend: "Request access" form (email, optional message).  
   - Netlify function: validate, store pending request, optional in-app "request received" state.

4. **Admin UI (owner-only)**  
   - After login, if current user is owner, show Admin (e.g. link or tab).  
   - List pending requests; Approve/Deny actions that update Blob (approved list + pending list).  
   - Optional: show list of approved emails (and optionally "revoke").

5. **Owner identity**  
   - Env: `OWNER_DROPBOX_ACCOUNT_ID` (or keep using `AUTHORIZED_DROPBOX_ACCOUNT_ID` as owner).  
   - Ensure owner is always allowed to log in and always sees admin; other users only if in approved list.

6. **Optional: email notification and approval-by-email**  
   - Integrate email provider; send email on new request; secure approval link that hits a function and adds email to approved list.

7. **Docs and deployment**  
   - Update SETUP_GUIDE / DEPLOYMENT: owner env var, no longer "single account ID" for users; document request/approve flow for end users.

---

## 9. What Stays the Same

- Dropbox OAuth flow (auth_start, auth_callback) and redirect URIs.
- One Dropbox app; no per-user app registration.
- Netlify and Netlify Blob; no new infrastructure required for the core flow (only optional email if you add it).
- Front-end flow for an approved user: login → folder selection → triage, same as today.

---

## 10. Open Questions / Choices

- **Naming:** Keep `AUTHORIZED_DROPBOX_ACCOUNT_ID` as "owner" or introduce `OWNER_DROPBOX_ACCOUNT_ID` and repurpose the former for something else (or drop it)?
- **Deny:** Do you want an explicit "Deny" that deletes the request and optionally notifies the requester, or is "ignore" enough?
- **Revoke:** Plan for "revoke access" (remove from approved, clear their auth) in a later phase?
- **Email notifications:** Start without email and add later, or include from the start?

This plan gives you a single, short approval step (in-app or by email link) and then approved users self-serve with their own Dropbox; no manual env edits per user.
