/**
 * Unit tests for useAuth hooks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useStartAuth, useAuthCallback } from "./useAuth";
import * as api from "../api";

vi.mock("../api", () => ({
  startAuth: vi.fn(),
  checkAuthCallback: vi.fn(),
}));

function createWrapper(): { client: QueryClient; wrapper: ({ children }: { children: ReactNode }) => ReactNode } {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useStartAuth", () => {
  beforeEach(() => {
    vi.mocked(api.startAuth).mockReset();
  });

  it("exposes mutate and isPending", () => {
    vi.mocked(api.startAuth).mockResolvedValue({ redirect_url: "https://dropbox.com/oauth" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartAuth(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("calls startAuth when mutate is invoked", async () => {
    vi.mocked(api.startAuth).mockResolvedValue({ redirect_url: "https://dropbox.com/oauth" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartAuth(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.startAuth).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ redirect_url: "https://dropbox.com/oauth" });
  });

  it("sets isError when startAuth rejects", async () => {
    vi.mocked(api.startAuth).mockRejectedValue(new Error("Network error"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartAuth(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeDefined();
  });
});

describe("useAuthCallback", () => {
  beforeEach(() => {
    vi.mocked(api.checkAuthCallback).mockReset();
  });

  it("does not run query when code or state is null", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useAuthCallback(null, "state"), { wrapper });
    renderHook(() => useAuthCallback("code", null), { wrapper });
    expect(api.checkAuthCallback).not.toHaveBeenCalled();
  });

  it("runs query when both code and state are provided", async () => {
    vi.mocked(api.checkAuthCallback).mockResolvedValue({
      success: true,
      account_id: "dbid:123",
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthCallback("code", "state"), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.checkAuthCallback).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ success: true, account_id: "dbid:123" });
  });

  it("returns error when callback fails", async () => {
    vi.mocked(api.checkAuthCallback).mockResolvedValue({
      success: false,
      error: "Invalid state",
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAuthCallback("code", "state"), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ success: false, error: "Invalid state" });
  });
});
