# PicSift - Design Decisions

This document captures all design and implementation decisions made for PicSift MVP.

---

## UI/UX Decisions

### Image Display Size
**Decision**: Option B - Large centered view with controls visible
- Better for quick decisions
- Controls always accessible
- Matches "fast" goal

### Keyboard Shortcuts Display
**Decision**: Option A - Always visible
- Small, unobtrusive indicators on buttons (K, D, U)
- Helpful for discoverability
- No need to hunt for shortcuts

### Progress Indicator Format
**Decision**: Option B - "37 of 500" (more readable)
- More natural language
- Clearer than "37 / 500"

### Confetti/Celebration
**Decision**: Option A - Yes, include confetti
- Matches "fun" goal
- **Settings required**: User can configure frequency
- Options: Every delete, Every 5 deletes, Every 10 deletes, Off

### Image Loading Strategy
**Decision**: Option B - Preload next image
- Smoother transitions
- Better user experience
- Matches "fast" goal

---

## Technical Decisions (Developer Judgment)

### Security & Token Management
- **Refresh Token Storage**: Netlify env var (simplest, secure)
- **Token Caching**: In-memory, 1-hour TTL
- **OAuth State**: HTTP-only signed cookie
- **Token Validation**: Validate on every API call
- **Account ID Storage**: Store with tokens for validation

### Error Handling
- **Error Display**: Toast for transient errors, modal for critical
- **Retry Logic**: Auto-retry once, then manual retry button

### Performance
- **Large Lists**: Load all at once for MVP (simpler)
- **Function Timeout**: 26 seconds for list function, 10 for others

### Development
- **Local OAuth**: Use `netlify dev` with local redirect URI
- **Test Data**: Use real Dropbox account with test folder
- **CORS**: Not needed (same domain)

### Security
- **Security Logging**: Netlify Functions logs (built-in)
- **Rate Limiting**: Rely on Dropbox API limits (single-user app)
- **Env Validation**: Validate in `_dropbox.ts` helper, fail fast

---

## Settings Feature

### Confetti Frequency Settings
**Component**: `src/components/Settings.tsx` (new)

**Options**:
- Every delete
- Every 5 deletes
- Every 10 deletes
- Every 25 deletes
- Off

**Storage**: localStorage key `picsift:confettiFrequency`
**Default**: Every 5 deletes (balanced fun without being overwhelming)

**Implementation**:
- Settings accessible from main app (gear icon or menu)
- Simple dropdown/radio selection
- Immediate effect (no restart needed)
- Persists across sessions

---

## Test Data Strategy

**Approach**: Use real Dropbox account with dedicated test folder

**Setup**:
1. Create test folder in Dropbox (e.g., `/PicSift Test`)
2. Add test images to this folder
3. Use this folder for development and testing
4. Keep production `/Camera Uploads` separate

**Benefits**:
- Realistic testing environment
- No risk to production photos
- Easy to reset test data
- Can test with various image types/sizes

---

## Folder Selection Decisions

### Single vs Multiple Folders
**Decision**: Single folder per session (MVP)
- One folder at a time
- Can change folder for next session
- Future: Support multiple folders

### Folder Discovery
**Decision**: 
- Depth: 3-4 levels
- Max folders: 100
- Cache: 1 hour TTL

### Folder Persistence
**Decision**: localStorage
- Simple, single-device use case
- Can migrate to server-side later if needed

### Mid-Session Folder Change
**Decision**: No
- Must complete or abandon current session
- Select new folder for next session

---

## Session Management

### Session ID Format
**Decision**: UUID v4
- Standard, collision-resistant
- No timestamp leakage

### Session Persistence
**Decision**: Partial persistence
- Persist sessionId and current index
- Re-fetch queue on reload (safety + simplicity)

---

## Summary

All major decisions have been made. The project plan reflects these decisions and is ready for implementation.

**Key Principles**:
- Security without over-engineering
- Fast, fun, undo-safe
- Simple MVP, extensible for future
