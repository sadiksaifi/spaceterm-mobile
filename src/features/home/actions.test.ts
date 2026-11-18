import { describe, expect, it, vi } from "vitest";

import { homeControls, machineSettingsAction, type HomeActions } from "./actions";
import type { HomeView } from "./model";

const noop = () => {};
const all: HomeActions = {
  onNewWorkspace: vi.fn(),
  onAddMachine: vi.fn(),
  onOpenSettings: vi.fn(),
  onMachineSettings: vi.fn(),
  onGetDesktop: noop,
};

describe("homeControls", () => {
  it("offers search and New Workspace where a connected Machine lists Workspaces", () => {
    const view: HomeView = { kind: "workspaces", rows: [], canCreateWorkspace: true };
    expect(homeControls(view, all)).toEqual({
      searchable: true,
      newWorkspace: all.onNewWorkspace,
      addMachine: all.onAddMachine,
      settings: all.onOpenSettings,
    });
  });

  it("keeps search but not New Workspace when only kept rows are listed", () => {
    const view: HomeView = { kind: "workspaces", rows: [], canCreateWorkspace: false };
    expect(homeControls(view, all)).toMatchObject({ searchable: true, newWorkspace: undefined });
  });

  it("offers neither search nor New Workspace where nothing can be listed", () => {
    const views: HomeView[] = [
      { kind: "loading" },
      { kind: "no-machines" },
      { kind: "unreachable", state: "not-connected", machine: null },
    ];
    for (const view of views) {
      expect(homeControls(view, all)).toMatchObject({ searchable: false, newWorkspace: undefined });
    }
  });

  it("leaves a control unavailable while its screen does not exist", () => {
    const view: HomeView = { kind: "no-workspaces", canCreateWorkspace: true };
    expect(homeControls(view, { onGetDesktop: noop })).toEqual({
      searchable: true,
      newWorkspace: undefined,
      addMachine: undefined,
      settings: undefined,
    });
  });
});

describe("machineSettingsAction", () => {
  it("opens the settings of the one Machine", () => {
    const onMachineSettings = vi.fn();
    machineSettingsAction(
      { id: "m1", name: "Mac mini" },
      { onGetDesktop: noop, onMachineSettings },
    )?.();
    expect(onMachineSettings).toHaveBeenCalledWith("m1");
  });

  it("opens Settings when several Machines are paired", () => {
    expect(machineSettingsAction(null, all)).toBe(all.onOpenSettings);
  });

  it("is unavailable without a handler", () => {
    expect(machineSettingsAction({ id: "m1", name: "Mac mini" }, { onGetDesktop: noop })).toBe(
      undefined,
    );
  });
});
