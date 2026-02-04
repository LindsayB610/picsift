/**
 * Accessibility tests for the FolderSelector view
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { render, screen } from "../utils";
import { axeJsdomOptions } from "./axe-options";
import FolderSelector from "@/components/FolderSelector";
import type { FolderInfo } from "@/types";

const mockFolders: FolderInfo[] = [
  {
    path: "/Photos/2024",
    name: "2024",
    display_path: "/Photos/2024",
    image_count: 42,
  },
  {
    path: "/Camera Roll",
    name: "Camera Roll",
    display_path: "/Camera Roll",
    image_count: 10,
  },
];

vi.mock("@/hooks/useFolders", () => ({
  useDiscoverFolders: () => ({
    data: { folders: mockFolders },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("FolderSelector accessibility", () => {
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no axe violations when folders are listed", async () => {
    const { container } = render(
      <FolderSelector onFolderSelected={noop} onCancel={noop} />,
    );
    const results = await axe(container, axeJsdomOptions);
    expect(results).toHaveNoViolations();
  });

  it("has a heading for the section", () => {
    render(<FolderSelector onFolderSelected={noop} onCancel={noop} />);
    expect(
      screen.getByRole("heading", { name: /select a folder/i }),
    ).toBeInTheDocument();
  });

  it("folder options are focusable and have accessible names", () => {
    render(<FolderSelector onFolderSelected={noop} onCancel={noop} />);
    expect(screen.getByRole("button", { name: /2024/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /camera roll/i }),
    ).toBeInTheDocument();
  });

  it("has Cancel and Start Session actions", () => {
    render(<FolderSelector onFolderSelected={noop} onCancel={noop} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start session/i }),
    ).toBeInTheDocument();
  });
});
