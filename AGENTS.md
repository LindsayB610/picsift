# PicSift – Agent context

Guidance for AI agents (e.g. Cursor) working in this repo.

---

## What this project is

PicSift is a **personal photo triage web app**: one photo at a time, keep or delete (move to quarantine), with Dropbox as storage. It’s single-user, hosted on Netlify, and optimized for **mobile-first** with a **dark theme** (black background, brand accent colors).

---

## Tech stack

- **Frontend**: React 18, Vite 5, TypeScript (strict), React Query (TanStack Query)
- **Backend**: Netlify Functions (TypeScript)
- **Storage / auth**: Dropbox API, OAuth
- **Tests**: Vitest, Testing Library, vitest-axe (axe-core), jsdom
- **Lint / format**: ESLint 9 (flat config), Prettier

---

## Project layout

```
src/
  App.tsx              # Root: loading, login, setup, folder-selection, ready
  main.tsx             # Entry: QueryClientProvider, App
  api.ts               # Client: calls to Netlify Functions
  types.ts             # Shared TS types
  index.css            # Global CSS, design tokens, mobile-first vars
  components/          # Login, FolderSelector (more in later phases)
  hooks/               # useAuth, useFolders (React Query)
  test/
    setup.ts           # Vitest: vitest-axe, jest-dom, document.lang
    utils.tsx          # custom render with QueryClientProvider
    a11y/               # Accessibility tests (axe + role/name checks)
netlify/functions/     # Serverless: auth_start, auth_callback, discover_folders, health
docs/                  # BUILD_NOTES, SETUP_GUIDE, DECISIONS, ACCESSIBILITY_TESTING, etc.
```

---

## Commands

| Command                 | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | Vite dev server (frontend only)                   |
| `npm run dev:functions` | Netlify dev (frontend + functions; use for OAuth) |
| `npm run build`         | Typecheck functions, then Vite build              |
| `npm run typecheck`     | TS check app + functions                          |
| `npm test`              | Run all Vitest tests                              |
| `npm run test:a11y`     | Run only `src/test/a11y`                          |
| `npm run test:watch`    | Vitest watch mode                                 |
| `npm run lint`          | ESLint                                            |
| `npm run format`        | Prettier write                                    |

---

## Conventions

- **TypeScript**: Strict, `verbatimModuleSyntax`, path alias `@/` → `src/`. See `docs/TYPESCRIPT_STANDARDS.md` and `tsconfig.base.json`.
- **Styling**: Global CSS in `src/index.css`. Design tokens (e.g. `--bg`, `--accent`, `--page-padding`, `--touch-min`). Mobile-first; breakpoints at 640px and 1024px. No Tailwind/CSS-in-JS.
- **Accessibility**: axe-core in tests (see `src/test/a11y/` and `docs/ACCESSIBILITY_TESTING.md`). Touch targets ≥ 44px; semantic HTML and accessible names for controls.
- **State**: Auth and folder preference in `localStorage`; OAuth/setup tokens in `sessionStorage` or URL hash as documented.

---

## Important docs

- **Setup / run locally**: `docs/SETUP_GUIDE.md`
- **Deploy / env checklist**: `docs/DEPLOYMENT.md`
- **Testing & polish (Phase 8)**: `docs/TESTING_AND_POLISH.md` — security, manual testing, test data
- **Design / product**: `docs/BUILD_NOTES.md`, `docs/DECISIONS.md`, `docs/USER_FLOW.md`
- **Design tokens**: `docs/COLOR_PALETTE.md`
- **Accessibility tests**: `docs/ACCESSIBILITY_TESTING.md`
- **TypeScript**: `docs/TYPESCRIPT_STANDARDS.md`

---

## Testing

- Tests live under `src/**/*.{test,spec}.{ts,tsx}`; a11y tests in `src/test/a11y/`.
- Use `render` from `src/test/utils.tsx` for components that need React Query.
- Use `axeJsdomOptions` from `src/test/a11y/axe-options.ts` when calling `axe()` (disables `color-contrast` in jsdom).
- Mock `@/hooks/useAuth` or `@/hooks/useFolders` in tests to avoid real API calls.

---

## Netlify / env

- Required env vars are in `.env.example`; copy to `.env` locally.
- Production: set same vars in Netlify (Site configuration → Environment variables). See `docs/SETUP_GUIDE.md` and `docs/DEPLOYMENT.md` for setup and deploy; `docs/WHILE_WAITING_FOR_DNS.md` for OAuth and DNS.
