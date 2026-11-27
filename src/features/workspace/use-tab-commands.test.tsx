import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { CommandResult, NewTabResult, Pane, Tab, Workspace } from "@/shared/machines/model";

import { useTabCommands, type TabClient } from "./use-tab-commands";

const MAIN = "/srv/api";
const FIX = "/srv/api-fix";

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

function tab(id: string, panes: Pane[] = [pane(`${id}-p`)], worktree = MAIN): Tab {
  return { id, name: id, worktree, panes };
}

const idle = tab("idle");
const busy = tab("busy", [pane("x"), pane("y", { running: true })]);

function workspace(tabs: Tab[], id = "w"): Workspace {
  return {
    id,
    name: "api",
    directory: "~/srv/api",
    terminalSessions: tabs.length,
    tabs,
    repository: {
      root: MAIN,
      worktrees: [
        { path: MAIN, name: "main" },
        { path: FIX, name: "fix" },
      ],
    },
  };
}

const done = async (): Promise<CommandResult> => ({ kind: "done" });
const refused = async (): Promise<CommandResult> => ({ kind: "failed" });

/** Each test gets its own Machine, so the grid state the app keeps does not carry over. */
let machines = 0;

async function render(client: Partial<TabClient>, tabs: Tab[] = [idle, busy]) {
  const onKill = jest.fn();
  const machineId = `mac-${(machines += 1)}`;
  const full: TabClient = {
    newTab: async () => ({ kind: "done", tab: "new" }),
    newPane: done,
    closeTab: done,
    closePane: done,
    moveTab: done,
    ...client,
  };
  const hook = await renderHook(
    ({ listed }: { listed: Workspace }) =>
      useTabCommands({ client: full, machineId, workspace: listed, onKill }),
    { initialProps: { listed: workspace(tabs) } },
  );
  return { ...hook, onKill, machineId };
}

describe("closing a Tab", () => {
  it("closes an idle Tab at once, and asks first for a Tab that runs a command", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(done);
    const { result } = await render({ closeTab });

    await act(async () => result.current.closeTab(idle));
    expect(closeTab).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), idle, false);
    expect(result.current.alert).toBeNull();

    await act(async () => result.current.closeTab(busy));
    expect(result.current.alert).toEqual({ kind: "close-tab", tab: busy });
    await act(async () => result.current.confirm());
    expect(closeTab).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), busy, true);
    expect(result.current.alert).toBeNull();
  });

  it("asks to Kill Workspace for the last Tab", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(done);
    const { result, onKill } = await render({ closeTab }, [idle]);

    await act(async () => result.current.closeTab(idle));
    expect(onKill).toHaveBeenCalled();
    expect(closeTab).not.toHaveBeenCalled();
  });

  it("offers Try Again when the Machine refuses, which closes the Tab again", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(refused);
    const { result } = await render({ closeTab });

    await act(async () => result.current.closeTab(idle));
    expect(result.current.failure).toEqual({ command: "close-tab", tab: idle, asked: false });

    closeTab.mockImplementationOnce(done);
    await act(async () => result.current.retry(result.current.failure!));
    expect(closeTab).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toBeNull();
  });

  it("asks on Try Again when a Tab closed without asking now runs a command", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(refused);
    const { result, rerender } = await render({ closeTab });
    await act(async () => result.current.closeTab(idle));

    const started = { ...idle, panes: [pane("idle-p", { running: true })] };
    await rerender({ listed: workspace([started, busy]) });
    await act(async () => result.current.retry(result.current.failure!));

    expect(closeTab).toHaveBeenCalledTimes(1);
    expect(result.current.alert).toEqual({ kind: "close-tab", tab: started });
  });

  it("closes an agreed Tab again on Try Again without asking again", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(refused);
    const { result } = await render({ closeTab });

    await act(async () => result.current.closeTab(busy));
    await act(async () => result.current.confirm());
    closeTab.mockImplementationOnce(done);
    await act(async () => result.current.retry(result.current.failure!));

    expect(result.current.alert).toBeNull();
    expect(closeTab).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), busy, true);
  });

  it("treats closing a Tab's last Pane as closing the Tab", async () => {
    const closeTab = jest.fn<TabClient["closeTab"]>(done);
    const closePane = jest.fn<TabClient["closePane"]>(done);
    const { result } = await render({ closeTab, closePane });

    await act(async () => result.current.closePane(idle, idle.panes[0]));
    expect(closeTab).toHaveBeenCalledTimes(1);
    expect(closePane).not.toHaveBeenCalled();
  });
});

describe("the Panes sheet", () => {
  it("opens for a Tab with several Panes and closes once the Tab is gone", async () => {
    const { result, rerender } = await render({});

    await act(async () => result.current.openTab(idle));
    expect(result.current.panes).toBeNull();
    await act(async () => result.current.openTab(busy));
    expect(result.current.panes?.id).toBe("busy");

    await rerender({ listed: workspace([idle, tab("other")]) });
    expect(result.current.panes).toBeNull();
  });
});

describe("picking a Worktree", () => {
  it("opens one Tab in a Worktree with none and shows it while the Tab is on its way", async () => {
    let answer: (result: NewTabResult) => void = () => {};
    const newTab = jest.fn<TabClient["newTab"]>(
      () => new Promise<NewTabResult>((resolve) => (answer = resolve)),
    );
    const { result, rerender } = await render({ newTab });
    const fix = { path: FIX, name: "fix" };

    await act(async () => result.current.pickWorktree(fix));
    expect(newTab).toHaveBeenCalledWith(expect.any(String), expect.anything(), fix);
    expect(result.current.grid.active?.name).toBe("fix");

    await act(async () => answer({ kind: "done", tab: "fresh" }));
    expect(result.current.grid.active?.name).toBe("fix");
    await rerender({ listed: workspace([idle, busy, tab("fresh", undefined, FIX)]) });
    expect(result.current.grid.tabs.map((each) => each.id)).toEqual(["fresh"]);
  });

  it("goes back to the Worktree picked before when the Tab cannot be opened", async () => {
    const review = "/srv/api-review";
    const tabs = [idle, tab("f", undefined, FIX)];
    const listed = workspace(tabs);
    const worktrees = [...listed.repository!.worktrees, { path: review, name: "review" }];
    listed.repository = { root: MAIN, worktrees };
    const newTab = async (): Promise<NewTabResult> => ({ kind: "failed" });
    const { result, rerender } = await render({ newTab }, tabs);
    await rerender({ listed });

    await act(async () => result.current.pickWorktree({ path: FIX, name: "fix" }));
    await act(async () => result.current.pickWorktree({ path: review, name: "review" }));
    expect(result.current.failure).toMatchObject({ command: "switch" });
    expect(result.current.grid.active?.name).toBe("fix");
  });

  it("goes back to the Worktree it showed when the Tab cannot be opened", async () => {
    const { result } = await render({ newTab: async () => ({ kind: "failed" }) });
    const fix = { path: FIX, name: "fix" };

    await act(async () => result.current.pickWorktree(fix));
    expect(result.current.failure).toEqual({ command: "switch", worktree: fix });
    expect(result.current.grid.active?.name).toBe("main");
  });
});

describe("New Tab", () => {
  it("opens again in the Worktree it was asked for when Try Again comes after a switch", async () => {
    const newTab = jest.fn<TabClient["newTab"]>(async () => ({ kind: "failed" }));
    const { result } = await render({ newTab }, [idle, busy, tab("f", undefined, FIX)]);
    const fix = { path: FIX, name: "fix" };

    await act(async () => result.current.pickWorktree(fix));
    await act(async () => result.current.newTab());
    expect(result.current.failure).toEqual({ command: "new-tab", worktree: fix });

    await act(async () => result.current.pickWorktree({ path: MAIN, name: "main" }));
    await act(async () => result.current.retry(result.current.failure!));
    expect(newTab).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), fix);
  });

  it("drops a New Tab failure whose Worktree is gone, rather than open the Tab elsewhere", async () => {
    const newTab = jest.fn<TabClient["newTab"]>(async () => ({ kind: "failed" }));
    const tabs = [idle, tab("f", undefined, FIX)];
    const { result, rerender } = await render({ newTab }, tabs);
    const fix = { path: FIX, name: "fix" };

    await act(async () => result.current.pickWorktree(fix));
    await act(async () => result.current.newTab());
    const shown = result.current.failure!;
    expect(shown).toEqual({ command: "new-tab", worktree: fix });

    const gone = workspace([idle]);
    gone.repository = { root: MAIN, worktrees: [{ path: MAIN, name: "main" }] };
    await rerender({ listed: gone });
    expect(result.current.failure).toBeNull();
    await act(async () => result.current.retry(shown));
    expect(newTab).toHaveBeenCalledTimes(1);
  });

  it("keeps a Workspace's New Tab failure for when the person comes back to it", async () => {
    let failFirst: (result: NewTabResult) => void = () => {};
    const newTab = jest
      .fn<TabClient["newTab"]>()
      .mockImplementationOnce(() => new Promise<NewTabResult>((resolve) => (failFirst = resolve)))
      .mockImplementation(() => new Promise<NewTabResult>(() => {}));
    const { result, rerender } = await render({ newTab });

    await act(async () => result.current.newTab());
    await rerender({ listed: workspace([idle], "other") });
    await act(async () => result.current.newTab());
    await act(async () => failFirst({ kind: "failed" }));
    expect(result.current.failure).toBeNull();

    await rerender({ listed: workspace([idle, busy]) });
    expect(result.current.failure).toMatchObject({ command: "new-tab" });
  });

  it("opens a Tab in another Workspace while one Workspace's New Tab is on its way", async () => {
    const newTab = jest.fn<TabClient["newTab"]>(() => new Promise<NewTabResult>(() => {}));
    const { result, rerender } = await render({ newTab });

    await act(async () => result.current.newTab());
    await rerender({ listed: workspace([idle], "other") });
    await act(async () => result.current.newTab());

    expect(newTab).toHaveBeenCalledTimes(2);
  });
});

describe("moving a Tab", () => {
  it("moves a Tab before its left neighbor or after its right one, as the Machine keeps them", async () => {
    const moveTab = jest.fn<TabClient["moveTab"]>(done);
    const { result } = await render({ moveTab });

    await act(async () => result.current.moveTab(busy, -1));
    expect(moveTab).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      busy,
      idle,
      "before",
    );
    await act(async () => result.current.moveTab(idle, 1));
    expect(moveTab).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      idle,
      busy,
      "after",
    );
  });

  it("offers Try Again when the Machine refuses, which sends the same move", async () => {
    const moveTab = jest.fn<TabClient["moveTab"]>(refused);
    const { result, rerender } = await render({ moveTab }, [idle, busy]);
    await act(async () => result.current.moveTab(busy, -1));
    expect(result.current.failure).toEqual({
      command: "move-tab",
      tab: busy,
      beside: idle,
      side: "before",
    });

    // The Machine made the move, but its answer was lost.
    await rerender({ listed: workspace([busy, idle]) });
    moveTab.mockImplementationOnce(done);
    await act(async () => result.current.retry(result.current.failure!));
    expect(moveTab).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      busy,
      idle,
      "before",
    );
    expect(result.current.failure).toBeNull();
  });
});
