/**
 * Move a file to quarantine (soft delete)
 * Destination: /_TRASHME/<filename> (single folder; autorename if name exists)
 * Uses files/move_v2 with autorename: true.
 */

import { requireSession } from "./_auth_store";
import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { TrashRecord, TrashResponse } from "../../src/types";

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

  const sessionError = await requireSession(event);
  if (sessionError) return sessionError as HandlerResponse;

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

  // Quarantine path: /_TRASHME/<filename> (flat; no session or source-path folders)
  const basename = path.split("/").filter(Boolean).pop() ?? path;
  const toPath = `/_TRASHME/${basename}`;

  try {
    const dbx = await createDropboxClient();
    const moveResult = await dbx.filesMoveV2({
      from_path: path,
      to_path: toPath,
      autorename: true,
    });
    const actualTrashedPath =
      moveResult.result.metadata.path_display ?? moveResult.result.metadata.path_lower ?? toPath;

    const trashRecord: TrashRecord = {
      original_path: path,
      trashed_path: actualTrashedPath,
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
