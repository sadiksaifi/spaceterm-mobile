import { describe, expect, it } from "vitest";

import { linkFromOutside } from "./entry";

describe("a Workspace link from another app", () => {
  it("opens the Workspace without New Tab, which only the app asks for", () => {
    expect(linkFromOutside("/workspace/mac/w1?action=new-tab")).toBe("/workspace/mac/w1");
    expect(linkFromOutside("spaceterm://workspace/mac/w1?action=new-tab&x=1")).toBe(
      "spaceterm://workspace/mac/w1?x=1",
    );
  });

  it("leaves every other link as it is", () => {
    expect(linkFromOutside("/workspace/mac/w1")).toBe("/workspace/mac/w1");
    expect(linkFromOutside("/settings?action=new-tab")).toBe("/settings?action=new-tab");
  });
});
