/**
 * Settings: confetti frequency and other preferences (localStorage)
 */

import { useEffect, useRef } from "react";
import SettingsIcon from "@mui/icons-material/Settings";

export const CONFETTI_STORAGE_KEY = "picsift:confettiFrequency";

export type ConfettiFrequency = "1" | "5" | "10" | "25" | "off";

export const CONFETTI_OPTIONS: { value: ConfettiFrequency; label: string }[] = [
  { value: "1", label: "Every delete" },
  { value: "5", label: "Every 5 deletes" },
  { value: "10", label: "Every 10 deletes" },
  { value: "25", label: "Every 25 deletes" },
  { value: "off", label: "Off" },
];

const DEFAULT_CONFETTI_FREQUENCY: ConfettiFrequency = "5";

export function getConfettiFrequency(): ConfettiFrequency {
  try {
    const raw = localStorage.getItem(CONFETTI_STORAGE_KEY);
    if (raw && CONFETTI_OPTIONS.some((o) => o.value === raw)) {
      return raw as ConfettiFrequency;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFETTI_FREQUENCY;
}

export function setConfettiFrequency(value: ConfettiFrequency): void {
  localStorage.setItem(CONFETTI_STORAGE_KEY, value);
}

export interface SettingsProps {
  onClose: () => void;
  /** Called when a setting changes (e.g. so parent can re-read) */
  onSettingChange?: () => void;
}

export default function Settings({ onClose, onSettingChange }: SettingsProps) {
  const current = getConfettiFrequency();
  const doneButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleChange = (value: ConfettiFrequency) => {
    setConfettiFrequency(value);
    onSettingChange?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--page-padding)",
        backgroundColor: "rgba(0,0,0,0.7)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="content-wrap"
        style={{
          maxWidth: "400px",
          width: "100%",
          padding: "1.5rem",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="settings-title"
          style={{
            margin: "0 0 1rem 0",
            fontFamily: "var(--sans)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-h)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <SettingsIcon sx={{ fontSize: 28 }} />
          Settings
        </h2>

        <fieldset
          style={{
            border: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <legend
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "0.5rem",
            }}
          >
            Confetti celebration
          </legend>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {CONFETTI_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  cursor: "pointer",
                  fontSize: "0.9375rem",
                  color: "var(--text-h)",
                }}
              >
                <input
                  type="radio"
                  name="confettiFrequency"
                  value={opt.value}
                  checked={current === opt.value}
                  onChange={() => handleChange(opt.value)}
                  style={{ accentColor: "var(--accent)" }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ marginTop: "1.25rem" }}>
          <button
            ref={doneButtonRef}
            type="button"
            className="touch-target-inline"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
