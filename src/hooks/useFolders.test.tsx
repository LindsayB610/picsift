/**
 * Unit tests for useDiscoverFolders hook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDiscoverFolders } from "./useFolders";
import * as api from "../api";
import type { FolderInfo } from "../types";

vi.mock("../api", () => ({
  discoverFolders: vi.fn(),
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

const mockFolders: FolderInfo[] = [
  {
    path: "/Photos/2024",
    name: "2024",
    display_path: "/Photos/2024",
    image_count: 42,
  },
];

describe("useDiscoverFolders", () => {
  beforeEach(() => {
    vi.mocked(api.discoverFolders).mockReset();
  });

  it("calls discoverFolders with default maxDepth 1", async () => {
    vi.mocked(api.discoverFolders).mockResolvedValue({ folders: mockFolders });
    const { wrapper } = createWrapper();
    renderHook(() => useDiscoverFolders(), { wrapper });
    await waitFor(() => {
      expect(api.discoverFolders).toHaveBeenCalledWith(1);
    });
  });

  it("calls discoverFolders with custom maxDepth", async () => {
    vi.mocked(api.discoverFolders).mockResolvedValue({ folders: mockFolders });
    const { wrapper } = createWrapper();
    renderHook(() => useDiscoverFolders(5), { wrapper });
    await waitFor(() => {
      expect(api.discoverFolders).toHaveBeenCalledWith(5);
    });
  });

  it("returns folders on success", async () => {
    vi.mocked(api.discoverFolders).mockResolvedValue({ folders: mockFolders });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDiscoverFolders(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.folders).toEqual(mockFolders);
  });

  it("sets isError when discoverFolders rejects", async () => {
    vi.mocked(api.discoverFolders).mockRejectedValue(new Error("Unauthorized"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDiscoverFolders(), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeDefined();
  });
});
