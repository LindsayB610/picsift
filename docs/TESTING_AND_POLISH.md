# Testing & Polish (Phase 8)

Checklist for testing the full flow and polishing the experience. See [PROJECT_PLAN.md](PROJECT_PLAN.md) Phase 8 for the full task list.

---

## Type Checking & Linting

- [ ] `npm run typecheck` — passes with zero errors
- [ ] `npm run lint` — passes with zero errors
- [ ] No floating promises; catch blocks use `unknown`; type-only imports use `import type`; index access handles `undefined`

---

## Security Testing

- [ ] **Unauthorized user:** Log in with a different Dropbox account than `AUTHORIZED_DROPBOX_ACCOUNT_ID`. Expect "Access denied. This app is restricted to authorized users only." and no tokens stored.
- [ ] **Token validation:** All API calls (list, temp_link, trash, undo) use server-side tokens; tokens are validated against the authorized account before each request (see `_dropbox.ts`).
- [ ] **Token refresh:** After refresh, new token is validated; invalid/expired tokens are cleared and not reused.
- [ ] **Error handling:** Invalid or mismatched tokens result in clear errors (no sensitive data leaked).

---

## Test Data Setup

- Use a **dedicated test folder** in Dropbox (e.g. `/PicSift Test`) so you don’t triage production photos during testing.
- Add a mix of image types (jpg, png, heic, webp, gif) and a few files to test:
  - Empty folder
  - Single image
  - Many images (e.g. 50+)
- Keep production folders (e.g. `/Camera Uploads`) separate from test data.

---

## Manual Testing Checklist

- [ ] **OAuth:** Start login → complete Dropbox consent → redirect back and see folder selection or ready state.
- [ ] **Folder selection:** Discover folders, pick one, "Start session" loads images.
- [ ] **List images:** Session shows correct count and first image.
- [ ] **Keep:** Keep button (and K) advances to next image; progress updates.
- [ ] **Delete:** Delete button (and D) moves file to quarantine; progress and undo stack update; confetti if configured.
- [ ] **Undo:** Undo button (and U) restores last deleted file; queue and undo stack update.
- [ ] **Session completion:** After last image, completion screen shows kept/deleted counts; "Start new session" and "Change folder" work.
- [ ] **Resume:** Refresh during a session (or return later within 24h), "Resume session" restores state.
- [ ] **Error scenarios:** Empty folder shows message; network/API errors show toast or modal as designed; retry works where offered.
- [ ] **Settings:** Confetti frequency changes take effect; gear icon opens/closes settings.

---

## UI/UX & Accessibility

- [ ] Loading states are visible (e.g. "Loading…", "Loading images…", disabled buttons during actions).
- [ ] Keyboard shortcuts K, D, U work when session is active and settings are closed.
- [ ] Progress ("X of Y") and button labels (Keep, Delete, Undo) are clear.
- [ ] Touch targets are at least 44px; focus styles visible for keyboard users.
- [ ] Run `npm run test:a11y` — all accessibility tests pass.

---

## Performance

- [ ] Image loading: current image loads; next image is preloaded for smooth transition.
- [ ] Large folders: queue is capped (e.g. 5000); session starts without long freezes.
- [ ] Client-side shuffle completes quickly for typical folder sizes.

---

## Documentation

- [ ] [README.md](../README.md) — setup and run instructions, env vars reference, keyboard shortcuts.
- [ ] [.env.example](../.env.example) — all required and optional variables documented.
- [ ] [docs/SETUP_GUIDE.md](SETUP_GUIDE.md) — full setup and OAuth.
- [ ] [docs/DEPLOYMENT.md](DEPLOYMENT.md) — deploy and env checklist.
