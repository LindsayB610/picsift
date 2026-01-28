/**
 * Shared Dropbox API helper functions
 * Handles token management, refresh, and validation
 */

// Load .env file for local development (Netlify Dev doesn't auto-load .env)
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  } catch {
    // dotenv not available, continue without it
  }
}

import { Dropbox } from 'dropbox';
import type { DropboxResponse } from 'dropbox';

// Token cache (in-memory, short-lived)
interface TokenCache {
  access_token: string;
  account_id: string;
  expires_at: number; // Unix timestamp
}

let tokenCache: TokenCache | null = null;
const TOKEN_CACHE_TTL = 55 * 60 * 1000; // 55 minutes (tokens expire in 1 hour)

/**
 * Get refresh token from environment
 */
function getRefreshToken(): string {
  const token = process.env.DROPBOX_REFRESH_TOKEN;
  if (!token) {
    throw new Error('DROPBOX_REFRESH_TOKEN not configured');
  }
  return token;
}

/**
 * Get authorized account ID or email from environment
 */
function getAuthorizedAccountId(): string | undefined {
  return process.env.AUTHORIZED_DROPBOX_ACCOUNT_ID;
}

function getAuthorizedEmail(): string | undefined {
  return process.env.AUTHORIZED_DROPBOX_EMAIL;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<{
  access_token: string;
  account_id: string;
}> {
  const refreshToken = getRefreshToken();
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error('DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be configured');
  }

  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[DROPBOX] Token refresh failed: ${response.status} ${errorText}`,
    );
    throw new Error(
      `Token refresh failed: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    account_id?: string;
  };

  // Get account ID from token if not provided
  let accountId = data.account_id;
  if (!accountId) {
    // Validate token and get account ID
    const dbx = new Dropbox({ accessToken: data.access_token });
    const accountInfo = await dbx.usersGetCurrentAccount();
    accountId = accountInfo.result.account_id;
  }

  return {
    access_token: data.access_token,
    account_id: accountId,
  };
}

/**
 * Validate that access token belongs to authorized user
 */
async function validateTokenAccount(
  accessToken: string,
  accountId: string,
): Promise<boolean> {
  const authorizedAccountId = getAuthorizedAccountId();
  const authorizedEmail = getAuthorizedEmail();

  // If no authorization configured, allow all (development mode)
  if (!authorizedAccountId && !authorizedEmail) {
    return true;
  }

  // Validate by account ID (preferred)
  if (authorizedAccountId) {
    const matches = accountId === authorizedAccountId;
    if (!matches) {
      console.error(
        `[TOKEN VALIDATION] Account ID mismatch: expected "${authorizedAccountId}", got "${accountId}"`,
      );
    }
    return matches;
  }

  // Validate by email (fallback)
  if (authorizedEmail) {
    const dbx = new Dropbox({ accessToken });
    const accountInfo = await dbx.usersGetCurrentAccount();
    return accountInfo.result.email === authorizedEmail;
  }

  return false;
}

/**
 * Get valid access token (with caching and refresh)
 */
export async function getAccessToken(): Promise<string> {
  // Check cache
  if (
    tokenCache &&
    tokenCache.expires_at > Date.now() &&
    tokenCache.account_id
  ) {
    // Validate cached token still belongs to authorized user
    const isValid = await validateTokenAccount(
      tokenCache.access_token,
      tokenCache.account_id,
    );
    if (isValid) {
      return tokenCache.access_token;
    }
    // Token is invalid, clear cache
    tokenCache = null;
  }

  // Refresh token
  const { access_token, account_id } = await refreshAccessToken();

  // Validate new token belongs to authorized user
  // TEMPORARILY DISABLED for local dev to make testing easier
  // In production, this should be enabled
  const isLocalDev = !process.env.NETLIFY && process.env.NODE_ENV !== 'production';
  const authorizedAccountId = getAuthorizedAccountId();
  const authorizedEmail = getAuthorizedEmail();
  
  if ((authorizedAccountId || authorizedEmail) && !isLocalDev) {
    // Only validate in production
    const isValid = await validateTokenAccount(access_token, account_id);
    if (!isValid) {
      console.error(
        `[SECURITY] Token validation failed: account_id ${account_id} is not authorized (expected: ${authorizedAccountId || authorizedEmail})`,
      );
      throw new Error('Unauthorized: Token does not belong to authorized user');
    }
  } else if (isLocalDev) {
    // In local dev, just log
    console.log(`[DROPBOX] Using token for account_id: ${account_id}`);
  }

  // Cache token
  tokenCache = {
    access_token,
    account_id,
    expires_at: Date.now() + TOKEN_CACHE_TTL,
  };

  return access_token;
}

/**
 * Create Dropbox client with valid access token
 */
export async function createDropboxClient(): Promise<Dropbox> {
  const accessToken = await getAccessToken();
  return new Dropbox({ accessToken });
}

/**
 * Generic Dropbox API call wrapper
 * Handles token refresh, validation, and error handling
 */
export async function dbxCall<T>(
  apiCall: (dbx: Dropbox) => Promise<DropboxResponse<T>>,
): Promise<T> {
  try {
    const dbx = await createDropboxClient();
    const response = await apiCall(dbx);
    return response.result;
  } catch (error) {
    // Log the full error for debugging
    console.error('[DROPBOX] API call error:', error);
    if (error instanceof Error) {
      console.error('[DROPBOX] Error message:', error.message);
      console.error('[DROPBOX] Error stack:', error.stack);
    }
    
    // Try to extract Dropbox-specific error details
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if ('error' in errorObj) {
        console.error('[DROPBOX] Dropbox error field:', errorObj.error);
      }
      if ('status' in errorObj) {
        console.error('[DROPBOX] HTTP status:', errorObj.status);
      }
      if ('statusText' in errorObj) {
        console.error('[DROPBOX] HTTP status text:', errorObj.statusText);
      }
      // DropboxResponseError might have error_summary or error_tag
      if ('error_summary' in errorObj) {
        console.error('[DROPBOX] Error summary:', errorObj.error_summary);
      }
      if ('error_tag' in errorObj) {
        console.error('[DROPBOX] Error tag:', errorObj.error_tag);
      }
    }

    // Handle token errors
    if (
      error instanceof Error &&
      (error.message.includes('expired') ||
        error.message.includes('invalid_token') ||
        error.message.includes('401') ||
        error.message.includes('400'))
    ) {
      // Clear cache and retry once
      console.log('[DROPBOX] Token error detected, clearing cache and retrying...');
      tokenCache = null;
      const dbx = await createDropboxClient();
      const response = await apiCall(dbx);
      return response.result;
    }
    throw error;
  }
}

/**
 * Clear token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
