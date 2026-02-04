/**
 * TypeScript type definitions for PicSift
 */

/**
 * Dropbox file entry metadata
 */
export interface DbxEntry {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified?: string;
  server_modified?: string;
  rev: string;
  size: number;
  content_hash?: string;
  is_downloadable: boolean;
  ".tag": "file";
}

/**
 * Dropbox folder entry metadata
 */
export interface DbxFolder {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  ".tag": "folder";
}

/**
 * Trash record for undo functionality
 */
export interface TrashRecord {
  original_path: string;
  trashed_path: string;
  session_id: string;
  timestamp: string;
}

/**
 * Session state
 */
export interface SessionState {
  session_id: string;
  folder_path: string;
  folder_name: string;
  current_index: number;
  total_count: number;
  kept_count: number;
  trashed_count: number;
  undo_stack: TrashRecord[];
}

/**
 * One undo stack item: trash record from API + entry for re-inserting into queue
 */
export interface UndoStackItem {
  record: TrashRecord;
  entry: DbxEntry;
}

/**
 * Persisted session state (localStorage) for Phase 6: restore on reload
 */
export interface PersistedSession {
  sessionId: string;
  folder: FolderInfo;
  queue: DbxEntry[];
  index: number;
  undoStack: UndoStackItem[];
  savedAt: string; // ISO timestamp
}

/**
 * Folder information for selection
 */
export interface FolderInfo {
  path: string;
  name: string;
  image_count: number;
  display_path: string; // Breadcrumb-style path
}

/**
 * API response types
 */
export interface AuthStartResponse {
  redirect_url: string;
}

export interface AuthCallbackResponse {
  success: boolean;
  error?: string;
  account_id?: string;
}

export interface DiscoverFoldersResponse {
  folders: FolderInfo[];
}

export interface ListResponse {
  entries: DbxEntry[];
  total_count: number;
}

export interface TempLinkResponse {
  url: string;
  expires_at: string;
}

/** One item from batch temp links response */
export interface TempLinkItem {
  path: string;
  url: string;
  expires_at: string;
}

export interface TempLinksBatchResponse {
  links: TempLinkItem[];
}

export interface TrashResponse {
  success: boolean;
  trash_record?: TrashRecord;
  error?: string;
}

export interface UndoResponse {
  success: boolean;
  error?: string;
}

/**
 * Error types
 */
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Auth state
 */
export interface AuthState {
  is_authenticated: boolean;
  account_id?: string;
}
