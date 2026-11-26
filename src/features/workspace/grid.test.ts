import { describe, expect, it } from "vitest";

import type { Pane, Tab, Workspace } from "@/shared/machines/model";

import {
  closePaneStep,
  closeTabStep,
  gridView,
  movedOrder,
  moves,
  NO_GRID_STATE,
  used,
  type GridState,
} from "./grid";

const MAIN = "/srv/api";
const FIX = "/srv/api-fix";
const PAIRING = "/srv/api-pairing";

function pane(id: string, extra: Partial<Pane> = {}): Pane {
  return {
    id,
    name: id,
    source: null,
    side: "right",
    running: false,
    controlledElsewhere: false,
    ...extra,
  };
}

function tab(id: string, worktree: string | null, panes: Pane[] = [pane(`${id}-p`)]): Tab {
  return { id, name: id, worktree, panes };
}

function workspace(tabs: Tab[], inRepository = true): Workspace {
  return {
    id: "w",
    name: "api",
    directory: "~/srv/api",
    terminalSessions: tabs.length,
    tabs,
    repository: inRepository
      ? {
          root: MAIN,
          worktrees: [
            { path: MAIN, name: "main" },
            { path: FIX, name: "fix" },
            { path: PAIRING, name: "feat/pairing" },
          ],
        }
      : null,
  };
}

const ids = (tabs: readonly Tab[]) => tabs.map((each) => each.id);
const state = (extra: Partial<GridState>): GridState => ({ ...NO_GRID_STATE, ...extra });

describe("the grid of Tabs", () => {
  const listed = workspace([tab("a", MAIN), tab("b", FIX), tab("c", MAIN), tab("gone", "/old")]);

  it("shows every Tab outside a repository", () => {
    const view = gridView(workspace([tab("a", null), tab("b", null)], false), NO_GRID_STATE);
    expect(ids(view.tabs)).toEqual(["a", "b"]);
    expect(view.worktrees).toEqual([]);
  });

  it("opens on the first Tab's Worktree, with Tabs of a Worktree Git no longer lists under the main one", () => {
    const view = gridView(listed, NO_GRID_STATE);
    expect(view.active?.name).toBe("main");
    expect(ids(view.tabs)).toEqual(["a", "c", "gone"]);
    expect(view.worktrees.map(({ worktree, active }) => [worktree.name, active])).toEqual([
      ["main", true],
      ["fix", false],
      ["feat/pairing", false],
    ]);
  });

  it("shows the picked Worktree, and the one used last once the picked one has no Tab", () => {
    expect(ids(gridView(listed, state({ picked: FIX })).tabs)).toEqual(["b"]);
    const closedFix = workspace([tab("a", MAIN), tab("c", MAIN)]);
    const view = gridView(closedFix, state({ picked: FIX, used: ["c", "b"] }));
    expect(view.active?.name).toBe("main");
  });

  it("keeps a picked Worktree with no Tab while the Tab it opened is on its way", () => {
    const view = gridView(listed, state({ picked: PAIRING, expecting: "new" }));
    expect(view.active?.name).toBe("feat/pairing");
    expect(view.tabs).toEqual([]);
  });

  it("moves a Tab past its neighbor in the grid, across Tabs of other Worktrees", () => {
    const order = movedOrder(listed, NO_GRID_STATE, listed.tabs[2], -1);
    expect(order).toEqual(["c", "b", "a", "gone"]);
    const moved = state({ order: order ?? [] });
    expect(ids(gridView(listed, moved).tabs)).toEqual(["c", "a", "gone"]);
    expect(movedOrder(listed, moved, listed.tabs[2], -1)).toBeNull();
  });

  it("puts a Tab this device has not ordered last", () => {
    const view = gridView(listed, state({ order: ["c", "a"] }));
    expect(ids(view.tabs)).toEqual(["c", "a", "gone"]);
  });

  it("offers Move Tab Left except on the first Tab and Move Tab Right except on the last", () => {
    const view = gridView(listed, NO_GRID_STATE);
    expect(moves(view, listed.tabs[0])).toEqual({ left: false, right: true });
    expect(moves(view, listed.tabs[3])).toEqual({ left: true, right: false });
  });

  it("remembers the Tab used last first", () => {
    const after = used(used(NO_GRID_STATE, listed.tabs[0]), listed.tabs[1]);
    expect(used(after, listed.tabs[0]).used).toEqual(["a", "b"]);
  });
});

describe("closing", () => {
  const idle = tab("idle", MAIN);
  const busy = tab("busy", MAIN, [pane("x"), pane("y", { running: true })]);
  const held = tab("held", MAIN, [pane("z", { controlledElsewhere: true })]);
  const listed = workspace([idle, busy, held]);

  it("closes an idle Tab at once and asks when a command runs or another device controls a Pane", () => {
    expect(closeTabStep(listed, idle)).toBe("close");
    expect(closeTabStep(listed, busy)).toBe("ask");
    expect(closeTabStep(listed, held)).toBe("ask");
  });

  it("asks to Kill Workspace for the last Tab", () => {
    expect(closeTabStep(workspace([idle]), idle)).toBe("kill");
  });

  it("asks before closing a Pane that runs a command, and treats a Tab's last Pane as the Tab", () => {
    expect(closePaneStep(listed, busy, busy.panes[0])).toBe("close");
    expect(closePaneStep(listed, busy, busy.panes[1])).toBe("ask");
    expect(closePaneStep(workspace([held]), held, held.panes[0])).toBe("kill");
  });
});
