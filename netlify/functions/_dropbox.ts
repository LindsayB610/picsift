/**
 * Shared Dropbox API helper functions
 * Handles token management, refresh, and validation
 */

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
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
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
    return accountId === authorizedAccountId;
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
  const isValid = await validateTokenAccount(access_token, account_id);
  if (!isValid) {
    // Security event: token doesn't belong to authorized user
    console.error(
      `[SECURITY] Token validation failed: account_id ${account_id} is not authorized`,
    );
    throw new Error('Unauthorized: Token does not belong to authorized user');
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
    // Handle token errors
    if (
      error instanceof Error &&
      (error.message.includes('expired') ||
        error.message.includes('invalid_token') ||
        error.message.includes('401'))
    ) {
      // Clear cache and retry once
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
