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
- **Dropbox integration**: Works with your Dropbox folders (e.g. Camera Uploads)

---

## How It Works

1. **Authenticate** with your Dropbox account (one-time setup)
2. **Select a folder** containing your photos (e.g. Camera Uploads)
3. **Review photos** one at a time in random order
4. **Make decisions**: Keep or delete each photo
5. **Undo if needed**: Accidentally deleted? Just undo it
6. **Quarantine safety**: Deleted photos are moved to `/_TRASHME/` for later review

---

## Safety First

- **No permanent deletes**: Photos are moved to quarantine, not deleted
- **Undo support**: Restore any photo you've deleted
- **Dropbox recovery**: Dropbox's built-in recovery still applies
- **Session-based**: Each session creates its own quarantine folder

---

## Tech Stack

- **Frontend**: React + Vite + TypeScript (mobile-first, dark theme)
- **Backend**: Netlify Functions
- **Storage**: Dropbox API
- **Hosting**: Netlify (picsift.lindsaybrunner.com)
- **Tests**: Vitest, Testing Library, axe-core (accessibility)

---

## Development

- **Local dev (frontend only)**: `npm run dev`
- **Local dev (with Netlify Functions / OAuth)**: `npm run dev:functions` — see [Setup Guide](docs/SETUP_GUIDE.md)
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint` · **Format**: `npm run format`
- **Tests**: `npm test` (all) · `npm run test:a11y` (accessibility only) · `npm run test:watch` (watch mode)

See [docs/ACCESSIBILITY_TESTING.md](docs/ACCESSIBILITY_TESTING.md) for how accessibility tests work. For a full testing and polish checklist (security, manual testing, test data setup), see [docs/TESTING_AND_POLISH.md](docs/TESTING_AND_POLISH.md).

---

## Environment Variables

Required environment variables are documented in `.env.example`. Copy it to `.env` for local development and configure the same variables in the Netlify dashboard for production. Never commit `.env` or any secrets. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for a deployment checklist and env reference.

---

## Getting Started

1. Click "Login with Dropbox" to authenticate
2. Grant access to your Dropbox account
3. Select a folder that contains your photos
4. Start reviewing your photos one at a time

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

## Docs

- [Setup Guide](docs/SETUP_GUIDE.md) — local dev, env, OAuth, deploy
- [Deployment](docs/DEPLOYMENT.md) — Phase 9 checklist, Netlify deploy, environment variables
- [Testing & polish](docs/TESTING_AND_POLISH.md) — Phase 8 checklist (security, manual testing, test data)
- [Build notes & plan](docs/BUILD_NOTES.md) — MVP scope and decisions
- [Accessibility testing](docs/ACCESSIBILITY_TESTING.md) — how a11y tests run

---

## About

PicSift is a personal project built to make photo curation feel good, not overwhelming. It's designed to be fast, safe, and actually useful.

**Guiding principle**: Make it feel good to decide. Make it hard to make an irreversible mistake.

---

## License

This is a personal project. See the repository for details.
