/**
 * Get temporary links for multiple files (batch).
 * Reduces round-trips when prefetching several image URLs.
 */

import { requireSession } from "./_auth_store";
import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";

type HandlerEvent = {
  httpMethod: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

const MAX_PATHS = 10;

function validatePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..")) return false;
  return path.startsWith("/");
}

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const sessionError = await requireSession(event);
  if (sessionError) return sessionError as HandlerResponse;

  let payload: { paths?: string[] };
  try {
    payload = event.body ? (JSON.parse(event.body) as { paths?: string[] }) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  if (paths.length === 0 || paths.length > MAX_PATHS) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error:
          paths.length === 0
            ? "Missing or empty paths array"
            : `paths array must have 1–${MAX_PATHS} items`,
      }),
    };
  }

  for (const p of paths) {
    if (!validatePath(p)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid path" }),
      };
    }
  }

  try {
    const dbx = await createDropboxClient();
    const expiresAt = new Date(
      Date.now() + 4 * 60 * 60 * 1000
    ).toISOString();

    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          const result = await dbx.filesGetTemporaryLink({ path });
          return {
            path,
            url: result.result.link,
            expires_at: expiresAt,
            ok: true as const,
          };
        } catch (err: unknown) {
          const message = normalizeError(err);
          console.error("[TEMP_LINKS] Error for path:", path, message);
          return { path, ok: false as const };
        }
      })
    );

    const links = results
      .filter((r): r is typeof r & { url: string } => r.ok && !!r.url)
      .map((r) => ({ path: r.path, url: r.url, expires_at: r.expires_at }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[TEMP_LINKS] Error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to get temporary links",
        message,
      }),
    };
  }
};
