import { describe, expect, it, vi } from "vitest";

import { homeControls, unreachableControls, type HomeActions } from "./actions";
import type { HomeView } from "./model";

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
