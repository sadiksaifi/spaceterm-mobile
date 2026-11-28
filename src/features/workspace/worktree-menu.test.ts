import { describe, expect, it } from "vitest";

import { folderName } from "./worktree-menu";

describe("folderName", () => {
  it("takes the last folder of a path", () => {
    expect(folderName("~/scratch/build-logs")).toBe("build-logs");
    expect(folderName("/var/log/")).toBe("log");
  });

  it("keeps a path with no folder in it", () => {
    expect(folderName("/")).toBe("/");
    expect(folderName("~")).toBe("~");
  });
});
