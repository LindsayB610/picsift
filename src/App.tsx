/**
 * Main App component
 * Handles authentication flow and routing
 */

import { useState, useEffect } from 'react';
import Login from './components/Login';
import FolderSelector from './components/FolderSelector';
import { useAuthCallback } from './hooks/useAuth';
import type { AuthState, FolderInfo } from './types';

const AUTH_STORAGE_KEY = 'picsift:auth';
const FOLDER_PREFERENCE_KEY = 'picsift:selectedFolder';

type AppState = 'loading' | 'login' | 'setup' | 'folder-selection' | 'ready';

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
      style={{
        maxWidth: '560px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontFamily: 'var(--sans)', color: 'var(--text-h)', margin: 0, fontSize: '1.5rem' }}>
        One more step
      </h1>
      <p style={{ color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
        Add these two values in Netlify so the app can use your Dropbox:
      </p>
      <ol style={{ color: 'var(--text)', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
        <li>Open your Netlify dashboard → your PicSift site.</li>
        <li>Go to <strong>Site configuration</strong> → <strong>Environment variables</strong>.</li>
        <li>Click <strong>Add a variable</strong> (or edit if they exist) and add the two below.</li>
        <li>Go to <strong>Deploys</strong> → <strong>Trigger deploy</strong> → <strong>Deploy site</strong>.</li>
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
            DROPBOX_REFRESH_TOKEN
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={tokens.refreshToken}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary, #f5f5f5)',
              }}
            />
            <button
              type="button"
              onClick={() => copyToClipboard(tokens.refreshToken)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--accent, #0061ff)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Copy
            </button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
            AUTHORIZED_DROPBOX_ACCOUNT_ID
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={tokens.accountId}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary, #f5f5f5)',
              }}
            />
            <button
              type="button"
              onClick={() => copyToClipboard(tokens.accountId)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--accent, #0061ff)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.9rem' }}>
        After you’ve added both and triggered a new deploy, click below.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: 'var(--accent, #0061ff)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          I’ve added them, continue
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border, #e5e4e7)',
            borderRadius: '6px',
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

  if (appState === 'loading') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>Loading...</p>
      </main>
    );
  }

  if (appState === 'login') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <Login />
      </main>
    );
  }

  if (appState === 'setup') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
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
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <FolderSelector
          onFolderSelected={handleFolderSelected}
          onCancel={handleLogout}
        />
      </main>
    );
  }

  // appState === 'ready'
  // TODO: Show main app (Viewer, Controls, etc.) in Phase 5
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '2rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--sans)', color: 'var(--text-h)', margin: 0 }}>
          PicSift
        </h1>
        <p style={{ color: 'var(--text)', margin: '1rem 0 0 0' }}>
          Ready to start! Selected folder: {selectedFolder?.name}
        </p>
        <p style={{ color: 'var(--text)', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>
          {selectedFolder?.image_count} images to review
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleChangeFolder}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border, #e5e4e7)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Change Folder
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border, #e5e4e7)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          padding: '2rem',
          backgroundColor: 'var(--bg-secondary, #f5f5f5)',
          borderRadius: '8px',
          maxWidth: '600px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--text)', margin: 0 }}>
          Main app interface coming in Phase 5
        </p>
      </div>
    </main>
  );
}
