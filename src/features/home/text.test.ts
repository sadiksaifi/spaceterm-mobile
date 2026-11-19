import { afterEach, describe, expect, it, vi } from "vitest";

import { killBody, text, unreachableText } from "./text";

// Vitest runs without EXPO_OS, so these are the sentence-case words Android shows.
describe("unreachableText", () => {
  it("names the one Machine", () => {
    expect(unreachableText("reconnecting", "Mac mini")).toEqual({
      title: "Reconnecting to Mac mini…",
    });
    expect(unreachableText("still-not-connected", "Mac mini")).toEqual({
      title: "Still not connected",
      body: "Make sure Mac mini is on and SpaceTerm Core is running.",
    });
    expect(unreachableText("not-connected", "Mac mini")).toEqual({
      title: "Machine not connected",
      body: "Mac mini is not connected.",
    });
  });

  it("speaks of all Machines when several are paired", () => {
    expect(unreachableText("reconnecting", null)).toEqual({
      title: "Reconnecting to your Machines…",
    });
    expect(unreachableText("still-not-connected", null)).toEqual({
      title: "Still not connected",
      body: "Make sure your Machines are on and SpaceTerm Core is running.",
    });
    expect(unreachableText("not-connected", null)).toEqual({
      title: "Machines not connected",
      body: "Your Machines are not connected.",
    });
  });
});

describe("Kill Workspace", () => {
  it("names the Workspace and counts the Terminal Sessions that end", () => {
    expect(text.killTitle("spaceterm-mobile")).toBe("Kill spaceterm-mobile?");
    expect(killBody(5)).toBe("This ends its 5 Terminal Sessions.");
    expect(killBody(1)).toBe("This ends its 1 Terminal Session.");
    expect(killBody(0)).toBeNull();
  });
});

describe("on iOS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses title case", async () => {
    vi.stubEnv("EXPO_OS", "ios");
    vi.resetModules();
    const ios = await import("./text");
    expect(ios.text.more).toBe("More");
    expect(ios.unreachableText("not-connected", "Mac mini").title).toBe("Machine Not Connected");
    expect(ios.text.killTitle("spaceterm-mobile")).toBe("Kill “spaceterm-mobile”?");
  });
});
