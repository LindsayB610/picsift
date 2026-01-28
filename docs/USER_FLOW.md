# PicSift User Flow

This document describes the complete user flow for PicSift, including the new user onboarding experience.

---

## New User Flow (First Time)

### Step 1: Initial Landing
- User visits `picsift.lindsaybrunner.com`
- Sees login page with README displayed
- Clicks "Login with Dropbox" button

### Step 2: Dropbox OAuth
- Redirected to Dropbox for authentication
- User authorizes PicSift to access their Dropbox
- Redirected back to `picsift.lindsaybrunner.com/auth/callback`
- **Access control check**: System verifies user is authorized (single-user app)
- If authorized: tokens stored, proceed to folder discovery
- If unauthorized: Error message, access denied

### Step 3: Folder Discovery
- After successful authentication, app scans Dropbox for folders containing images
- **Discovery process**:
  - Start from root (`/`)
  - Recursively scan folders (with reasonable depth limit, e.g., 3-4 levels)
  - Identify folders that contain image files (jpg, jpeg, png, heic, webp, gif)
  - Count images in each folder
  - Present folders to user sorted by image count (most images first)

### Step 4: Folder Selection
- User sees list of folders with images
- Each folder shows:
  - Folder name and path
  - Number of images found
  - Preview (optional: first image thumbnail)
- **Selection options**:
  - **Option A (Recommended for MVP)**: Select ONE folder at a time
    - User picks one folder
    - That folder becomes the active source
    - User can change folder later (settings/start new session)
  - **Option B (Future)**: Select MULTIPLE folders
    - User can select multiple folders
    - Images from all selected folders are combined into one queue
    - More complex, but allows triaging across folders

### Step 5: Start Session
- User confirms folder selection
- App stores selected folder path (in localStorage or user preferences)
- App fetches all images from selected folder(s)
- Images are shuffled client-side
- User begins triage session

---

## Returning User Flow

### Step 1: Authentication Check
- User visits `picsift.lindsaybrunner.com`
- App checks if user is authenticated (tokens valid)
- If authenticated: proceed to session management
- If not authenticated: show login page

### Step 2: Session Management
- **If no active session**:
  - Check if user has a saved folder preference
  - If yes: offer to start new session with saved folder
  - If no: show folder selection again
- **If active session exists** (from localStorage):
  - Offer to resume session
  - Or start fresh with new folder

### Step 3: Start/Resume Session
- User chooses to start new session or resume existing
- If new: folder selection (or use saved preference)
- If resume: restore session state from localStorage
- Begin triage

---

## Folder Discovery Implementation

### Technical Approach

**Function**: `netlify/functions/discover_folders.ts` (new)

**Input**: 
- `rootPath?: string` (default: "/")
- `maxDepth?: number` (default: 3)

**Process**:
1. Start from root or specified path
2. Use `files/list_folder` to get folder contents
3. For each entry:
   - If it's a folder: recurse (if depth < maxDepth)
   - If it's a file: check if it's an image (by extension)
4. Track folders that contain images
5. Count images per folder
6. Return list of folders with image counts

**Output**:
```typescript
type FolderDiscovery = {
  folders: Array<{
    path: string;
    name: string;
    imageCount: number;
    depth: number;
  }>;
};
```

**Performance Considerations**:
- Limit recursion depth (3-4 levels max)
- Limit total folders scanned (e.g., first 100 folders)
- Cache results (don't re-scan on every visit)
- Show loading indicator during scan

---

## Folder Selection UI

### Component: `src/components/FolderSelector.tsx`

**Design**:
- Clean list of folders
- Each folder shows:
  - Folder icon/emoji
  - Folder name (truncated if long)
  - Path (breadcrumb style, e.g., "Photos / 2024 / January")
  - Image count badge (e.g., "1,234 images")
  - Select button/checkbox
- Search/filter input (optional, for many folders)
- "Start Session" button (disabled until folder selected)

**For MVP (Single Folder)**:
- Radio button selection (only one selectable)
- "Start Session" button enabled when one folder selected

**For Future (Multiple Folders)**:
- Checkbox selection (multiple selectable)
- "Start Session" button enabled when at least one folder selected
- Shows combined image count

---

## Folder Preference Storage

### Options:

**Option A: localStorage (Recommended for MVP)**
- Store selected folder path in `localStorage`
- Key: `picsift:selectedFolder`
- Value: `{ path: string, name: string, imageCount: number }`
- Persists across sessions
- User can change in settings

**Option B: Server-side (Future)**
- Store in Netlify KV or database
- Allows sync across devices
- More complex, requires user accounts

**Recommendation**: Option A for MVP (single-user, single-device use case)

---

## Updated High-Level Flow

1. **New User**:
   - Authenticate with Dropbox
   - System scans for image folders
   - User selects folder(s)
   - Start triage session

2. **Returning User**:
   - Authenticate (if needed)
   - Option to use saved folder or select new one
   - Start/resume triage session

3. **Triage Session**:
   - Images shown one at a time (shuffled)
   - User keeps or deletes
   - Undo available
   - Progress tracked

4. **Session End**:
   - Show summary
   - Option to start new session (same or different folder)

---

## Questions to Answer

1. **Single vs Multiple Folders for MVP?**
   - **Recommendation**: Single folder for MVP (simpler, faster to build)
   - Can add multiple folder support later

2. **Folder Discovery Depth?**
   - **Recommendation**: 3-4 levels deep, max 100 folders scanned
   - Prevents long scan times

3. **Folder Discovery Caching?**
   - **Recommendation**: Cache for 1 hour (folders don't change often)
   - Invalidate on explicit "refresh" button

4. **Folder Selection Persistence?**
   - **Recommendation**: localStorage (MVP)
   - Can migrate to server-side later if needed

5. **Can User Change Folder Mid-Session?**
   - **Recommendation**: No (for MVP)
   - Must complete or abandon current session
   - Can select different folder for next session

6. **What if No Image Folders Found?**
   - Show helpful message
   - Offer to scan again
   - Provide instructions on where to put images

---

## Implementation Phases

### Phase 2.5: Folder Discovery (New Phase)

**Tasks**:
1. Create `discover_folders.ts` Netlify Function
   - Recursive folder scanning
   - Image detection
   - Folder counting
   - Return folder list with counts

2. Create `FolderSelector.tsx` component
   - Display folder list
   - Single folder selection (MVP)
   - Loading states
   - Empty states

3. Update `App.tsx` routing
   - After auth: check for saved folder
   - If no saved folder: show folder selector
   - If saved folder: offer to use it or select new

4. Folder preference storage
   - Save to localStorage
   - Load on app start
   - Update when user selects new folder

**Deliverables**:
- Folder discovery function
- Folder selector UI
- Folder preference persistence
- Integration with session flow

---

## Updated Session State

```typescript
export type SessionState = {
  sessionId: string;
  sourcePaths: string[];  // Changed from single sourcePath
  queue: DbxEntry[];
  index: number;
  kept: string[];
  trashed: TrashRecord[];
  undoStack: TrashRecord[];
  folderPreference?: {  // New
    path: string;
    name: string;
    imageCount: number;
  };
};
```

**Note**: For MVP, `sourcePaths` will be a single-item array `[selectedFolderPath]`

---

## Migration from Current Plan

**Changes Needed**:
1. Update `list.ts` to accept array of paths (for future multi-folder support)
2. Add `discover_folders.ts` function
3. Add `FolderSelector.tsx` component
4. Update `App.tsx` to include folder selection step
5. Update session state type
6. Add folder preference to localStorage

**Backward Compatibility**:
- Default to "/Camera Uploads" if no folder selected (for existing users)
- Show folder selector if no preference saved
