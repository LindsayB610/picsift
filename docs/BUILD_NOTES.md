# Photo Triage App — Build Notes (MVP)

This document captures the agreed-upon MVP design and implementation plan for a personal photo triage web app.  
Primary goals: fun, fast, undo-safe, and actually useful.

---

## Overview

The app presents photos one at a time, in random order, and lets the user quickly decide to keep or delete them.

Key constraints:

- Built for personal use
- Uses Dropbox (not Google Photos)
- Undo is required (no irreversible deletes on first action)
- Hosted on a Netlify subdomain
- Frontend stack matches existing projects (React + Vite + TypeScript)

---

## Core Decisions (Locked)

- Frontend: React + Vite + TypeScript
- Hosting: Netlify
- Backend: Netlify Functions
- Auth: Dropbox OAuth (single-user)
- Source folder: /Camera Uploads
- Quarantine folder: /\_TRASHME/<sessionId>/... (top-level)
- Delete behavior: Move to quarantine (not permanent delete)
- Undo behavior: Move back to original path
- Permanent delete: Optional, manual or via later "Purge session"

---

## High-Level Flow

1. User authenticates with Dropbox
2. App lists images from /Camera Uploads
3. App shuffles images client-side
4. Images are shown one at a time
5. User actions:
   - Keep → next image
   - Delete → move to quarantine + next image
   - Undo → move image back to original location
6. Session ends when queue is exhausted

---

## Safety Model (Important)

Never hard-delete on first action.

Instead:

- "Delete" = move_v2 to /\_TRASHME/<sessionId>/...
- Undo = move_v2 back to original path
- Dropbox trash / recovery still applies as an extra safety net

Optional later feature:

- "Purge this session" → delete_v2 on quarantined paths

---

## Dropbox API Capabilities Used

- List files:
  - files/list_folder
  - files/list_folder/continue
- Display images:
  - files/get_temporary_link
- Quarantine (soft delete):
  - files/move_v2
- Undo:
  - files/move_v2
- Permanent delete (optional):
  - files/delete_v2

---

## Dropbox App Setup

In the Dropbox App Console:

1. Create a new app
2. Access type: Scoped access
3. Permissions: Full Dropbox
4. Redirect URI:
   https://<subdomain>.lindsaybrunner.com/auth/callback

5. Required scopes:
   - files.metadata.read
   - files.content.read
   - files.content.write

---

## Repo Structure

    photo-triage/
      netlify/
        functions/
          auth_start.ts
          auth_callback.ts
          list.ts
          temp_link.ts
          trash.ts
          undo.ts
          purge.ts        # optional
          _dropbox.ts     # shared Dropbox API helper
      src/
        api.ts
        types.ts
        App.tsx
        components/
          Viewer.tsx
          Controls.tsx
      netlify.toml
      vite.config.ts
      package.json

---

## TypeScript Models

File: src/types.ts

    export type DbxEntry = {
      id: string;
      name: string;
      path_lower: string;
      path_display: string;
      server_modified?: string;
      size?: number;
    };

    export type TrashRecord = {
      id: string;
      original_path: string;
      trashed_path: string;
      name: string;
    };

    export type SessionState = {
      sessionId: string;
      sourcePath: string; // "/Camera Uploads"
      queue: DbxEntry[];
      index: number;
      kept: string[];
      trashed: TrashRecord[];
      undoStack: TrashRecord[];
    };

---

## Netlify Functions (Responsibilities)

### \_dropbox.ts

Shared helper for calling Dropbox HTTP API.

    export async function dbx<T>(
      path: string,
      token: string,
      body: unknown
    ): Promise<T> {
      const res = await fetch(`https://api.dropboxapi.com/2/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<T>;
    }

---

### list.ts

- Input: { path: "/Camera Uploads", limit?: number }
- Behavior:
  - Call files/list_folder
  - Follow has_more with files/list_folder/continue
  - Filter to images only (jpg, png, heic, webp)
- Output: { entries: DbxEntry[] }

---

### temp_link.ts

- Input: { path: string }
- Output: { link: string }
- Uses files/get_temporary_link

---

### trash.ts

- Input: { path: string, sessionId: string }
- Behavior:
  - Compute destination:
    /\_TRASHME/<sessionId><original_path>
  - Call files/move_v2 with autorename: true
- Output: TrashRecord

---

### undo.ts

- Input: { trashed_path: string, original_path: string }
- Behavior:
  - Move file back using files/move_v2

---

### purge.ts (optional)

- Input: { paths: string[] }
- Behavior:
  - Permanently delete using files/delete_v2

---

## Frontend UX Notes

- Start session:
  - Generate sessionId (ISO timestamp or UUID)
- Shuffle queue client-side
- Keyboard shortcuts:
  - K → keep
  - D → delete (move to quarantine)
  - U → undo
- UI elements:
  - One large image
  - Keep / Delete buttons
  - Progress indicator (e.g., 37 / 500)
  - Optional streak/confetti for deletes

---

## Auth Strategy (MVP)

Single-user app.

Simplest approach:

- Complete OAuth once
- Store refresh token securely (Netlify env var / KV / Blob)
- Netlify Functions mint access tokens as needed
- Tokens never exposed to the browser

No user accounts, no multi-user logic.

---

## Product Naming & Positioning

**App name:** PicSift

Rationale:

- Short, friendly, and memorable
- Immediately communicates "photos + curation"
- Feels playful without being cutesy or technical
- Fits naturally alongside other personal tools/projects

Optional supporting copy (non-binding):

- One-liner: "A calm way to sift through your photos, one decision at a time."
- Alternate micro-tagline: "Keep what matters. Let the rest go."

These are product-level notes only; navigation and site integration are handled elsewhere.

---

## Explicit Non-Goals (v1)

- No multi-user support
- No permanent delete by default
- No tagging, albums, or ML classification
- No Google Photos integration
- No "optimize later" architecture

This is a vibe tool, not a platform.

---

## Guiding Principle

Make it feel good to decide.  
Make it hard to make an irreversible mistake.

Ship the smallest thing that does that.
