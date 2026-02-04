/**
 * Unit tests for API client (handleResponse, retry, error parsing)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiClientError,
  startAuth,
  checkAuthCallback,
  discoverFolders,
  listImages,
  getTempLink,
  getTempLinks,
  trash,
  undo,
} from "./api";

describe("ApiClientError", () => {
  it("extends Error with name and message", () => {
    const err = new ApiClientError("Bad request", 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiClientError");
    expect(err.message).toBe("Bad request");
    expect(err.status).toBe(400);
  });

  it("allows undefined status", () => {
    const err = new ApiClientError("Unknown");
    expect(err.status).toBeUndefined();
  });
});

describe("API client with mocked fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("startAuth", () => {
    it("returns data on 200", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ redirect_url: "https://dropbox.com/oauth" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      const result = await startAuth();
      expect(result).toEqual({ redirect_url: "https://dropbox.com/oauth" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/.netlify/functions/auth_start"),
        undefined
      );
    });

    it("throws ApiClientError with body.message on 4xx", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );
      await expect(startAuth()).rejects.toMatchObject({
        message: "Invalid request",
        status: 400,
      });
    });

    it("throws ApiClientError with body.error when message missing", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );
      await expect(startAuth()).rejects.toMatchObject({
        message: "Bad request",
        status: 400,
      });
    });

    it("throws with fallback message when response is not JSON", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response("not json", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        })
      );
      await expect(startAuth()).rejects.toMatchObject({
        message: "Request failed (403). Please try again.",
        status: 403,
      });
    });

    it("retries on 500 then succeeds", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ redirect_url: "https://ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      const result = await startAuth();
      expect(result).toEqual({ redirect_url: "https://ok" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws after retry on 500 then 500", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
      await expect(startAuth()).rejects.toThrow(ApiClientError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 400", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      );
      await expect(startAuth()).rejects.toThrow(ApiClientError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("checkAuthCallback", () => {
    const originalLocation = window.location;

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
        writable: true,
      });
    });

    it("returns success: false when code is missing", async () => {
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, search: "?state=abc" },
        configurable: true,
        writable: true,
      });
      const result = await checkAuthCallback();
      expect(result).toEqual({
        success: false,
        error: "Missing authorization code or state",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("returns success: false when state is missing", async () => {
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, search: "?code=xyz" },
        configurable: true,
        writable: true,
      });
      const result = await checkAuthCallback();
      expect(result).toEqual({
        success: false,
        error: "Missing authorization code or state",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("calls auth_callback and returns response when code and state present", async () => {
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, search: "?code=abc&state=xyz" },
        configurable: true,
        writable: true,
      });
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, account_id: "dbid:123" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const result = await checkAuthCallback();
      expect(result).toEqual({ success: true, account_id: "dbid:123" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("auth_callback"),
        expect.any(Object)
      );
    });
  });

  describe("discoverFolders", () => {
    it("calls discover_folders with default max_depth 1", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ folders: [{ path: "/Pics", name: "Pics", display_path: "/Pics", image_count: 10 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const result = await discoverFolders();
      expect(result.folders).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("max_depth=1"),
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("passes custom max_depth", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      await discoverFolders(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("max_depth=5"),
        expect.any(Object)
      );
    });
  });

  describe("listImages", () => {
    it("sends single path as body.path", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ entries: [], total_count: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      await listImages("/Photos/2024");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ path: "/Photos/2024" }),
        })
      );
    });

    it("sends multiple paths as body.paths", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ entries: [], total_count: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      await listImages(["/P1", "/P2"]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ paths: ["/P1", "/P2"] }),
        })
      );
    });
  });

  describe("getTempLink", () => {
    it("sends path and returns url", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ url: "https://temp.link/1", expires_at: "2025-01-01T00:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const result = await getTempLink("/img.jpg");
      expect(result).toEqual({
        url: "https://temp.link/1",
        expires_at: "2025-01-01T00:00:00Z",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("temp_link"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ path: "/img.jpg" }),
        })
      );
    });
  });

  describe("getTempLinks", () => {
    it("returns empty links without calling fetch when paths is empty", async () => {
      const mockFetch = vi.mocked(fetch);
      const result = await getTempLinks([]);
      expect(result).toEqual({ links: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends paths and returns links", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            links: [
              { path: "/a.jpg", url: "https://temp.link/a", expires_at: "2025-01-01T00:00:00Z" },
              { path: "/b.jpg", url: "https://temp.link/b", expires_at: "2025-01-01T00:00:00Z" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const result = await getTempLinks(["/a.jpg", "/b.jpg"]);
      expect(result.links).toHaveLength(2);
      expect(result.links[0]).toEqual({
        path: "/a.jpg",
        url: "https://temp.link/a",
        expires_at: "2025-01-01T00:00:00Z",
      });
      expect(result.links[1]).toEqual({
        path: "/b.jpg",
        url: "https://temp.link/b",
        expires_at: "2025-01-01T00:00:00Z",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("temp_links"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ paths: ["/a.jpg", "/b.jpg"] }),
        })
      );
    });
  });

  describe("trash", () => {
    it("sends path and session_id", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            trash_record: {
              original_path: "/a",
              trashed_path: "/quarantine/a",
              session_id: "s1",
              timestamp: "2025-01-01T00:00:00Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const result = await trash("/a", "s1");
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("trash"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ path: "/a", session_id: "s1" }),
        })
      );
    });
  });

  describe("undo", () => {
    it("sends trashed_path and original_path", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      await undo("/quarantine/a", "/a");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("undo"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            trashed_path: "/quarantine/a",
            original_path: "/a",
          }),
        })
      );
    });
  });
});
