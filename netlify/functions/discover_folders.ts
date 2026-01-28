/**
 * Folder discovery function
 * Recursively scans Dropbox for folders containing images
 */

import { createDropboxClient } from './_dropbox';
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
      const result = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({ path, recursive: false });

      const entries = result.result.entries;

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
  } catch (error) {
    // Some folders may not be accessible, skip them
    console.warn(`Error scanning folder ${path}:`, error);
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

    // Start from root
    const rootPath = '';

    // Create Dropbox client and discover folders
    const dbx = await createDropboxClient();
    const folders = await discoverFoldersRecursive(rootPath, dbx, maxDepth);

    // Sort by image count (descending)
    folders.sort((a, b) => b.image_count - a.image_count);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folders,
        total_folders: folders.length,
      }),
    };
  } catch (error) {
    console.error('Folder discovery error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to discover folders',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
