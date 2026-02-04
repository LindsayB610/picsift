/**
 * Move a file to quarantine (soft delete)
 * Destination: /_TRASHME/<session_id><original_path>
 * Uses files/move_v2 with autorename: true.
 */

import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { TrashRecord, TrashResponse } from "../../src/types";

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

/**
 * Validate path and session_id to prevent injection / traversal
 */
function validatePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..")) return false;
  return path.startsWith("/");
}

function validateSessionId(sessionId: string): boolean {
  if (typeof sessionId !== "string" || sessionId.length === 0) return false;
  if (sessionId.length > 128) return false;
  // Allow alphanumeric, hyphen, underscore only
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
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

  let payload: { path?: string; session_id?: string };
  try {
    payload = event.body
      ? (JSON.parse(event.body) as { path?: string; session_id?: string })
      : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const path = payload.path;
  const sessionId = payload.session_id;

  if (!path || !validatePath(path)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or missing path" }),
    };
  }

  if (!sessionId || !validateSessionId(sessionId)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or missing session_id" }),
    };
  }

  // Quarantine path: /_TRASHME/<sessionId><original_path>
  // e.g. /_TRASHME/abc123/Camera Uploads/photo.jpg
  const trashedPath = `/_TRASHME/${sessionId}${path}`;

  try {
    const dbx = await createDropboxClient();
    await dbx.filesMoveV2({
      from_path: path,
      to_path: trashedPath,
      autorename: true,
    });

    const trashRecord: TrashRecord = {
      original_path: path,
      trashed_path: trashedPath,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };

    const response: TrashResponse = {
      success: true,
      trash_record: trashRecord,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[TRASH] Error:", message);
    const response: TrashResponse = {
      success: false,
      error: message,
    };
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  }
};
