import { describe, expect, it } from "vitest";

import type { Machine, MachinesSnapshot, Workspace } from "@/shared/machines/model";

import { barLayout, workspaceView } from "./model";

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

describe("the Workspace bar", () => {
  const PADDING = 16;

  it("shares the bar equally while every name fits its share", () => {
    expect(barLayout([30], 300, 0, PADDING)).toEqual({
      shared: true,
      widths: [300],
      offset: 0,
      past: { start: false, end: false },
    });
    expect(barLayout([30, 40], 300, 1, PADDING)).toEqual({
      shared: true,
      widths: [150, 150],
      offset: 0,
      past: { start: false, end: false },
    });
  });

  it("gives each Workspace its name's width once a name would be cut, keeping the selected one in view", () => {
    // 232 and 212 wide: 444 in all, 144 more than the bar shows.
    expect(barLayout([200, 180], 300, 0, PADDING)).toEqual({
      shared: false,
      widths: [232, 212],
      offset: 0,
      past: { start: false, end: true },
    });
    expect(barLayout([200, 180], 300, 1, PADDING).offset).toBe(144);
    // Five of 100: the third's middle, at 250, sits in the middle of the bar.
    expect(barLayout([68, 68, 68, 68, 68], 300, 2, PADDING).offset).toBe(100);
  });

  it("says which edges have Workspaces past them", () => {
    // Five of 100 in a bar of 300: 200 more than it shows.
    const names = [68, 68, 68, 68, 68];
    expect(barLayout(names, 300, 0, PADDING).past).toEqual({ start: false, end: true });
    expect(barLayout(names, 300, 2, PADDING).past).toEqual({ start: true, end: true });
    expect(barLayout(names, 300, 4, PADDING).past).toEqual({ start: true, end: false });
  });

  it("shares the bar until every name is measured", () => {
    expect(barLayout([30, undefined], 300, 0, PADDING).shared).toBe(true);
  });
});
