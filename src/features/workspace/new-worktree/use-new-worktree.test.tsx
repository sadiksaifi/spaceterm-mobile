import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Workspace, WorktreeContext, WorktreeCreation } from "@/shared/machines/model";

import { pick } from "../grid";
import { changeGridState, useGridState } from "../grid-store";
import { useNewWorktree, type NewWorktreeClient } from "./use-new-worktree";

const CONTEXT: WorktreeContext = {
  root: "/srv/api",
  local: ["main", "fix"],
  remote: [],
  checkedOut: ["main"],
  startFrom: "main",
  template: "",
  home: "/home/me",
};

const WORKSPACE: Workspace = {
  id: "w",
  name: "api",
  directory: "~/srv/api",
  terminalSessions: 0,
  tabs: [],
  repository: { root: "/srv/api", worktrees: [{ path: "/srv/api", name: "main" }] },
};

/** Each test gets its own Machine, so the grid state the app keeps does not carry over. */
let machines = 0;

async function render(
  creations: (WorktreeCreation | Promise<WorktreeCreation>)[],
  contexts: (WorktreeContext | null)[] = [CONTEXT],
) {
  const machineId = `mac-${(machines += 1)}`;
  const onCreated = jest.fn();
  const sent: Parameters<NewWorktreeClient["createWorktree"]>[3][] = [];
  const client: NewWorktreeClient = {
    worktreeContext: async () => contexts.shift() ?? null,
    worktreeLocation: (_, branch) => `~/wt/${branch}`,
    createWorktree: async (_machine, _workspace, _context, request) => {
      sent.push(request);
      return (await creations.shift()) ?? { kind: "failed" };
    },
  };
  const hook = await renderHook(() =>
    useNewWorktree({ client, machineId, workspace: WORKSPACE, onCreated }),
  );
  return { ...hook, machineId, onCreated, sent };
}

describe("useNewWorktree", () => {
  it("opens the new Worktree's Tab once created, and closes the form", async () => {
    const { result, machineId, onCreated } = await render([{ kind: "created", tab: "t9" }]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());

    expect(onCreated).toHaveBeenCalledTimes(1);
    const grid = await renderHook(() => useGridState(`${machineId}/w`));
    expect(grid.result.current[0]).toMatchObject({ picked: null, expecting: "t9", used: ["t9"] });
  });

  it("opens the new Worktree's Tab but leaves the screen alone when the form closed first", async () => {
    let answer: (creation: WorktreeCreation) => void = () => {};
    const created = new Promise<WorktreeCreation>((resolve) => (answer = resolve));
    const { result, machineId, onCreated, unmount } = await render([created]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());

    await unmount();
    await act(async () => answer({ kind: "created", tab: "t9" }));

    expect(onCreated).not.toHaveBeenCalled();
    const grid = await renderHook(() => useGridState(`${machineId}/w`));
    expect(grid.result.current[0]).toMatchObject({ expecting: "t9", used: ["t9"] });
  });

  it("leaves the Worktree the person picked while Create was on its way", async () => {
    let answer: (creation: WorktreeCreation) => void = () => {};
    const created = new Promise<WorktreeCreation>((resolve) => (answer = resolve));
    const { result, machineId, unmount } = await render([created]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());

    await unmount();
    const other = "/srv/api-other";
    await act(async () => changeGridState(`${machineId}/w`, (grid) => pick(grid, other)));
    await act(async () => answer({ kind: "created", tab: "t9" }));

    const grid = await renderHook(() => useGridState(`${machineId}/w`));
    expect(grid.result.current[0]).toMatchObject({ picked: other, expecting: null });
  });

  it("leaves the Worktree picked again while Create was on its way, as it was before", async () => {
    let answer: (creation: WorktreeCreation) => void = () => {};
    const created = new Promise<WorktreeCreation>((resolve) => (answer = resolve));
    const { result, machineId, unmount } = await render([created]);
    const key = `${machineId}/w`;
    const [first, other] = ["/srv/api-first", "/srv/api-other"];
    await act(async () => changeGridState(key, (grid) => pick(grid, first)));
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());

    await unmount();
    await act(async () => changeGridState(key, (grid) => pick(grid, other)));
    await act(async () => changeGridState(key, (grid) => pick(grid, first)));
    await act(async () => answer({ kind: "created", tab: "t9" }));

    const grid = await renderHook(() => useGridState(key));
    expect(grid.result.current[0]).toMatchObject({ picked: first, expecting: null });
  });

  it("says a Location is not empty until the Location changes", async () => {
    const { result } = await render([{ kind: "not-empty" }]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());
    expect(result.current.form?.problem).toBe("not-empty");

    await act(async () => result.current.setLocation("~/wt/elsewhere"));
    expect(result.current.form?.problem).toBeNull();
    expect(result.current.form?.view.location).toBe("~/wt/elsewhere");
  });

  it("says a branch name the Machine refused until the name changes", async () => {
    const { result } = await render([{ kind: "branch-exists" }, { kind: "invalid-name" }]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());
    expect(result.current.failure).toBeNull();
    expect(result.current.form?.problem).toBe("branch-exists");
    expect(result.current.form?.request).toBeNull();

    await act(async () => result.current.setName("other"));
    expect(result.current.form?.problem).toBeNull();
    await act(async () => result.current.create());
    expect(result.current.form?.problem).toBe("invalid-name");
  });

  it("tries again with the Create that failed, even after the form changed", async () => {
    const { result, sent } = await render([{ kind: "failed" }, { kind: "created", tab: "t9" }]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());
    expect(result.current.failure).toBe("create");

    await act(async () => result.current.setName("different"));
    await act(async () => result.current.retry());
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[1]).toMatchObject({ location: "~/wt/topic" });
  });

  it("offers Try Again when the branches do not load, and loads them again", async () => {
    const { result } = await render([], [null, CONTEXT]);
    expect(result.current.failure).toBe("branches");
    expect(result.current.form).toBeNull();

    await act(async () => result.current.retry());
    expect(result.current.failure).toBeNull();
    expect(result.current.form?.view).toMatchObject({ kind: "new", startFrom: { value: "main" } });
  });
});
