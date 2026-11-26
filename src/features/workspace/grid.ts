import type { Pane, Tab, Workspace, Worktree } from "@/shared/machines/model";

/** What this device remembers about one Workspace's grid while the app runs. */
export type GridState = {
  /** The Worktree the person picked, by path. */
  picked: string | null;
  /** A Tab this device opened that the Machine has not listed yet. */
  expecting: string | null;
  /** Tab ids, the one used last first. */
  used: readonly string[];
};

export const NO_GRID_STATE: GridState = { picked: null, expecting: null, used: [] };

export type WorktreeChoice = { worktree: Worktree; active: boolean };

export type GridView = {
  /** The Tabs of the active Worktree, in the order the Machine keeps them. */
  tabs: readonly Tab[];
  /** The Worktrees of the Workspace's repository, empty outside one. */
  worktrees: readonly WorktreeChoice[];
  active: Worktree | null;
  /** The Machine keeps the Tabs in a fixed order, so no Tab moves. */
  fixedOrder: boolean;
};

/**
 * The grid of Tabs. In a repository it shows the active Worktree's Tabs: the one the person
 * picked, while it has Tabs or one is on its way; else the one whose Tab was used last; else the
 * first Tab's. A Tab whose Worktree Git no longer lists counts as the Main Worktree's.
 */
export function gridView(workspace: Workspace, state: GridState): GridView {
  const { tabs, repository } = workspace;
  const fixedOrder = workspace.fixedTabOrder === true;
  if (repository === null || repository.worktrees.length === 0) {
    return { tabs, worktrees: [], active: null, fixedOrder };
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
    fixedOrder,
  };
}

/**
 * The Tab that `tab` moves past to go one place left or right in the grid, `null` where it
 * cannot. The Machine moves a Tab only past another of the same Worktree, which a Tab whose
 * Worktree Git no longer lists is not, though the grid shows it with the main one's.
 */
export function movePast(view: GridView, tab: Tab, direction: -1 | 1): Tab | null {
  if (view.fixedOrder) return null;
  const at = view.tabs.findIndex((each) => each.id === tab.id);
  const neighbor = at === -1 ? undefined : view.tabs[at + direction];
  return neighbor !== undefined && neighbor.worktree === view.tabs[at].worktree ? neighbor : null;
}

/** Whether Move Tab Left and Move Tab Right can move `tab`. */
export function moves(view: GridView, tab: Tab): { left: boolean; right: boolean } {
  return { left: movePast(view, tab, -1) !== null, right: movePast(view, tab, 1) !== null };
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
