# Pre-Build Questions

This document captures questions that need to be answered before beginning implementation.

---

## Token Storage & Management

### 1. Refresh Token Storage Mechanism

**Question**: How should we store the refresh token securely?

- **Option A**: Netlify environment variable (simple, but manual update required if token changes)
- **Option B**: Netlify KV store (programmatic, but requires KV setup)
- **Option C**: Netlify Blob store (programmatic, encrypted)
- **Option D**: Encrypted file in Netlify Functions directory (not recommended for security)

**Current Plan**: Mentions "Netlify env var or encrypted Netlify KV/Blob store" - needs decision

**Recommendation**: Start with Netlify env var (simplest), migrate to KV if token rotation becomes needed

---

### 2. Token Caching Strategy

**Question**: How should we cache access tokens in `_dropbox.ts`?

- **Option A**: In-memory cache (per function invocation, lost on cold start)
- **Option B**: Shared cache across function invocations (requires external storage)
- **Option C**: No caching (always refresh, simpler but slower)

**Current Plan**: Mentions "in-memory, short-lived" - needs clarification on TTL and cache invalidation

**Recommendation**: In-memory cache with TTL (e.g., 1 hour, tokens expire in 4 hours), refresh on cache miss

---

### 3. Account ID Storage with Tokens

**Question**: Where should we store the account ID alongside tokens for validation?

- **Option A**: Same location as refresh token (env var or KV)
- **Option B**: Separate storage
- **Option C**: Validate on every request without caching (slower but simpler)

**Current Plan**: Mentions "store account ID with tokens" - needs implementation detail

**Recommendation**: Store account ID in same location as refresh token for consistency

---

## OAuth Implementation

### 4. OAuth State Parameter Storage

**Question**: How should we store the OAuth state parameter for CSRF protection?

- **Option A**: HTTP-only cookie (secure, automatic expiration)
- **Option B**: Server-side session (requires session store)
- **Option C**: Signed cookie (can be validated without server-side storage)
- **Option D**: Encrypted in redirect URL (stateless but URL length limits)

**Current Plan**: Mentions "Store state in session/cookie" - needs specific implementation

**Recommendation**: HTTP-only signed cookie with short expiration (5-10 minutes)

---

### 5. OAuth Callback Error Handling

**Question**: What should happen if OAuth callback fails (invalid state, token exchange fails, unauthorized user)?

- **Option A**: Redirect to login page with error message
- **Option B**: Show error page
- **Option C**: Return JSON error to frontend (if using SPA pattern)

**Current Plan**: Mentions "Return success/error to frontend" - needs UI/UX decision

**Recommendation**: Redirect to login page with error query parameter, display user-friendly message

---

## Session Management

### 6. Session State Persistence

**Question**: Should session state be persisted to localStorage?

- **Option A**: Yes, persist everything (queue, index, kept, trashed) - allows resume after page reload
- **Option B**: No persistence (start fresh on reload) - simpler, but loses progress
- **Option C**: Partial persistence (only sessionId, re-fetch queue) - balance between simplicity and UX

**Current Plan**: Lists as "optional" - needs decision for MVP

**Recommendation**: Option C - persist sessionId and current index, re-fetch queue on reload (safety + simplicity)

---

### 7. Session ID Format

**Question**: What format should we use for sessionId?

- **Option A**: UUID v4 (standard, collision-resistant)
- **Option B**: ISO timestamp (human-readable, sortable)
- **Option C**: Custom format combining timestamp + random

**Current Plan**: Mentions "UUID or ISO timestamp" - needs decision

**Recommendation**: UUID v4 (standard, collision-resistant, no timestamp leakage)

---

## UI/UX Decisions

### 8. Image Display Size

**Question**: How should images be displayed?

- **Option A**: Full-screen (immersive, minimal UI)
- **Option B**: Large centered view with controls visible (better for quick decisions)
- **Option C**: Responsive (full-screen on desktop, smaller on mobile)

**Current Plan**: Mentions "full-screen or large view" - needs decision

**Recommendation**: Option B - large centered view with controls always visible (matches "fast" goal)

---

### 9. Keyboard Shortcut Display

**Question**: Should keyboard shortcuts be visible in the UI?

- **Option A**: Always visible (helpful for discoverability)
- **Option B**: Hidden by default, shown on hover/help button
- **Option C**: Not shown (rely on README/documentation)

**Current Plan**: Mentions "Keyboard shortcut indicators" - needs implementation detail

**Recommendation**: Option A - small, unobtrusive indicators on buttons (K, D, U)

---

### 10. Progress Indicator Format

**Question**: What format for progress indicator?

- **Option A**: "37 / 500" (current / total)
- **Option B**: "37 of 500" (more readable)
- **Option C**: "7% (37/500)" (percentage + numbers)
- **Option D**: Progress bar + numbers

**Current Plan**: Shows "37 / 500" - needs confirmation

**Recommendation**: Option A or B - simple and clear

---

### 11. Confetti/Celebration for Delete Streaks

**Question**: Should we include confetti/celebration for delete streaks?

- **Option A**: Yes, make it fun (matches "fun" goal)
- **Option B**: No, keep it minimal (matches "calm" goal)
- **Option C**: Optional, can be toggled

**Current Plan**: Lists as "optional" - needs decision

**Recommendation**: Option C - include but make it subtle and optional (toggle in settings or localStorage)

---

## Error Handling

### 12. Error Message Display

**Question**: How should errors be displayed to users?

- **Option A**: Toast notifications (non-blocking)
- **Option B**: Inline error messages (contextual)
- **Option C**: Modal dialogs (blocking, for critical errors)
- **Option D**: Combination (toast for transient, modal for critical)

**Current Plan**: Mentions "Error messages" - needs implementation detail

**Recommendation**: Option D - toast for network/API errors, modal for auth failures

---

### 13. Retry Logic

**Question**: Should we implement automatic retry for failed API calls?

- **Option A**: Yes, with exponential backoff (3 retries)
- **Option B**: Manual retry button only
- **Option C**: Both (auto-retry + manual option)

**Current Plan**: Mentions "Retry mechanisms" - needs implementation detail

**Recommendation**: Option C - auto-retry once for transient errors, then show manual retry button

---

## Performance & Optimization

### 14. Image Loading Strategy

**Question**: How should we handle image loading?

- **Option A**: Load current image only (fastest, no preloading)
- **Option B**: Preload next image (smoother transitions, more bandwidth)
- **Option C**: Lazy load with intersection observer (balance)

**Current Plan**: Mentions "lazy loading" - needs clarification

**Recommendation**: Option B - preload next image for smooth transitions (matches "fast" goal)

---

### 15. Large Image List Handling

**Question**: How should we handle very large image lists (1000+ images)?

- **Option A**: Load all at once (simple, but slow initial load)
- **Option B**: Pagination (load in batches, more complex)
- **Option C**: Virtual scrolling (complex, probably overkill for MVP)

**Current Plan**: Lists as edge case - needs decision

**Recommendation**: Option A for MVP (simpler), add pagination later if needed

---

## Testing & Development

### 16. Local OAuth Testing

**Question**: How should we test OAuth flow locally?

- **Option A**: Use `netlify dev` with local redirect URI
- **Option B**: Use production redirect URI (requires deployment)
- **Option C**: Mock OAuth for local development

**Current Plan**: Mentions "Test OAuth with local redirect URI" - needs setup details

**Recommendation**: Option A - configure local redirect URI in Dropbox app (e.g., `http://localhost:8888/auth/callback`)

---

### 17. Test Data Strategy

**Question**: How should we handle test data for development?

- **Option A**: Use real Dropbox account (risky, but realistic)
- **Option B**: Create test Dropbox account (safer, separate from production)
- **Option C**: Mock Dropbox API responses (fastest, but less realistic)

**Current Plan**: Not mentioned - needs decision

**Recommendation**: Option B - create separate test Dropbox account for development

---

## Deployment & Configuration

### 18. Netlify Function Timeout

**Question**: What timeout should we configure for Netlify Functions?

- **Option A**: Default (10 seconds)
- **Option B**: Extended (26 seconds, max for free tier)
- **Option C**: Per-function configuration

**Current Plan**: Not mentioned - needs decision for functions that might be slow (list with pagination)

**Recommendation**: Option B - 26 seconds for list function (pagination can be slow), 10 seconds for others

---

### 19. CORS Configuration

**Question**: Do we need CORS configuration?

- **Option A**: No (same origin, Netlify Functions on same domain)
- **Option B**: Yes (if frontend and functions on different domains)
- **Option C**: Configure but not needed (future-proofing)

**Current Plan**: Lists as "if needed" - needs confirmation

**Recommendation**: Option A - not needed since functions are on same domain, but document for future

---

### 20. Environment Variable Validation

**Question**: Should we validate environment variables on startup?

- **Option A**: Yes, fail fast if missing (better error messages)
- **Option B**: No, let functions fail naturally (simpler)
- **Option C**: Validate in each function (defensive)

**Current Plan**: Not mentioned - needs decision

**Recommendation**: Option A - validate in `_dropbox.ts` helper, throw clear error if tokens/env vars missing

---

## Security

### 21. Security Event Logging

**Question**: How should we log security events (unauthorized access, token validation failures)?

- **Option A**: Console.log (simple, visible in Netlify logs)
- **Option B**: Structured logging service (e.g., Sentry, LogRocket)
- **Option C**: Netlify Functions logs only (built-in)

**Current Plan**: Mentions "log security events" - needs implementation detail

**Recommendation**: Option C for MVP (Netlify logs), add structured logging later if needed

---

### 22. Rate Limiting

**Question**: Should we implement rate limiting?

- **Option A**: No (rely on Dropbox API rate limits)
- **Option B**: Yes, per IP (prevent abuse)
- **Option C**: Yes, per user (more complex, probably overkill for single-user)

**Current Plan**: Lists rate limiting as error type - needs decision on handling

**Recommendation**: Option A for MVP (single-user app), add IP-based rate limiting later if needed

---

## Folder Selection & Discovery

### 23. Single vs Multiple Folders (MVP)

**Question**: Should users be able to select multiple folders for one session?

- **Option A**: Single folder only (simpler, faster to build)
- **Option B**: Multiple folders (combine into one queue, more complex)
- **Option C**: Single folder per session, but can change folder for next session

**Current Plan**: Option A (single folder) for MVP - needs confirmation

**Recommendation**: Option A for MVP - one folder at a time, can change for next session

---

### 24. Folder Discovery Depth & Limits

**Question**: How deep should we scan and how many folders?

- **Option A**: 2-3 levels deep, max 50 folders (fast)
- **Option B**: 3-4 levels deep, max 100 folders (balanced)
- **Option C**: 4-5 levels deep, no limit (comprehensive but slow)

**Current Plan**: 3-4 levels, max 100 folders - needs confirmation

**Recommendation**: Option B - 3-4 levels, max 100 folders (good balance)

---

### 25. Folder Discovery Caching

**Question**: Should we cache folder discovery results?

- **Option A**: No caching (always fresh, but slower)
- **Option B**: Cache for 1 hour (good balance)
- **Option C**: Cache until manual refresh (faster, but may be stale)

**Current Plan**: 1 hour TTL - needs confirmation

**Recommendation**: Option B - 1 hour cache with manual refresh button

---

### 26. Folder Selection Persistence

**Question**: How should we store the selected folder?

- **Option A**: localStorage only (simple, single device)
- **Option B**: Server-side (KV/database) for multi-device sync
- **Option C**: Both (localStorage + optional server sync)

**Current Plan**: localStorage for MVP - needs confirmation

**Recommendation**: Option A for MVP (single-user, single-device use case)

---

### 27. Can User Change Folder Mid-Session?

**Question**: Should users be able to switch folders during an active session?

- **Option A**: No, must complete or abandon current session (simpler)
- **Option B**: Yes, can switch anytime (more flexible, more complex)
- **Option C**: Yes, but only at session boundaries (compromise)

**Current Plan**: Option A (no mid-session change) - needs confirmation

**Recommendation**: Option A - must complete or abandon session, select new folder for next session

---

## Summary of Critical Decisions Needed

**Before Phase 1:**

- None (setup phase, no critical decisions)

**Before Phase 2 (OAuth):**

1. ✅ Refresh token storage mechanism (env var vs KV)
2. ✅ OAuth state storage (cookie vs session)
3. ✅ OAuth callback error handling (redirect vs JSON)

**Before Phase 2.5 (Folder Discovery):** 23. ✅ Single vs multiple folders (MVP decision) 24. ✅ Folder discovery depth and limits 25. ✅ Folder discovery caching strategy 26. ✅ Folder selection persistence method 27. ✅ Can user change folder mid-session?

**Before Phase 3 (API Functions):** 4. ✅ Token caching strategy (TTL, invalidation) 5. ✅ Account ID storage with tokens 6. ✅ Environment variable validation approach

**Before Phase 5 (Frontend):** 7. ✅ Session state persistence (yes/no/partial) 8. ✅ Session ID format (UUID vs timestamp) 9. ✅ Image display size 10. ✅ Keyboard shortcut display 11. ✅ Progress indicator format 12. ✅ Confetti/celebration (yes/no/optional)

**Before Phase 7 (Error Handling):** 13. ✅ Error message display method 14. ✅ Retry logic (auto vs manual vs both)

**Before Phase 8 (Testing):** 15. ✅ Local OAuth testing setup 16. ✅ Test data strategy

**Before Phase 9 (Deployment):** 17. ✅ Netlify function timeout configuration 18. ✅ CORS configuration (if needed) 19. ✅ Security event logging method

---

## Recommended Defaults (If No Preference)

If you don't have a preference, here are recommended defaults based on the project goals (fun, fast, undo-safe):

1. **Refresh Token**: Netlify env var (simplest)
2. **Token Caching**: In-memory, 1-hour TTL
3. **OAuth State**: HTTP-only signed cookie
4. **Session Persistence**: Partial (sessionId + index only)
5. **Session ID**: UUID v4
6. **Image Display**: Large centered view with controls visible
7. **Keyboard Shortcuts**: Always visible, small indicators
8. **Progress**: "37 / 500" format
9. **Confetti**: Optional, subtle, toggleable
10. **Error Display**: Toast for transient, modal for critical
11. **Retry**: Auto-retry once, then manual button
12. **Image Loading**: Preload next image
13. **Large Lists**: Load all at once (MVP)
14. **Local OAuth**: Use `netlify dev` with local redirect
15. **Test Data**: Separate test Dropbox account
16. **Function Timeout**: 26 seconds for list, 10 for others
17. **CORS**: Not needed
18. **Env Validation**: Validate in `_dropbox.ts` helper
19. **Security Logging**: Netlify Functions logs
20. **Rate Limiting**: Rely on Dropbox API limits (MVP)

---

## Next Steps

1. Review each question and provide preferences
2. Update PROJECT_PLAN.md with decisions
3. Begin Phase 1 implementation with decisions in place
