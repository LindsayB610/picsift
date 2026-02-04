/**
 * Unit tests for useTempLink hook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTempLink } from "./useTempLink";
import * as api from "../api";

vi.mock("../api", () => ({
  getTempLink: vi.fn(),
}));

function createWrapper(): { client: QueryClient; wrapper: ({ children }: { children: ReactNode }) => ReactNode } {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useTempLink", () => {
  beforeEach(() => {
    vi.mocked(api.getTempLink).mockReset();
  });

  it("does not run query when path is null", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useTempLink(null), { wrapper });
    expect(api.getTempLink).not.toHaveBeenCalled();
  });

  it("does not run query when path is empty string", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useTempLink(""), { wrapper });
    expect(api.getTempLink).not.toHaveBeenCalled();
  });

  it("calls getTempLink and returns url when path is provided", async () => {
    vi.mocked(api.getTempLink).mockResolvedValue({
      url: "https://temp.link/img",
      expires_at: "2025-01-01T00:00:00Z",
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTempLink("/Photos/img.jpg"), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.getTempLink).toHaveBeenCalledWith("/Photos/img.jpg");
    expect(result.current.data).toBe("https://temp.link/img");
  });

  it("returns null when path is null and query is disabled", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTempLink(null), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });
});
