# Accessibility testing

PicSift uses **Vitest**, **Testing Library**, and **axe-core** (via **vitest-axe**) to run accessibility tests on the main UI views.

## Running tests

```bash
# Run all tests (including a11y)
npm test

# Run only accessibility tests (files under src/test/a11y/)
npm run test:a11y

# Watch mode for all tests
npm run test:watch
```

## What is tested

- **Login** (`src/test/a11y/login.a11y.test.tsx`): README + “Login with Dropbox” view
  - No axe violations (with jsdom-safe options)
  - Primary button has an accessible name
  - Main content wrapper is present

- **FolderSelector** (`src/test/a11y/folder-selector.a11y.test.tsx`): Folder picker
  - No axe violations
  - Section heading “Select a Folder”
  - Folder options are focusable and have accessible names
  - Cancel and Start Session buttons present and named

- **App** (`src/test/a11y/app.a11y.test.tsx`): Full app in different states
  - Login view: no axe violations after load
  - Ready (homepage) view: no axe violations when a folder is selected
  - Ready view: “Change folder” and “Logout” buttons have accessible names

## Setup details

- **Test setup** (`src/test/setup.ts`): Extends `expect` with vitest-axe (`toHaveNoViolations`) and `@testing-library/jest-dom`; sets `document.documentElement.lang = "en"` for axe.
- **Custom render** (`src/test/utils.tsx`): Wraps components in `QueryClientProvider` so hooks like `useAuthCallback` and `useDiscoverFolders` work in tests.
- **axe in jsdom**: The `color-contrast` rule is disabled in these tests because it depends on `HTMLCanvasElement.getContext`, which jsdom does not implement. Contrast can be checked in a real browser (e.g. Lighthouse or axe DevTools).

## Adding more a11y tests

1. For a new view, add a test file under `src/test/a11y/` (e.g. `my-view.a11y.test.tsx`).
2. Use `render` from `../utils` so React Query is provided.
3. Run axe with `axeJsdomOptions` from `./axe-options` when using `axe(container, axeJsdomOptions)`.
4. Add role/name assertions with `screen.getByRole(...)` to reinforce accessible names and structure.
