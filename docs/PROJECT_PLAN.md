# PicSift — Project Plan

This document outlines the implementation plan for building the PicSift MVP, with special attention to security practices for a public repository.

---

## Security Principles (Critical)

Since this is a **public repository**, we must ensure:

1. **Never commit secrets**: API keys, tokens, app secrets, or any sensitive credentials
2. **Environment variables only**: All secrets stored in Netlify environment variables
3. **Server-side only**: Access tokens never exposed to the browser
4. **Template files**: Example `.env.example` files can be committed (with placeholder values)
5. **No user data in code**: Paths, user IDs, or personal data should be configurable, not hardcoded

---

## Implementation Phases

### Phase 1: Project Setup & Configuration
**Goal**: Initialize the project structure and development environment

#### Tasks:
1. **Initialize Vite + React + TypeScript project**
   - `npm create vite@latest . -- --template react-ts`
   - Install dependencies
   - Install markdown rendering library (e.g., `react-markdown`)
   - Configure TypeScript with proper TSConfig structure (see TypeScript Standards)

2. **Set up Netlify configuration**
   - Create `netlify.toml` with function settings
   - Configure build settings
   - Set up redirect rules for SPA
   - Configure custom domain: `picsift.lindsaybrunner.com`

3. **Create project structure**
   - Set up `netlify/functions/` directory
   - Set up `src/` directory structure
   - Create component directories

4. **Security setup**
   - Create `.env.example` with placeholder values
   - Ensure `.env` is in `.gitignore`
   - Document required environment variables

5. **TypeScript configuration** (per TypeScript Standards)
   - Create `tsconfig.base.json` with all required compiler options:
     - `noUncheckedIndexedAccess`
     - `exactOptionalPropertyTypes`
     - `useUnknownInCatchVariables`
     - `verbatimModuleSyntax`
     - `moduleDetection: "force"`
     - `noUncheckedSideEffectImports`
   - Create `tsconfig.app.json` extending base
   - Create `tsconfig.node.json` extending base
   - Create `tsconfig.functions.json` extending base (for Netlify Functions)
   - Create `tsconfig.eslint.json` for ESLint type-checking
   - Update root `tsconfig.json` with project references

6. **ESLint configuration** (per TypeScript Standards)
   - Install `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`
   - Configure with `projectService: true` (better performance)
   - Add `recommendedTypeChecked` config
   - Enable critical type-checked rules:
     - `@typescript-eslint/no-floating-promises`
     - `@typescript-eslint/no-misused-promises`
     - `@typescript-eslint/switch-exhaustiveness-check`
     - `@typescript-eslint/consistent-type-imports`
   - Configure ESLint to use `tsconfig.eslint.json`

7. **Development tooling**
   - Set up Prettier (optional but recommended)
   - Configure VS Code settings (optional)
   - Add npm scripts: `typecheck`, `lint`, `lint:fix`

**Deliverables:**
- Working Vite dev server
- Netlify Functions structure
- Environment variable template
- Basic routing setup
- Complete TSConfig structure (base, app, node, functions, eslint)
- ESLint configured with type-checked rules
- Type checking and linting scripts working

---

### Phase 2: Dropbox OAuth Implementation
**Goal**: Secure authentication flow with Dropbox

#### Tasks:
1. **Create Dropbox app** (manual step)
   - Register app in Dropbox App Console
   - Configure OAuth redirect URI: `https://picsift.lindsaybrunner.com/auth/callback`
   - Note App Key and App Secret (store in Netlify env vars)

2. **Implement OAuth start function** (`netlify/functions/auth_start.ts`)
   - Generate state parameter (CSRF protection)
   - Build Dropbox OAuth URL
   - Redirect user to Dropbox
   - Store state in session/cookie

3. **Implement OAuth callback** (`netlify/functions/auth_callback.ts`)
   - Validate state parameter
   - Exchange authorization code for tokens
   - Store refresh token securely (Netlify env var or encrypted storage)
   - Return success/error to frontend

4. **Token management helper** (`netlify/functions/_dropbox.ts`)
   - Function to refresh access tokens using refresh token
   - Token caching (in-memory, short-lived)
   - Error handling for expired tokens

5. **Login page component** (`src/components/Login.tsx`)
   - Display README.md content (render markdown)
   - Show "Login with Dropbox" button
   - Clean, simple design
   - Link to start OAuth flow

6. **Frontend auth flow** (`src/App.tsx`)
   - Check authentication status
   - Show Login page if not authenticated
   - Handle OAuth callback
   - Store auth state (sessionStorage/localStorage)
   - Route to main app after authentication

**Security considerations:**
- App Key/Secret: Netlify env vars only (`DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`)
- Refresh token: Store in Netlify env var or encrypted Netlify KV/Blob store
- State parameter: Use crypto-secure random string, validate on callback
- Access tokens: Never sent to browser, only used server-side

**Deliverables:**
- Login page with README display
- Working OAuth flow
- Secure token storage
- Auth status checking

---

### Phase 3: Core Dropbox API Functions
**Goal**: Server-side functions to interact with Dropbox API

#### Tasks:
1. **Shared Dropbox helper** (`netlify/functions/_dropbox.ts`)
   - Generic `dbx()` function for API calls
   - Automatic token refresh logic
   - Error handling and retries
   - Type-safe API responses

2. **List function** (`netlify/functions/list.ts`)
   - Accept path parameter (default: "/Camera Uploads")
   - Call `files/list_folder`
   - Handle pagination with `files/list_folder/continue`
   - Filter to image files only (jpg, jpeg, png, heic, webp, gif)
   - Return array of `DbxEntry` objects

3. **Temporary link function** (`netlify/functions/temp_link.ts`)
   - Accept file path
   - Call `files/get_temporary_link`
   - Return temporary URL (expires in 4 hours)
   - Used for displaying images in browser

4. **Trash function** (`netlify/functions/trash.ts`)
   - Accept file path and sessionId
   - Compute quarantine path: `/_TRASHME/<sessionId><original_path>`
   - Call `files/move_v2` with `autorename: true`
   - Return `TrashRecord` with original and new paths

5. **Undo function** (`netlify/functions/undo.ts`)
   - Accept trashed_path and original_path
   - Call `files/move_v2` to restore file
   - Return success/error

6. **Frontend API client** (`src/api.ts`)
   - Type-safe functions to call Netlify Functions
   - Handle authentication headers
   - Error handling and retries
   - Type definitions matching function responses

**Security considerations:**
- All Dropbox API calls happen server-side
- Access tokens never exposed to browser
- Path validation (prevent path traversal attacks)
- Session ID validation (format check)

**Deliverables:**
- All Netlify Functions implemented
- Frontend API client
- Type-safe interfaces

---

### Phase 4: TypeScript Types & Models
**Goal**: Define all TypeScript interfaces and types

#### Tasks:
1. **Create `src/types.ts`**
   - `DbxEntry` type (matches Dropbox file metadata)
   - `TrashRecord` type
   - `SessionState` type
   - API request/response types
   - Error types

2. **Type safety throughout** (per TypeScript Standards)
   - Ensure all functions are typed
   - No `any` types (use `unknown` if needed)
   - Proper error types
   - All catch blocks use `unknown` and proper error normalization
   - All index access handles `undefined` (with `noUncheckedIndexedAccess`)
   - All type-only imports use `import type` (with `verbatimModuleSyntax`)
   - All promises are handled (no floating promises)

**Deliverables:**
- Complete type definitions
- Type-safe codebase
- All code patterns align with TypeScript Standards
- No type-checking errors

---

### Phase 5: Frontend Core Components
**Goal**: Build the main UI components

#### Tasks:
1. **App component** (`src/App.tsx`)
   - Main app structure
   - Auth state management
   - Session initialization
   - Routing/navigation
   - Show Login component when not authenticated
   - Show main app when authenticated

2. **Login component** (`src/components/Login.tsx`)
   - Render README.md content as markdown
   - Install markdown rendering library (e.g., `react-markdown` or `marked`)
   - Display README in a readable format
   - "Login with Dropbox" button that triggers OAuth
   - Clean, centered layout
   - Responsive design

3. **Viewer component** (`src/components/Viewer.tsx`)
   - Display single image (full-screen or large view)
   - Loading states
   - Error handling (failed image load)
   - Image optimization (lazy loading, sizing)

3. **Controls component** (`src/components/Controls.tsx`)
   - Keep button
   - Delete button
   - Undo button (if available)
   - Progress indicator (current / total)
   - Keyboard shortcuts (K, D, U)

4. **Session state management**
   - Generate sessionId (UUID or ISO timestamp)
   - Shuffle queue client-side
   - Track current index
   - Track kept/trashed items
   - Maintain undo stack

5. **Styling**
   - Minimal, clean design
   - Responsive layout
   - Keyboard shortcut indicators
   - Progress feedback
   - Optional: confetti/celebration for delete streaks

**Deliverables:**
- Login page with README display
- Working UI with image viewer
- Functional keep/delete/undo actions
- Keyboard shortcuts
- Progress tracking

---

### Phase 6: Session Management & State Persistence
**Goal**: Handle session lifecycle and optional state persistence

#### Tasks:
1. **Session initialization**
   - Fetch image list from Dropbox
   - Shuffle client-side
   - Generate sessionId
   - Initialize session state

2. **State persistence** (optional)
   - Save session state to localStorage
   - Restore session on page reload
   - Handle expired sessions gracefully

3. **Session completion**
   - Show completion message
   - Display summary (kept: X, deleted: Y)
   - Option to start new session

**Deliverables:**
- Complete session flow
- Optional state persistence
- Session summary

---

### Phase 7: Error Handling & Edge Cases
**Goal**: Robust error handling and user feedback

#### Tasks:
1. **Error handling** (per TypeScript Standards)
   - All catch blocks use `unknown` type
   - Proper error normalization utilities
   - Network errors
   - Dropbox API errors
   - Authentication errors
   - File not found errors
   - Rate limiting
   - Consistent error handling patterns

2. **Edge cases**
   - Empty folder
   - No images found
   - Duplicate files
   - Very large image lists
   - Slow network connections

3. **User feedback**
   - Loading indicators
   - Error messages
   - Success confirmations
   - Retry mechanisms

**Deliverables:**
- Comprehensive error handling
- User-friendly error messages
- Graceful degradation

---

### Phase 8: Testing & Polish
**Goal**: Test the complete flow and polish the experience

#### Tasks:
1. **Type checking and linting** (per TypeScript Standards)
   - Run `npm run typecheck` - must pass with zero errors
   - Run `npm run lint` - must pass with zero errors
   - Fix any violations incrementally
   - Ensure all catch blocks use `unknown`
   - Ensure all index access handles `undefined`
   - Ensure all type-only imports use `import type`
   - Ensure no floating promises

2. **Manual testing**
   - Complete OAuth flow
   - List images
   - Keep/delete actions
   - Undo functionality
   - Session completion
   - Error scenarios

3. **UI/UX polish**
   - Smooth transitions
   - Loading states
   - Keyboard shortcuts work reliably
   - Mobile responsiveness (if needed)
   - Accessibility basics

4. **Performance**
   - Image loading optimization
   - Function response times
   - Client-side shuffling performance

5. **Documentation**
   - README with setup instructions
   - Environment variables documentation
   - Deployment guide

**Deliverables:**
- Type checking passes with zero errors
- Linting passes with zero errors
- Fully tested application
- Polished UI/UX
- Documentation
- Code aligns with TypeScript Standards

---

### Phase 9: Deployment
**Goal**: Deploy to Netlify

#### Tasks:
1. **Netlify setup**
   - Connect GitHub repository
   - Configure build settings
   - Set environment variables
   - Configure custom domain (if applicable)

2. **Environment variables**
   - `DROPBOX_APP_KEY`
   - `DROPBOX_APP_SECRET`
   - `DROPBOX_REFRESH_TOKEN` (after first OAuth)
   - Any other required secrets

3. **Deploy and verify**
   - Deploy to Netlify
   - Test OAuth flow
   - Test complete user flow
   - Verify security (no tokens in browser)

**Deliverables:**
- Live application on Netlify
- Working OAuth
- Secure deployment

---

## Security Checklist

Before deploying, verify:

- [ ] No secrets in code (grep for API keys, tokens, passwords)
- [ ] `.env` file in `.gitignore`
- [ ] `.env.example` exists with placeholder values
- [ ] All Dropbox API calls happen server-side
- [ ] Access tokens never sent to browser
- [ ] Refresh token stored securely (Netlify env var)
- [ ] OAuth state parameter validated
- [ ] Path validation prevents traversal attacks
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS enforced (Netlify default)
- [ ] CORS configured correctly (if needed)

---

## Environment Variables Reference

### Required (set in Netlify dashboard):

```
DROPBOX_APP_KEY=your_app_key_here
DROPBOX_APP_SECRET=your_app_secret_here
DROPBOX_REFRESH_TOKEN=your_refresh_token_here  # Set after first OAuth
```

### Optional:
```
DROPBOX_SOURCE_PATH=/Camera Uploads  # Default if not set
NETLIFY_URL=https://picsift.lindsaybrunner.com  # For OAuth redirect
```

---

## File Structure (Final)

```
picsift/
├── .env.example                    # Template with placeholders
├── .gitignore                      # Includes .env
├── README.md                       # Setup instructions
├── docs/                           # Reference documentation
│   ├── BUILD_NOTES.md              # Original spec
│   ├── PROJECT_PLAN.md             # This file
│   └── TYPESCRIPT_STANDARDS.md     # TypeScript standards alignment plan
├── netlify.toml                    # Netlify configuration
├── package.json
├── tsconfig.json                   # Root with project references
├── tsconfig.base.json              # Shared base configuration
├── tsconfig.app.json               # App code configuration
├── tsconfig.node.json              # Node tooling configuration
├── tsconfig.functions.json         # Netlify functions configuration
├── tsconfig.eslint.json            # ESLint type-checking configuration
├── vite.config.ts
├── .eslintrc.cjs                   # ESLint configuration
├── netlify/
│   └── functions/
│       ├── auth_start.ts           # OAuth initiation
│       ├── auth_callback.ts        # OAuth callback handler
│       ├── list.ts                 # List images
│       ├── temp_link.ts            # Get image URL
│       ├── trash.ts                # Move to quarantine
│       ├── undo.ts                 # Restore from quarantine
│       ├── purge.ts                # Optional: permanent delete
│       └── _dropbox.ts             # Shared Dropbox API helper
└── src/
    ├── api.ts                      # Frontend API client
    ├── types.ts                    # TypeScript definitions
    ├── App.tsx                     # Main app component
    ├── main.tsx                    # Entry point
    ├── index.css                   # Global styles
    └── components/
        ├── Login.tsx               # Login page with README
        ├── Viewer.tsx              # Image display
        └── Controls.tsx            # Action buttons
```

---

## Development Workflow

1. **Local development:**
   - Run `npm run dev` for frontend
   - Use Netlify CLI (`netlify dev`) for functions
   - Test OAuth with local redirect URI

2. **Testing:**
   - Test each function individually
   - Test complete user flows
   - Test error scenarios

3. **Deployment:**
   - Push to `main` branch
   - Netlify auto-deploys
   - Configure custom domain: `picsift.lindsaybrunner.com` in Netlify
   - Set environment variables in Netlify dashboard
   - Update Dropbox OAuth redirect URI to match custom domain
   - Test production deployment

---

## TypeScript Standards Integration

This project follows the TypeScript Standards outlined in `docs/TYPESCRIPT_STANDARDS.md`. Key requirements:

- **TSConfig Structure**: Proper base config with all required compiler options
- **ESLint**: Type-checked linting with `projectService: true`
- **Code Patterns**: No `any`, proper error handling, type-safe patterns
- **Validation**: `npm run typecheck` and `npm run lint` must pass with zero errors

The TypeScript standards are integrated into Phase 1 (setup), Phase 4 (types), Phase 7 (error handling), and Phase 8 (testing). See `docs/TYPESCRIPT_STANDARDS.md` for detailed implementation guidance.

---

## Next Steps

Start with **Phase 1: Project Setup & Configuration** to initialize the project structure, set up TypeScript standards, and ensure all security measures are in place before writing any code that handles sensitive data.
