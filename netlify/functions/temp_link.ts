/**
 * Get a temporary link for a file in Dropbox
 * Used for displaying images in the browser (link expires in 4 hours).
 */

import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { TempLinkResponse } from "../../src/types";

type HandlerEvent = {
  httpMethod: string;
  path: string;
  body?: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

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

  let payload: { path?: string };
  try {
    payload = event.body ? (JSON.parse(event.body) as { path?: string }) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const path = payload.path;
  if (!path || !validatePath(path)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or missing path" }),
    };
  }

  try {
    const dbx = await createDropboxClient();
    const result = await dbx.filesGetTemporaryLink({ path });

    // Dropbox temporary links expire in 4 hours
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    const response: TempLinkResponse = {
      url: result.result.link,
      expires_at: expiresAt,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[TEMP_LINK] Error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to get temporary link",
        message,
      }),
    };
  }
};
