/**
 * Accessibility tests for the Login view (README + Login with Dropbox)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { render, screen } from "../utils";
import { axeJsdomOptions } from "./axe-options";
import Login from "@/components/Login";

// Avoid real API calls and redirects
vi.mock("@/hooks/useAuth", () => ({
  useStartAuth: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

describe("Login accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no axe violations on the login view", async () => {
    const { container } = render(<Login />);
    const results = await axe(container, axeJsdomOptions);
    expect(results).toHaveNoViolations();
  });

  it("has a primary button with an accessible name", () => {
    render(<Login />);
    const button = screen.getByRole("button", { name: /login with dropbox/i });
    expect(button).toBeInTheDocument();
  });

  it("main content is in a landmark (content-wrap div is present)", () => {
    const { container } = render(<Login />);
    const wrap = container.querySelector(".content-wrap");
    expect(wrap).toBeInTheDocument();
  });
});
