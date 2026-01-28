/**
 * OAuth callback function
 * Handles Dropbox OAuth callback, validates state, exchanges code for tokens,
 * and enforces access control
 */

import { Dropbox } from 'dropbox';

type HandlerEvent = {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  cookies?: string[];
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

/**
 * Parse cookies from request
 */
function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Get state from cookies or query params
 */
function getState(event: HandlerEvent): string | undefined {
  // Try cookies first (more secure)
  const cookieHeader = event.headers.cookie || event.headers.Cookie;
  const cookies = parseCookies(cookieHeader);
  if (cookies.picsift_oauth_state) {
    return cookies.picsift_oauth_state;
  }

  // Fallback to query params (for client-side validation)
  return event.queryStringParameters?.state;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  account_id: string;
  email: string;
}> {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const redirectUri = getRedirectUri();

  if (!appKey || !appSecret) {
    throw new Error('DROPBOX_APP_KEY and DROPBOX_APP_SECRET must be configured');
  }

  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    account_id?: string;
  };

  // Get account info to verify access
  const dbx = new Dropbox({ accessToken: data.access_token });
  const accountInfo = await dbx.usersGetCurrentAccount();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    account_id: accountInfo.result.account_id,
    email: accountInfo.result.email,
  };
}

/**
 * Get OAuth redirect URI (must match auth_start)
 */
function getRedirectUri(): string {
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL;
  const baseUrl = netlifyUrl || siteUrl || 'http://localhost:8888';
  return `${baseUrl}/.netlify/functions/auth_callback`;
}

/**
 * Check if account is authorized
 */
function isAuthorizedAccount(accountId: string, email: string): boolean {
  const authorizedAccountId = process.env.AUTHORIZED_DROPBOX_ACCOUNT_ID;
  const authorizedEmail = process.env.AUTHORIZED_DROPBOX_EMAIL;

  // If no authorization configured, allow all (development mode)
  if (!authorizedAccountId && !authorizedEmail) {
    return true;
  }

  // Check account ID (preferred)
  if (authorizedAccountId && accountId === authorizedAccountId) {
    return true;
  }

  // Check email (fallback)
  if (authorizedEmail && email === authorizedEmail) {
    return true;
  }

  return false;
}

export const handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get authorization code and state from query params
    const code = event.queryStringParameters?.code;
    const state = getState(event);
    const stateParam = event.queryStringParameters?.state;

    if (!code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing authorization code' }),
      };
    }

    // Validate state parameter (CSRF protection)
    if (!state || !stateParam || state !== stateParam) {
      console.error('[SECURITY] OAuth state mismatch');
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid state parameter',
          message: 'Access denied. This app is restricted to authorized users only.',
        }),
      };
    }

    // Exchange code for tokens
    const { refresh_token, account_id, email } =
      await exchangeCodeForTokens(code);

    // Access control check: verify user is authorized
    if (!isAuthorizedAccount(account_id, email)) {
      console.error(
        `[SECURITY] Unauthorized access attempt: account_id=${account_id}, email=${email}`,
      );
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Access denied',
          message: 'Access denied. This app is restricted to authorized users only.',
        }),
      };
    }

    // Store refresh token securely
    // Note: In production, store this in Netlify environment variables or encrypted storage
    // For MVP, we'll return it to the client to store (not ideal, but functional)
    // TODO: Implement secure server-side token storage

    // Clear state cookie
    const clearCookieHeader =
      'picsift_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

    // Return success with account info
    // In production, you'd want to store the refresh token server-side
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookieHeader,
      },
      body: JSON.stringify({
        success: true,
        account_id,
        email,
        // Note: In production, don't return refresh_token to client
        // Store it server-side instead
        refresh_token, // Temporary: for MVP, client stores this
        message:
          'IMPORTANT: Store DROPBOX_REFRESH_TOKEN in Netlify environment variables. Do not commit to git.',
      }),
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Authentication failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
