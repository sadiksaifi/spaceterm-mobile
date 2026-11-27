import { afterEach, describe, expect, it, vi } from "vitest";

import type { NativeJoinState, NativePairedMachine, NativeWorkspace } from "@/modules/libspaceterm";

import { createNativeClient, type NativeMachines } from "./native";

const LINK = "spaceterm://pair/invitation";

/** libspaceterm as the client sees it: the test sets its state, then announces a change. */
function fakeNative() {
  const listeners = new Set<() => void>();
  const state = {
    machines: [] as NativePairedMachine[],
    join: { kind: "reaching" } as NativeJoinState,
    /** Each paused join that `retryJoin` resumes goes back to reaching. */
    retried: 0,
    cancelled: 0,
    connectAccepted: true,
    localNetwork: true,
  };
  const native: NativeMachines = {
    allowLocalNetwork: async () => state.localNetwork,
    readInvitation: () => ({
      kind: "invitation",
      machineId: "core",
      machineName: "Mac mini",
      address: "mac-mini.local",
    }),
    join: () => ({ kind: "joining", join: "j1" }),
    joinState: () => state.join,
    retryJoin: () => {
      if (state.join.kind !== "paused") return false;
      state.retried += 1;
      state.join = { kind: "reaching" };
      return true;
    },
    cancelJoin: async () => {
      state.cancelled += 1;
    },
    stopUnfinishedPairings: vi.fn(async () => true),
    paired: () => state.machines,
    connect: async () => state.connectAccepted,
    disconnect: async () => true,
    unpair: async () => true,
    renameWorkspace: vi.fn(async () => true),
    killWorkspace: vi.fn(async () => true),
    newTab: vi.fn(async () => "t-new"),
    newPane: vi.fn(async () => true),
    moveTab: vi.fn(async () => true),
    panePreviews: vi.fn(async () => []),
    close: vi.fn(async () => true),
    worktreeContext: vi.fn(async () => null),
    worktreeLocation: vi.fn(() => null),
    createWorktree: vi.fn(async () => ({ kind: "failed" as const })),
    checkWorktreeRemoval: vi.fn(async () => ({
      kind: "review" as const,
      boot: "b0",
      confirmation: "c0",
      changes: true,
      submodules: false,
      tabs: 2,
      sessions: 3,
    })),
    removeWorktree: vi.fn(async () => ({ kind: "removed" as const })),
    addListener: (_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const change = (update: Partial<typeof state>) => {
    Object.assign(state, update);
    for (const listener of listeners) listener();
  };
  return { native, state, change };
}

/** Lets a pairing get past asking for local network access. */
async function flush() {
  for (let turn = 0; turn < 3; turn += 1) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("pairing through libspaceterm", () => {
  it("shows the Comparison Code in two groups, then the paired Machine", async () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);

    const started = client.pair(LINK, null);

    await flush();
    change({ join: { kind: "comparing", code: "482915" } });
    const pairing = await started;
    expect(pairing).toMatchObject({ kind: "comparing", code: "482 915" });

    change({
      machines: [
        {
          id: "m1",
          name: "Mac mini",
          address: "mac-mini.local",
          connection: "connected",
          workspaces: [],
        },
      ],
      join: { kind: "paired", machineId: "m1" },
    });
    expect(pairing.kind === "comparing" && (await pairing.outcome)).toEqual({
      kind: "paired",
      machine: { id: "m1", name: "Mac mini" },
    });
  });

  it("tries again when the Machine does not answer at first", async () => {
    vi.useFakeTimers();
    const { native, state, change } = fakeNative();
    const client = createNativeClient(native, { retryWait: 10 });

    const started = client.pair(LINK, null);

    await flush();
    change({ join: { kind: "paused" } });
    await vi.advanceTimersByTimeAsync(10);
    change({ join: { kind: "comparing", code: "482915" } });

    expect(state.retried).toBe(1);
    expect(await started).toMatchObject({ kind: "comparing" });
  });

  it("gives up on a Machine that never answers, and ends the join", async () => {
    vi.useFakeTimers();
    const { native, state, change } = fakeNative();
    const client = createNativeClient(native, { retryWait: 10 });

    const started = client.pair(LINK, null);

    await flush();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      change({ join: { kind: "paused" } });
      await vi.advanceTimersByTimeAsync(10);
    }

    expect(await started).toEqual({ kind: "unreachable" });
    expect(state.retried).toBe(3);
    expect(state.cancelled).toBe(1);
  });

  it("ends as declined when the Machine declines the code", async () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);

    const started = client.pair(LINK, null);

    await flush();
    change({ join: { kind: "comparing", code: "482915" } });
    const pairing = await started;
    change({ join: { kind: "declined" } });

    expect(pairing.kind === "comparing" && (await pairing.outcome)).toEqual({ kind: "declined" });
  });

  it("still tries a Machine when local network access is refused", async () => {
    const { native, state } = fakeNative();
    state.localNetwork = false;
    const join = vi.spyOn(native, "join");

    void createNativeClient(native).pair(LINK, "203.0.113.7");
    await flush();
    expect(join).toHaveBeenCalledWith(LINK, "203.0.113.7");
  });

  it("is unreachable when the join cannot start", async () => {
    const { native } = fakeNative();
    native.join = () => ({ kind: "invalid-address" });

    expect(await createNativeClient(native).pair(LINK, "not an address")).toEqual({
      kind: "unreachable",
    });
  });

  it("reports a device with no room, and how many unfinished pairings hold it", async () => {
    const { native, state, change } = fakeNative();
    const started = createNativeClient(native).pair(LINK, null);
    await flush();
    change({ join: { kind: "full", unfinished: 2 } });

    expect(await started).toEqual({ kind: "full", unfinished: 2 });
    expect(state.cancelled).toBe(0);
  });

  it("stops the unfinished pairings only when asked, and says whether all stopped", async () => {
    const { native } = fakeNative();
    const client = createNativeClient(native);
    expect(native.stopUnfinishedPairings).not.toHaveBeenCalled();

    vi.mocked(native.stopUnfinishedPairings).mockResolvedValueOnce(false);
    expect(await client.stopUnfinishedPairings()).toBe(false);
    expect(await client.stopUnfinishedPairings()).toBe(true);
  });

  it("ends the join when the person cancels", async () => {
    const { native, state, change } = fakeNative();
    const started = createNativeClient(native).pair(LINK, null);
    await flush();
    change({ join: { kind: "comparing", code: "482915" } });
    const pairing = await started;

    if (pairing.kind === "comparing") pairing.cancel();
    expect(state.cancelled).toBe(1);
  });
});

describe("pairing that ends early", () => {
  it("ends the join when the person leaves before the Machine shows a code", async () => {
    const { native, state } = fakeNative();
    const leaving = new AbortController();
    void createNativeClient(native).pair(LINK, null, { signal: leaving.signal });
    await flush();

    leaving.abort();
    expect(state.cancelled).toBe(1);
  });

  it("pairs when the approval is the first state it reads", async () => {
    const { native, state } = fakeNative();
    state.machines = [
      {
        id: "m1",
        name: "Mac mini",
        address: "mac-mini.local",
        connection: "connected",
        workspaces: [],
      },
    ];
    state.join = { kind: "paired", machineId: "m1" };

    const pairing = await createNativeClient(native).pair(LINK, null);
    expect(pairing.kind === "comparing" && (await pairing.outcome)).toEqual({
      kind: "paired",
      machine: { id: "m1", name: "Mac mini" },
    });
  });
});

describe("the paired Machines", () => {
  const mini: NativePairedMachine = {
    id: "m1",
    name: "Mac mini",
    address: "mac-mini.local",
    connection: "disconnected",
    workspaces: null,
  };
  const api: NativeWorkspace = {
    id: "w1",
    name: "api",
    directory: "~/srv/api",
    branch: "main",
    terminalSessions: 2,
    seen: "api seen",
    tabs: [],
    repository: null,
    fixedTabOrder: false,
  };
  const logs: NativeWorkspace = {
    id: "w2",
    name: "logs",
    directory: "/var/log",
    branch: null,
    terminalSessions: 1,
    seen: "logs seen",
    tabs: [],
    repository: null,
    fixedTabOrder: false,
  };

  it("lists a connected Machine's Workspaces and others without a list", () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);
    const heard = vi.fn();
    client.subscribe(heard);

    change({
      machines: [
        { ...mini, connection: "connected", workspaces: [api, logs] },
        { ...mini, id: "m2", name: "MacBook Pro", connection: "connecting" },
      ],
    });

    expect(heard).toHaveBeenCalledOnce();
    expect(client.getSnapshot().machines).toEqual([
      {
        id: "m1",
        name: "Mac mini",
        connection: "connected",
        workspaces: [
          {
            id: "w1",
            name: "api",
            directory: "~/srv/api",
            branch: "main",
            terminalSessions: 2,
            revision: "api seen",
            tabs: [],
            repository: null,
          },
          {
            id: "w2",
            name: "logs",
            directory: "/var/log",
            terminalSessions: 1,
            revision: "logs seen",
            tabs: [],
            repository: null,
          },
        ],
      },
      { id: "m2", name: "MacBook Pro", connection: "reconnecting", workspaces: null },
    ]);
  });

  it("reconnects until a connected Machine's list arrives", () => {
    const { native, state, change } = fakeNative();
    state.machines = [{ ...mini, connection: "connected" }];
    const client = createNativeClient(native);
    expect(client.getSnapshot()).toEqual({
      machines: [{ id: "m1", name: "Mac mini", connection: "reconnecting", workspaces: null }],
      starting: true,
    });

    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    expect(client.getSnapshot()).toEqual({
      machines: [{ id: "m1", name: "Mac mini", connection: "connected", workspaces: [] }],
      starting: false,
    });
  });

  it("gives up on a Machine that connects by itself but never lists, until the list arrives", () => {
    vi.useFakeTimers();
    const { native, state, change } = fakeNative();
    state.machines = [{ ...mini, connection: "connected" }];
    const client = createNativeClient(native);

    vi.advanceTimersByTime(29_999);
    expect(client.getSnapshot().machines[0]?.connection).toBe("reconnecting");
    vi.advanceTimersByTime(1);
    expect(client.getSnapshot()).toEqual({
      machines: [
        { id: "m1", name: "Mac mini", connection: "still-not-connected", workspaces: null },
      ],
      starting: false,
    });

    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    expect(client.getSnapshot().machines[0]?.connection).toBe("connected");
  });

  it("keeps a Machine's last list after it disconnects", () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);

    change({ machines: [{ ...mini, connection: "connected", workspaces: [logs] }] });
    change({ machines: [{ ...mini, connection: "connecting" }] });

    expect(client.getSnapshot().machines).toEqual([
      {
        id: "m1",
        name: "Mac mini",
        connection: "reconnecting",
        workspaces: [
          {
            id: "w2",
            name: "logs",
            directory: "/var/log",
            terminalSessions: 1,
            revision: "logs seen",
            tabs: [],
            repository: null,
          },
        ],
      },
    ]);
  });

  it("renames and kills a Workspace as the person saw it, not as it is now", async () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);
    change({ machines: [{ ...mini, connection: "connected", workspaces: [api] }] });
    const shown = client.getSnapshot().machines[0]?.workspaces?.[0];
    if (shown === undefined) throw new Error("No Workspace listed");

    change({
      machines: [
        {
          ...mini,
          connection: "connected",
          workspaces: [
            {
              ...api,
              terminalSessions: 3,
              seen: "api with a third session",
              tabs: [],
              repository: null,
            },
          ],
        },
      ],
    });
    expect(await client.killWorkspace("m1", shown)).toEqual({ kind: "done" });
    expect(await client.renameWorkspace("m1", shown, "web")).toEqual({ kind: "done" });

    expect(native.killWorkspace).toHaveBeenCalledWith("m1", "w1", "api seen");
    expect(native.renameWorkspace).toHaveBeenCalledWith("m1", "w1", "api seen", "web");
  });

  it("lists a Workspace anew when only what Rename and Kill send back changes", () => {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);
    change({ machines: [{ ...mini, connection: "connected", workspaces: [api] }] });
    const heard = vi.fn();
    client.subscribe(heard);

    change({
      machines: [{ ...mini, connection: "connected", workspaces: [{ ...api, seen: "x" }] }],
    });
    const shown = client.getSnapshot().machines[0]?.workspaces?.[0];
    if (shown === undefined) throw new Error("No Workspace listed");
    void client.killWorkspace("m1", shown);

    expect(heard).toHaveBeenCalledOnce();
    expect(native.killWorkspace).toHaveBeenCalledWith("m1", "w1", "x");
  });

  it("starts until the first Machine answers", () => {
    const { native, state, change } = fakeNative();
    state.machines = [{ ...mini, connection: "connecting" }];
    const client = createNativeClient(native);
    expect(client.getSnapshot().starting).toBe(true);

    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    change({ machines: [{ ...mini, connection: "connecting" }] });
    expect(client.getSnapshot().starting).toBe(false);
  });

  it("is still not connected after a Connect that fails", async () => {
    const { native, state, change } = fakeNative();
    state.machines = [mini];
    const client = createNativeClient(native);

    const connecting = client.connect("m1");
    await Promise.resolve();
    change({ machines: [{ ...mini, connection: "connecting" }] });
    change({ machines: [mini] });
    await connecting;

    expect(client.getSnapshot().machines[0]?.connection).toBe("still-not-connected");
  });

  it("leaves a Machine alone that connected or started connecting before Connect reached it", async () => {
    const { native, state, change } = fakeNative();
    state.machines = [{ ...mini, connection: "connected", workspaces: [] }];
    const client = createNativeClient(native);
    const connect = vi.spyOn(native, "connect");

    await client.connect("m1");
    change({ machines: [{ ...mini, connection: "connecting" }] });
    const connecting = client.connect("m1");
    await flush();
    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    await connecting;

    expect(connect).not.toHaveBeenCalled();
    expect(client.getSnapshot().machines[0]?.connection).toBe("connected");
  });

  it("stops waiting for a Machine that connects but never lists, and Connect starts it over", async () => {
    vi.useFakeTimers();
    const { native, state, change } = fakeNative();
    state.machines = [mini];
    const client = createNativeClient(native);
    const connect = vi.spyOn(native, "connect");

    const connecting = client.connect("m1");
    await flush();
    change({ machines: [{ ...mini, connection: "connected" }] });
    await vi.advanceTimersByTimeAsync(30_000);
    await connecting;
    expect(client.getSnapshot().machines[0]?.connection).toBe("still-not-connected");

    void client.connect("m1");
    await flush();
    expect(connect).toHaveBeenCalledTimes(2);
    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    expect(client.getSnapshot().machines[0]?.connection).toBe("connected");
  });

  it("connects once the Machine has sent its Workspaces", async () => {
    const { native, state, change } = fakeNative();
    state.machines = [mini];
    const client = createNativeClient(native);
    let settled = false;

    const connecting = client.connect("m1").then(() => (settled = true));
    await Promise.resolve();
    change({ machines: [{ ...mini, connection: "connecting" }] });
    change({ machines: [{ ...mini, connection: "connected" }] });
    await flush();
    expect(settled).toBe(false);

    change({ machines: [{ ...mini, connection: "connected", workspaces: [] }] });
    await connecting;
    expect(client.getSnapshot().machines[0]?.connection).toBe("connected");
  });

  it("reads an Invitation Link as the Machine it names", () => {
    const { native } = fakeNative();
    expect(createNativeClient(native).readInvitation(LINK)).toEqual({
      kind: "invitation",
      invitation: { machineId: "core", machineName: "Mac mini", address: "mac-mini.local" },
    });
  });
});

describe("a Workspace's Tabs through libspaceterm", () => {
  const root = "/Users/you/Projects/api";
  const pane = {
    id: "p1",
    name: "zsh",
    source: null,
    side: "right" as const,
    running: false,
    controlledElsewhere: false,
    seen: "pane seen",
  };
  const workspace: NativeWorkspace = {
    id: "w1",
    name: "api",
    directory: "~/Projects/api",
    branch: "main",
    terminalSessions: 1,
    seen: "api seen",
    tabs: [{ id: "t1", name: "zsh", worktree: root, panes: [pane], seen: "tab seen" }],
    repository: { root, worktrees: [{ path: `${root}-fix`, name: "fix" }] },
    fixedTabOrder: false,
  };
  const machine: NativePairedMachine = {
    id: "m1",
    name: "Mac mini",
    address: "mac-mini.local",
    connection: "connected",
    workspaces: [workspace],
  };

  function listed() {
    const { native, change } = fakeNative();
    const client = createNativeClient(native);
    change({ machines: [machine] });
    const shown = client.getSnapshot().machines[0].workspaces?.[0];
    if (shown === undefined) throw new Error("no Workspace listed");
    return { native, client, shown };
  }

  it("closes a Tab or a Pane as the person saw it", async () => {
    const { native, client, shown } = listed();
    const [tab] = shown.tabs;

    await expect(client.closeTab("m1", shown, tab, true)).resolves.toEqual({ kind: "done" });
    await client.closePane("m1", shown, tab, tab.panes[0], false);

    expect(native.close).toHaveBeenNthCalledWith(1, "m1", "w1", "t1", null, "tab seen", true);
    expect(native.close).toHaveBeenNthCalledWith(2, "m1", "w1", "t1", "p1", "pane seen", false);
  });

  it("opens a Tab in a Worktree of the Workspace's repository and answers with it", async () => {
    const { native, client, shown } = listed();

    const opened = await client.newTab("m1", shown, { path: `${root}-fix`, name: "fix" }, true);

    expect(opened).toEqual({ kind: "done", tab: "t-new" });
    expect(native.newTab).toHaveBeenCalledWith("m1", "w1", root, `${root}-fix`, true);
  });

  it("adds a Pane beside the Pane it is given", async () => {
    const { native, client, shown } = listed();

    await client.newPane("m1", shown, shown.tabs[0], shown.tabs[0].panes[0], false);

    expect(native.newPane).toHaveBeenCalledWith("m1", "w1", "t1", "p1", false);
  });

  it("asks for a Worktree from a remote branch as a new branch that tracks it", async () => {
    const { native, client, shown } = listed();
    const context = {
      root,
      local: [],
      remote: ["origin/topic"],
      checkedOut: [],
      startFrom: null,
      template: "~/.worktrees/{repository}/{branch}",
      home: "/Users/you",
    };

    await client.createWorktree("m1", shown, context, {
      branch: { kind: "remote", remote: "origin/topic", name: "topic" },
      location: "~/.worktrees/api/topic",
    });

    expect(native.createWorktree).toHaveBeenCalledWith(
      "m1",
      "w1",
      root,
      "/Users/you",
      "~/.worktrees/api/topic",
      "remote",
      "topic",
      "origin/topic",
    );
  });

  it("removes a Worktree with the check the person confirmed", async () => {
    const { native, client } = listed();
    const worktree = { path: `${root}-fix`, name: "fix" };
    const repository = { root, worktrees: [{ path: root, name: "main" }, worktree] };

    const check = await client.checkWorktreeRemoval("m1", repository, worktree);
    if (check.kind !== "review") throw new Error("no review");
    const removal = await client.removeWorktree("m1", repository, check.review);

    expect(check.review).toMatchObject({ worktree, changes: true, tabs: 2, sessions: 3 });
    expect(native.checkWorktreeRemoval).toHaveBeenCalledWith("m1", root, `${root}-fix`);
    expect(native.removeWorktree).toHaveBeenCalledWith("m1", root, `${root}-fix`, "b0", "c0");
    expect(removal).toEqual({ kind: "removed" });
  });
});
