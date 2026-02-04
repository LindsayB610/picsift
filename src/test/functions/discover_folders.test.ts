/**
 * Unit tests for discover_folders Netlify function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handler, __clearFolderCacheForTesting } from "../../../netlify/functions/discover_folders";

vi.mock("../../../netlify/functions/_auth_store", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../../../netlify/functions/_dropbox", () => ({
  createDropboxClient: vi.fn(),
}));

import { requireSession } from "../../../netlify/functions/_auth_store";
import { createDropboxClient } from "../../../netlify/functions/_dropbox";

type MockDbx = {
  filesListFolder: ReturnType<typeof vi.fn>;
  filesListFolderContinue: ReturnType<typeof vi.fn>;
};

function createMockDbx(
  rootEntries: Array<{ ".tag": "folder" | "file"; path_lower?: string; path_display?: string; name: string }>,
  folderContents: Record<string, Array<{ ".tag": "file"; name: string }>> = {}
): MockDbx {
  const filesListFolder = vi.fn();
  const filesListFolderContinue = vi.fn();

  filesListFolder.mockImplementation((opts: { path?: string; recursive?: boolean }) => {
    const path = opts?.path ?? "";
    if (path === "" || path === "/") {
      return Promise.resolve({
        result: { entries: rootEntries, has_more: false, cursor: undefined },
      });
    }
    const entries = folderContents[path] ?? [];
    return Promise.resolve({
      result: { entries, has_more: false, cursor: undefined },
    });
  });

  filesListFolderContinue.mockResolvedValue({
    result: { entries: [], has_more: false, cursor: undefined },
  });

  return { filesListFolder, filesListFolderContinue };
}

function mkEvent(
  overrides: Partial<{ httpMethod: string; queryStringParameters: Record<string, string> }> = {}
) {
  const base = {
    httpMethod: "GET" as const,
    path: "/",
    headers: {} as const,
  };
  return { ...base, ...overrides };
}

describe("discover_folders handler", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue(null);
    __clearFolderCacheForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-GET", async () => {
    const res = await handler(mkEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ error: "Method not allowed" });
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 401 when requireSession rejects", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    });
    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(401);
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns folders with images using default max_depth 1", async () => {
    const mockDbx = createMockDbx(
      [
        {
          ".tag": "folder",
          path_lower: "/photos",
          path_display: "/Photos",
          name: "Photos",
        },
      ],
      { "/photos": [{ ".tag": "file", name: "pic.jpg" }] }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.folders).toHaveLength(1);
    expect(body.folders[0]).toMatchObject({
      path: "/photos",
      name: "Photos",
      image_count: 1,
      display_path: "Photos",
    });
    expect(body.total_folders).toBe(1);
    expect(mockDbx.filesListFolder).toHaveBeenCalledWith(
      expect.objectContaining({ path: "", recursive: false })
    );
  });

  it("respects max_depth query param", async () => {
    const mockDbx = createMockDbx(
      [{ ".tag": "folder", path_lower: "/photos", path_display: "/Photos", name: "Photos" }],
      { "/photos": [{ ".tag": "file", name: "pic.jpg" }] }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    await handler(mkEvent({ queryStringParameters: { max_depth: "2" } }));
    expect(mockDbx.filesListFolder).toHaveBeenCalled();
  });

  it("excludes folders with no images", async () => {
    const mockDbx = createMockDbx(
      [
        { ".tag": "folder", path_lower: "/photos", path_display: "/Photos", name: "Photos" },
        { ".tag": "folder", path_lower: "/docs", path_display: "/Docs", name: "Docs" },
      ],
      {
        "/photos": [{ ".tag": "file", name: "pic.jpg" }],
        "/docs": [{ ".tag": "file", name: "readme.pdf" }],
      }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.folders).toHaveLength(1);
    expect(body.folders[0].name).toBe("Photos");
  });

  it("counts only image extensions", async () => {
    const mockDbx = createMockDbx(
      [{ ".tag": "folder", path_lower: "/photos", path_display: "/Photos", name: "Photos" }],
      {
        "/photos": [
          { ".tag": "file", name: "pic.jpg" },
          { ".tag": "file", name: "photo.png" },
          { ".tag": "file", name: "doc.pdf" },
        ],
      }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.folders[0].image_count).toBe(2);
  });

  it("sorts folders by image count descending", async () => {
    const mockDbx = createMockDbx(
      [
        { ".tag": "folder", path_lower: "/small", path_display: "/Small", name: "Small" },
        { ".tag": "folder", path_lower: "/big", path_display: "/Big", name: "Big" },
      ],
      {
        "/small": [{ ".tag": "file", name: "a.jpg" }],
        "/big": [
          { ".tag": "file", name: "a.jpg" },
          { ".tag": "file", name: "b.jpg" },
          { ".tag": "file", name: "c.jpg" },
        ],
      }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.folders[0].name).toBe("Big");
    expect(body.folders[0].image_count).toBe(3);
    expect(body.folders[1].name).toBe("Small");
    expect(body.folders[1].image_count).toBe(1);
  });

  it("returns 500 when Dropbox root listing fails", async () => {
    vi.mocked(createDropboxClient).mockResolvedValue({
      filesListFolder: vi.fn().mockRejectedValue(new Error("Dropbox API error")),
      filesListFolderContinue: vi.fn(),
    } as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.error).toBe("Failed to discover folders");
  });

  it("returns cached result when valid", async () => {
    const mockDbx = createMockDbx(
      [{ ".tag": "folder", path_lower: "/photos", path_display: "/Photos", name: "Photos" }],
      { "/photos": [{ ".tag": "file", name: "pic.jpg" }] }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res1 = await handler(mkEvent());
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body ?? "{}");
    expect(body1.folders).toHaveLength(1);

    vi.mocked(createDropboxClient).mockClear();
    const res2 = await handler(mkEvent());
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body ?? "{}");
    expect(body2.folders).toEqual(body1.folders);
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("skips folders with missing path_lower or name", async () => {
    const mockDbx = createMockDbx(
      [
        { ".tag": "folder", path_lower: "/photos", path_display: "/Photos", name: "Photos" },
        { ".tag": "folder", path_lower: "", path_display: "/Bad", name: "Bad" } as never,
      ],
      { "/photos": [{ ".tag": "file", name: "pic.jpg" }] }
    );
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(mkEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.folders).toHaveLength(1);
  });
});
