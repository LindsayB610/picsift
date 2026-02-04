/**
 * Error normalization for Netlify Functions (Phase 7)
 * Per TypeScript Standards: catch (err: unknown) then normalizeError(err).
 */

/**
 * Normalize unknown thrown values to a user-facing message.
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
