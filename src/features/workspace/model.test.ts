import { describe, expect, it } from "vitest";

import type { Machine, MachinesSnapshot, Workspace } from "@/shared/machines/model";

import { workspaceView } from "./model";

function workspace(id: string): Workspace {
  return { id, name: id, directory: `~/${id}`, terminalSessions: 1, tabs: [], repository: null };
}

function snapshot(...machines: Machine[]): MachinesSnapshot {
  return { machines, starting: false };
}

const mac = (extra: Partial<Machine> = {}): Machine =>
  ({
    id: "mac",
    name: "MacBook Pro",
    connection: "connected",
    workspaces: [workspace("api")],
    ...extra,
  }) as Machine;

describe("the Workspace a screen shows", () => {
  it("shows the Tabs of a Workspace on a connected Machine", () => {
    const view = workspaceView(snapshot(mac()), "mac", "api", null);
    expect(view).toMatchObject({ kind: "tabs", workspace: { id: "api" }, machine: { id: "mac" } });
  });

  it("shows a Machine that is not connected in place of the Tabs, by the Workspace kept last", () => {
    const kept = snapshot(mac({ connection: "reconnecting", workspaces: [workspace("api")] }));
    expect(workspaceView(kept, "mac", "api", null)).toMatchObject({
      kind: "unreachable",
      state: "reconnecting",
      workspace: { id: "api" },
    });
    const forgotten = snapshot(mac({ connection: "not-connected", workspaces: null }));
    expect(workspaceView(forgotten, "mac", "api", workspace("api"))).toMatchObject({
      kind: "unreachable",
      workspace: { id: "api" },
    });
  });

  it("is gone once the Machine no longer lists the Workspace, or the Machine is unpaired", () => {
    expect(workspaceView(snapshot(mac({ workspaces: [] })), "mac", "api", null).kind).toBe("gone");
    expect(workspaceView(snapshot(), "mac", "api", workspace("api")).kind).toBe("gone");
  });
});
