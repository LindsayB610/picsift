/**
 * Main App component
 * Handles authentication flow and routing
 */

import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import SettingsIcon from '@mui/icons-material/Settings';
import Login from './components/Login';
import FolderSelector from './components/FolderSelector';
import Viewer from './components/Viewer';
import Controls from './components/Controls';
import Settings, {
  getConfettiFrequency,
  type ConfettiFrequency,
} from './components/Settings';
import { useAuthCallback } from './hooks/useAuth';
import { listImages, trash as apiTrash, undo as apiUndo } from './api';
import type { AuthState, FolderInfo, DbxEntry, TrashRecord } from './types';

const AUTH_STORAGE_KEY = 'picsift:auth';
const FOLDER_PREFERENCE_KEY = 'picsift:selectedFolder';
const SESSION_PERSIST_KEY = 'picsift:session';

type AppState = 'loading' | 'login' | 'setup' | 'folder-selection' | 'ready';

/** Undo stack item: record from API + entry for re-inserting into queue */
type UndoItem = { record: TrashRecord; entry: DbxEntry };

function shuffleArray<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function maybeConfetti(trashedCount: number, frequency: ConfettiFrequency): void {
  if (frequency === 'off') return;
  const n = frequency === '1' ? 1 : parseInt(frequency, 10);
  if (Number.isNaN(n) || n <= 0) return;
  if (trashedCount % n !== 0) return;
  void confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
  });
}

const SETUP_TOKENS_KEY = 'picsift:setup_tokens';

function SetupAddTokens({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [tokens, setTokens] = useState<{
    refreshToken: string;
    accountId: string;
  } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SETUP_TOKENS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { refreshToken: string; accountId: string };
        if (parsed.refreshToken && parsed.accountId) {
          setTokens(parsed);
        }
      } catch {
        sessionStorage.removeItem(SETUP_TOKENS_KEY);
      }
    }
  }, []);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  if (!tokens) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text)' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="content-wrap"
      style={{
        maxWidth: '560px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      <h1 style={{ fontFamily: 'var(--sans)', color: 'var(--text-h)', margin: 0, fontSize: '1.35rem' }}>
        One more step
      </h1>
      <p style={{ color: 'var(--text)', margin: 0, lineHeight: 1.5, fontSize: '0.9375rem' }}>
        Add these two values in Netlify so the app can use your Dropbox:
      </p>
      <ol style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
        <li>Open your Netlify dashboard → your PicSift site.</li>
        <li>Go to <strong>Site configuration</strong> → <strong>Environment variables</strong>.</li>
        <li>Click <strong>Add a variable</strong> (or edit if they exist) and add the two below.</li>
        <li>Go to <strong>Deploys</strong> → <strong>Trigger deploy</strong> → <strong>Deploy site</strong>.</li>
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            DROPBOX_REFRESH_TOKEN
          </label>
          <input
            type="text"
            readOnly
            value={tokens.refreshToken}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '16px',
              fontFamily: 'monospace',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-h)',
              minHeight: 'var(--touch-min)',
            }}
          />
          <button
            type="button"
            className="touch-target-inline"
            onClick={() => copyToClipboard(tokens.refreshToken)}
            style={{
              width: '100%',
              fontSize: '0.9375rem',
              fontWeight: 500,
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            AUTHORIZED_DROPBOX_ACCOUNT_ID
          </label>
          <input
            type="text"
            readOnly
            value={tokens.accountId}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '16px',
              fontFamily: 'monospace',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-h)',
              minHeight: 'var(--touch-min)',
            }}
          />
          <button
            type="button"
            className="touch-target-inline"
            onClick={() => copyToClipboard(tokens.accountId)}
            style={{
              width: '100%',
              fontSize: '0.9375rem',
              fontWeight: 500,
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.875rem' }}>
        After you’ve added both and triggered a new deploy, click below.
      </p>
      <div className="actions-row">
        <button
          type="button"
          className="touch-target-inline"
          onClick={onContinue}
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          I’ve added them, continue
        </button>
        <button
          type="button"
          className="touch-target-inline"
          onClick={onCancel}
          style={{
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Cancel / Log out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [, setAuthState] = useState<AuthState>({
    is_authenticated: false,
  });
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);

  // Session state (triage)
  const [sessionQueue, setSessionQueue] = useState<DbxEntry[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [sessionListError, setSessionListError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check for OAuth callback in URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const authCallbackQuery = useAuthCallback(code, state);

  useEffect(() => {
    void initializeApp();
  }, []);

  // Handle auth callback from React Query
  useEffect(() => {
    if (code && state && authCallbackQuery.data) {
      const response = authCallbackQuery.data;
      if (response.success && response.account_id) {
        const newAuthState: AuthState = {
          is_authenticated: true,
          account_id: response.account_id,
        };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
        window.history.replaceState({}, '', window.location.pathname);

        const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
        if (savedFolder) {
          try {
            const folder = JSON.parse(savedFolder) as FolderInfo;
            setSelectedFolder(folder);
            setAppState('ready');
          } catch {
            setAppState('folder-selection');
          }
        } else {
          setAppState('folder-selection');
        }
      } else {
        setAppState('login');
      }
    } else if (code && state && authCallbackQuery.isError) {
      console.error('Auth callback error:', authCallbackQuery.error);
      setAppState('login');
    }
  }, [code, state, authCallbackQuery.data, authCallbackQuery.isError, authCallbackQuery.error]);

  /**
   * Initialize app: check for OAuth callback, load saved auth state, check for folder preference
   */
  const initializeApp = () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if user wants to clear auth and re-authenticate
    if (urlParams.get('reauth') === 'true' || urlParams.get('clear') === 'true') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(FOLDER_PREFERENCE_KEY);
      setAuthState({ is_authenticated: false });
      setSelectedFolder(null);
      window.history.replaceState({}, '', window.location.pathname);
      setAppState('login');
      return;
    }

    // Production: after OAuth we redirect with #setup=1&account_id=...&refresh_token=... so you can add them to Netlify
    const hash = window.location.hash.slice(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const setup = hashParams.get('setup');
      const accountIdFromHash = hashParams.get('account_id');
      const refreshToken = hashParams.get('refresh_token');
      if (setup === '1' && accountIdFromHash && refreshToken) {
        const newAuthState: AuthState = { is_authenticated: true, account_id: accountIdFromHash };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
        sessionStorage.setItem(
          SETUP_TOKENS_KEY,
          JSON.stringify({ refreshToken, accountId: accountIdFromHash }),
        );
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        setAppState('setup');
        return;
      }
    }

    // Check for setup tokens in sessionStorage (e.g. user refreshed on setup screen)
    const storedSetup = sessionStorage.getItem(SETUP_TOKENS_KEY);
    if (storedSetup) {
      try {
        JSON.parse(storedSetup);
        setAppState('setup');
        return;
      } catch {
        sessionStorage.removeItem(SETUP_TOKENS_KEY);
      }
    }

    // Server redirects here after OAuth with ?auth=success&account_id=xxx or ?auth=error&message=xxx
    const authResult = urlParams.get('auth');
    const accountId = urlParams.get('account_id');
    const errorMessage = urlParams.get('message');

    if (authResult === 'success' && accountId) {
      // Redirect from auth_callback with success
      const newAuthState: AuthState = {
        is_authenticated: true,
        account_id: accountId,
      };
      setAuthState(newAuthState);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
      window.history.replaceState({}, '', window.location.pathname);

      const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
      if (savedFolder) {
        try {
          const folder = JSON.parse(savedFolder) as FolderInfo;
          setSelectedFolder(folder);
          setAppState('ready');
        } catch {
          setAppState('folder-selection');
        }
      } else {
        setAppState('folder-selection');
      }
      return;
    }

    if (authResult === 'error') {
      // Redirect from auth_callback with error
      window.history.replaceState({}, '', window.location.pathname);
      if (errorMessage) {
        console.error('Auth error:', errorMessage);
      }
      setAppState('login');
      return;
    }

    // Legacy: code + state in URL (frontend calls API) — keep for compatibility
    // This is handled by the useAuthCallback hook below

    // Not an OAuth callback, check saved auth state
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedAuth) {
        try {
          const auth = JSON.parse(savedAuth) as AuthState;
          if (auth.is_authenticated) {
            setAuthState(auth);

            // Check for saved folder preference
            const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
            if (savedFolder) {
              try {
                const folder = JSON.parse(savedFolder) as FolderInfo;
                setSelectedFolder(folder);
                setAppState('ready');
              } catch {
                // Invalid saved folder, show selector
                setAppState('folder-selection');
              }
            } else {
              // No saved folder, show selector
              setAppState('folder-selection');
            }
          } else {
            setAppState('login');
          }
        } catch {
          // Invalid saved auth, show login
          setAppState('login');
        }
      } else {
        // No saved auth, show login
        setAppState('login');
      }
  };

  /**
   * Handle folder selection
   */
  const handleFolderSelected = (folder: FolderInfo) => {
    setSelectedFolder(folder);
    setAppState('ready');
  };

  /**
   * Handle logout (clear auth and folder preference)
   */
  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(FOLDER_PREFERENCE_KEY);
    setAuthState({ is_authenticated: false });
    setSelectedFolder(null);
    setAppState('login');
  };

  /**
   * Handle change folder (go back to folder selection)
   */
  const handleChangeFolder = () => {
    setAppState('folder-selection');
  };

  /**
   * Start a triage session: fetch images, shuffle, set session state
   */
  const startSession = useCallback(async () => {
    if (!selectedFolder) return;
    setSessionListError(null);
    setSessionListLoading(true);
    try {
      const res = await listImages(selectedFolder.path);
      const entries = res.entries ?? [];
      if (entries.length === 0) {
        setSessionListError('No images found in this folder.');
        return;
      }
      const shuffled = shuffleArray(entries);
      const id = crypto.randomUUID();
      setSessionQueue(shuffled);
      setSessionIndex(0);
      setSessionId(id);
      setUndoStack([]);
      setSessionListLoading(false);
      try {
        localStorage.setItem(
          SESSION_PERSIST_KEY,
          JSON.stringify({ sessionId: id, index: 0, total: shuffled.length }),
        );
      } catch {
        // ignore persist errors
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSessionListError(message);
    } finally {
      setSessionListLoading(false);
    }
  }, [selectedFolder]);

  const currentEntry = sessionQueue[sessionIndex] ?? null;
  const nextEntry = sessionQueue[sessionIndex + 1] ?? null;
  const trashedCount = undoStack.length;
  const keptCount = sessionIndex - trashedCount;
  const totalCount = sessionQueue.length;
  const isSessionComplete = totalCount > 0 && sessionIndex >= totalCount;

  const onKeep = useCallback(() => {
    if (actionBusy || !currentEntry) return;
    setActionError(null);
    const next = sessionIndex + 1;
    setSessionIndex(next);
    try {
      localStorage.setItem(
        SESSION_PERSIST_KEY,
        JSON.stringify({
          sessionId,
          index: next,
          total: totalCount,
        }),
      );
    } catch {
      // ignore
    }
  }, [actionBusy, currentEntry, sessionIndex, sessionId, totalCount]);

  const onDelete = useCallback(async () => {
    if (actionBusy || !currentEntry || !sessionId) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const result = await apiTrash(currentEntry.path_display, sessionId);
      if (!result.success || !result.trash_record) {
        throw new Error(result.error ?? 'Delete failed');
      }
      const record = result.trash_record;
      setUndoStack((prev) => [...prev, { record, entry: currentEntry }]);
      setSessionIndex((i) => i + 1);
      maybeConfetti(undoStack.length + 1, getConfettiFrequency());
      try {
        localStorage.setItem(
          SESSION_PERSIST_KEY,
          JSON.stringify({
            sessionId,
            index: sessionIndex + 1,
            total: totalCount,
          }),
        );
      } catch {
        // ignore
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      console.error('Trash error:', err);
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    currentEntry,
    sessionId,
    sessionIndex,
    totalCount,
    undoStack.length,
  ]);

  const onUndo = useCallback(async () => {
    const item = undoStack[undoStack.length - 1];
    if (actionBusy || !item || !sessionId) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const result = await apiUndo(
        item.record.trashed_path,
        item.record.original_path,
      );
      if (!result.success) {
        throw new Error(result.error ?? 'Undo failed');
      }
      setUndoStack((prev) => prev.slice(0, -1));
      setSessionQueue((q) => {
        const next = [...q];
        next.splice(sessionIndex, 0, item.entry);
        return next;
      });
      // Stay at same index so current image is the restored one
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      console.error('Undo error:', err);
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, undoStack, sessionId, sessionIndex]);

  // Clear action error after a delay so user can read it
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(t);
  }, [actionError]);

  // Keyboard shortcuts K, D, U
  useEffect(() => {
    if (appState !== 'ready' || showSettings || isSessionComplete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        onKeep();
      } else if (key === 'd') {
        e.preventDefault();
        void onDelete();
      } else if (key === 'u') {
        e.preventDefault();
        void onUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    appState,
    showSettings,
    isSessionComplete,
    onKeep,
    onDelete,
    onUndo,
  ]);

  if (appState === 'loading') {
    return (
      <main className="page-main">
        <p style={{ color: 'var(--text)', fontSize: '0.9375rem' }}>Loading…</p>
      </main>
    );
  }

  if (appState === 'login') {
    return (
      <main className="page-main">
        <Login />
      </main>
    );
  }

  if (appState === 'setup') {
    return (
      <main className="page-main">
        <SetupAddTokens
          onContinue={() => {
            sessionStorage.removeItem(SETUP_TOKENS_KEY);
            setAppState('folder-selection');
          }}
          onCancel={handleLogout}
        />
      </main>
    );
  }

  if (appState === 'folder-selection') {
    return (
      <main className="page-main">
        <FolderSelector
          onFolderSelected={handleFolderSelected}
          onCancel={handleLogout}
        />
      </main>
    );
  }

  // appState === 'ready' — triage session or start/completion screens
  const hasActiveSession = sessionId !== null && sessionQueue.length > 0;
  const showStartPrompt =
    !hasActiveSession && !sessionListLoading && sessionQueue.length === 0;

  if (showSettings) {
    return (
      <main className="page-main">
        <Settings
          onClose={() => setShowSettings(false)}
          onSettingChange={() => {}}
        />
      </main>
    );
  }

  if (showStartPrompt) {
    return (
      <main className="page-main">
        <div
          className="content-wrap"
          style={{
            maxWidth: '420px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <header style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                color: 'var(--text-h)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              PicSift
            </h1>
            <p
              style={{
                color: 'var(--text)',
                margin: '0.5rem 0 0 0',
                fontSize: '0.9375rem',
              }}
            >
              Ready to start
            </p>
          </header>

          <section
            style={{
              padding: '1.25rem 1rem',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.8125rem' }}>
              Selected folder
            </p>
            <p
              style={{
                color: 'var(--text-h)',
                margin: '0.25rem 0 0 0',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              {selectedFolder?.name}
            </p>
            <p
              style={{
                color: 'var(--text)',
                margin: '0.5rem 0 0 0',
                fontSize: '0.8125rem',
              }}
            >
              {selectedFolder?.image_count} images to review
            </p>
          </section>

          {sessionListError && (
            <p
              style={{
                color: 'var(--error-text)',
                margin: 0,
                fontSize: '0.875rem',
              }}
            >
              {sessionListError}
            </p>
          )}

          <div className="actions-row">
            <button
              type="button"
              className="touch-target-inline"
              onClick={() => void startSession()}
              disabled={sessionListLoading}
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: sessionListLoading ? 'wait' : 'pointer',
                opacity: sessionListLoading ? 0.8 : 1,
              }}
            >
              {sessionListLoading ? 'Loading…' : 'Start session'}
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleChangeFolder}
              style={{
                fontSize: '0.9375rem',
                fontWeight: 500,
                backgroundColor: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Change folder
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleLogout}
              style={{
                fontSize: '0.9375rem',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (sessionListLoading && sessionQueue.length === 0) {
    return (
      <main className="page-main">
        <p style={{ color: 'var(--text)', fontSize: '0.9375rem' }}>
          Loading images…
        </p>
      </main>
    );
  }

  if (isSessionComplete) {
    return (
      <main className="page-main">
        <div
          className="content-wrap"
          style={{
            maxWidth: '420px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 600,
              fontSize: '1.5rem',
              color: 'var(--text-h)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Session complete
          </h1>
          <section
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.9375rem' }}>
              Kept: <strong style={{ color: 'var(--text-h)' }}>{keptCount}</strong>
            </p>
            <p
              style={{
                color: 'var(--text)',
                margin: '0.5rem 0 0 0',
                fontSize: '0.9375rem',
              }}
            >
              Deleted:{' '}
              <strong style={{ color: 'var(--text-h)' }}>{trashedCount}</strong>
            </p>
          </section>
          <div className="actions-row">
            <button
              type="button"
              className="touch-target-inline"
              onClick={() => {
                setSessionId(null);
                setSessionQueue([]);
                setSessionIndex(0);
                setUndoStack([]);
                void startSession();
              }}
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Start new session
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleChangeFolder}
              style={{
                fontSize: '0.9375rem',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Change folder
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleLogout}
              style={{
                fontSize: '0.9375rem',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Active triage: Viewer + Controls + settings gear
  return (
    <main className="page-main">
      <div
        className="content-wrap"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          alignItems: 'center',
        }}
      >
        <header
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 600,
              fontSize: '1.25rem',
              color: 'var(--text-h)',
              margin: 0,
            }}
          >
            PicSift
          </h1>
          <button
            type="button"
            className="touch-target"
            onClick={() => setShowSettings(true)}
            style={{
              width: 'var(--touch-min)',
              height: 'var(--touch-min)',
              padding: 0,
              border: 'none',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Settings"
          >
            <SettingsIcon sx={{ fontSize: 24 }} />
          </button>
        </header>

        <Viewer currentEntry={currentEntry} nextEntry={nextEntry} />

        {actionError && (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              color: 'var(--error-text)',
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: '8px',
              width: '100%',
              maxWidth: 'var(--content-max)',
              textAlign: 'center',
            }}
          >
            {actionError}
          </p>
        )}

        <Controls
          onKeep={onKeep}
          onDelete={() => void onDelete()}
          onUndo={() => void onUndo()}
          currentPosition={sessionIndex + 1}
          totalCount={totalCount}
          canUndo={undoStack.length > 0}
          isBusy={actionBusy}
        />

        <div className="actions-row" style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            className="touch-target-inline"
            onClick={handleChangeFolder}
            style={{
              fontSize: '0.8125rem',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Change folder
          </button>
          <button
            type="button"
            className="touch-target-inline"
            onClick={handleLogout}
            style={{
              fontSize: '0.8125rem',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
