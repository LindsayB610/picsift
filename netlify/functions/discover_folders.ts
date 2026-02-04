/**
 * Folder discovery function
 * Recursively scans Dropbox for folders containing images
 */

import { createDropboxClient } from './_dropbox';
import { normalizeError } from './_utils';
import type { FolderInfo } from '../../src/types';

type HandlerEvent = {
  httpMethod: string;
  path: string;
  queryStringParameters?: Record<string, string>;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

/** In-memory cache for folder discovery (1 hour TTL, per warm instance) */
const FOLDER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let folderCache:
  | { maxDepth: number; result: { folders: FolderInfo[]; total_folders: number }; expiresAt: number }
  | null = null;

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
]);

/**
 * Check if file is an image
 */
function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().substring(name.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Count images in a folder (non-recursive)
 */
async function countImagesInFolder(
  path: string,
  dbx: Awaited<ReturnType<typeof createDropboxClient>>,
): Promise<number> {
  let count = 0;
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const result = cursor
      ? await dbx.filesListFolderContinue({ cursor })
      : await dbx.filesListFolder({ path, recursive: false });

    const entries = result.result.entries;
    for (const entry of entries) {
      if (entry['.tag'] === 'file' && isImageFile(entry.name)) {
        count++;
      }
    }

    hasMore = result.result.has_more;
    cursor = result.result.cursor;
  }

  return count;
}

/**
 * Recursively discover folders with images
 */
async function discoverFoldersRecursive(
  path: string,
  dbx: Awaited<ReturnType<typeof createDropboxClient>>,
  maxDepth: number,
  currentDepth: number = 0,
): Promise<FolderInfo[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const folders: FolderInfo[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  try {
    while (hasMore) {
      let result;
      try {
        result = cursor
          ? await dbx.filesListFolderContinue({ cursor })
          : await dbx.filesListFolder({
              path: path || '', // Ensure empty string for root
              recursive: false,
            });
      } catch (listErr: unknown) {
        const errorMsg = normalizeError(listErr);
        console.error(
          `[DISCOVER] Error listing folder "${path}": ${errorMsg}`,
        );
        
        // Extract DropboxResponseError details
        if (listErr != null && typeof listErr === 'object') {
          const err = listErr as Record<string, unknown>;
          if ('error' in err) {
            console.error('[DISCOVER] Dropbox error:', err.error);
          }
          if ('status' in err) {
            console.error('[DISCOVER] HTTP status:', err.status);
          }
          if ('headers' in err) {
            console.error('[DISCOVER] Response headers:', err.headers);
          }
        }
        throw listErr;
      }

      const entries = result.result.entries;
      
      if (currentDepth === 0 && !cursor) {
        console.log(`[DISCOVER] Root level: found ${entries.length} entries`);
      }

      for (const entry of entries) {
        if (entry['.tag'] === 'folder') {
          // Ensure required fields are present
          const pathLower = entry.path_lower;
          const pathDisplay = entry.path_display;
          const name = entry.name;

          if (!pathLower || !name) {
            console.warn(`Skipping folder with missing required fields:`, entry);
            continue;
          }

          // Count images in this folder
          const imageCount = await countImagesInFolder(pathLower, dbx);
          
          if (currentDepth <= 1) {
            console.log(`[DISCOVER] Folder "${name}" (${pathLower}): ${imageCount} images`);
          }

          if (imageCount > 0) {
            // Create breadcrumb-style display path
            const displayPath = pathDisplay
              ? pathDisplay.split('/').filter(Boolean).join(' / ')
              : '/';

            folders.push({
              path: pathLower,
              name,
              image_count: imageCount,
              display_path: displayPath,
            });

            // Recursively search subfolders
            const subfolders = await discoverFoldersRecursive(
              pathLower,
              dbx,
              maxDepth,
              currentDepth + 1,
            );
            folders.push(...subfolders);
          }
        }
      }

      hasMore = result.result.has_more;
      cursor = result.result.cursor;
    }
  } catch (err: unknown) {
    // Some folders may not be accessible, skip them
    const errorMessage = normalizeError(err);
    console.error(
      `[DISCOVER] Error scanning folder "${path}": ${errorMessage}`,
    );
    // Re-throw if it's the root folder (we need to know about root errors)
    if (path === '' || path === '/') {
      throw err;
    }
  }

  return folders;
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
    const maxDepth = parseInt(
      event.queryStringParameters?.max_depth || '3',
      10,
    );

    // Return cached result if valid (same maxDepth, within TTL)
    if (
      folderCache &&
      folderCache.maxDepth === maxDepth &&
      folderCache.expiresAt > Date.now()
    ) {
      console.log('[DISCOVER] Returning cached result');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folderCache.result),
      };
    }

    // Create Dropbox client
    const dbx = await createDropboxClient();
    
    // Try starting from root (empty string) - Dropbox API v2 uses '' for root
    // If that fails, we'll try common folder paths
    let rootPath = '';
    let folders: FolderInfo[] = [];
    
    try {
      console.log(`[DISCOVER] Starting folder discovery from root, max depth: ${maxDepth}`);
      
      // Test: Try listing root first
      console.log('[DISCOVER] Testing root folder access with empty string...');
      const rootTest = await dbx.filesListFolder({ path: '' });
      console.log(
        `[DISCOVER] Root folder test: found ${rootTest.result.entries.length} entries`,
      );
      
      // If root works, discover from root
      folders = await discoverFoldersRecursive(rootPath, dbx, maxDepth);
    } catch (rootError: unknown) {
      console.error('[DISCOVER] Root folder access failed, trying alternative paths...');
      
      // Try common folder paths as fallback
      const commonPaths = ['/', 'Camera Uploads', 'Photos'];
      let foundPath = false;
      
      for (const testPath of commonPaths) {
        try {
          console.log(`[DISCOVER] Trying path: "${testPath}"`);
          const testResult = await dbx.filesListFolder({ path: testPath });
          console.log(
            `[DISCOVER] Path "${testPath}" works: found ${testResult.result.entries.length} entries`,
          );
          rootPath = testPath;
          folders = await discoverFoldersRecursive(rootPath, dbx, maxDepth);
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
        console.error(`[DISCOVER] All paths failed. Original error: ${errorDetails}`);
        
        // Try to extract Dropbox error details
        if (rootError && typeof rootError === 'object') {
          const errorObj = rootError as Record<string, unknown>;
          console.error('[DISCOVER] Full error object keys:', Object.keys(errorObj));
          if ('error' in errorObj) {
            console.error('[DISCOVER] Dropbox error:', errorObj.error);
          }
          if ('status' in errorObj) {
            console.error('[DISCOVER] HTTP status:', errorObj.status);
          }
          if ('headers' in errorObj) {
            console.error('[DISCOVER] Response headers:', errorObj.headers);
          }
          // Log the full error as JSON for debugging
          try {
            console.error('[DISCOVER] Full error JSON:', JSON.stringify(errorObj, null, 2));
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err: unknown) {
    console.error('[DISCOVER] Folder discovery error:', err);
    const errorMessage = normalizeError(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    // Extract Dropbox error details if available
    let dropboxError: string | undefined;
    let httpStatus: number | undefined;
    if (err != null && typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      httpStatus = typeof errObj.status === 'number' ? errObj.status : undefined;

      // Properly serialize the error field
      if ('error' in errObj) {
        if (typeof errObj.error === 'string') {
          dropboxError = errObj.error;
        } else if (errObj.error != null && typeof errObj.error === 'object') {
          // If it's an object, try to extract a message or stringify it
          const errorObj = errObj.error as Record<string, unknown>;
          if (
            'error_summary' in errorObj &&
            typeof errorObj.error_summary === 'string'
          ) {
            dropboxError = errorObj.error_summary;
          } else if (
            'error' in errorObj &&
            typeof errorObj.error === 'string'
          ) {
            dropboxError = errorObj.error;
          } else {
            dropboxError = JSON.stringify(errObj.error);
          }
        }
      }
    }
    
    console.error('[DISCOVER] Error details:', {
      message: errorMessage,
      stack: errorStack,
      dropboxError,
      httpStatus,
    });
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to discover folders',
        message: errorMessage,
        dropboxError,
        httpStatus,
        ...(errorStack && { stack: errorStack }),
      }),
    };
  }
};
