/**
 * Image viewer: displays current image, preloads next, handles loading and error states
 * Phase 7: normalized error display
 */

import { useEffect, useState } from "react";
import { useTempLink } from "../hooks/useTempLink";
import { normalizeError } from "../utils/error";
import type { DbxEntry } from "../types";

export interface ViewerProps {
  /** Current image entry to display */
  currentEntry: DbxEntry | null;
  /** Next entry (for preloading only) */
  nextEntry?: DbxEntry | null;
}

export default function Viewer({
  currentEntry,
  nextEntry = null,
}: ViewerProps) {
  const currentPath = currentEntry?.path_display ?? null;
  const nextPath = nextEntry?.path_display ?? null;
  const [imageLoadError, setImageLoadError] = useState(false);

  const {
    data: currentUrl,
    isLoading: currentLoading,
    isError: currentError,
    error: currentErrorDetail,
  } = useTempLink(currentPath);

  const { data: nextUrl } = useTempLink(nextPath);

  // Reset image load error when entry changes
  useEffect(() => {
    setImageLoadError(false);
  }, [currentPath]);

  // Preload next image
  useEffect(() => {
    if (!nextUrl) return;
    const img = new Image();
    img.src = nextUrl;
  }, [nextUrl]);

  if (!currentEntry) {
    return (
      <div
        className="viewer-placeholder"
        style={{
          width: "100%",
          aspectRatio: "4/3",
          maxHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <p style={{ color: "var(--text)", margin: 0, fontSize: "0.9375rem" }}>
          No image
        </p>
      </div>
    );
  }

  if (currentLoading) {
    return (
      <div
        className="viewer-loading"
        style={{
          width: "100%",
          aspectRatio: "4/3",
          maxHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <p style={{ color: "var(--text)", margin: 0, fontSize: "0.9375rem" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (currentError || !currentUrl || imageLoadError) {
    return (
      <div
        className="viewer-error"
        style={{
          width: "100%",
          aspectRatio: "4/3",
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "1rem",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "12px",
          border: "1px solid var(--error-border)",
        }}
      >
        <p
          style={{
            color: "var(--error-text)",
            margin: 0,
            fontSize: "0.9375rem",
            textAlign: "center",
          }}
        >
          Failed to load image
        </p>
        {(currentErrorDetail != null || imageLoadError) && (
          <p
            style={{
              color: "var(--text)",
              margin: 0,
              fontSize: "0.8125rem",
              textAlign: "center",
            }}
          >
            {imageLoadError
              ? "Image could not be displayed"
              : currentErrorDetail != null
                ? normalizeError(currentErrorDetail)
                : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="viewer-image-wrap"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        maxHeight: "60vh",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <img
        src={currentUrl}
        alt={currentEntry.name}
        style={{
          maxWidth: "100%",
          maxHeight: "60vh",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          display: "block",
        }}
        loading="eager"
        decoding="async"
        onError={() => setImageLoadError(true)}
      />
    </div>
  );
}
