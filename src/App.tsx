/**
 * Main App component
 * Handles authentication flow and routing
 */

import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import SettingsIcon from "@mui/icons-material/Settings";
import Login from "./components/Login";
import FolderSelector from "./components/FolderSelector";
import Viewer from "./components/Viewer";
import Controls from "./components/Controls";
import Settings, {
  getConfettiFrequency,
  type ConfettiFrequency,
} from "./components/Settings";
import { useAuthCallback } from "./hooks/useAuth";
import { useFeedback } from "./contexts/FeedbackContext";
import {
  listImages,
  getTempLinks,
  logout,
  trash as apiTrash,
  undo as apiUndo,
  ApiClientError,
} from "./api";
import { useQueryClient } from "@tanstack/react-query";
import {
  normalizeError,
  getErrorCategory,
  isRateLimitError,
  isNetworkError,
} from "./utils/error";
import { prefersReducedMotion } from "./utils/motion";
import type {
  AuthState,
  FolderInfo,
  DbxEntry,
  UndoStackItem,
  PersistedSession,
} from "./types";

/** Max images per session (edge case: very large folders) */
const MAX_QUEUE_SIZE = 5000;

const AUTH_STORAGE_KEY = "picsift:auth";
const FOLDER_PREFERENCE_KEY = "picsift:selectedFolder";
const SESSION_PERSIST_KEY = "picsift:session";
const FOLDER_PROGRESS_KEY = "picsift:folderProgress";
/** Sessions older than this are not offered for resume (Phase 6) */
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Per-folder progress: path_lower of images already reviewed (kept or deleted) */
type FolderProgressStore = Record<string, string[]>;

function getFolderProgress(folderPath: string): Set<string> {
  try {
    const raw = localStorage.getItem(FOLDER_PROGRESS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as FolderProgressStore;
    const list = parsed[folderPath];
    return Array.isArray(list) ? new Set(list as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addReviewedPath(folderPath: string, pathLower: string): void {
  try {
    const raw = localStorage.getItem(FOLDER_PROGRESS_KEY);
    const store: FolderProgressStore = raw ? (JSON.parse(raw) as FolderProgressStore) : {};
    const list = store[folderPath] ?? [];
    if (!list.includes(pathLower)) {
      store[folderPath] = [...list, pathLower];
      localStorage.setItem(FOLDER_PROGRESS_KEY, JSON.stringify(store));
    }
  } catch {
    // quota or other; progress continues in memory for this session
  }
}

function removeReviewedPath(folderPath: string, pathLower: string): void {
  try {
    const raw = localStorage.getItem(FOLDER_PROGRESS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as FolderProgressStore;
    const list = store[folderPath];
    if (!Array.isArray(list)) return;
    const next = list.filter((p) => p !== pathLower);
    if (next.length === 0) {
      delete store[folderPath];
    } else {
      store[folderPath] = next;
    }
    localStorage.setItem(FOLDER_PROGRESS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function clearFolderProgress(folderPath: string): void {
  try {
    const raw = localStorage.getItem(FOLDER_PROGRESS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as FolderProgressStore;
    delete store[folderPath];
    localStorage.setItem(FOLDER_PROGRESS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

type AppState = "loading" | "login" | "setup" | "folder-selection" | "ready";

/**
 * Compute initial app state from URL/storage so we avoid a "Loading…" flash when
 * returning from OAuth (auth=success) and go straight to folder-selection.
 */
function getInitialAppState(): AppState {
  if (typeof window === "undefined") return "loading";
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reauth") === "true" || urlParams.get("clear") === "true") {
    return "login";
  }
  if (urlParams.get("auth") === "success" && urlParams.get("account_id")) {
    const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
    if (savedFolder) {
      try {
        const folder = JSON.parse(savedFolder) as { path?: string; name?: string; image_count?: number; display_path?: string };
        if (folder?.path && folder?.name != null) return "ready";
      } catch {
        // invalid saved folder
      }
    }
    return "folder-selection";
  }
  if (urlParams.get("auth") === "error") return "login";
  return "loading";
}

function shuffleArray<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const CONFETTI_COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#00f2fe"];

function maybeConfetti(
  trashedCount: number,
  frequency: ConfettiFrequency
): void {
  if (frequency === "off") return;
  if (prefersReducedMotion()) return;
  const n = frequency === "1" ? 1 : parseInt(frequency, 10);
  if (Number.isNaN(n) || n <= 0) return;
  if (trashedCount % n !== 0) return;
  void confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS,
  });
}

function saveSessionToStorage(
  sessionId: string,
  folder: FolderInfo,
  queue: DbxEntry[],
  index: number,
  undoStack: UndoStackItem[]
): void {
  try {
    const payload: PersistedSession = {
      sessionId,
      folder,
      queue,
      index,
      undoStack,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_PERSIST_KEY, JSON.stringify(payload));
  } catch {
    // quota or other; session continues in memory
  }
}

function loadSessionFromStorage(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    const folder = parsed.folder;
    if (
      !parsed.sessionId ||
      !Array.isArray(parsed.queue) ||
      typeof parsed.index !== "number" ||
      !Array.isArray(parsed.undoStack) ||
      !parsed.savedAt ||
      !folder ||
      typeof folder.path !== "string" ||
      !folder.path ||
      typeof folder.name !== "string" ||
      typeof folder.image_count !== "number" ||
      typeof folder.display_path !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(SESSION_PERSIST_KEY);
  } catch {
    // ignore
  }
}

/** True if persisted session is within expiry window and can be resumed */
function isSessionResumable(parsed: PersistedSession): boolean {
  const savedAt = new Date(parsed.savedAt).getTime();
  return Number.isFinite(savedAt) && Date.now() - savedAt < SESSION_EXPIRY_MS;
}

const SETUP_TOKENS_KEY = "picsift:setup_tokens";

function SetupAddTokens({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [tokens, setTokens] = useState<{
    refreshToken: string;
    accountId: string;
  } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SETUP_TOKENS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          refreshToken: string;
          accountId: string;
        };
        if (parsed.refreshToken && parsed.accountId) {
          setTokens(parsed);
        }
      } catch {
        sessionStorage.removeItem(SETUP_TOKENS_KEY);
      }
    }
  }, []);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  if (!tokens) {
    return (
      <div style={{ textAlign: "center", color: "var(--text)" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="content-wrap"
      style={{
        maxWidth: "560px",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--sans)",
          color: "var(--text-h)",
          margin: 0,
          fontSize: "1.35rem",
        }}
      >
        One more step
      </h1>
      <p
        style={{
          color: "var(--text)",
          margin: 0,
          lineHeight: 1.5,
          fontSize: "0.9375rem",
        }}
      >
        Add these two values in Netlify so the app can use your Dropbox:
      </p>
      <ol
        style={{
          color: "var(--text)",
          margin: 0,
          paddingLeft: "1.25rem",
          lineHeight: 1.6,
          fontSize: "0.9375rem",
        }}
      >
        <li>Open your Netlify dashboard → your PicSift site.</li>
        <li>
          Go to <strong>Site configuration</strong> →{" "}
          <strong>Environment variables</strong>.
        </li>
        <li>
          Click <strong>Add a variable</strong> (or edit if they exist) and add
          the two below.
        </li>
        <li>
          Go to <strong>Deploys</strong> → <strong>Trigger deploy</strong> →{" "}
          <strong>Deploy site</strong>.
        </li>
      </ol>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            DROPBOX_REFRESH_TOKEN
          </label>
          <input
            type="text"
            readOnly
            value={tokens.refreshToken}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "16px",
              fontFamily: "monospace",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-h)",
              minHeight: "var(--touch-min)",
            }}
          />
          <button
            type="button"
            className="touch-target-inline"
            onClick={() => copyToClipboard(tokens.refreshToken)}
            style={{
              width: "100%",
              fontSize: "0.9375rem",
              fontWeight: 500,
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            AUTHORIZED_DROPBOX_ACCOUNT_ID
          </label>
          <input
            type="text"
            readOnly
            value={tokens.accountId}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "16px",
              fontFamily: "monospace",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-h)",
              minHeight: "var(--touch-min)",
            }}
          />
          <button
            type="button"
            className="touch-target-inline"
            onClick={() => copyToClipboard(tokens.accountId)}
            style={{
              width: "100%",
              fontSize: "0.9375rem",
              fontWeight: 500,
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <p style={{ color: "var(--text)", margin: 0, fontSize: "0.875rem" }}>
        After you’ve added both and triggered a new deploy, click below.
      </p>
      <div className="actions-row">
        <button
          type="button"
          className="touch-target-inline"
          onClick={onContinue}
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          I’ve added them, continue
        </button>
        <button
          type="button"
          className="touch-target-inline"
          onClick={onCancel}
          style={{
            fontSize: "1rem",
            backgroundColor: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Cancel / Log out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { showToast, showCriticalModal } = useFeedback();
  const [appState, setAppState] = useState<AppState>(getInitialAppState);
  const [, setAuthState] = useState<AuthState>({
    is_authenticated: false,
  });

  /** Route errors: critical (auth) → modal; transient → toast with optional retry */
  const showApiError = useCallback(
    (err: unknown, retry?: () => void) => {
      const message = normalizeError(err);
      const status = err instanceof ApiClientError ? err.status : undefined;
      const category = getErrorCategory(err, { status, message });
      if (category === "critical") {
        showCriticalModal(message, "Authentication required", () => {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ is_authenticated: false });
          setAppState("login");
        });
      } else {
        const retryLabel = isRateLimitError(err)
          ? "Retry (rate limited)"
          : isNetworkError(err)
            ? "Retry (network)"
            : undefined;
        showToast(message, { retry, retryLabel });
      }
    },
    [showToast, showCriticalModal, setAppState, setAuthState]
  );
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Session state (triage)
  const [sessionQueue, setSessionQueue] = useState<DbxEntry[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoStackItem[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [sessionListError, setSessionListError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** For background delete: only apply completion when session still matches */
  const sessionIdRef = useRef<string | null>(null);
  const sessionQueueRef = useRef<DbxEntry[]>([]);
  const sessionIndexRef = useRef(0);
  const undoStackRef = useRef<UndoStackItem[]>([]);
  /** Last failed delete (path/sessionId/entry) for retry from toast */
  const [lastFailedDelete, setLastFailedDelete] = useState<{
    path: string;
    sessionId: string;
    entry: DbxEntry;
  } | null>(null);

  const queryClient = useQueryClient();
  const prefetchedTempLinksSessionRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    sessionQueueRef.current = sessionQueue;
    sessionIndexRef.current = sessionIndex;
    undoStackRef.current = undoStack;
  }, [sessionQueue, sessionIndex, undoStack]);

  // Prefetch temp links for first few images so first loads are instant
  useEffect(() => {
    if (
      !sessionId ||
      sessionQueue.length === 0 ||
      prefetchedTempLinksSessionRef.current === sessionId
    )
      return;
    prefetchedTempLinksSessionRef.current = sessionId;
    const paths = sessionQueue
      .slice(0, 5)
      .map((e) => e.path_display)
      .filter(Boolean);
    if (paths.length === 0) return;
    getTempLinks(paths)
      .then((res) => {
        res.links.forEach(({ path, url }) =>
          queryClient.setQueryData(["tempLink", path], url)
        );
      })
      .catch(() => {});
  }, [sessionId, sessionQueue, queryClient]);

  // Check for OAuth callback in URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const authCallbackQuery = useAuthCallback(code, state);

  useEffect(() => {
    void initializeApp();
  }, []);

  // Handle auth callback from React Query
  useEffect(() => {
    if (code && state && authCallbackQuery.data) {
      const response = authCallbackQuery.data;
      if (response.success && response.account_id) {
        const newAuthState: AuthState = {
          is_authenticated: true,
          account_id: response.account_id,
        };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
        window.history.replaceState({}, "", window.location.pathname);

        const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
        if (savedFolder) {
          try {
            const folder = JSON.parse(savedFolder) as FolderInfo;
            setSelectedFolder(folder);
            setAppState("ready");
          } catch {
            setAppState("folder-selection");
          }
        } else {
          setAppState("folder-selection");
        }
      } else {
        setAppState("login");
      }
    } else if (code && state && authCallbackQuery.isError) {
      showCriticalModal(
        normalizeError(authCallbackQuery.error),
        "Authentication failed"
      );
      setAppState("login");
    }
  }, [
    code,
    state,
    authCallbackQuery.data,
    authCallbackQuery.isError,
    authCallbackQuery.error,
    showCriticalModal,
  ]);

  // Phase 7: show critical modal when redirected with auth=error (e.g. access denied)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "error") {
      const message =
        params.get("message") != null
          ? decodeURIComponent(params.get("message") ?? "")
          : "Authentication failed.";
      showCriticalModal(message, "Authentication failed");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showCriticalModal]);

  /**
   * Initialize app: check for OAuth callback, load saved auth state, check for folder preference
   */
  const initializeApp = () => {
    const urlParams = new URLSearchParams(window.location.search);

    // Check if user wants to clear auth and re-authenticate
    if (
      urlParams.get("reauth") === "true" ||
      urlParams.get("clear") === "true"
    ) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(FOLDER_PREFERENCE_KEY);
      setAuthState({ is_authenticated: false });
      setSelectedFolder(null);
      window.history.replaceState({}, "", window.location.pathname);
      setAppState("login");
      return;
    }

    // Legacy setup path: only allow on localhost so we never store tokens from URL in production.
    // Production OAuth redirects with ?auth=success&account_id=... (no tokens in hash).
    const isLocalhost =
      typeof window !== "undefined" &&
      /^https?:\/\/localhost(:\d+)?(\/|$)/i.test(window.location.origin);
    const hash = window.location.hash.slice(1);
    if (isLocalhost && hash) {
      const hashParams = new URLSearchParams(hash);
      const setup = hashParams.get("setup");
      const accountIdFromHash = hashParams.get("account_id");
      const refreshToken = hashParams.get("refresh_token");
      if (setup === "1" && accountIdFromHash && refreshToken) {
        const newAuthState: AuthState = {
          is_authenticated: true,
          account_id: accountIdFromHash,
        };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
        sessionStorage.setItem(
          SETUP_TOKENS_KEY,
          JSON.stringify({ refreshToken, accountId: accountIdFromHash })
        );
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.search
        );
        setAppState("setup");
        return;
      }
    }

    // Check for setup tokens in sessionStorage (e.g. user refreshed on setup screen)
    const storedSetup = sessionStorage.getItem(SETUP_TOKENS_KEY);
    if (storedSetup) {
      try {
        JSON.parse(storedSetup);
        setAppState("setup");
        return;
      } catch {
        sessionStorage.removeItem(SETUP_TOKENS_KEY);
      }
    }

    // Server redirects here after OAuth with ?auth=success&account_id=xxx or ?auth=error&message=xxx
    const authResult = urlParams.get("auth");
    const accountId = urlParams.get("account_id");
    const errorMessage = urlParams.get("message");

    if (authResult === "success" && accountId) {
      // Redirect from auth_callback with success
      const newAuthState: AuthState = {
        is_authenticated: true,
        account_id: accountId,
      };
      setAuthState(newAuthState);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
      window.history.replaceState({}, "", window.location.pathname);

      const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
      if (savedFolder) {
        try {
          const folder = JSON.parse(savedFolder) as FolderInfo;
          setSelectedFolder(folder);
          setAppState("ready");
        } catch {
          setAppState("folder-selection");
        }
      } else {
        setAppState("folder-selection");
      }
      return;
    }

    if (authResult === "error") {
      // Redirect from auth_callback with error
      window.history.replaceState({}, "", window.location.pathname);
      if (errorMessage) {
        console.error("Auth error:", errorMessage);
      }
      setAppState("login");
      return;
    }

    // Legacy: code + state in URL (frontend calls API) — keep for compatibility
    // This is handled by the useAuthCallback hook below

    // Not an OAuth callback, check saved auth state
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth) as AuthState;
        if (auth.is_authenticated) {
          setAuthState(auth);

          // Check for saved folder preference
          const savedFolder = localStorage.getItem(FOLDER_PREFERENCE_KEY);
          if (savedFolder) {
            try {
              const folder = JSON.parse(savedFolder) as FolderInfo;
              setSelectedFolder(folder);
              setAppState("ready");
            } catch {
              // Invalid saved folder, show selector
              setAppState("folder-selection");
            }
          } else {
            // No saved folder, show selector
            setAppState("folder-selection");
          }
        } else {
          setAppState("login");
        }
      } catch {
        // Invalid saved auth, show login
        setAppState("login");
      }
    } else {
      // No saved auth, show login
      setAppState("login");
    }
  };

  /**
   * Handle folder selection
   */
  const handleFolderSelected = (folder: FolderInfo) => {
    if (folder.path !== selectedFolder?.path) {
      clearPersistedSession();
      setSessionId(null);
      setSessionQueue([]);
      setSessionIndex(0);
      setUndoStack([]);
    }
    setSelectedFolder(folder);
    setAppState("ready");
  };

  /**
   * Handle logout: clear server-side token then local state
   */
  const handleLogout = () => {
    void logout().finally(() => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(FOLDER_PREFERENCE_KEY);
      setAuthState({ is_authenticated: false });
      setSelectedFolder(null);
      setAppState("login");
    });
  };

  /**
   * Handle change folder (go back to folder selection)
   */
  const handleChangeFolder = () => {
    setAppState("folder-selection");
  };

  /**
   * Start a triage session: fetch images, filter out already-reviewed, shuffle, set session state.
   * If user had a resumable session and chose "Start new session", merge that session's seen paths
   * into folder progress so we never show the same pic again.
   */
  const startSession = useCallback(
    async (options?: { clearProgress?: boolean }) => {
      if (!selectedFolder) return;
      setSessionListError(null);
      setSessionListLoading(true);

      // If starting new while we have a resumable session for this folder, merge "seen" into folder progress
      const saved = loadSessionFromStorage();
      if (
        saved &&
        saved.folder.path === selectedFolder.path &&
        isSessionResumable(saved)
      ) {
        try {
          const raw = localStorage.getItem(FOLDER_PROGRESS_KEY);
          const store: FolderProgressStore = raw
            ? (JSON.parse(raw) as FolderProgressStore)
            : {};
          const list = store[selectedFolder.path] ?? [];
          const seenSet = new Set(list);
          for (let i = 0; i < saved.index && i < saved.queue.length; i++) {
            const e = saved.queue[i];
            const key = e?.path_lower ?? e?.path_display;
            if (key && !seenSet.has(key)) {
              seenSet.add(key);
              list.push(key);
            }
          }
          if (list.length > 0) {
            store[selectedFolder.path] = list;
            localStorage.setItem(FOLDER_PROGRESS_KEY, JSON.stringify(store));
          }
        } catch {
          // ignore
        }
      }
      clearPersistedSession();

      if (options?.clearProgress) {
        clearFolderProgress(selectedFolder.path);
      }

      try {
        const res = await listImages(selectedFolder.path);
        const rawEntries = res.entries ?? [];
        // Dedupe by path (edge case: duplicate files)
        const seen = new Set<string>();
        const deduped = rawEntries.filter((e) => {
          const key = e.path_lower ?? e.path_display;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const reviewed = getFolderProgress(selectedFolder.path);
        const entries = options?.clearProgress
          ? deduped
          : deduped.filter((e) => !reviewed.has(e.path_lower ?? e.path_display));

        if (entries.length === 0) {
          setSessionListError(
            options?.clearProgress
              ? "No images found in this folder."
              : "You've reviewed all images in this folder. Start completely fresh to see them again."
          );
          setSessionListLoading(false);
          return;
        }
        const capped =
          entries.length > MAX_QUEUE_SIZE
            ? entries.slice(0, MAX_QUEUE_SIZE)
            : entries;
        if (capped.length < entries.length) {
          showToast(
            `Showing first ${MAX_QUEUE_SIZE} of ${entries.length} images. Start another session for the rest.`
          );
        }
        const shuffled = shuffleArray(capped);
        const id = crypto.randomUUID();
        setSessionQueue(shuffled);
        setSessionIndex(0);
        setSessionId(id);
        setUndoStack([]);
        setSessionListLoading(false);
        saveSessionToStorage(id, selectedFolder, shuffled, 0, []);
      } catch (err: unknown) {
        const message = normalizeError(err);
        setSessionListError(message);
        showApiError(err, () => void startSession());
      } finally {
        setSessionListLoading(false);
      }
    },
    [selectedFolder, showApiError, showToast]
  );

  const currentEntry = sessionQueue[sessionIndex] ?? null;
  const nextEntry = sessionQueue[sessionIndex + 1] ?? null;
  const nextEntry2 = sessionQueue[sessionIndex + 2] ?? null;
  const trashedCount = undoStack.length;
  const keptCount = sessionIndex - trashedCount;
  const totalCount = sessionQueue.length;
  const isSessionComplete = totalCount > 0 && sessionIndex >= totalCount;

  const onKeep = useCallback(() => {
    if (actionBusy || !currentEntry || !selectedFolder || !sessionId) return;
    setActionError(null);
    addReviewedPath(
      selectedFolder.path,
      currentEntry.path_lower ?? currentEntry.path_display
    );
    const next = sessionIndex + 1;
    setSessionIndex(next);
    saveSessionToStorage(
      sessionId,
      selectedFolder,
      sessionQueue,
      next,
      undoStack
    );
  }, [
    actionBusy,
    currentEntry,
    selectedFolder,
    sessionIndex,
    sessionId,
    sessionQueue,
    undoStack,
  ]);

  /** Retry the last failed delete (used by toast from showApiError) */
  const retryLastDelete = useCallback(() => {
    const failed = lastFailedDelete;
    if (!failed) return;
    setLastFailedDelete(null);
    setActionError(null);
    void apiTrash(failed.path, failed.sessionId)
      .then((result) => {
        if (!result.success || !result.trash_record) {
          throw new Error(result.error ?? "Delete failed");
        }
        if (sessionIdRef.current !== failed.sessionId) return;
        const newUndoItem: UndoStackItem = {
          record: result.trash_record,
          entry: failed.entry,
        };
        setUndoStack((prev) => {
          const next = [...prev, newUndoItem];
          const folder = selectedFolder;
          if (folder) {
            saveSessionToStorage(
              failed.sessionId,
              folder,
              sessionQueueRef.current,
              sessionIndexRef.current,
              next
            );
          }
          return next;
        });
        maybeConfetti(
          undoStackRef.current.length + 1,
          getConfettiFrequency()
        );
        showToast("Delete completed.", { variant: "success" });
      })
      .catch((err: unknown) => {
        setLastFailedDelete(failed);
        showApiError(err, () => retryLastDelete());
      });
  }, [lastFailedDelete, selectedFolder, showApiError, showToast]);

  const onDelete = useCallback(() => {
    if (!currentEntry || !sessionId || !selectedFolder) return;
    setActionError(null);
    setLastFailedDelete(null);

    const entry = currentEntry;
    const pathKey = entry.path_lower ?? entry.path_display;

    // Optimistic: advance to next image immediately
    addReviewedPath(selectedFolder.path, pathKey);
    const nextIndex = sessionIndex + 1;
    setSessionIndex(nextIndex);
    saveSessionToStorage(
      sessionId,
      selectedFolder,
      sessionQueue,
      nextIndex,
      undoStack
    );

    // Move to trash in background; add to undo stack when done
    void apiTrash(entry.path_display, sessionId)
      .then((result) => {
        if (!result.success || !result.trash_record) {
          throw new Error(result.error ?? "Delete failed");
        }
        if (sessionIdRef.current !== sessionId) return;
        const record = result.trash_record;
        const newUndoItem: UndoStackItem = { record, entry };
        setUndoStack((prev) => [...prev, newUndoItem]);
        maybeConfetti(undoStack.length + 1, getConfettiFrequency());
        saveSessionToStorage(
          sessionId,
          selectedFolder,
          sessionQueue,
          nextIndex,
          [...undoStack, newUndoItem]
        );
      })
      .catch((err: unknown) => {
        removeReviewedPath(selectedFolder.path, pathKey);
        setLastFailedDelete({
          path: entry.path_display,
          sessionId,
          entry,
        });
        showApiError(err, () => retryLastDelete());
      });
  }, [
    currentEntry,
    sessionId,
    selectedFolder,
    sessionQueue,
    sessionIndex,
    undoStack,
    showApiError,
    retryLastDelete,
  ]);

  const onUndo = useCallback(async () => {
    const item = undoStack[undoStack.length - 1];
    if (actionBusy || !item || !sessionId || !selectedFolder) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const result = await apiUndo(
        item.record.trashed_path,
        item.record.original_path
      );
      if (!result.success) {
        throw new Error(result.error ?? "Undo failed");
      }
      removeReviewedPath(
        selectedFolder.path,
        item.entry.path_lower ?? item.entry.path_display
      );
      const newUndoStack = undoStack.slice(0, -1);
      const newQueue = [...sessionQueue];
      newQueue.splice(sessionIndex, 0, item.entry);
      setUndoStack(newUndoStack);
      setSessionQueue(newQueue);
      saveSessionToStorage(
        sessionId,
        selectedFolder,
        newQueue,
        sessionIndex,
        newUndoStack
      );
      showToast("Photo restored.", { variant: "success" });
    } catch (err: unknown) {
      const message = normalizeError(err);
      setActionError(message);
      showApiError(err, () => void onUndo());
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    undoStack,
    sessionId,
    selectedFolder,
    sessionQueue,
    sessionIndex,
    showApiError,
    showToast,
  ]);

  // Clear action error after a delay so user can read it
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(t);
  }, [actionError]);

  // Keyboard shortcuts K, D, U
  useEffect(() => {
    if (appState !== "ready" || showSettings || isSessionComplete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        onKeep();
      } else if (key === "d") {
        e.preventDefault();
        void onDelete();
      } else if (key === "u") {
        e.preventDefault();
        void onUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appState, showSettings, isSessionComplete, onKeep, onDelete, onUndo]);

  // Phase 6: clear persisted session when session completes so reload doesn't offer resume
  useEffect(() => {
    if (isSessionComplete) {
      clearPersistedSession();
    }
  }, [isSessionComplete]);

  // One-time confetti when user lands on session complete (if they have confetti enabled)
  useEffect(() => {
    if (!isSessionComplete || totalCount === 0) return;
    if (getConfettiFrequency() === "off") return;
    if (prefersReducedMotion()) return;
    const t = setTimeout(() => {
      void confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
        colors: CONFETTI_COLORS,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [isSessionComplete, totalCount]);

  // Phase 6: clear expired or wrong-folder session when on start prompt (handle expired sessions gracefully)
  useEffect(() => {
    if (appState !== "ready" || !selectedFolder) return;
    const saved = loadSessionFromStorage();
    if (!saved) return;
    const sameFolder = saved.folder.path === selectedFolder.path;
    const resumable = isSessionResumable(saved);
    if (!sameFolder || !resumable) {
      clearPersistedSession();
    }
    // Intentionally depend on path only so we don't re-run when FolderInfo reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, selectedFolder?.path]);

  /** Restore session from localStorage (Phase 6) */
  const resumeSession = useCallback(() => {
    const saved = loadSessionFromStorage();
    if (
      !saved ||
      !selectedFolder ||
      saved.folder.path !== selectedFolder.path ||
      !isSessionResumable(saved)
    ) {
      return;
    }
    setSessionId(saved.sessionId);
    setSessionQueue(saved.queue);
    setSessionIndex(saved.index);
    setUndoStack(saved.undoStack);
  }, [selectedFolder]);

  if (appState === "loading") {
    return (
      <main className="page-main">
        <p style={{ color: "var(--text)", fontSize: "0.9375rem" }}>Loading…</p>
      </main>
    );
  }

  if (appState === "login") {
    return (
      <main className="page-main">
        <Login />
      </main>
    );
  }

  if (appState === "setup") {
    return (
      <main className="page-main">
        <SetupAddTokens
          onContinue={() => {
            sessionStorage.removeItem(SETUP_TOKENS_KEY);
            setAppState("folder-selection");
          }}
          onCancel={handleLogout}
        />
      </main>
    );
  }

  if (appState === "folder-selection") {
    return (
      <main className="page-main">
        <FolderSelector
          onFolderSelected={handleFolderSelected}
          onCancel={handleLogout}
        />
      </main>
    );
  }

  // appState === 'ready' — triage session or start/completion screens
  const hasActiveSession = sessionId !== null && sessionQueue.length > 0;
  const showStartPrompt =
    !hasActiveSession && !sessionListLoading && sessionQueue.length === 0;

  // Phase 6: offer resume if we have a resumable persisted session for this folder (computed for UI only)
  const persistedSession =
    showStartPrompt && selectedFolder ? loadSessionFromStorage() : null;
  const canResume =
    persistedSession != null &&
    persistedSession.folder.path === selectedFolder?.path &&
    isSessionResumable(persistedSession);

  if (showSettings) {
    return (
      <main className="page-main">
        <Settings
          onClose={() => setShowSettings(false)}
          onSettingChange={() => {}}
        />
      </main>
    );
  }

  if (showStartPrompt) {
    return (
      <main className="page-main">
        <div
          className="content-wrap"
          style={{
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <header style={{ textAlign: "center" }}>
            <h1
              className="text-gradient"
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 600,
                fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              PicSift
            </h1>
            <p
              style={{
                color: "var(--text)",
                margin: "0.5rem 0 0 0",
                fontSize: "0.9375rem",
              }}
            >
              Ready to start
            </p>
          </header>

          <section
            style={{
              padding: "1.25rem 1rem",
              backgroundColor: "var(--bg-elevated)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            <p
              style={{ color: "var(--text)", margin: 0, fontSize: "0.8125rem" }}
            >
              Selected folder
            </p>
            <p
              style={{
                color: "var(--text-h)",
                margin: "0.25rem 0 0 0",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              {selectedFolder?.name}
            </p>
            <p
              style={{
                color: "var(--text)",
                margin: "0.5rem 0 0 0",
                fontSize: "0.8125rem",
              }}
            >
              {selectedFolder?.image_count} images to review
            </p>
          </section>

          {sessionListError && (
            <p
              style={{
                color: "var(--error-text)",
                margin: 0,
                fontSize: "0.875rem",
              }}
            >
              {sessionListError}
            </p>
          )}

          {canResume && (
            <p
              style={{
                color: "var(--text)",
                margin: 0,
                fontSize: "0.8125rem",
              }}
            >
              You have a session in progress. Resume or start fresh.
            </p>
          )}

          <div className="actions-row">
            {canResume && (
              <button
                type="button"
                className="touch-target-inline"
                onClick={resumeSession}
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  backgroundColor: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Resume session
              </button>
            )}
            <button
              type="button"
              className="touch-target-inline"
              onClick={() => void startSession()}
              disabled={sessionListLoading}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                backgroundColor: canResume
                  ? "var(--bg-elevated)"
                  : "var(--accent)",
                color: canResume ? "var(--text-h)" : "white",
                border: canResume ? "1px solid var(--border)" : "none",
                borderRadius: "8px",
                cursor: sessionListLoading ? "wait" : "pointer",
                opacity: sessionListLoading ? 0.8 : 1,
              }}
            >
              {sessionListLoading
                ? "Loading…"
                : canResume
                  ? "Start new session"
                  : "Start session"}
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={() => void startSession({ clearProgress: true })}
              disabled={sessionListLoading}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: sessionListLoading ? "wait" : "pointer",
                opacity: sessionListLoading ? 0.8 : 1,
              }}
            >
              Start completely fresh
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleChangeFolder}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Change folder
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleLogout}
              style={{
                fontSize: "0.9375rem",
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (sessionListLoading && sessionQueue.length === 0) {
    return (
      <main className="page-main">
        <p style={{ color: "var(--text)", fontSize: "0.9375rem" }}>
          Loading images…
        </p>
      </main>
    );
  }

  if (isSessionComplete) {
    return (
      <main className="page-main">
        <div
          className="content-wrap"
          style={{
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <h1
            className="text-gradient"
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: "1.5rem",
              margin: 0,
              textAlign: "center",
            }}
          >
            Session complete
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text)",
              fontSize: "0.9375rem",
              textAlign: "center",
            }}
          >
            Nice work—you're all caught up. Ready for another round?
          </p>
          <section
            className="card-gradient-accent"
            style={{
              padding: "1.25rem",
            }}
          >
            <p
              style={{ color: "var(--text)", margin: 0, fontSize: "0.9375rem" }}
            >
              Kept:{" "}
              <strong style={{ color: "var(--text-h)" }}>{keptCount}</strong>
            </p>
            <p
              style={{
                color: "var(--text)",
                margin: "0.5rem 0 0 0",
                fontSize: "0.9375rem",
              }}
            >
              Deleted:{" "}
              <strong style={{ color: "var(--text-h)" }}>{trashedCount}</strong>
            </p>
          </section>
          <div className="actions-row">
            <button
              type="button"
              className="touch-target-inline"
              onClick={() => {
                setSessionId(null);
                setSessionQueue([]);
                setSessionIndex(0);
                setUndoStack([]);
                void startSession();
              }}
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                backgroundColor: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Start new session
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleChangeFolder}
              style={{
                fontSize: "0.9375rem",
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Change folder
            </button>
            <button
              type="button"
              className="touch-target-inline"
              onClick={handleLogout}
              style={{
                fontSize: "0.9375rem",
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Active triage: Viewer + Controls + settings gear
  // On mobile, controls are in a fixed bottom bar (triage-controls-bar) so they stay thumb-accessible
  return (
    <main className="page-main page-main--triage">
      <div className="triage-scroll">
        <div
          className="content-wrap"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          <header
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h1
              className="text-gradient"
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 600,
                fontSize: "1.25rem",
                margin: 0,
              }}
            >
              PicSift
            </h1>
            <button
              type="button"
              className="touch-target"
              onClick={() => setShowSettings(true)}
              style={{
                width: "var(--touch-min)",
                height: "var(--touch-min)",
                padding: 0,
                border: "none",
                borderRadius: "8px",
                backgroundColor: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Settings"
            >
              <SettingsIcon sx={{ fontSize: 24 }} />
            </button>
          </header>

          <Viewer
              currentEntry={currentEntry}
              nextEntry={nextEntry}
              nextEntry2={nextEntry2}
            />

          {actionError && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                color: "var(--error-text)",
                backgroundColor: "var(--error-bg)",
                border: "1px solid var(--error-border)",
                borderRadius: "8px",
                width: "100%",
                maxWidth: "var(--content-max)",
                textAlign: "center",
              }}
            >
              {actionError}
            </p>
          )}
        </div>
      </div>

      <div className="triage-controls-bar">
        <Controls
          onKeep={onKeep}
          onDelete={() => void onDelete()}
          onUndo={() => void onUndo()}
          currentPosition={sessionIndex + 1}
          totalCount={totalCount}
          canUndo={undoStack.length > 0}
          isBusy={actionBusy}
        />
        <div className="actions-row" style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            className="touch-target-inline"
            onClick={handleChangeFolder}
            style={{
              fontSize: "0.8125rem",
              backgroundColor: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Change folder
          </button>
          <button
            type="button"
            className="touch-target-inline"
            onClick={handleLogout}
            style={{
              fontSize: "0.8125rem",
              backgroundColor: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
