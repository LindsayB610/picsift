/**
 * Unit tests for temp_links Netlify function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handler } from "../../../netlify/functions/temp_links";

vi.mock("../../../netlify/functions/_auth_store", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../../../netlify/functions/_dropbox", () => ({
  createDropboxClient: vi.fn(),
}));

import { requireSession } from "../../../netlify/functions/_auth_store";
import { createDropboxClient } from "../../../netlify/functions/_dropbox";

function mkEvent(
  overrides: Partial<{ httpMethod: string; body: string | null }> = {}
) {
  const base = {
    httpMethod: "POST" as const,
    path: "/.netlify/functions/temp_links",
    headers: {} as const,
    body: null as string | null,
  };
  return { ...base, ...overrides };
}

describe("temp_links handler", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-POST", async () => {
    const res = await handler(mkEvent({ httpMethod: "GET" }));
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      error: "Method not allowed",
    });
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 401 when requireSession rejects", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    });
    const res = await handler(
      mkEvent({ body: JSON.stringify({ paths: ["/a.jpg"] }) })
    );
    expect(res.statusCode).toBe(401);
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await handler(mkEvent({ body: "not json" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      error: "Invalid JSON body",
    });
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 400 for missing or empty paths array", async () => {
    const res1 = await handler(mkEvent({ body: "{}" }));
    expect(res1.statusCode).toBe(400);
    expect(JSON.parse(res1.body ?? "{}").error).toMatch(/Missing or empty paths/);

    const res2 = await handler(
      mkEvent({ body: JSON.stringify({ paths: [] }) })
    );
    expect(res2.statusCode).toBe(400);
    expect(JSON.parse(res2.body ?? "{}").error).toMatch(/Missing or empty paths/);
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 400 when paths array exceeds max size", async () => {
    const paths = Array.from({ length: 11 }, (_, i) => `/${i}.jpg`);
    const res = await handler(
      mkEvent({ body: JSON.stringify({ paths }) })
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}").error).toMatch(/1–10/);
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid path (no leading slash)", async () => {
    const res = await handler(
      mkEvent({ body: JSON.stringify({ paths: ["a.jpg"] }) })
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ error: "Invalid path" });
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 400 for path containing ..", async () => {
    const res = await handler(
      mkEvent({ body: JSON.stringify({ paths: ["/foo/../bar.jpg"] }) })
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ error: "Invalid path" });
    expect(createDropboxClient).not.toHaveBeenCalled();
  });

  it("returns 200 with links when Dropbox returns temp links", async () => {
    const mockDbx = {
      filesGetTemporaryLink: vi.fn().mockImplementation((opts: { path: string }) =>
        Promise.resolve({
          result: {
            link: `https://temp.dropbox.com/${opts.path.replace(/\//g, "_")}`,
          },
        })
      ),
    };
    vi.mocked(createDropboxClient).mockResolvedValue(mockDbx as never);

    const res = await handler(
      mkEvent({
        body: JSON.stringify({ paths: ["/a.jpg", "/b.png"] }),
      })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}");
    expect(body.links).toHaveLength(2);
    expect(body.links[0]).toMatchObject({
      path: "/a.jpg",
      url: expect.stringContaining("temp.dropbox.com"),
      expires_at: expect.any(String),
    });
    expect(body.links[1]).toMatchObject({
      path: "/b.png",
      url: expect.stringContaining("temp.dropbox.com"),
      expires_at: expect.any(String),
    });
    expect(mockDbx.filesGetTemporaryLink).toHaveBeenCalledWith({
      path: "/a.jpg",
    });
    expect(mockDbx.filesGetTemporaryLink).toHaveBeenCalledWith({
      path: "/b.png",
    });
  });
});
