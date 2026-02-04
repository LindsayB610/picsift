/**
 * Unit tests for error normalization and classification
 */

import { describe, it, expect } from "vitest";
import {
  normalizeError,
  getErrorCategory,
  isRateLimitError,
  isNetworkError,
} from "./error";

describe("normalizeError", () => {
  it("returns message for Error instances", () => {
    expect(normalizeError(new Error("Something failed"))).toBe("Something failed");
  });

  it("returns string when err is a string", () => {
    expect(normalizeError("Network error")).toBe("Network error");
  });

  it("returns message for object with string message property", () => {
    expect(normalizeError({ message: "Custom error" })).toBe("Custom error");
  });

  it("returns fallback for null", () => {
    expect(normalizeError(null)).toBe("Something went wrong. Please try again.");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeError(undefined)).toBe("Something went wrong. Please try again.");
  });

  it("returns fallback for number", () => {
    expect(normalizeError(42)).toBe("Something went wrong. Please try again.");
  });

  it("returns fallback for object without message", () => {
    expect(normalizeError({ code: "ERR" })).toBe("Something went wrong. Please try again.");
  });

  it("returns fallback for object with non-string message", () => {
    expect(normalizeError({ message: 123 })).toBe("Something went wrong. Please try again.");
  });
});

describe("getErrorCategory", () => {
  it("returns critical for status 401", () => {
    expect(getErrorCategory(new Error("x"), { status: 401 })).toBe("critical");
  });

  it("returns critical for status 403", () => {
    expect(getErrorCategory(new Error("x"), { status: 403 })).toBe("critical");
  });

  it("returns critical when message includes access denied", () => {
    expect(getErrorCategory(new Error("Access denied"))).toBe("critical");
  });

  it("returns critical when message includes unauthorized", () => {
    expect(getErrorCategory(new Error("Unauthorized"))).toBe("critical");
  });

  it("returns critical when message includes authorized users only", () => {
    expect(
      getErrorCategory(new Error("This app is restricted to authorized users only."))
    ).toBe("critical");
  });

  it("returns critical when message includes authentication", () => {
    expect(getErrorCategory(new Error("Authentication failed"))).toBe("critical");
  });

  it("uses context.message when provided", () => {
    expect(
      getErrorCategory(new Error("other"), { message: "Access denied" })
    ).toBe("critical");
  });

  it("returns transient for network-like messages", () => {
    expect(getErrorCategory(new Error("Network error"))).toBe("transient");
  });

  it("returns transient for 5xx status", () => {
    expect(getErrorCategory(new Error("x"), { status: 500 })).toBe("transient");
  });

  it("returns transient for 404", () => {
    expect(getErrorCategory(new Error("Not found"), { status: 404 })).toBe("transient");
  });
});

describe("isRateLimitError", () => {
  it("returns true when message includes rate limit", () => {
    expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
  });

  it("returns true when message includes too many requests", () => {
    expect(isRateLimitError(new Error("Too many requests"))).toBe(true);
  });

  it("returns true when message includes 429", () => {
    expect(isRateLimitError(new Error("Error 429"))).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isRateLimitError(new Error("RATE LIMIT"))).toBe(true);
  });

  it("returns false for generic error", () => {
    expect(isRateLimitError(new Error("Something went wrong"))).toBe(false);
  });
});

describe("isNetworkError", () => {
  it("returns true for TypeError with Failed to fetch", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true when message includes network", () => {
    expect(isNetworkError(new Error("Network request failed"))).toBe(true);
  });

  it("returns true when message includes fetch", () => {
    expect(isNetworkError(new Error("Fetch failed"))).toBe(true);
  });

  it("returns true when message includes connection", () => {
    expect(isNetworkError(new Error("Connection refused"))).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isNetworkError(new Error("NETWORK ERROR"))).toBe(true);
  });

  it("returns false for generic error", () => {
    expect(isNetworkError(new Error("Something went wrong"))).toBe(false);
  });
});
