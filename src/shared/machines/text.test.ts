import { afterEach, describe, expect, it, vi } from "vitest";

import { connectionStateText } from "./text";

describe("connectionStateText", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Vitest runs without EXPO_OS, so these are the sentence-case words Android shows.
  it("states why a row is dimmed", () => {
    expect(connectionStateText("reconnecting")).toBe("Reconnecting…");
    expect(connectionStateText("still-not-connected")).toBe("Still not connected");
    expect(connectionStateText("not-connected")).toBe("Not connected");
  });

  it("uses title case on iOS", async () => {
    vi.stubEnv("EXPO_OS", "ios");
    vi.resetModules();
    const ios = await import("./text");
    expect(ios.connectionStateText("still-not-connected")).toBe("Still Not Connected");
  });
});
