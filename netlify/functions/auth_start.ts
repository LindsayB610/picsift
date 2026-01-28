/**
 * OAuth start function
 * Initiates Dropbox OAuth flow with CSRF protection
 */

import { randomBytes } from 'crypto';

type HandlerEvent = {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

/**
 * Generate secure random state parameter for CSRF protection
 */
function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get OAuth redirect URI
 */
function getRedirectUri(): string {
  // In production, use custom domain or Netlify URL
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL; // Netlify auto-provides this
  const baseUrl = netlifyUrl || siteUrl || 'http://localhost:8888';
  return `${baseUrl}/.netlify/functions/auth_callback`;
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
    const appKey = process.env.DROPBOX_APP_KEY;
    if (!appKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'DROPBOX_APP_KEY not configured' }),
      };
    }

    // Generate state parameter for CSRF protection
    const state = generateState();

    // Build OAuth URL
    const redirectUri = getRedirectUri();
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', appKey);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('token_access_type', 'offline'); // Request refresh token
    authUrl.searchParams.set('state', state);

    // Return redirect URL with state
    // Store state in cookie for validation in callback
    const cookieHeader = `picsift_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
      body: JSON.stringify({
        redirect_url: authUrl.toString(),
        state: state, // Also return in body for client-side storage as backup
      }),
    };
  } catch (error) {
    console.error('OAuth start error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to initiate OAuth flow',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
