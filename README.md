# PicSift

**A calm way to sift through your photos, one decision at a time.**

PicSift is a personal photo triage web app that helps you quickly decide which photos to keep and which to delete. It presents photos one at a time in random order, making it easy to make quick decisions without feeling overwhelmed.

---

## Features

- **One photo at a time**: Focus on a single decision without distraction
- **Random order**: Prevents decision fatigue from chronological sorting
- **Undo-safe**: Deleted photos are moved to quarantine, not permanently deleted
- **Fast keyboard shortcuts**: `K` to keep, `D` to delete, `U` to undo
- **Progress tracking**: See how many photos you've reviewed
- **Dropbox integration**: Works with your Dropbox Camera Uploads folder

---

## How It Works

1. **Authenticate** with your Dropbox account (one-time setup)
2. **Review photos** from your `/Camera Uploads` folder
3. **Make decisions**: Keep or delete each photo
4. **Undo if needed**: Accidentally deleted? Just undo it
5. **Quarantine safety**: Deleted photos are moved to `/_TRASHME/` for later review

---

## Safety First

- **No permanent deletes**: Photos are moved to quarantine, not deleted
- **Undo support**: Restore any photo you've deleted
- **Dropbox recovery**: Dropbox's built-in recovery still applies
- **Session-based**: Each session creates its own quarantine folder

---

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Netlify Functions
- **Storage**: Dropbox API
- **Hosting**: Netlify (picsift.lindsaybrunner.com)

---

## Getting Started

1. Click "Login with Dropbox" to authenticate
2. Grant access to your Dropbox account
3. Start reviewing your photos!

---

## Keyboard Shortcuts

- `K` - Keep this photo
- `D` - Delete this photo (move to quarantine)
- `U` - Undo last delete

---

## Privacy & Security

- Single-user app (personal use only)
- All Dropbox API calls happen server-side
- Access tokens never exposed to your browser
- Open source and transparent

---

## About

PicSift is a personal project built to make photo curation feel good, not overwhelming. It's designed to be fast, safe, and actually useful.

**Guiding principle**: Make it feel good to decide. Make it hard to make an irreversible mistake.

---

## License

This is a personal project. See the repository for details.
