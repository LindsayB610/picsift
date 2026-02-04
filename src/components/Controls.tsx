/**
 * Triage controls: Keep, Delete, Undo with keyboard shortcut labels and progress
 */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";

export interface ControlsProps {
  onKeep: () => void;
  onDelete: () => void;
  onUndo: () => void;
  /** 1-based current position (e.g. 37) */
  currentPosition: number;
  /** Total number of images (e.g. 500) */
  totalCount: number;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether an action is in progress (e.g. delete/undo API call) */
  isBusy?: boolean;
}

const buttonBase = {
  minHeight: "var(--touch-min)",
  padding: "0.625rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  transition: "background-color 0.15s ease, opacity 0.15s ease",
} as const;

export default function Controls({
  onKeep,
  onDelete,
  onUndo,
  currentPosition,
  totalCount,
  canUndo,
  isBusy = false,
}: ControlsProps) {
  return (
    <div
      className="triage-controls"
      style={{
        width: "100%",
        maxWidth: "var(--content-max)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <p
        className="triage-progress"
        style={{
          margin: 0,
          color: "var(--text)",
          fontSize: "0.9375rem",
          textAlign: "center",
        }}
        aria-live="polite"
      >
        {currentPosition} of {totalCount}
      </p>

      <div
        className="controls-buttons"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="touch-target-inline"
          onClick={onKeep}
          disabled={isBusy}
          style={{
            ...buttonBase,
            backgroundColor: "var(--accent)",
            color: "white",
            opacity: isBusy ? 0.7 : 1,
          }}
          onMouseOver={(e) => {
            if (!isBusy)
              e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
          aria-label="Keep (K)"
        >
          <CheckCircleIcon sx={{ fontSize: 20 }} />
          <span aria-hidden="true">Keep</span>
          <kbd
            style={{
              fontSize: "0.75rem",
              opacity: 0.9,
              padding: "0.1em 0.35em",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.2)",
            }}
          >
            K
          </kbd>
        </button>

        <button
          type="button"
          className="touch-target-inline"
          onClick={onDelete}
          disabled={isBusy}
          style={{
            ...buttonBase,
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-h)",
            border: "1px solid var(--border)",
            opacity: isBusy ? 0.7 : 1,
          }}
          onMouseOver={(e) => {
            if (!isBusy) {
              e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--text)";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
          aria-label="Delete (D)"
        >
          <DeleteIcon sx={{ fontSize: 20 }} />
          <span aria-hidden="true">Delete</span>
          <kbd
            style={{
              fontSize: "0.75rem",
              padding: "0.1em 0.35em",
              borderRadius: "4px",
              background: "var(--border)",
              color: "var(--text-h)",
            }}
          >
            D
          </kbd>
        </button>

        <button
          type="button"
          className="touch-target-inline"
          onClick={onUndo}
          disabled={isBusy || !canUndo}
          style={{
            ...buttonBase,
            backgroundColor: canUndo
              ? "var(--bg-elevated)"
              : "var(--bg-secondary)",
            color: canUndo ? "var(--text-h)" : "var(--text)",
            border: "1px solid var(--border)",
            opacity: isBusy || !canUndo ? 0.6 : 1,
            cursor: canUndo && !isBusy ? "pointer" : "default",
          }}
          onMouseOver={(e) => {
            if (canUndo && !isBusy) {
              e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--text)";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = canUndo
              ? "var(--bg-elevated)"
              : "var(--bg-secondary)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
          aria-label="Undo last delete (U)"
          aria-disabled={!canUndo}
        >
          <UndoIcon sx={{ fontSize: 20 }} />
          <span aria-hidden="true">Undo</span>
          <kbd
            style={{
              fontSize: "0.75rem",
              padding: "0.1em 0.35em",
              borderRadius: "4px",
              background: "var(--border)",
              color: "var(--text-h)",
            }}
          >
            U
          </kbd>
        </button>
      </div>
    </div>
  );
}
