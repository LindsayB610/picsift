/**
 * Login component
 * Displays README content and "Login with Dropbox" button
 * Phase 7: normalized error display
 */

import ReactMarkdown from "react-markdown";
import { useStartAuth } from "../hooks/useAuth";
import { normalizeError } from "../utils/error";

const README_CONTENT = `# PicSift

**A calm way to sift through your photos, one decision at a time.**

PicSift is a personal photo triage web app that helps you quickly decide which photos to keep and which to delete. It presents photos one at a time in random order, making it easy to make quick decisions without feeling overwhelmed.

---

## Features

- **One photo at a time**: Focus on a single decision without distraction
- **Random order**: Prevents decision fatigue from chronological sorting
- **Undo-safe**: Deleted photos are moved to quarantine, not permanently deleted
- **Fast keyboard shortcuts**: \`K\` to keep, \`D\` to delete, \`U\` to undo
- **Progress tracking**: See how many photos you've reviewed
- **Dropbox integration**: Works with your Dropbox folders

---

## How It Works

1. **Authenticate** with your Dropbox account (one-time setup)
2. **Select a folder** containing your photos
3. **Review photos** one at a time
4. **Make decisions**: Keep or delete each photo
5. **Undo if needed**: Accidentally deleted? Just undo it
6. **Quarantine safety**: Deleted photos are moved to \`/_TRASHME/\` for later review

---

## Safety First

- **No permanent deletes**: Photos are moved to quarantine, not deleted
- **Undo support**: Restore any photo you've deleted
- **Dropbox recovery**: Dropbox's built-in recovery still applies
- **Session-based**: Each session creates its own quarantine folder

---

## Keyboard Shortcuts

- \`K\` - Keep this photo
- \`D\` - Delete this photo (move to quarantine)
- \`U\` - Undo last delete

---

## Privacy & Security

- Single-user app (personal use only)
- All Dropbox API calls happen server-side
- Access tokens never exposed to your browser
- Open source and transparent

---

**Guiding principle**: Make it feel good to decide. Make it hard to make an irreversible mistake.`;

export default function Login() {
  const startAuthMutation = useStartAuth();

  const handleLogin = () => {
    void startAuthMutation.mutate(undefined, {
      onSuccess: (response) => {
        // Redirect to Dropbox OAuth
        if (response.redirect_url) {
          window.location.href = response.redirect_url;
        }
      },
      onError: () => {
        // Error is handled by the error state below
      },
    });
  };

  return (
    <div
      className="content-wrap"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <div
        className="markdown-content"
        style={{
          backgroundColor: "var(--bg-secondary)",
          padding: "1.25rem 1rem",
          borderRadius: "12px",
          lineHeight: "1.6",
          border: "1px solid var(--border)",
          maxHeight: "60vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <ReactMarkdown>{README_CONTENT}</ReactMarkdown>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <button
          type="button"
          className="touch-target-inline"
          onClick={handleLogin}
          disabled={startAuthMutation.isPending}
          style={{
            width: "100%",
            padding: "0.875rem 1.5rem",
            fontSize: "1rem",
            fontWeight: "600",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: startAuthMutation.isPending ? "not-allowed" : "pointer",
            opacity: startAuthMutation.isPending ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {startAuthMutation.isPending ? "Connecting..." : "Login with Dropbox"}
        </button>

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
      </div>
    </div>
  );
}
