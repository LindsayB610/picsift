/**
 * Login component
 * Visual homepage: how it works, shortcuts, and "Login with Dropbox"
 * Phase 7: normalized error display
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useStartAuth } from "../hooks/useAuth";
import { normalizeError } from "../utils/error";

const STEPS = [
  { label: "Connect", detail: "Link your Dropbox (one-time)" },
  { label: "Pick a folder", detail: "Choose which photos to sift" },
  { label: "Sift", detail: "One photo at a time, keep or delete" },
  { label: "Done", detail: "Undo anytime; nothing is permanent" },
] as const;

const README_CONTENT = `## Features

- **One photo at a time**: Focus on a single decision without distraction
- **Random order**: Prevents decision fatigue from chronological sorting
- **Undo-safe**: Deleted photos are moved to quarantine, not permanently deleted
- **Dropbox integration**: Works with your Dropbox folders

## Safety

- Photos are moved to quarantine (\`/_TRASHME/\`), not deleted
- Undo restores any photo you've removed
- Dropbox's built-in recovery still applies

## Privacy & Security

- Single-user app (personal use only)
- All Dropbox API calls happen server-side
- Access tokens never exposed to your browser
- Open source and transparent`;

export default function Login() {
  const startAuthMutation = useStartAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const showConnecting = isConnecting || startAuthMutation.isPending;

  const handleLogin = () => {
    setIsConnecting(true);
    void startAuthMutation.mutate(undefined, {
      onSuccess: (response) => {
        if (response.redirect_url) {
          window.location.href = response.redirect_url;
        } else {
          setIsConnecting(false);
        }
      },
      onError: () => {
        setIsConnecting(false);
      },
    });
  };

  return (
    <div
      className="content-wrap login-home"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <header className="login-hero" style={{ textAlign: "center" }}>
        <h1
          className="text-gradient"
          style={{
            fontFamily: "var(--sans)",
            fontWeight: 600,
            fontSize: "clamp(2rem, 6vw, 2.75rem)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          PicSift
        </h1>
        <p
          style={{
            color: "var(--text)",
            margin: "0.5rem auto 0",
            fontSize: "1rem",
            maxWidth: "20ch",
          }}
        >
          One photo at a time. Keep or delete. No overwhelm.
        </p>
      </header>

      <section
        className="login-steps"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.5rem",
          width: "100%",
        }}
        aria-label="How it works"
      >
        {STEPS.map(({ label, detail }, i) => (
          <div
            key={label}
            className="login-step"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.75rem 0.5rem",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span
              className="login-step-badge"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--brand-gradient)",
                color: "var(--bg)",
                fontSize: "0.875rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                color: "var(--text-h)",
                fontWeight: 600,
                fontSize: "0.8125rem",
              }}
            >
              {label}
            </span>
            <span
              style={{
                color: "var(--text)",
                fontSize: "0.6875rem",
                lineHeight: 1.2,
              }}
            >
              {detail}
            </span>
          </div>
        ))}
      </section>

      <section
        className="login-shortcuts"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          justifyContent: "center",
          alignItems: "center",
        }}
        aria-label="Keyboard shortcuts"
      >
        <span
          style={{
            color: "var(--text)",
            fontSize: "0.8125rem",
            marginRight: "0.25rem",
          }}
        >
          Quick keys:
        </span>
        <span
          className="login-key"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.6rem",
            backgroundColor: "var(--accent-light)",
            border: "1px solid var(--accent)",
            borderRadius: "8px",
            color: "var(--text-h)",
            fontSize: "0.8125rem",
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 16 }} />
          <kbd>K</kbd> Keep
        </span>
        <span
          className="login-key"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.6rem",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-h)",
            fontSize: "0.8125rem",
          }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
          <kbd>D</kbd> Delete
        </span>
        <span
          className="login-key"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.6rem",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-h)",
            fontSize: "0.8125rem",
          }}
        >
          <UndoIcon sx={{ fontSize: 16 }} />
          <kbd>U</kbd> Undo
        </span>
      </section>

      <p
        style={{
          color: "var(--text)",
          margin: 0,
          fontSize: "0.8125rem",
          textAlign: "center",
        }}
      >
        Photos go to quarantine, not the bin. Undo anytime.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <button
          type="button"
          className="touch-target-inline"
          onClick={handleLogin}
          disabled={showConnecting}
          aria-busy={showConnecting}
          aria-live="polite"
          style={{
            width: "100%",
            padding: "0.875rem 1.5rem",
            fontSize: "1rem",
            fontWeight: "600",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: showConnecting ? "wait" : "pointer",
            opacity: showConnecting ? 0.9 : 1,
            transition: "opacity 0.2s",
            minHeight: "var(--touch-min)",
          }}
        >
          {showConnecting ? "Connecting…" : "Login with Dropbox"}
        </button>
        {showConnecting && (
          <div
            className="discover-loading-bar"
            style={{ marginTop: "0.25rem" }}
            role="status"
            aria-hidden="true"
          >
            <div className="discover-loading-bar-fill" />
          </div>
        )}

        {startAuthMutation.isError && (
          <div
            role="alert"
            style={{
              padding: "1rem",
              backgroundColor: "var(--error-bg)",
              color: "var(--error-text)",
              borderRadius: "8px",
              border: "1px solid var(--error-border)",
            }}
          >
            {normalizeError(startAuthMutation.error)}
          </div>
        )}

        <button
          type="button"
          className="touch-target-inline"
          onClick={() => setShowMore(!showMore)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
            padding: "0.5rem",
            fontSize: "0.875rem",
            color: "var(--text)",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "8px",
          }}
          aria-expanded={showMore}
        >
          {showMore ? (
            <ExpandLessIcon sx={{ fontSize: 20 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 20 }} />
          )}
          {showMore ? "Less" : "More about PicSift"}
        </button>

        {showMore && (
          <div
            className="markdown-content login-more"
            style={{
              backgroundColor: "var(--bg-secondary)",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              maxHeight: "40vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <ReactMarkdown>{README_CONTENT}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
