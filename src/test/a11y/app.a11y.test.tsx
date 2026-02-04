/**
 * Accessibility tests for main App views (login, ready state)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { render, screen, waitFor } from "../utils";
import { axeJsdomOptions } from "./axe-options";
import App from "@/App";

const AUTH_STORAGE_KEY = "picsift:auth";
const FOLDER_PREFERENCE_KEY = "picsift:selectedFolder";

describe("App accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no auth so App shows Login (not folder-select or ready)
    const storage: Record<string, string | null> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const k of Object.keys(storage)) delete storage[k];
      },
      length: 0,
      key: () => null,
    });
    // No OAuth callback in URL
    window.history.replaceState({}, "", "/");
  });

  it("login view has no axe violations after load", async () => {
    const { container } = render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /login with dropbox/i }),
      ).toBeInTheDocument();
    });
    const results = await axe(container, axeJsdomOptions);
    expect(results).toHaveNoViolations();
  });

  it("ready (homepage) view has no axe violations when folder is selected", async () => {
    const folder = {
      path: "/Photos/2024",
      name: "2024",
      display_path: "/Photos/2024",
      image_count: 42,
    };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => {
        if (key === AUTH_STORAGE_KEY)
          return JSON.stringify({ is_authenticated: true, account_id: "test" });
        if (key === FOLDER_PREFERENCE_KEY) return JSON.stringify(folder);
        return null;
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    });

    const { container } = render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /picsift/i })).toBeInTheDocument();
    });
    const results = await axe(container, axeJsdomOptions);
    expect(results).toHaveNoViolations();
  });

  it("ready view has Change folder and Logout buttons with accessible names", async () => {
    const folder = {
      path: "/Photos/2024",
      name: "2024",
      display_path: "/Photos/2024",
      image_count: 42,
    };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => {
        if (key === AUTH_STORAGE_KEY)
          return JSON.stringify({ is_authenticated: true, account_id: "test" });
        if (key === FOLDER_PREFERENCE_KEY) return JSON.stringify(folder);
        return null;
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /picsift/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /change folder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
