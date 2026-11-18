import { describe, expect, it } from "vitest";

import type { Machine } from "@/shared/machines/model";

import { firstStep } from "./entry";

const machine = (id: string, connection: Machine["connection"] = "connected"): Machine =>
  connection === "connected"
    ? { id, name: id, connection, workspaces: [] }
    : { id, name: id, connection, workspaces: null };

describe("firstStep", () => {
  it("skips the Machine step when one Machine is paired", () => {
    expect(firstStep({ machines: [machine("mac-mini")], starting: false })).toEqual({
      step: "directory",
      machineId: "mac-mini",
    });
  });

  it("starts with the Machine step when several Machines are paired, connected or not", () => {
    expect(
      firstStep({ machines: [machine("a"), machine("b", "not-connected")], starting: false }),
    ).toEqual({ step: "machine" });
  });
});
