/**
 * Main App component
 * Handles authentication flow and routing
 */

import { useState, useEffect } from 'react';
import Login from './components/Login';
import FolderSelector from './components/FolderSelector';
import { checkAuthCallback } from './api';
import type { AuthState, FolderInfo } from './types';

const AUTH_STORAGE_KEY = 'picsift:auth';
const FOLDER_PREFERENCE_KEY = 'picsift:selectedFolder';

type AppState = 'loading' | 'login' | 'folder-selection' | 'ready';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [, setAuthState] = useState<AuthState>({
    is_authenticated: false,
  });
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(
    null,
  );

  useEffect(() => {
    void initializeApp();
  }, []);

  /**
   * Initialize app: check for OAuth callback, load saved auth state, check for folder preference
   */
  const initializeApp = async () => {
    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      // Handle OAuth callback
      try {
        const response = await checkAuthCallback();
        if (response.success && response.account_id) {
          // Save auth state
          const newAuthState: AuthState = {
            is_authenticated: true,
            account_id: response.account_id,
          };
          setAuthState(newAuthState);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));

          // Clear OAuth params from URL
          window.history.replaceState({}, '', window.location.pathname);

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
          // Auth failed
          setAppState('login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setAppState('login');
      }
    } else {
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
