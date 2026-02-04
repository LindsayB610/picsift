/**
 * OAuth callback function
 * Handles Dropbox OAuth callback, validates state, exchanges code for tokens,
 * and enforces access control
 */

import { Dropbox } from 'dropbox';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { normalizeError } from './_utils';

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
 * Get site base URL. Production must use HTTPS.
 */
function getBaseUrl(): string {
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL;
  let base = netlifyUrl || siteUrl || 'http://localhost:8888';
  if (!base.includes('localhost') && base.startsWith('http://')) {
    base = base.replace(/^http:\/\//i, 'https://');
  }
  return base;
}

/**
 * Get OAuth redirect URI (must match auth_start)
 */
function getRedirectUri(): string {
  return `${getBaseUrl()}/.netlify/functions/auth_callback`;
}

/**
 * Get app base URL for redirecting after auth
 * For local dev, always use localhost:8888 (frontend port)
 * In production, use the actual site URL (HTTPS)
 */
function getAppBaseUrl(): string {
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL;
  // For local development, always redirect to the frontend port (8888)
  if (!netlifyUrl && (!siteUrl || siteUrl.includes('localhost'))) {
    return 'http://localhost:8888';
  }
  let base = netlifyUrl || siteUrl || 'http://localhost:8888';
  if (!base.includes('localhost') && base.startsWith('http://')) {
    base = base.replace(/^http:\/\//i, 'https://');
  }
  return base;
}

/**
 * Check if account is authorized (only this account can use the app)
 */
function isAuthorizedAccount(accountId: string, email: string): boolean {
  const authorizedAccountId = process.env.AUTHORIZED_DROPBOX_ACCOUNT_ID;
  const authorizedEmail = process.env.AUTHORIZED_DROPBOX_EMAIL;
  const isLocalDev = !process.env.NETLIFY && process.env.NODE_ENV !== 'production';

  // In production: require at least one to be set; otherwise reject everyone (fail closed)
  if (!isLocalDev && !authorizedAccountId && !authorizedEmail) {
    return false;
  }

  // Local dev: if none configured, allow all for easier testing
  if (isLocalDev && !authorizedAccountId && !authorizedEmail) {
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

    // Clear state cookie (Secure only when on HTTPS)
    const isSecure = appBase.startsWith('https://');
    const clearCookieHeader =
      `picsift_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isSecure ? '; Secure' : ''}`;

    // In local dev, automatically update .env file with new tokens
    if (isLocalDev) {
      try {
        const envPath = join(process.cwd(), '.env');
        let envContent = readFileSync(envPath, 'utf-8');
        
        // Update DROPBOX_REFRESH_TOKEN
        envContent = envContent.replace(
          /^DROPBOX_REFRESH_TOKEN=.*$/m,
          `DROPBOX_REFRESH_TOKEN=${refresh_token}`,
        );
        
        // Update AUTHORIZED_DROPBOX_ACCOUNT_ID
        envContent = envContent.replace(
          /^AUTHORIZED_DROPBOX_ACCOUNT_ID=.*$/m,
          `AUTHORIZED_DROPBOX_ACCOUNT_ID=${account_id}`,
        );
        
        writeFileSync(envPath, envContent, 'utf-8');
        console.log('='.repeat(80));
        console.log('[AUTH] ✅ Automatically updated .env file with new tokens!');
        console.log(`DROPBOX_REFRESH_TOKEN=${refresh_token}`);
        console.log(`AUTHORIZED_DROPBOX_ACCOUNT_ID=${account_id}`);
        console.log('='.repeat(80));
        console.log('[AUTH] ⚠️  Restart the server to load the new tokens.');
      } catch (envErr: unknown) {
        // If auto-update fails, just log the values
        console.log('='.repeat(80));
        console.log('[AUTH] ⚠️  Could not auto-update .env file. Please update manually:');
        console.log(`DROPBOX_REFRESH_TOKEN=${refresh_token}`);
        console.log(`AUTHORIZED_DROPBOX_ACCOUNT_ID=${account_id}`);
        console.log('='.repeat(80));
        console.error('[AUTH] Error updating .env:', envErr);
      }
    }

    // In production: log tokens so you can copy from Netlify function logs (URL fragment is unreliable for long tokens)
    if (!isLocalDev) {
      console.log('[AUTH] Add these to Netlify → Site configuration → Environment variables, then trigger a new deploy:');
      console.log('DROPBOX_REFRESH_TOKEN=' + refresh_token);
      console.log('AUTHORIZED_DROPBOX_ACCOUNT_ID=' + account_id);
    }

    // Redirect to app with success (no token in URL; get token from Netlify → Functions → auth_callback → Logs)
    const redirectUrl = `${appBase}/?auth=success&account_id=${encodeURIComponent(account_id)}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        'Set-Cookie': clearCookieHeader,
      },
    };
  } catch (err: unknown) {
    console.error('OAuth callback error:', err);
    const message = normalizeError(err);
    const redirectUrl = `${getAppBaseUrl()}/?auth=error&message=${encodeURIComponent(message)}`;
    return { statusCode: 302, headers: { Location: redirectUrl } };
  }
};
