/**
 * Folder discovery function
 * Recursively scans Dropbox for folders containing images
 */

import { requireSession } from "./_auth_store";
import { createDropboxClient } from "./_dropbox";
import { normalizeError } from "./_utils";
import type { FolderInfo } from "../../src/types";

type HandlerEvent = {
  httpMethod: string;
  path: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

/** In-memory cache for folder discovery (1 hour TTL, per warm instance) */
const FOLDER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Reset cache (for unit tests only) */
export function __clearFolderCacheForTesting(): void {
  folderCache = null;
}

let folderCache: {
  maxDepth: number;
  result: { folders: FolderInfo[]; total_folders: number };
  expiresAt: number;
} | null = null;

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".webp",
  ".gif",
  ".bmp",
  ".tiff",
  ".tif",
]);

/**
 * Check if file is an image
 */
function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().substring(name.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
}

/** Depth of a folder path: number of segments (e.g. /a/b => 2) */
function folderDepth(path: string): number {
  const segments = path.split("/").filter(Boolean);
  return segments.length;
}

/** Parent folder path; "" for root-level folders */
function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  if (i <= 0) return "";
  return path.slice(0, i);
}

/**
 * Discover folders with images using a single recursive list_folder.
 * Much faster than one API call per folder (one or few calls for the whole tree).
 */
async function discoverFoldersRecursiveList(
  rootPath: string,
  dbx: Awaited<ReturnType<typeof createDropboxClient>>,
  maxDepth: number
): Promise<FolderInfo[]> {
  const pathCount = new Map<string, number>();
  let hasMore = true;
  let cursor: string | undefined;
  let totalEntries = 0;

  try {
    while (hasMore) {
      let result;
      try {
        result = cursor
          ? await dbx.filesListFolderContinue({ cursor })
          : await dbx.filesListFolder({
              path: rootPath || "",
              recursive: true,
            });
      } catch (listErr: unknown) {
        const errorMsg = normalizeError(listErr);
        console.error(
          `[DISCOVER] Error listing folder "${rootPath}": ${errorMsg}`
        );
        if (listErr != null && typeof listErr === "object") {
          const err = listErr as Record<string, unknown>;
          if ("error" in err) console.error("[DISCOVER] Dropbox error:", err.error);
          if ("status" in err) console.error("[DISCOVER] HTTP status:", err.status);
        }
        throw listErr;
      }

      const entries = result.result.entries;
      totalEntries += entries.length;

      if (!cursor) {
        console.log(
          `[DISCOVER] Recursive list: processing batch of ${entries.length} entries`
        );
      }

      for (const entry of entries) {
        if (entry[".tag"] !== "file" || !isImageFile(entry.name)) continue;
        const pathLower =
          (entry as { path_lower?: string }).path_lower ??
          (entry as { path_display?: string }).path_display;
        if (!pathLower || typeof pathLower !== "string") continue;
        const folderPath = dirname(pathLower) || "/";
        const depth =
          folderPath === "/" || folderPath === "" ? 1 : folderDepth(folderPath);
        if (depth <= maxDepth) {
          pathCount.set(
            folderPath,
            (pathCount.get(folderPath) ?? 0) + 1
          );
        }
      }

      hasMore = result.result.has_more;
      cursor = result.result.cursor;
    }
  } catch (err: unknown) {
    const errorMessage = normalizeError(err);
    console.error(`[DISCOVER] Error during recursive list: ${errorMessage}`);
    throw err;
  }

  console.log(
    `[DISCOVER] Scanned ${totalEntries} entries, ${pathCount.size} folders with images`
  );

  const folders: FolderInfo[] = [];
  for (const [pathLower, image_count] of pathCount.entries()) {
    if (image_count <= 0) continue;
    const segments = pathLower.split("/").filter(Boolean);
    const name = segments.length > 0 ? segments[segments.length - 1]! : pathLower;
    const display_path = segments.join(" / ") || "/";
    folders.push({
      path: pathLower,
      name,
      image_count,
      display_path,
    });
  }

  return folders;
}

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const sessionError = await requireSession(event);
  if (sessionError) return sessionError as HandlerResponse;

  try {
    const maxDepth = parseInt(
      event.queryStringParameters?.max_depth || "1",
      10
    );

    // Return cached result if valid (same maxDepth, within TTL)
    if (
      folderCache &&
      folderCache.maxDepth === maxDepth &&
      folderCache.expiresAt > Date.now()
    ) {
      console.log("[DISCOVER] Returning cached result");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(folderCache.result),
      };
    }

    // Create Dropbox client
    const dbx = await createDropboxClient();

    // Try starting from root (empty string) - Dropbox API v2 uses '' for root
    // If that fails, we'll try common folder paths
    let rootPath = "";
    let folders: FolderInfo[] = [];

    try {
      console.log(
        `[DISCOVER] Starting folder discovery from root (recursive list), max depth: ${maxDepth}`
      );

      // Single recursive list from root – much faster than N+1 per-folder calls
      folders = await discoverFoldersRecursiveList(rootPath, dbx, maxDepth);
    } catch (rootError: unknown) {
      console.error(
        "[DISCOVER] Root folder access failed, trying alternative paths..."
      );

      // Try common folder paths as fallback
      const commonPaths = ["/", "Camera Uploads", "Photos"];
      let foundPath = false;

      for (const testPath of commonPaths) {
        try {
          console.log(`[DISCOVER] Trying path: "${testPath}"`);
          const testResult = await dbx.filesListFolder({
            path: testPath,
            recursive: true,
          });
          console.log(
            `[DISCOVER] Path "${testPath}" works: found ${testResult.result.entries.length} entries`
          );
          rootPath = testPath;
          folders = await discoverFoldersRecursiveList(
            rootPath,
            dbx,
            maxDepth
          );
          foundPath = true;
          break;
        } catch (pathErr: unknown) {
          const pathErrorMsg = normalizeError(pathErr);
          console.warn(`[DISCOVER] Path "${testPath}" failed: ${pathErrorMsg}`);
          // Continue to next path
        }
      }

      if (!foundPath) {
        // If all paths failed, throw the original root error with details
        const errorDetails = normalizeError(rootError);
        console.error(
          `[DISCOVER] All paths failed. Original error: ${errorDetails}`
        );

        // Try to extract Dropbox error details
        if (rootError && typeof rootError === "object") {
          const errorObj = rootError as Record<string, unknown>;
          console.error(
            "[DISCOVER] Full error object keys:",
            Object.keys(errorObj)
          );
          if ("error" in errorObj) {
            console.error("[DISCOVER] Dropbox error:", errorObj.error);
          }
          if ("status" in errorObj) {
            console.error("[DISCOVER] HTTP status:", errorObj.status);
          }
          if ("headers" in errorObj) {
            console.error("[DISCOVER] Response headers:", errorObj.headers);
          }
          // Log the full error as JSON for debugging
          try {
            console.error(
              "[DISCOVER] Full error JSON:",
              JSON.stringify(errorObj, null, 2)
            );
          } catch {
            // Ignore JSON stringify errors
          }
        }

        throw rootError;
      }
    }

    console.log(`[DISCOVER] Found ${folders.length} folders with images`);

    // Sort by image count (descending)
    folders.sort((a, b) => b.image_count - a.image_count);

    const result = { folders, total_folders: folders.length };

    // Cache result (1 hour TTL)
    folderCache = {
      maxDepth,
      result,
      expiresAt: Date.now() + FOLDER_CACHE_TTL_MS,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err: unknown) {
    console.error("[DISCOVER] Folder discovery error:", err);
    const errorMessage = normalizeError(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Extract Dropbox error details if available
    let dropboxError: string | undefined;
    let httpStatus: number | undefined;
    if (err != null && typeof err === "object") {
      const errObj = err as Record<string, unknown>;
      httpStatus =
        typeof errObj.status === "number" ? errObj.status : undefined;

      // Properly serialize the error field
      if ("error" in errObj) {
        if (typeof errObj.error === "string") {
          dropboxError = errObj.error;
        } else if (errObj.error != null && typeof errObj.error === "object") {
          // If it's an object, try to extract a message or stringify it
          const errorObj = errObj.error as Record<string, unknown>;
          if (
            "error_summary" in errorObj &&
            typeof errorObj.error_summary === "string"
          ) {
            dropboxError = errorObj.error_summary;
          } else if (
            "error" in errorObj &&
            typeof errorObj.error === "string"
          ) {
            dropboxError = errorObj.error;
          } else {
            dropboxError = JSON.stringify(errObj.error);
          }
        }
      }
    }

    console.error("[DISCOVER] Error details:", {
      message: errorMessage,
      stack: errorStack,
      dropboxError,
      httpStatus,
    });

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to discover folders",
        message: errorMessage,
        dropboxError,
        httpStatus,
      }),
    };
  }
};
