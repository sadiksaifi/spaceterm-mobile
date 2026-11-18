import { describe, expect, it } from "vitest";

import {
  homeView,
  isSearchable,
  type Machine,
  type UnreachableState,
  type Workspace,
} from "./model";

const mobile: Workspace = {
  id: "w1",
  name: "spaceterm-mobile",
  directory: "~/Projects/spaceterm-mobile",
  branch: "main",
};
const desktop: Workspace = {
  id: "w2",
  name: "spaceterm-desktop",
  directory: "~/Projects/spaceterm-desktop",
  branch: "fix/sidebar",
};
const logs: Workspace = { id: "w3", name: "logs", directory: "/var/log" };

function connected(name: string, workspaces: readonly Workspace[]): Machine {
  return { id: name, name, connection: "connected", workspaces };
}

function unreachable(
  name: string,
  connection: UnreachableState,
  workspaces: readonly Workspace[] | null = null,
): Machine {
  return { id: name, name, connection, workspaces };
}

describe("homeView", () => {
  it("shows No Machines when no Machine is paired", () => {
    expect(homeView({ machines: [], starting: true })).toEqual({ kind: "no-machines" });
  });

  it("shows loading at start when no list is kept", () => {
    const view = homeView({
      machines: [unreachable("Mac mini", "reconnecting")],
      starting: true,
    });
    expect(view).toEqual({ kind: "loading" });
  });

  it("shows the kept list at start, dimmed until the Machine answers", () => {
    const view = homeView({
      machines: [unreachable("MacBook Pro", "reconnecting", [mobile])],
      starting: true,
    });
    expect(view).toMatchObject({
      kind: "workspaces",
      canCreateWorkspace: false,
      rows: [{ machineName: "MacBook Pro", connection: "reconnecting", workspace: mobile }],
    });
  });

  it("lists Workspaces Machine after Machine, in pairing order", () => {
    const view = homeView({
      machines: [connected("MacBook Pro", [mobile, desktop]), connected("build-server", [logs])],
      starting: false,
    });
    expect(view.kind === "workspaces" && view.rows.map((row) => row.workspace.name)).toEqual([
      "spaceterm-mobile",
      "spaceterm-desktop",
      "logs",
    ]);
  });

  it("keeps rows of a Machine that is not connected, and allows New Workspace while one Machine is", () => {
    const view = homeView({
      machines: [
        connected("MacBook Pro", [mobile]),
        unreachable("Home Server", "not-connected", [logs]),
      ],
      starting: false,
    });
    expect(view).toMatchObject({
      kind: "workspaces",
      canCreateWorkspace: true,
      rows: [{ connection: "connected" }, { connection: "not-connected" }],
    });
  });

  it("keeps the dimmed rows after start when no Machine answers, without New Workspace", () => {
    const view = homeView({
      machines: [unreachable("MacBook Pro", "still-not-connected", [mobile])],
      starting: false,
    });
    expect(view).toMatchObject({
      kind: "workspaces",
      canCreateWorkspace: false,
      rows: [{ connection: "still-not-connected" }],
    });
  });

  it("shows No Workspaces when a connected Machine has none", () => {
    const view = homeView({
      machines: [connected("Mac mini", []), unreachable("Home Server", "still-not-connected")],
      starting: false,
    });
    expect(view).toEqual({ kind: "no-workspaces", canCreateWorkspace: true });
  });

  it("names the one Machine when it is not connected and nothing is listed", () => {
    const view = homeView({
      machines: [unreachable("Home Server", "not-connected")],
      starting: false,
    });
    expect(view).toEqual({
      kind: "unreachable",
      state: "not-connected",
      machine: { id: "Home Server", name: "Home Server" },
    });
  });

  it("names no Machine when several are paired, and picks Reconnecting first", () => {
    const view = homeView({
      machines: [
        unreachable("Home Server", "not-connected"),
        unreachable("build-server", "still-not-connected"),
        unreachable("Mac mini", "reconnecting"),
      ],
      starting: false,
    });
    expect(view).toEqual({ kind: "unreachable", state: "reconnecting", machine: null });
  });

  it("picks Still Not Connected over Not Connected", () => {
    const view = homeView({
      machines: [
        unreachable("Home Server", "not-connected"),
        unreachable("build-server", "still-not-connected"),
      ],
      starting: false,
    });
    expect(view).toMatchObject({ kind: "unreachable", state: "still-not-connected" });
  });
});

describe("homeView search", () => {
  const snapshot = {
    machines: [connected("MacBook Pro", [mobile, desktop]), connected("build-server", [logs])],
    starting: false,
  };

  it("matches the Workspace name only, ignoring case", () => {
    const view = homeView(snapshot, "  SpaceTerm ");
    expect(view.kind === "workspaces" && view.rows.map((row) => row.workspace.id)).toEqual([
      "w1",
      "w2",
    ]);
  });

  it("does not match the directory or the Machine", () => {
    expect(homeView(snapshot, "var")).toEqual({
      kind: "no-results",
      query: "var",
      canCreateWorkspace: true,
    });
    expect(homeView(snapshot, "build")).toMatchObject({ kind: "no-results" });
  });

  it("reports no results when No Workspaces is searched", () => {
    const view = homeView({ machines: [connected("Mac mini", [])], starting: false }, "zed");
    expect(view).toEqual({ kind: "no-results", query: "zed", canCreateWorkspace: true });
  });

  it("ignores the query where Home has no search", () => {
    expect(homeView({ machines: [], starting: false }, "zed")).toEqual({ kind: "no-machines" });
  });
});

describe("isSearchable", () => {
  it("offers search on the list, No Workspaces and no results only", () => {
    expect(isSearchable({ kind: "no-workspaces", canCreateWorkspace: true })).toBe(true);
    expect(isSearchable({ kind: "no-results", query: "x", canCreateWorkspace: false })).toBe(true);
    expect(isSearchable({ kind: "loading" })).toBe(false);
    expect(isSearchable({ kind: "no-machines" })).toBe(false);
    expect(isSearchable({ kind: "unreachable", state: "not-connected", machine: null })).toBe(
      false,
    );
  });
});
