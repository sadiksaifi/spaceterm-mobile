import { describe, expect, it, vi } from "vitest";

import {
  homeControls,
  renameOutcome,
  rowCommands,
  unreachableControls,
  type HomeActions,
} from "./actions";
import type { HomeView, WorkspaceRow } from "./model";

const noop = () => {};
const all: HomeActions = {
  onNewWorkspace: vi.fn(),
  onAddMachine: vi.fn(),
  onOpenSettings: vi.fn(),
  onMachineSettings: vi.fn(),
  onTryAgain: vi.fn(),
  onGetDesktop: noop,
};

describe("homeControls", () => {
  it("offers search and New Workspace where a connected Machine lists Workspaces", () => {
    const view: HomeView = { kind: "workspaces", rows: [], canCreateWorkspace: true };
    expect(homeControls(view, all)).toEqual({
      searchable: true,
      newWorkspace: { onPress: all.onNewWorkspace },
      addMachine: { onPress: all.onAddMachine },
      settings: { onPress: all.onOpenSettings },
    });
  });

  it("shows New Workspace unavailable when only kept rows are listed", () => {
    const view: HomeView = { kind: "workspaces", rows: [], canCreateWorkspace: false };
    expect(homeControls(view, all)).toMatchObject({
      searchable: true,
      newWorkspace: { onPress: undefined },
    });
  });

  it("offers neither search nor New Workspace where nothing can be listed", () => {
    const views: HomeView[] = [
      { kind: "loading" },
      { kind: "no-machines" },
      { kind: "unreachable", state: "not-connected", machine: null },
    ];
    for (const view of views) {
      expect(homeControls(view, all)).toMatchObject({ searchable: false, newWorkspace: null });
    }
  });

  it("leaves a control unavailable while its screen does not exist", () => {
    const view: HomeView = { kind: "no-workspaces", canCreateWorkspace: true };
    expect(homeControls(view, { onGetDesktop: noop })).toEqual({
      searchable: true,
      newWorkspace: { onPress: undefined },
      addMachine: { onPress: undefined },
      settings: { onPress: undefined },
    });
  });
});

describe("unreachableControls", () => {
  const one = { id: "m1", name: "Mac mini" };

  it("opens the settings of the one Machine", () => {
    const onMachineSettings = vi.fn();
    const view: HomeView = { kind: "unreachable", state: "not-connected", machine: one };
    unreachableControls(view, {
      onGetDesktop: noop,
      onMachineSettings,
    }).machineSettings.onPress?.();
    expect(onMachineSettings).toHaveBeenCalledWith("m1");
  });

  it("opens Settings when several Machines are paired", () => {
    const view: HomeView = { kind: "unreachable", state: "not-connected", machine: null };
    expect(unreachableControls(view, all).machineSettings).toEqual({
      onPress: all.onOpenSettings,
    });
  });

  it("leaves Machine Settings unavailable without a handler", () => {
    const view: HomeView = { kind: "unreachable", state: "not-connected", machine: one };
    expect(unreachableControls(view, { onGetDesktop: noop }).machineSettings).toEqual({
      onPress: undefined,
    });
  });

  it("offers Try Again unless a reconnect is under way", () => {
    const failed: HomeView = { kind: "unreachable", state: "still-not-connected", machine: one };
    const reconnecting: HomeView = { kind: "unreachable", state: "reconnecting", machine: one };
    expect(unreachableControls(failed, all).tryAgain).toEqual({ onPress: all.onTryAgain });
    expect(unreachableControls(reconnecting, all).tryAgain).toBeNull();
  });
});

describe("rowCommands", () => {
  const workspace = {
    id: "w1",
    name: "spaceterm-mobile",
    directory: "~/Projects/spaceterm-mobile",
    terminalSessions: 5,
  };
  const row = (connection: WorkspaceRow["connection"]): WorkspaceRow => ({
    key: "m1/w1",
    machineId: "m1",
    machineName: "MacBook Pro",
    workspace,
    connection,
  });
  const commands = {
    onNewTab: vi.fn(),
    onRenameWorkspace: vi.fn(),
    onKillWorkspace: vi.fn(),
  };

  it("offers New Tab, Rename Workspace and Kill Workspace on a connected row, which swipes", () => {
    const result = rowCommands(row("connected"), commands);
    expect(result.swipes).toBe(true);
    result.newTab.onPress?.();
    result.rename.onPress?.();
    result.kill.onPress?.();
    expect(commands.onNewTab).toHaveBeenCalledWith(row("connected"));
    expect(commands.onRenameWorkspace).toHaveBeenCalledWith(row("connected"));
    expect(commands.onKillWorkspace).toHaveBeenCalledWith(row("connected"));
  });

  it("does not swipe while Kill Workspace is unavailable", () => {
    const { onKillWorkspace: _, ...withoutKill } = commands;
    expect(rowCommands(row("connected"), withoutKill).swipes).toBe(false);
  });

  it("leaves every command unavailable on a row whose Machine is not connected, which does not swipe", () => {
    for (const connection of ["reconnecting", "still-not-connected", "not-connected"] as const) {
      expect(rowCommands(row(connection), commands)).toEqual({
        swipes: false,
        newTab: { onPress: undefined },
        rename: { onPress: undefined },
        kill: { onPress: undefined },
        underway: null,
      });
    }
  });

  it("offers nothing on a row whose Rename or Kill is under way, which does not swipe", () => {
    for (const underway of ["rename", "kill"] as const) {
      expect(rowCommands(row("connected"), commands, underway)).toEqual({
        swipes: false,
        newTab: { onPress: undefined },
        rename: { onPress: undefined },
        kill: { onPress: undefined },
        underway,
      });
    }
  });
});

describe("renameOutcome", () => {
  it("renames to the typed name without the spaces around it", () => {
    expect(renameOutcome("spaceterm-mobile", "  mobile app ")).toEqual({
      kind: "rename",
      name: "mobile app",
    });
  });

  it("is unavailable while the field is empty or holds only spaces", () => {
    expect(renameOutcome("spaceterm-mobile", "")).toEqual({ kind: "unavailable" });
    expect(renameOutcome("spaceterm-mobile", "   ")).toEqual({ kind: "unavailable" });
  });

  it("sends nothing when the name is unchanged", () => {
    expect(renameOutcome("spaceterm-mobile", "spaceterm-mobile ")).toEqual({ kind: "unchanged" });
  });
});
