/**
 * Restore a file from quarantine (undo trash)
 * Moves file from trashed_path back to original_path using files/move_v2.
 */

import { requireSession } from "./_auth_store";
import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { UndoResponse } from "../../src/types";

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

  let payload: { trashed_path?: string; original_path?: string };
  try {
    payload = event.body
      ? (JSON.parse(event.body) as {
          trashed_path?: string;
          original_path?: string;
        })
      : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const trashedPath = payload.trashed_path;
  const originalPath = payload.original_path;

  if (!trashedPath || !validatePath(trashedPath)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or missing trashed_path" }),
    };
  }

  if (!originalPath || !validatePath(originalPath)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or missing original_path" }),
    };
  }

  // Ensure trashed_path is under /_TRASHME/
  if (!trashedPath.startsWith("/_TRASHME/")) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "trashed_path must be under /_TRASHME/" }),
    };
  }

  try {
    const dbx = await createDropboxClient();
    await dbx.filesMoveV2({
      from_path: trashedPath,
      to_path: originalPath,
    });

    const response: UndoResponse = {
      success: true,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[UNDO] Error:", message);
    const response: UndoResponse = {
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
