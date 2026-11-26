import { useEffect, useRef, useState } from "react";

import type {
  CommandResult,
  MachineClient,
  NewTabResult,
  Pane,
  Tab,
  Workspace,
  Worktree,
} from "@/shared/machines/model";

import {
  closePaneStep,
  closeTabStep,
  gridView,
  movedOrder,
  type GridState,
  type GridView,
} from "./grid";
import { useGridState } from "./grid-store";

export type TabClient = Pick<MachineClient, "newTab" | "newPane" | "closeTab" | "closePane">;

/** The alert a close opened: the Tab or Pane runs a command, or another device controls it. */
export type TabAlert =
  | { kind: "close-tab"; tab: Tab }
  | { kind: "close-pane"; tab: Tab; pane: Pane };

/** A command the Machine refused, or did not answer. */
export type TabFailure =
  | { command: "close-tab"; tab: Tab }
  | { command: "close-pane"; tab: Tab; pane: Pane }
  | { command: "new-tab" }
  | { command: "new-pane"; tab: Tab }
  /** Picking a Worktree with no Tab opens one there; this is that Tab not opening. */
  | { command: "switch"; worktree: Worktree };

export type TabCommands = {
  grid: GridView;
  /** The Tab whose Panes the Panes sheet shows, while it is open and the Tab is listed. */
  panes: Tab | null;
  alert: TabAlert | null;
  /** The last refusal, until Try Again or Cancel, and while what it names is still listed. */
  failure: TabFailure | null;
  /** A Tab with several Panes opens the Panes sheet. A Tab with one Pane is only remembered. */
  openTab: (tab: Tab) => void;
  closePanes: () => void;
  newTab: () => void;
  newPane: (tab: Tab) => void;
  closeTab: (tab: Tab) => void;
  closePane: (tab: Tab, pane: Pane) => void;
  moveTab: (tab: Tab, direction: -1 | 1) => void;
  pickWorktree: (worktree: Worktree) => void;
  /** Close Tab or Close Pane in the alert. */
  confirm: () => void;
  /** Cancel in the alert, or the alert closing by itself. */
  cancel: () => void;
  retry: (failure: TabFailure) => void;
  dismissFailure: (failure: TabFailure) => void;
};

/** `expecting` while the Machine has not answered New Tab yet. */
const PENDING = "";

type Local = {
  /** The Workspace these belong to; another Workspace starts with none. */
  key: string;
  alert: TabAlert | null;
  failure: TabFailure | null;
  panes: string | null;
};

/**
 * The commands of a Workspace's grid of Tabs and its Panes sheet. Closing asks first when a Pane
 * runs a command or another device controls it, and asks to Kill Workspace, through `onKill`,
 * for the last Tab. New Tab opens in the active Worktree. A refused command becomes `failure`,
 * which offers Try Again on the Tab or Pane as listed then.
 */
export function useTabCommands({
  client,
  machineId,
  workspace,
  onKill,
}: {
  client: TabClient;
  machineId: string;
  workspace: Workspace;
  onKill: () => void;
}): TabCommands {
  const key = `${machineId}/${workspace.id}`;
  const [state, updateGrid] = useGridState(key);
  const [stored, setLocal] = useState<Local>({ key, alert: null, failure: null, panes: null });
  const local = stored.key === key ? stored : { key, alert: null, failure: null, panes: null };
  // The commands under way, as of the last event rather than the last render.
  const inFlight = useRef(new Set<string>());
  const grid = gridView(workspace, state);
  const listedTab = (id: string) => workspace.tabs.find((each) => each.id === id);

  // The Tab New Tab opened shows once the Machine lists it; the grid stops waiting for it then.
  const arrived =
    state.expecting !== null && state.expecting !== PENDING && listedTab(state.expecting);
  useEffect(() => {
    if (arrived) updateGrid((grid) => ({ ...grid, expecting: null }));
  }, [arrived, updateGrid]);

  const change = (next: (local: Local) => Local) =>
    setLocal((current) => next(current.key === key ? current : local));

  const run = <T extends CommandResult | NewTabResult>(
    failure: TabFailure,
    send: () => Promise<T>,
    after?: (result: T) => void,
  ) => {
    const id = flightId(failure);
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    change((current) => ({
      ...current,
      failure: current.failure && flightId(current.failure) === id ? null : current.failure,
    }));
    void send().then((result) => {
      inFlight.current.delete(id);
      after?.(result);
      if (result.kind === "failed") {
        setLocal((current) => (current.key === key ? { ...current, failure } : current));
      }
    });
  };

  const opened = (result: NewTabResult) =>
    updateGrid((grid) =>
      result.kind === "done"
        ? { ...remember(grid, result.tab), expecting: result.tab }
        : { ...grid, expecting: null },
    );

  const sendCloseTab = (tab: Tab) =>
    run({ command: "close-tab", tab }, () => client.closeTab(machineId, workspace, tab));
  const sendClosePane = (tab: Tab, pane: Pane) =>
    run({ command: "close-pane", tab, pane }, () =>
      client.closePane(machineId, workspace, tab, pane),
    );

  const closeTab = (tab: Tab) => {
    const step = closeTabStep(workspace, tab);
    if (step === "kill") onKill();
    else if (step === "ask")
      change((current) => ({ ...current, alert: { kind: "close-tab", tab } }));
    else sendCloseTab(tab);
  };

  const closePane = (tab: Tab, pane: Pane) => {
    if (tab.panes.length === 1) return closeTab(tab);
    const step = closePaneStep(workspace, tab, pane);
    if (step === "ask") {
      change((current) => ({ ...current, alert: { kind: "close-pane", tab, pane } }));
    } else sendClosePane(tab, pane);
  };

  const newTab = () =>
    run(
      { command: "new-tab" },
      () => client.newTab(machineId, workspace, grid.active ?? undefined),
      opened,
    );

  const newPane = (tab: Tab) =>
    run({ command: "new-pane", tab }, () => client.newPane(machineId, workspace, tab));

  const pickWorktree = (worktree: Worktree) => {
    const picked = { ...state, picked: worktree.path, expecting: null };
    const hasTabs = gridView(workspace, picked).active?.path === worktree.path;
    if (hasTabs) return updateGrid((grid) => ({ ...grid, picked: worktree.path }));
    updateGrid((grid) => ({ ...grid, picked: worktree.path, expecting: PENDING }));
    run(
      { command: "switch", worktree },
      () => client.newTab(machineId, workspace, worktree),
      opened,
    );
  };

  const failure =
    local.failure !== null && stillListed(workspace, local.failure) ? local.failure : null;

  return {
    grid,
    panes: local.panes === null ? null : (listedTab(local.panes) ?? null),
    alert: local.alert,
    failure,
    openTab(tab) {
      updateGrid((grid) => remember(grid, tab.id));
      if (tab.panes.length > 1) change((current) => ({ ...current, panes: tab.id }));
    },
    closePanes: () => change((current) => ({ ...current, panes: null })),
    newTab,
    newPane,
    closeTab,
    closePane,
    moveTab(tab, direction) {
      const order = movedOrder(workspace, state, tab, direction);
      if (order !== null) updateGrid((grid) => ({ ...grid, order }));
    },
    pickWorktree,
    confirm() {
      const { alert } = local;
      if (alert === null) return;
      change((current) => ({ ...current, alert: null }));
      if (alert.kind === "close-tab") sendCloseTab(alert.tab);
      else sendClosePane(alert.tab, alert.pane);
    },
    cancel: () => change((current) => ({ ...current, alert: null })),
    retry(shown) {
      if (shown !== failure) return;
      change((current) => ({ ...current, failure: null }));
      switch (shown.command) {
        case "close-tab": {
          const tab = listedTab(shown.tab.id);
          if (tab === undefined) return;
          // What the person agreed to close is unchanged, so it closes without asking again.
          return tab.revision === shown.tab.revision ? sendCloseTab(tab) : closeTab(tab);
        }
        case "close-pane": {
          const tab = listedTab(shown.tab.id);
          const pane = tab?.panes.find((each) => each.id === shown.pane.id);
          if (tab === undefined || pane === undefined) return;
          return pane.revision === shown.pane.revision
            ? sendClosePane(tab, pane)
            : closePane(tab, pane);
        }
        case "new-tab":
          return newTab();
        case "new-pane": {
          const tab = listedTab(shown.tab.id);
          return tab && newPane(tab);
        }
        case "switch":
          return pickWorktree(shown.worktree);
      }
    },
    dismissFailure(shown) {
      change((current) => (current.failure === shown ? { ...current, failure: null } : current));
    },
  };
}

/** `state` with `tab` as the Tab used last. */
function remember(state: GridState, tab: string): GridState {
  return { ...state, used: [tab, ...state.used.filter((id) => id !== tab)] };
}

/** One command per target at a time. */
function flightId(failure: TabFailure): string {
  switch (failure.command) {
    case "close-tab":
      return `close-tab/${failure.tab.id}`;
    case "close-pane":
      return `close-pane/${failure.pane.id}`;
    case "new-pane":
      return `new-pane/${failure.tab.id}`;
    case "new-tab":
    case "switch":
      return "new-tab";
  }
}

/** A refusal for a Tab or Pane that has gone offers nothing to try again. */
function stillListed(workspace: Workspace, failure: TabFailure): boolean {
  if (!("tab" in failure)) return true;
  const tab = workspace.tabs.find((each) => each.id === failure.tab.id);
  if (tab === undefined) return false;
  return failure.command !== "close-pane" || tab.panes.some((each) => each.id === failure.pane.id);
}
