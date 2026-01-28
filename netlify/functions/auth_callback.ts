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
 * Get app base URL for redirecting after auth
 * For local dev, always use localhost:8888 (frontend port)
 * In production, use the actual site URL
 */
function getAppBaseUrl(): string {
  // In production, use custom domain or Netlify URL
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL;
  
  // For local development, always redirect to the frontend port (8888)
  // process.env.URL in Netlify Dev points to the function server, not the frontend
  if (!netlifyUrl && (!siteUrl || siteUrl.includes('localhost'))) {
    return 'http://localhost:8888';
  }
  
  // In production, use the actual site URL
  return netlifyUrl || siteUrl || 'http://localhost:8888';
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
    const appBase = getAppBaseUrl();

    // Get authorization code and state from query params
    const code = event.queryStringParameters?.code;
    const state = getState(event);
    const stateParam = event.queryStringParameters?.state;

    if (!code) {
      const redirectUrl = `${appBase}/?auth=error&message=${encodeURIComponent('Missing authorization code')}`;
      return { statusCode: 302, headers: { Location: redirectUrl } };
    }

    // Validate state parameter (CSRF protection)
    if (!state || !stateParam || state !== stateParam) {
      console.error('[SECURITY] OAuth state mismatch');
      const redirectUrl = `${appBase}/?auth=error&message=${encodeURIComponent('Invalid state parameter')}`;
      return { statusCode: 302, headers: { Location: redirectUrl } };
    }

    // Exchange code for tokens
    const { refresh_token, account_id, email } =
      await exchangeCodeForTokens(code);

    // Access control check: verify user is authorized
    // TEMPORARILY DISABLED for local dev to make testing easier
    // In production, this should be enabled
    const isLocalDev = !process.env.NETLIFY && process.env.NODE_ENV !== 'production';
    if (!isAuthorizedAccount(account_id, email) && !isLocalDev) {
      // Only enforce in production
      console.error(
        `[SECURITY] Unauthorized access attempt: account_id=${account_id}, email=${email}`,
      );
      const redirectUrl = `${appBase}/?auth=error&message=${encodeURIComponent('Access denied. This app is restricted to authorized users only.')}`;
      return { statusCode: 302, headers: { Location: redirectUrl } };
    }
    
    // In local dev, just log the account info
    if (isLocalDev) {
      console.log(`[AUTH] Authenticated: account_id=${account_id}, email=${email}`);
    }

    // Clear state cookie
    const clearCookieHeader =
      'picsift_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

    // In local dev, log the refresh token so user can update .env
    if (isLocalDev) {
      console.log('='.repeat(80));
      console.log('[AUTH] NEW REFRESH TOKEN (update your .env file):');
      console.log(`DROPBOX_REFRESH_TOKEN=${refresh_token}`);
      console.log(`AUTHORIZED_DROPBOX_ACCOUNT_ID=${account_id}`);
      console.log('='.repeat(80));
    }

    // Redirect to app with success so user lands on the app, not raw JSON
    const redirectUrl = `${appBase}/?auth=success&account_id=${encodeURIComponent(account_id)}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        'Set-Cookie': clearCookieHeader,
      },
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    const redirectUrl = `${getAppBaseUrl()}/?auth=error&message=${encodeURIComponent(message)}`;
    return { statusCode: 302, headers: { Location: redirectUrl } };
  }
};
