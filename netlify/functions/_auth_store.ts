/**
 * Server-side auth storage using Netlify Blob.
 * Stores refresh token, account_id, and session_entries (one per device with last_activity) so we never log or expose tokens.
 * Sessions expire after a period of inactivity (default 30 min, configurable via PICSIFT_SESSION_INACTIVITY_MINUTES).
 */

import { randomBytes } from "crypto";
import { getStore } from "@netlify/blobs";

const AUTH_STORE_NAME = "picsift-auth";
const AUTH_BLOB_KEY = "dropbox";

export const SESSION_COOKIE_NAME = "picsift_session";

/** Inactivity timeout: default 30 minutes. Override with PICSIFT_SESSION_INACTIVITY_MINUTES. */
const DEFAULT_INACTIVITY_MINUTES = 30;
/** Only update last_activity in Blob at most this often to reduce writes. */
const ACTIVITY_UPDATE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionEntry {
  secret: string;
  last_activity: number; // Unix ms
}

export interface StoredAuth {
  refresh_token: string;
  account_id: string;
  /** Legacy: single session (old blobs). */
  session_secret?: string;
  /** Legacy: array of secrets without timestamps. */
  session_secrets?: string[];
  /** One entry per device; used for inactivity expiry. */
  session_entries?: SessionEntry[];
}

function getInactivityMs(): number {
  const minutes = process.env.PICSIFT_SESSION_INACTIVITY_MINUTES;
  const n = minutes ? parseInt(minutes, 10) : DEFAULT_INACTIVITY_MINUTES;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_INACTIVITY_MINUTES * 60 * 1000;
  return Math.min(n, 60 * 24 * 365) * 60 * 1000; // cap at 1 year
}

/**
 * Read stored auth from Blob (production). Returns null if not found or not on Netlify.
 */
export async function getAuthFromBlob(): Promise<StoredAuth | null> {
  try {
    if (!process.env.NETLIFY) return null;
    const store = getStore(AUTH_STORE_NAME);
    const raw = await store.get(AUTH_BLOB_KEY);
    if (!raw || typeof raw !== "string") return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "refresh_token" in parsed &&
      "account_id" in parsed &&
      typeof (parsed as StoredAuth).refresh_token === "string" &&
      typeof (parsed as StoredAuth).account_id === "string"
    ) {
      return parsed as StoredAuth;
    }
    return null;
  } catch {
    return null;
  }
}

/** Normalize blob data to session_entries (for backward compat with session_secret / session_secrets). */
function getSessionEntries(auth: StoredAuth | null): SessionEntry[] {
  if (!auth) return [];
  const now = Date.now();
  if (Array.isArray(auth.session_entries) && auth.session_entries.length > 0)
    return auth.session_entries;
  if (Array.isArray(auth.session_secrets) && auth.session_secrets.length > 0)
    return auth.session_secrets.map((secret) => ({ secret, last_activity: now }));
  if (auth.session_secret && auth.session_secret.length > 0)
    return [{ secret: auth.session_secret, last_activity: now }];
  return [];
}

function getSessionSecretsList(auth: StoredAuth | null): string[] {
  return getSessionEntries(auth).map((e) => e.secret);
}

/**
 * Verify that the cookie is a valid session and not expired by inactivity.
 * If valid, optionally updates last_activity in Blob (throttled). If expired, removes that session.
 */
export async function verifySessionCookie(
  sessionCookieValue: string | undefined
): Promise<boolean> {
  if (!sessionCookieValue || typeof sessionCookieValue !== "string") return false;
  if (!process.env.NETLIFY) return true; // local dev: no Blob, skip session check
  const auth = await getAuthFromBlob();
  if (!auth) return false;
  const entries = getSessionEntries(auth);
  const now = Date.now();
  const inactivityMs = getInactivityMs();
  const entry = entries.find((e) => e.secret === sessionCookieValue);
  if (!entry) return false;
  if (now - entry.last_activity > inactivityMs) {
    // Session expired by inactivity: remove it
    const remaining = entries.filter((e) => e.secret !== sessionCookieValue);
    await writeAuthWithEntries(auth, remaining);
    return false;
  }
  // Valid: optionally refresh last_activity (throttle blob writes)
  if (entry && now - entry.last_activity > ACTIVITY_UPDATE_THROTTLE_MS) {
    const updated = entries.map((e) =>
      e.secret === sessionCookieValue ? { ...e, last_activity: now } : e
    );
    await writeAuthWithEntries(auth, updated);
  }
  return true;
}

/** Write blob with given session_entries (and existing token/account_id). */
async function writeAuthWithEntries(
  auth: StoredAuth,
  session_entries: SessionEntry[]
): Promise<void> {
  if (!process.env.NETLIFY) return;
  const store = getStore(AUTH_STORE_NAME);
  if (session_entries.length === 0) {
    await store.delete(AUTH_BLOB_KEY);
    return;
  }
  await store.set(
    AUTH_BLOB_KEY,
    JSON.stringify({
      refresh_token: auth.refresh_token,
      account_id: auth.account_id,
      session_entries,
    } as StoredAuth)
  );
}

/**
 * Parse request cookies and return the session cookie value.
 */
export function getSessionCookieFromEvent(event: {
  headers?: Record<string, string>;
}): string | undefined {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie;
  if (!cookieHeader) return undefined;
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((part) => {
    const [name, value] = part.trim().split("=");
    if (name && value) cookies[name] = decodeURIComponent(value);
  });
  return cookies[SESSION_COOKIE_NAME];
}

/**
 * Write auth to Blob (production only). Generates one session and returns its secret.
 * Use for first login or when a different account logs in (replaces existing).
 */
export async function setAuthInBlob(
  refresh_token: string,
  account_id: string
): Promise<string | null> {
  if (!process.env.NETLIFY) return null;
  const secret = randomBytes(32).toString("hex");
  const session_entries: SessionEntry[] = [
    { secret, last_activity: Date.now() },
  ];
  await writeAuthWithEntries(
    { refresh_token, account_id, session_entries } as StoredAuth,
    session_entries
  );
  return secret;
}

/**
 * Add a new device session for the same account (e.g. login from phone when already logged in on desktop).
 * Updates refresh_token if provided. Returns the new session secret, or null if blob missing or different account.
 */
export async function addSessionToAuth(
  account_id: string,
  refresh_token?: string
): Promise<string | null> {
  if (!process.env.NETLIFY) return null;
  const auth = await getAuthFromBlob();
  if (!auth || auth.account_id !== account_id) return null;
  const newSecret = randomBytes(32).toString("hex");
  const existingEntries = getSessionEntries(auth);
  const session_entries: SessionEntry[] = [
    ...existingEntries,
    { secret: newSecret, last_activity: Date.now() },
  ];
  await writeAuthWithEntries(
    {
      refresh_token: refresh_token ?? auth.refresh_token,
      account_id: auth.account_id,
      session_entries,
    } as StoredAuth,
    session_entries
  );
  return newSecret;
}

/**
 * Remove this device's session from Blob (logout this device only).
 * If no sessions remain, deletes the blob so the next login starts fresh.
 */
export async function removeSessionFromBlob(
  sessionCookieValue: string | undefined
): Promise<void> {
  if (!sessionCookieValue || !process.env.NETLIFY) return;
  const auth = await getAuthFromBlob();
  if (!auth) return;
  const entries = getSessionEntries(auth);
  const remaining = entries.filter((e) => e.secret !== sessionCookieValue);
  await writeAuthWithEntries(auth, remaining);
}

/**
 * Build Set-Cookie header to clear the session cookie (logout).
 */
export function clearSessionCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

/**
 * Build Set-Cookie header to set the session cookie after login.
 */
export function setSessionCookieHeader(
  sessionSecret: string,
  secure: boolean,
  maxAgeSeconds: number = 30 * 24 * 60 * 60
): string {
  return `${SESSION_COOKIE_NAME}=${sessionSecret}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

/**
 * Require valid session cookie for API access. Call at the start of list, temp_link, trash, undo, discover_folders.
 * Returns a 401 response if the request has no valid session (so only the browser that completed OAuth can use the API).
 * In local dev (no NETLIFY), skips the check and returns null.
 */
export async function requireSession(event: {
  headers?: Record<string, string>;
}): Promise<{ statusCode: number; headers: Record<string, string>; body: string } | null> {
  if (!process.env.NETLIFY) return null;
  const sessionCookie = getSessionCookieFromEvent(event);
  const valid = await verifySessionCookie(sessionCookie);
  if (!valid) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Unauthorized",
        message: "Session required. Log in with Dropbox to continue.",
      }),
    };
  }
  return null;
}

/**
 * Delete all stored auth from Blob. Use for "log out everywhere" or when removing session is not possible.
 */
export async function deleteAuthFromBlob(): Promise<void> {
  try {
    if (!process.env.NETLIFY) return;
    const store = getStore(AUTH_STORE_NAME);
    await store.delete(AUTH_BLOB_KEY);
  } catch {
    // Ignore; blob may not exist
  }
}
