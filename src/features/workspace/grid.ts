import type { Pane, Tab, Workspace, Worktree } from "@/shared/machines/model";

/** What this device remembers about one Workspace's grid while the app runs. */
export type GridState = {
  /** The Worktree the person picked, by path. */
  picked: string | null;
  /** A Tab this device opened that the Machine has not listed yet. */
  expecting: string | null;
  /** Tab ids, the one used last first. */
  used: readonly string[];
  /**
   * This device's order of the Tabs, by id. The Machine keeps no order of its own yet
   * (sadiksaifi/SpaceTerm#951), so a move shows on this device only.
   */
  order: readonly string[];
};

export const NO_GRID_STATE: GridState = { picked: null, expecting: null, used: [], order: [] };

export type WorktreeChoice = { worktree: Worktree; active: boolean };

export type GridView = {
  /** The Tabs of the active Worktree, in this device's order. */
  tabs: readonly Tab[];
  /** The Worktrees of the Workspace's repository, empty outside one. */
  worktrees: readonly WorktreeChoice[];
  active: Worktree | null;
};

/**
 * The grid of Tabs. In a repository it shows the active Worktree's Tabs: the one the person
 * picked, while it has Tabs or one is on its way; else the one whose Tab was used last; else the
 * first Tab's. A Tab whose Worktree Git no longer lists counts as the Main Worktree's.
 */
export function gridView(workspace: Workspace, state: GridState): GridView {
  const tabs = ordered(workspace.tabs, state.order);
  const { repository } = workspace;
  if (repository === null || repository.worktrees.length === 0) {
    return { tabs, worktrees: [], active: null };
  }
  const listed = repository.worktrees;
  const worktreeOf = (tab: Tab) =>
    listed.find((worktree) => worktree.path === tab.worktree) ?? listed[0];
  const picked = listed.find((worktree) => worktree.path === state.picked);
  const lastUsed = state.used
    .map((id) => tabs.find((tab) => tab.id === id))
    .find((tab) => tab !== undefined);
  const active =
    (picked &&
      (state.expecting !== null || tabs.some((tab) => worktreeOf(tab) === picked)) &&
      picked) ||
    (lastUsed && worktreeOf(lastUsed)) ||
    (tabs[0] && worktreeOf(tabs[0])) ||
    listed[0];
  return {
    tabs: tabs.filter((tab) => worktreeOf(tab) === active),
    worktrees: listed.map((worktree) => ({ worktree, active: worktree === active })),
    active,
  };
}

/** The Tabs in this device's order. Tabs it has not ordered follow, in the Machine's order. */
function ordered(tabs: readonly Tab[], order: readonly string[]): readonly Tab[] {
  const known = order
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab) => tab !== undefined);
  return [...known, ...tabs.filter((tab) => !order.includes(tab.id))];
}

/**
 * The order after moving `tab` one place left or right among the Tabs the grid shows. `null`
 * when it is already at that end.
 */
export function movedOrder(
  workspace: Workspace,
  state: GridState,
  tab: Tab,
  direction: -1 | 1,
): readonly string[] | null {
  const shown = gridView(workspace, state).tabs;
  const at = shown.findIndex((each) => each.id === tab.id);
  const neighbor = shown[at + direction];
  if (at === -1 || neighbor === undefined) return null;
  const all = ordered(workspace.tabs, state.order).map((each) => each.id);
  const from = all.indexOf(tab.id);
  const to = all.indexOf(neighbor.id);
  [all[from], all[to]] = [all[to], all[from]];
  return all;
}

/** Whether Move Tab Left and Move Tab Right can move `tab`. */
export function moves(view: GridView, tab: Tab): { left: boolean; right: boolean } {
  const at = view.tabs.findIndex((each) => each.id === tab.id);
  return { left: at > 0, right: at !== -1 && at < view.tabs.length - 1 };
}

/** `state` after the person used `tab`. */
export function used(state: GridState, tab: Tab): GridState {
  return { ...state, used: [tab.id, ...state.used.filter((id) => id !== tab.id)] };
}

/**
 * What a close does first: close at once, ask, or ask to Kill Workspace because the Workspace
 * would be left with no Tab. It asks when a Pane runs a command or another device controls it.
 */
export type CloseStep = "close" | "ask" | "kill";

export function closeTabStep(workspace: Workspace, tab: Tab): CloseStep {
  if (workspace.tabs.length === 1) return "kill";
  return tab.panes.some(asks) ? "ask" : "close";
}

/** Closing a Tab's last Pane closes the Tab. */
export function closePaneStep(workspace: Workspace, tab: Tab, pane: Pane): CloseStep {
  if (tab.panes.length === 1) return closeTabStep(workspace, tab);
  return asks(pane) ? "ask" : "close";
}

function asks(pane: Pane): boolean {
  return pane.running || pane.controlledElsewhere;
}
