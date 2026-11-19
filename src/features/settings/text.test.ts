import { describe, expect, it } from "vitest";

import { restartBody } from "./text";

describe("the Restart SpaceTerm Core alert", () => {
  it("says how many Terminal Sessions it ends, and nothing when none run", () => {
    expect(restartBody(6, "MacBook Pro")).toBe("This ends 6 Terminal Sessions on MacBook Pro.");
    expect(restartBody(1, "MacBook Pro")).toBe("This ends 1 Terminal Session on MacBook Pro.");
    expect(restartBody(0, "MacBook Pro")).toBeNull();
  });
});
