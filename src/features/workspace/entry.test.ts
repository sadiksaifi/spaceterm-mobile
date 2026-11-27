import { describe, expect, it } from "vitest";

import { newTabAction, takeNewTab, workspaceHref } from "./entry";

describe("New Tab through a Workspace link", () => {
  it("opens once for an action the app made", () => {
    const href = workspaceHref("mac", "w1", true);
    const action = typeof href === "object" ? href.params?.action : undefined;

    expect(typeof action).toBe("string");
    expect(takeNewTab(action as string)).toBe(true);
    expect(takeNewTab(action as string)).toBe(false);
  });

  it("opens for none the app did not make, as a link from another app carries", () => {
    expect(takeNewTab("new-tab")).toBe(false);
    expect(takeNewTab(undefined)).toBe(false);
  });

  it("makes a different action each time", () => {
    expect(newTabAction()).not.toBe(newTabAction());
  });
});
