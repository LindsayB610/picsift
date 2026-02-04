/**
 * Frontend API client for Netlify Functions
 */

import type {
  AuthStartResponse,
  AuthCallbackResponse,
  DiscoverFoldersResponse,
  ListResponse,
  TempLinkResponse,
  TrashResponse,
  UndoResponse,
  ApiError,
} from './types';

const FUNCTIONS_BASE = '/.netlify/functions';

/**
 * Handle API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError & { error?: string };
    const message = error.message || error.error || `API error: ${response.status}`;
    throw new Error(message);
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

/**
 * List images in a folder (or multiple folders)
 */
export async function listImages(
  pathOrPaths: string | string[],
): Promise<ListResponse> {
  const body =
    typeof pathOrPaths === 'string'
      ? JSON.stringify({ path: pathOrPaths })
      : JSON.stringify({ paths: pathOrPaths });
  const response = await fetch(`${FUNCTIONS_BASE}/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return handleResponse<ListResponse>(response);
}

/**
 * Get a temporary URL for displaying an image (expires in 4 hours)
 */
export async function getTempLink(path: string): Promise<TempLinkResponse> {
  const response = await fetch(`${FUNCTIONS_BASE}/temp_link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return handleResponse<TempLinkResponse>(response);
}

/**
 * Move a file to quarantine (soft delete)
 */
export async function trash(
  path: string,
  sessionId: string,
): Promise<TrashResponse> {
  const response = await fetch(`${FUNCTIONS_BASE}/trash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, session_id: sessionId }),
  });
  return handleResponse<TrashResponse>(response);
}

/**
 * Restore a file from quarantine (undo)
 */
export async function undo(
  trashedPath: string,
  originalPath: string,
): Promise<UndoResponse> {
  const response = await fetch(`${FUNCTIONS_BASE}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trashed_path: trashedPath,
      original_path: originalPath,
    }),
  });
  return handleResponse<UndoResponse>(response);
}
