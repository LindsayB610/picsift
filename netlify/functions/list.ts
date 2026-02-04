/**
 * List images in a Dropbox folder
 * Accepts path or paths (for future multi-folder support), paginates with list_folder/continue,
 * filters to image files only.
 */

import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { DbxEntry, ListResponse } from "../../src/types";

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

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".webp",
  ".gif",
]);

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().substring(name.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Validate path to prevent traversal (e.g. ".." or absolute paths outside Dropbox)
 */
function validatePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..")) return false;
  // Dropbox paths are typically "/folder" or "" for root
  return path === "" || path.startsWith("/");
}

function toDbxEntry(entry: {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  rev?: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
}): DbxEntry {
  const result: DbxEntry = {
    ".tag": "file",
    name: entry.name,
    path_lower: entry.path_lower,
    path_display: entry.path_display,
    id: entry.id,
    rev: entry.rev ?? "",
    size: entry.size ?? 0,
    is_downloadable: true,
  };
  if (entry.client_modified !== undefined) {
    result.client_modified = entry.client_modified;
  }
  if (entry.server_modified !== undefined) {
    result.server_modified = entry.server_modified;
  }
  return result;
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

  let payload: { path?: string; paths?: string[] };
  try {
    payload = event.body
      ? (JSON.parse(event.body) as { path?: string; paths?: string[] })
      : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const paths: string[] = Array.isArray(payload.paths)
    ? payload.paths
    : typeof payload.path === "string"
      ? [payload.path]
      : ["/Camera Uploads"];

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
    const allEntries: DbxEntry[] = [];

    for (const folderPath of paths) {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = cursor
          ? await dbx.filesListFolderContinue({ cursor })
          : await dbx.filesListFolder({
              path: folderPath || "",
              recursive: false,
            });

        const entries = result.result.entries;
        for (const entry of entries) {
          if (entry[".tag"] === "file" && isImageFile(entry.name)) {
            const fileEntry = entry as {
              name: string;
              path_lower: string;
              path_display: string;
              id: string;
              rev?: string;
              size?: number;
              client_modified?: string;
              server_modified?: string;
            };
            allEntries.push(toDbxEntry(fileEntry));
          }
        }

        hasMore = result.result.has_more;
        cursor = result.result.cursor;
      }
    }

    const response: ListResponse = {
      entries: allEntries,
      total_count: allEntries.length,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[LIST] Error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to list folder",
        message,
      }),
    };
  }
};
