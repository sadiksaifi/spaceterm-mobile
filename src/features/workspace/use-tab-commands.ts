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
  movePast,
  type GridState,
  type GridView,
} from "./grid";
import { useGridState } from "./grid-store";

export type TabClient = Pick<
  MachineClient,
  "newTab" | "newPane" | "closeTab" | "closePane" | "moveTab"
>;

/** The alert a close opened: the Tab or Pane runs a command, or another device controls it. */
export type TabAlert =
  | { kind: "close-tab"; tab: Tab }
  | { kind: "close-pane"; tab: Tab; pane: Pane };

/** A command the Machine refused, or did not answer. */
export type TabFailure =
  /** `asked`: the person agreed to the close, so Try Again closes without asking again. */
  | { command: "close-tab"; tab: Tab; asked: boolean }
  | { command: "close-pane"; tab: Tab; pane: Pane; asked: boolean }
  /** `worktree`: the active Worktree then, where Try Again opens the Tab while it is listed. */
  | { command: "new-tab"; worktree: Worktree | null }
  | { command: "new-pane"; tab: Tab }
  /**
   * Try Again sends the same move, which the Machine may have made with its answer lost, so the
   * Tab never moves twice.
   */
  | { command: "move-tab"; tab: Tab; beside: Tab; side: "before" | "after" }
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
  alert: TabAlert | null;
  failure: TabFailure | null;
  panes: string | null;
};

const NO_LOCAL: Local = { alert: null, failure: null, panes: null };

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
  // Each Workspace's own, so one that answers after the person moved on keeps its failure.
  const [stored, setStored] = useState<Readonly<Record<string, Local>>>({});
  const local = stored[key] ?? NO_LOCAL;
  // Leaving a Workspace closes its alert and Panes sheet; its failure stays for Try Again.
  useEffect(
    () => () =>
      setStored((all) => {
        const left = all[key];
        return left ? { ...all, [key]: { ...NO_LOCAL, failure: left.failure } } : all;
      }),
    [key],
  );
  // The commands under way, as of the last event rather than the last render. The screen stays
  // mounted when it changes Workspace, so each id names its Workspace.
  const inFlight = useRef(new Set<string>());
  const underway = (failure: TabFailure) => inFlight.current.has(`${key}/${flightId(failure)}`);
  const grid = gridView(workspace, state);
  const listedTab = (id: string) => workspace.tabs.find((each) => each.id === id);

  // The Tab New Tab opened shows once the Machine lists it; the grid stops waiting for it then.
  const arrived =
    state.expecting !== null && state.expecting !== PENDING && listedTab(state.expecting);
  useEffect(() => {
    if (arrived) updateGrid((grid) => ({ ...grid, expecting: null }));
  }, [arrived, updateGrid]);

  const changeIn = (of: string, next: (local: Local) => Local) =>
    setStored((all) => ({ ...all, [of]: next(all[of] ?? NO_LOCAL) }));
  const change = (next: (local: Local) => Local) => changeIn(key, next);

  const run = <T extends CommandResult | NewTabResult>(
    failure: TabFailure,
    send: () => Promise<T>,
    after?: (result: T) => void,
  ) => {
    if (underway(failure)) return;
    const id = `${key}/${flightId(failure)}`;
    inFlight.current.add(id);
    change((current) => ({
      ...current,
      failure:
        current.failure && flightId(current.failure) === flightId(failure) ? null : current.failure,
    }));
    void send().then((result) => {
      inFlight.current.delete(id);
      after?.(result);
      if (result.kind === "failed") changeIn(key, (current) => ({ ...current, failure }));
    });
  };

  const opened = (result: NewTabResult) =>
    updateGrid((grid) =>
      result.kind === "done"
        ? { ...remember(grid, result.tab), expecting: result.tab }
        : { ...grid, expecting: null },
    );

  const sendCloseTab = (tab: Tab, asked: boolean) =>
    run({ command: "close-tab", tab, asked }, () =>
      client.closeTab(machineId, workspace, tab, asked),
    );
  const sendClosePane = (tab: Tab, pane: Pane, asked: boolean) =>
    run({ command: "close-pane", tab, pane, asked }, () =>
      client.closePane(machineId, workspace, tab, pane, asked),
    );

  const closeTab = (tab: Tab) => {
    const step = closeTabStep(workspace, tab);
    if (step === "kill") onKill();
    else if (step === "ask")
      change((current) => ({ ...current, alert: { kind: "close-tab", tab } }));
    else sendCloseTab(tab, false);
  };

  const closePane = (tab: Tab, pane: Pane) => {
    if (tab.panes.length === 1) return closeTab(tab);
    const step = closePaneStep(workspace, tab, pane);
    if (step === "ask") {
      change((current) => ({ ...current, alert: { kind: "close-pane", tab, pane } }));
    } else sendClosePane(tab, pane, false);
  };

  const newTabIn = (worktree: Worktree | null) =>
    run(
      { command: "new-tab", worktree },
      () => client.newTab(machineId, workspace, worktree ?? undefined),
      opened,
    );
  const newTab = () => newTabIn(grid.active);

  const newPane = (tab: Tab) =>
    run({ command: "new-pane", tab }, () => client.newPane(machineId, workspace, tab));

  const sendMove = (tab: Tab, beside: Tab, side: "before" | "after") =>
    run({ command: "move-tab", tab, beside, side }, () =>
      client.moveTab(machineId, workspace, tab, beside, side),
    );
  const moveTab = (tab: Tab, direction: -1 | 1) => {
    const beside = movePast(grid, tab, direction);
    if (beside !== null) sendMove(tab, beside, direction === -1 ? "before" : "after");
  };

  const pickWorktree = (worktree: Worktree) => {
    const picked = { ...state, picked: worktree.path, expecting: null };
    const hasTabs = gridView(workspace, picked).active?.path === worktree.path;
    if (hasTabs) return updateGrid((grid) => ({ ...grid, picked: worktree.path }));
    // Another New Tab is on its way; the grid keeps waiting for that one.
    if (underway({ command: "switch", worktree })) return;
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
    moveTab,
    pickWorktree,
    confirm() {
      const { alert } = local;
      if (alert === null) return;
      change((current) => ({ ...current, alert: null }));
      if (alert.kind === "close-tab") sendCloseTab(alert.tab, true);
      else sendClosePane(alert.tab, alert.pane, true);
    },
    cancel: () => change((current) => ({ ...current, alert: null })),
    retry(shown) {
      if (shown !== failure) return;
      change((current) => ({ ...current, failure: null }));
      switch (shown.command) {
        case "close-tab": {
          const tab = listedTab(shown.tab.id);
          if (tab === undefined) return;
          // What the person agreed to close is unchanged, so it closes without asking again. A
          // close nobody was asked about goes through the rules again, as the Tab may now ask.
          return shown.asked && tab.revision === shown.tab.revision
            ? sendCloseTab(tab, true)
            : closeTab(tab);
        }
        case "close-pane": {
          const tab = listedTab(shown.tab.id);
          const pane = tab?.panes.find((each) => each.id === shown.pane.id);
          if (tab === undefined || pane === undefined) return;
          return shown.asked && pane.revision === shown.pane.revision
            ? sendClosePane(tab, pane, true)
            : closePane(tab, pane);
        }
        case "new-tab": {
          const { worktree } = shown;
          const listed = grid.worktrees.some((each) => each.worktree.path === worktree?.path);
          return worktree !== null && listed ? newTabIn(worktree) : newTab();
        }
        case "new-pane": {
          const tab = listedTab(shown.tab.id);
          return tab && newPane(tab);
        }
        case "move-tab": {
          const tab = listedTab(shown.tab.id);
          const beside = listedTab(shown.beside.id);
          return tab && beside && sendMove(tab, beside, shown.side);
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
    case "move-tab":
      return `move-tab/${failure.tab.id}`;
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
