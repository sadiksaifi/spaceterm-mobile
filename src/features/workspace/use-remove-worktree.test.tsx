import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type {
  Repository,
  Worktree,
  WorktreeRemoval,
  WorktreeRemovalCheck,
  WorktreeRemovalReview,
} from "@/shared/machines/model";

import { useRemoveWorktree, type RemovalClient } from "./use-remove-worktree";

const main: Worktree = { path: "/srv/api", name: "main" };
const fix: Worktree = { path: "/srv/api-fix", name: "fix" };
const repository: Repository = { root: main.path, worktrees: [main, fix] };
const review: WorktreeRemovalReview = {
  worktree: fix,
  changes: true,
  submodules: false,
  tabs: 1,
  sessions: 2,
  confirmation: "c1",
};

async function render(
  client: Partial<RemovalClient>,
  { active = fix, connected = true }: { active?: Worktree; connected?: boolean } = {},
) {
  const full = {
    checkWorktreeRemoval: jest.fn(async (): Promise<WorktreeRemovalCheck> => ({
      kind: "review",
      review,
    })),
    removeWorktree: jest.fn(async (): Promise<WorktreeRemoval> => ({ kind: "removed" })),
    ...client,
  };
  const hook = await renderHook(
    ({ workspaceId }: { workspaceId: string }) =>
      useRemoveWorktree({
        client: full,
        machineId: "m1",
        workspaceId,
        repository,
        active,
        connected,
      }),
    { initialProps: { workspaceId: "w1" } },
  );
  return { ...hook, client: full };
}

describe("useRemoveWorktree", () => {
  it("offers no remove for the Main Worktree or a Machine that is not connected", async () => {
    expect((await render({}, { active: main })).result.current.start).toBeUndefined();
    expect((await render({}, { connected: false })).result.current.start).toBeUndefined();
    expect((await render({})).result.current.start).toBeDefined();
  });

  it("asks with what the Machine checked, and removes with that check", async () => {
    const { result, client } = await render({});

    await act(async () => result.current.start?.());
    expect(result.current.alert).toEqual({ kind: "confirm", review });

    await act(async () => result.current.confirm());
    expect(client.removeWorktree).toHaveBeenCalledWith("m1", repository, review);
    expect(result.current.alert).toBeNull();
  });

  it("says why when the Machine refuses the remove", async () => {
    const { result } = await render({
      removeWorktree: async () => ({ kind: "failed", failure: "changed" }),
    });

    await act(async () => result.current.start?.());
    await act(async () => result.current.confirm());

    expect(result.current.alert).toEqual({
      kind: "failed",
      worktree: fix,
      failure: "changed",
      checking: false,
    });
  });

  it("removes nothing when the Machine cannot check, and says so", async () => {
    const { result, client } = await render({
      checkWorktreeRemoval: async () => ({ kind: "failed", failure: "failed" }),
    });

    await act(async () => result.current.start?.());

    expect(result.current.alert).toEqual({
      kind: "failed",
      worktree: fix,
      failure: "failed",
      checking: true,
    });
    expect(client.removeWorktree).not.toHaveBeenCalled();
  });

  it("shows nothing when the check finds that a remove whose answer was lost went through", async () => {
    const { result, client } = await render({
      checkWorktreeRemoval: async () => ({ kind: "removed" }),
    });

    await act(async () => result.current.start?.());

    expect(result.current.alert).toBeNull();
    expect(client.removeWorktree).not.toHaveBeenCalled();
  });

  it("drops a check that answers after the person left its Workspace", async () => {
    let answer: (check: WorktreeRemovalCheck) => void = () => {};
    const { result, rerender } = await render({
      checkWorktreeRemoval: () => new Promise((resolve) => (answer = resolve)),
    });

    await act(async () => result.current.start?.());
    await rerender({ workspaceId: "w2" });
    await rerender({ workspaceId: "w1" });
    await act(async () => answer({ kind: "review", review }));

    expect(result.current.alert).toBeNull();
    expect(result.current.start).toBeDefined();
  });

  it("checks one Worktree at a time on a Machine, across its Workspaces", async () => {
    let answer: (check: WorktreeRemovalCheck) => void = () => {};
    const { result, rerender } = await render({
      checkWorktreeRemoval: () => new Promise((resolve) => (answer = resolve)),
    });

    await act(async () => result.current.start?.());
    await rerender({ workspaceId: "w2" });
    expect(result.current.start).toBeUndefined();

    await act(async () => answer({ kind: "review", review }));
    expect(result.current.start).toBeDefined();
  });

  it("drops a Workspace's question when another Workspace checks on the same Machine", async () => {
    const { result, rerender } = await render({});

    await act(async () => result.current.start?.());
    await rerender({ workspaceId: "w2" });
    await act(async () => result.current.start?.());
    expect(result.current.alert).toEqual({ kind: "confirm", review });

    await rerender({ workspaceId: "w1" });
    expect(result.current.alert).toBeNull();
  });

  it("keeps a Workspace's refusal while another Workspace asks", async () => {
    const { result, rerender } = await render({
      removeWorktree: async () => ({ kind: "failed", failure: "locked" }),
    });

    await act(async () => result.current.start?.());
    await act(async () => result.current.confirm());
    await rerender({ workspaceId: "w2" });
    await act(async () => result.current.start?.());
    await rerender({ workspaceId: "w1" });

    expect(result.current.alert).toEqual({
      kind: "failed",
      worktree: fix,
      failure: "locked",
      checking: false,
    });
  });

  it("tries a remove whose answer was lost again from its alert", async () => {
    const checkWorktreeRemoval = jest
      .fn<RemovalClient["checkWorktreeRemoval"]>()
      .mockResolvedValueOnce({ kind: "review", review })
      .mockResolvedValueOnce({ kind: "removed" });
    const { result, client } = await render({
      checkWorktreeRemoval,
      removeWorktree: async () => ({ kind: "failed", failure: "unanswered" }),
    });

    await act(async () => result.current.start?.());
    await act(async () => result.current.confirm());
    expect(result.current.alert).toMatchObject({ kind: "failed", failure: "unanswered" });

    await act(async () => result.current.confirm());
    expect(client.checkWorktreeRemoval).toHaveBeenLastCalledWith("m1", repository, fix);
    expect(result.current.alert).toBeNull();
  });
});
