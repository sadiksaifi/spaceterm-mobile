import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { Workspace, WorktreeContext, WorktreeCreation } from "@/shared/machines/model";

import { useGridState } from "../grid-store";
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
  const client: NewWorktreeClient = {
    worktreeContext: async () => contexts.shift() ?? null,
    worktreeLocation: (_, branch) => `~/wt/${branch}`,
    createWorktree: async () => (await creations.shift()) ?? { kind: "failed" },
  };
  const hook = await renderHook(() =>
    useNewWorktree({ client, machineId, workspace: WORKSPACE, onCreated }),
  );
  return { ...hook, machineId, onCreated };
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

  it("says a Location is not empty until the Location changes", async () => {
    const { result } = await render([{ kind: "not-empty" }]);
    await act(async () => result.current.setName("topic"));
    await act(async () => result.current.create());
    expect(result.current.form?.problem).toBe("not-empty");

    await act(async () => result.current.setLocation("~/wt/elsewhere"));
    expect(result.current.form?.problem).toBeNull();
    expect(result.current.form?.view.location).toBe("~/wt/elsewhere");
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
