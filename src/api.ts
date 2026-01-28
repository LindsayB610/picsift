/**
 * Frontend API client for Netlify Functions
 */

import type {
  AuthStartResponse,
  AuthCallbackResponse,
  DiscoverFoldersResponse,
  ApiError,
} from './types';

const FUNCTIONS_BASE = '/.netlify/functions';

/**
 * Handle API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(error.message || `API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Start OAuth flow
 */
export async function startAuth(): Promise<AuthStartResponse> {
  const response = await fetch(`${FUNCTIONS_BASE}/auth_start`);
  return handleResponse<AuthStartResponse>(response);
}

/**
 * Check auth callback (called after OAuth redirect)
 */
export async function checkAuthCallback(): Promise<AuthCallbackResponse> {
  // Get code and state from URL
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    return {
      success: false,
      error: 'Missing authorization code or state',
    };
  }

  // Call callback function
  const callbackUrl = `${FUNCTIONS_BASE}/auth_callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const response = await fetch(callbackUrl, {
    credentials: 'include', // Include cookies
  });

  return handleResponse<AuthCallbackResponse>(response);
}

/**
 * Discover folders with images
 */
export async function discoverFolders(
  maxDepth: number = 3,
): Promise<DiscoverFoldersResponse> {
  const response = await fetch(
    `${FUNCTIONS_BASE}/discover_folders?max_depth=${maxDepth}`,
  );
  return handleResponse<DiscoverFoldersResponse>(response);
}
