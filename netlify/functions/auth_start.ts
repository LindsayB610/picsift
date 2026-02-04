/**
 * OAuth start function
 * Initiates Dropbox OAuth flow with CSRF protection
 */

import { randomBytes } from "crypto";
import { normalizeError } from "./_utils";

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
  return randomBytes(32).toString("hex");
}

/**
 * Get OAuth redirect URI (must be HTTPS in production for Dropbox)
 */
function getRedirectUri(): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/.netlify/functions/auth_callback`;
}

/**
 * Get site base URL. Production must use HTTPS or Dropbox shows "doesn't support secure connections".
 */
function getBaseUrl(): string {
  const netlifyUrl = process.env.NETLIFY_URL;
  const siteUrl = process.env.URL;
  let base = netlifyUrl || siteUrl || "http://localhost:8888";
  // Force HTTPS in production (non-localhost) so Dropbox accepts the redirect URI
  if (!base.includes("localhost") && base.startsWith("http://")) {
    base = base.replace(/^http:\/\//i, "https://");
  }
  return base;
}

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  await Promise.resolve();
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const appKey = process.env.DROPBOX_APP_KEY;
    if (!appKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "DROPBOX_APP_KEY not configured" }),
      };
    }

    // Generate state parameter for CSRF protection
    const state = generateState();

    // Build OAuth URL
    const redirectUri = getRedirectUri();
    const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", appKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("token_access_type", "offline"); // Request refresh token
    authUrl.searchParams.set("state", state);

    // Return redirect URL with state
    // Store state in cookie for validation in callback
    // Secure only when on HTTPS (required for production; omit on localhost so cookie is sent)
    const baseUrl = getBaseUrl();
    const isSecure = baseUrl.startsWith("https://");
    const cookieHeader = `picsift_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${isSecure ? "; Secure" : ""}`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
      body: JSON.stringify({
        redirect_url: authUrl.toString(),
        state: state, // Also return in body for client-side storage as backup
      }),
    };
  } catch (err: unknown) {
    console.error("OAuth start error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to initiate OAuth flow",
        message: normalizeError(err),
      }),
    };
  }
};
