/**
 * Error normalization and classification (Phase 7)
 * All catch blocks should use normalizeError; use isCriticalError for modal vs toast.
 */

/**
 * Normalize unknown thrown values to a user-facing message.
 * Per TypeScript Standards: catch (err: unknown) then normalizeError(err).
 */
export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    err != null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Error category for UI: critical (modal) vs transient (toast).
 */
export type ErrorCategory = "critical" | "transient";

/**
 * Classify error for display: critical errors show in a modal (e.g. auth),
 * transient errors show as toast (network, API, file not found, rate limit).
 */
export function getErrorCategory(
  err: unknown,
  context?: { status?: number; message?: string }
): ErrorCategory {
  const status = context?.status;
  const message = (context?.message ?? normalizeError(err)).toLowerCase();

  // Auth / access denied → critical (modal)
  if (status === 401 || status === 403) return "critical";
  if (
    message.includes("access denied") ||
    message.includes("unauthorized") ||
    message.includes("authorized users only") ||
    message.includes("authentication")
  ) {
    return "critical";
  }

  // Network, 5xx, rate limit, file not found → transient (toast)
  return "transient";
}

/**
 * Check if a message suggests rate limiting (for retry UI).
 */
export function isRateLimitError(err: unknown): boolean {
  const msg = normalizeError(err).toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429")
  );
}

/**
 * Check if error is a network failure (for retry UI).
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Failed to fetch")
    return true;
  const msg = normalizeError(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("connection")
  );
}
