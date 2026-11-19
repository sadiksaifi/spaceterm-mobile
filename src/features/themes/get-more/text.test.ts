import { describe, expect, it } from "vitest";

import { downloadCount, text } from "./text";

describe("a download count", () => {
  it("is shortened with K and M, with one decimal below ten", () => {
    expect(downloadCount(950)).toBe("950");
    expect(downloadCount(1_234)).toBe("1.2K");
    expect(downloadCount(3_000)).toBe("3K");
    expect(downloadCount(51_700)).toBe("52K");
    expect(downloadCount(517_499)).toBe("517K");
    expect(downloadCount(1_233_350)).toBe("1.2M");
  });

  it("moves up a unit when rounding reaches a thousand", () => {
    expect(downloadCount(999_700)).toBe("1M");
    expect(downloadCount(999)).toBe("999");
  });
});

describe("an extension's details", () => {
  it("give its authors and downloads, leaving out what Zed does not supply", () => {
    expect(text.details("Catppuccin", 1_233_350)).toBe("Catppuccin · 1.2M downloads");
    expect(text.details("", 950)).toBe("950 downloads");
    expect(text.details("Catppuccin", null)).toBe("Catppuccin");
    expect(text.details("", null)).toBe("");
  });
});
