import { describe, expect, it } from "vitest";

import type { Machine } from "@/shared/machines/model";

import { newWorkspaceHref } from "./entry";

const machine = (id: string, connection: Machine["connection"] = "connected"): Machine =>
  connection === "connected"
    ? { id, name: id, connection, workspaces: [] }
    : { id, name: id, connection, workspaces: null };

describe("newWorkspaceHref", () => {
  it("skips the Machine step when one Machine is paired", () => {
    expect(newWorkspaceHref({ machines: [machine("mac-mini")], starting: false })).toEqual({
      pathname: "/new-workspace/[machineId]",
      params: { machineId: "mac-mini" },
    });
  });

  it("opens nowhere while no Machine is connected", () => {
    expect(newWorkspaceHref({ machines: [], starting: false })).toBeNull();
    expect(
      newWorkspaceHref({ machines: [machine("mac-mini", "not-connected")], starting: false }),
    ).toBeNull();
  });

  it("starts with the Machine step when several Machines are paired, connected or not", () => {
    expect(
      newWorkspaceHref({
        machines: [machine("a"), machine("b", "not-connected")],
        starting: false,
      }),
    ).toBe("/new-workspace");
  });
});
