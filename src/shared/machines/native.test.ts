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
    paired: () => state.machines,
    connect: async () => state.connectAccepted,
    disconnect: async () => true,
    unpair: async () => true,
    renameWorkspace: vi.fn(async () => true),
    killWorkspace: vi.fn(async () => true),
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
  };
  const logs: NativeWorkspace = {
    id: "w2",
    name: "logs",
    directory: "/var/log",
    branch: null,
    terminalSessions: 1,
    seen: "logs seen",
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
          { id: "w1", name: "api", directory: "~/srv/api", branch: "main", terminalSessions: 2 },
          { id: "w2", name: "logs", directory: "/var/log", terminalSessions: 1 },
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
        workspaces: [{ id: "w2", name: "logs", directory: "/var/log", terminalSessions: 1 }],
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
          workspaces: [{ ...api, terminalSessions: 3, seen: "api with a third session" }],
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
