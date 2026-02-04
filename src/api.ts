/**
 * Frontend API client for Netlify Functions
 * Phase 7: normalized errors, optional retry for transient failures.
 */

import { normalizeError } from './utils/error';
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

/** Thrown by handleResponse; status preserved for error classification */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Parse API response; throw ApiClientError with normalized message and status.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string;
    try {
      const body = (await response.json()) as ApiError & { error?: string };
      message = body.message ?? body.error ?? `Request failed (${response.status})`;
    } catch {
      message = `Request failed (${response.status}). Please try again.`;
    }
    throw new ApiClientError(message, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch (err: unknown) {
    throw new ApiClientError(normalizeError(err), response.status);
  }
}

/** Retry once on network failure or 429/5xx */
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, init);
      const retryable =
        !response.ok &&
        (RETRYABLE_STATUSES.includes(response.status) ||
          response.status >= 500);
      if (!retryable) return response;
      lastErr = new ApiClientError(
        `Request failed (${response.status}). Please try again.`,
        response.status,
      );
    } catch (err: unknown) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Start OAuth flow
 */
export async function startAuth(): Promise<AuthStartResponse> {
  const response = await fetchWithRetry(`${FUNCTIONS_BASE}/auth_start`);
  return handleResponse<AuthStartResponse>(response);
}

/**
 * Check auth callback (called after OAuth redirect)
 * No retry: auth callback is one-time.
 */
export async function checkAuthCallback(): Promise<AuthCallbackResponse> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    return {
      success: false,
      error: 'Missing authorization code or state',
    };
  }

  const callbackUrl = `${FUNCTIONS_BASE}/auth_callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  const response = await fetch(callbackUrl, {
    credentials: 'include',
  });
  return handleResponse<AuthCallbackResponse>(response);
}

/**
 * Discover folders with images
 */
export async function discoverFolders(
  maxDepth: number = 3,
): Promise<DiscoverFoldersResponse> {
  const response = await fetchWithRetry(
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
  const response = await fetchWithRetry(`${FUNCTIONS_BASE}/list`, {
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
  const response = await fetchWithRetry(`${FUNCTIONS_BASE}/temp_link`, {
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
  const response = await fetchWithRetry(`${FUNCTIONS_BASE}/trash`, {
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
  const response = await fetchWithRetry(`${FUNCTIONS_BASE}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trashed_path: trashedPath,
      original_path: originalPath,
    }),
  });
  return handleResponse<UndoResponse>(response);
}
