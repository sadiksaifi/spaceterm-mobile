import { describe, expect, it, vi } from "vitest";

import { createMockClient, type MockMachine, type MockPairing } from "./mock";

const mac: MockMachine = {
  id: "mac",
  name: "MacBook Pro",
  connection: "connected",
  home: "/Users/you",
  directories: {
    "/Users": ["you"],
    "/Users/you": ["Projects"],
    "/Users/you/Projects": ["app"],
    "/Users/you/Projects/app": [],
    "/var/root": "unavailable",
  },
  branches: { "/Users/you/Projects/app": "main" },
  workspaces: [],
};

const workspace = {
  id: "w1",
  name: "app",
  directory: "~/Projects/app",
  terminalSessions: 1,
  tabs: [],
  repository: null,
};

describe("the mock client", () => {
  it("lists a directory with its parent, as the Machine shows paths", async () => {
    const client = createMockClient([mac]);
    expect(await client.listDirectory("mac", "~/Projects")).toEqual({
      kind: "listed",
      path: "~/Projects/",
      parent: "~/",
      directories: [{ name: "app", path: "~/Projects/app/" }],
    });
    expect(await client.listDirectory("mac", "~/")).toMatchObject({
      path: "~/",
      parent: "/Users/",
    });
    expect(await client.listDirectory("mac", "/var/root/")).toMatchObject({ kind: "unavailable" });
  });

  it("adds a Workspace named after its directory and tells its subscribers", async () => {
    const client = createMockClient([mac]);
    let changes = 0;
    client.subscribe(() => changes++);

    const result = await client.createWorkspace("mac", "~/Projects/app/");

    expect(result).toMatchObject({
      kind: "created",
      workspace: { name: "app", directory: "~/Projects/app", branch: "main" },
    });
    expect(client.getSnapshot().machines[0]?.workspaces).toHaveLength(1);
    expect(changes).toBe(1);
  });

  it("makes a change when its answer arrives, not before", async () => {
    vi.useFakeTimers();
    try {
      const client = createMockClient([{ ...mac, workspaces: [workspace] }], { latency: 500 });
      const workspaces = () => client.getSnapshot().machines[0]?.workspaces;

      const killed = client.killWorkspace("mac", workspace);
      await vi.advanceTimersByTimeAsync(499);
      expect(workspaces()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await killed).toEqual({ kind: "done" });
      expect(workspaces()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates a missing directory only when asked to", async () => {
    const client = createMockClient([mac]);
    expect(await client.createWorkspace("mac", "~/Projects/notes")).toEqual({
      kind: "missing-directory",
      directory: "~/Projects/notes",
    });
    expect(client.getSnapshot().machines[0]?.workspaces).toHaveLength(0);

    await client.createWorkspace("mac", "~/Projects/notes", { createDirectory: true });

    expect(await client.listDirectory("mac", "~/Projects/")).toMatchObject({
      directories: [
        { name: "app", path: "~/Projects/app/" },
        { name: "notes", path: "~/Projects/notes/" },
      ],
    });
  });

  it("lists each directory it creates in its parent, however deep the new path goes", async () => {
    const client = createMockClient([mac]);
    await client.createWorkspace("mac", "~/Projects/notes/2026", { createDirectory: true });

    expect(await client.listDirectory("mac", "~/Projects/")).toMatchObject({
      directories: [{ name: "app" }, { name: "notes" }],
    });
    expect(await client.listDirectory("mac", "~/Projects/notes/")).toMatchObject({
      directories: [{ name: "2026", path: "~/Projects/notes/2026/" }],
    });
  });

  it("treats a directory its parent names as one that exists and is empty", async () => {
    // The parent names `src`, which has no entry of its own.
    const named: MockMachine = {
      ...mac,
      directories: { ...mac.directories, "/Users/you/Projects/app": ["src"] },
    };
    const client = createMockClient([named]);
    expect(await client.listDirectory("mac", "~/Projects/app/src")).toMatchObject({
      kind: "listed",
      directories: [],
    });

    await client.createWorkspace("mac", "~/Projects/app/src", { createDirectory: true });
    expect(await client.listDirectory("mac", "~/Projects/app")).toMatchObject({
      directories: [{ name: "src", path: "~/Projects/app/src/" }],
    });
  });

  it("refuses every other command when asked to, so Try Again succeeds", async () => {
    const client = createMockClient([{ ...mac, workspaces: [workspace] }], { refuse: true });

    expect(await client.renameWorkspace("mac", workspace, "web")).toEqual({ kind: "failed" });
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("app");
    expect(await client.renameWorkspace("mac", workspace, "web")).toEqual({ kind: "done" });
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("web");

    expect(await client.killWorkspace("mac", workspace)).toEqual({ kind: "failed" });
    expect(await client.killWorkspace("mac", workspace)).toEqual({ kind: "done" });
    expect(client.getSnapshot().machines[0]?.workspaces).toEqual([]);

    expect(await client.createWorkspace("mac", "~/Projects/app")).toEqual({ kind: "failed" });
    expect(await client.createWorkspace("mac", "~/Projects/app")).toMatchObject({
      kind: "created",
    });
  });

  it("answers a Machine that is not paired, or a Workspace that is gone, with a failure", async () => {
    const client = createMockClient([{ ...mac, workspaces: [workspace] }]);

    expect(await client.listDirectory("gone", "~/")).toMatchObject({ kind: "unavailable" });
    expect(await client.createWorkspace("gone", "~/")).toEqual({ kind: "failed" });
    expect(await client.killWorkspace("mac", { ...workspace, id: "w2" })).toEqual({
      kind: "failed",
    });
    expect(await client.renameWorkspace("gone", workspace, "web")).toEqual({ kind: "failed" });
  });

  it("disconnects at once, and reconnects when the Machine answers Connect", async () => {
    vi.useFakeTimers();
    const client = createMockClient([mac], { latency: 100 });
    const connection = () => client.getSnapshot().machines[0]?.connection;

    client.disconnect("mac");
    expect(connection()).toBe("not-connected");

    client.connect("mac");
    expect(connection()).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100);
    expect(connection()).toBe("connected");
    vi.useRealTimers();
  });

  it("lets Disconnect end a Connect still under way, so its late answer changes nothing", async () => {
    vi.useFakeTimers();
    const client = createMockClient([{ ...mac, connection: "not-connected" }], {
      latency: 100,
      refuse: true,
    });
    const connection = () => client.getSnapshot().machines[0]?.connection;

    // The first try will be refused, the second reached. Disconnect ends the first.
    client.connect("mac");
    client.disconnect("mac");
    await vi.advanceTimersByTimeAsync(100);
    expect(connection()).toBe("not-connected");

    // A try started after Disconnect waits for its own answer, not an earlier one's.
    client.connect("mac");
    await vi.advanceTimersByTimeAsync(50);
    client.disconnect("mac");
    client.connect("mac");
    await vi.advanceTimersByTimeAsync(50);
    expect(connection()).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(50);
    expect(connection()).toBe("still-not-connected");
    vi.useRealTimers();
  });

  it("lets a subscriber that disconnects on seeing Reconnecting end that try", async () => {
    vi.useFakeTimers();
    const client = createMockClient([{ ...mac, connection: "not-connected" }], { latency: 100 });
    const connection = () => client.getSnapshot().machines[0]?.connection;
    client.subscribe(() => {
      if (connection() === "reconnecting") client.disconnect("mac");
    });

    client.connect("mac");
    await vi.advanceTimersByTimeAsync(100);

    expect(connection()).toBe("not-connected");
    vi.useRealTimers();
  });

  it("is still not connected when Connect fails, and Connect tries again", async () => {
    const client = createMockClient([{ ...mac, connection: "not-connected" }], { refuse: true });
    const connection = () => client.getSnapshot().machines[0]?.connection;

    await client.connect("mac");
    expect(connection()).toBe("still-not-connected");
    await client.connect("mac");
    expect(connection()).toBe("connected");
  });

  it("restarts SpaceTerm Core on a connected Machine, which ends its Terminal Sessions", async () => {
    const client = createMockClient([
      { ...mac, workspaces: [{ ...workspace, terminalSessions: 3, tabs: [], repository: null }] },
      { ...mac, id: "away", connection: "not-connected", workspaces: [workspace] },
    ]);

    expect(await client.restartCore("away")).toEqual({ kind: "failed" });
    expect(await client.restartCore("mac")).toEqual({ kind: "done" });
    expect(client.getSnapshot().machines[0]?.workspaces).toEqual([
      { ...workspace, terminalSessions: 0, tabs: [], repository: null },
    ]);
  });

  it("unpairs at once, connected or not, so the Machine leaves the list", () => {
    const client = createMockClient([mac, { ...mac, id: "away", connection: "not-connected" }]);
    let changes = 0;
    client.subscribe(() => changes++);

    client.unpair("away");
    client.unpair("mac");

    expect(client.getSnapshot().machines).toEqual([]);
    expect(changes).toBe(2);
  });

  describe("pairing", () => {
    const link = "spaceterm://pair/eyJtYWNoaW5lX25hbWUiOiJNYWMgbWluaSJ9";
    const mini: MockMachine = { ...mac, id: "mini", name: "Mac mini" };
    const pairing = (answer: MockPairing["answer"]) => ({
      machine: mini,
      address: "mac-mini.local",
      code: "482 915",
      answer,
      wait: 3000,
    });

    /** Starts a pairing on a client whose timers are fake, and waits for the Machine's first answer. */
    async function start(client: ReturnType<typeof createMockClient>) {
      const started = client.pair(link, null);
      await vi.advanceTimersByTimeAsync(0);
      const pairing = await started;
      if (pairing.kind !== "comparing") throw new Error("expected a pairing");
      return pairing;
    }

    it("has no room until its unfinished pairings stop, then pairs", async () => {
      vi.useFakeTimers();
      try {
        const client = createMockClient([mac], { pairing: pairing("full") });
        const full = client.pair(link, null);
        await vi.advanceTimersByTimeAsync(0);
        expect(await full).toEqual({ kind: "full", unfinished: 2 });

        const stopped = client.stopUnfinishedPairings();
        await vi.advanceTimersByTimeAsync(0);
        expect(await stopped).toBe(true);
        const started = await start(client);
        await vi.advanceTimersByTimeAsync(3000);
        expect(await started.outcome).toEqual({
          kind: "paired",
          machine: { id: "mini", name: "Mac mini" },
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("can use no Invitation Link and reach no Machine without a pairing to fake", async () => {
      const client = createMockClient([mac]);
      expect(client.readInvitation(link)).toEqual({ kind: "unusable" });
      expect(await client.pair(link, null)).toEqual({ kind: "unreachable" });
    });

    it("reads an Invitation Link for the Machine it pairs, and nothing else", () => {
      const client = createMockClient([mac], { pairing: pairing("approve") });
      const invitation = { machineId: "mini", machineName: "Mac mini", address: "mac-mini.local" };
      expect(client.readInvitation(link)).toEqual({ kind: "invitation", invitation });
      expect(client.readInvitation("https://example.com")).toEqual({ kind: "unusable" });
      expect(
        createMockClient([mac], { pairing: pairing("unusable") }).readInvitation(link),
      ).toEqual({ kind: "unusable" });
    });

    it("says when the link's Machine is paired already", () => {
      const client = createMockClient([mac], { pairing: { ...pairing("approve"), machine: mac } });
      expect(client.readInvitation(link)).toMatchObject({
        kind: "already-paired",
        invitation: { machineName: "MacBook Pro" },
      });
    });

    it("shows the Comparison Code, then pairs the Machine once it approves", async () => {
      vi.useFakeTimers();
      try {
        const client = createMockClient([mac], { pairing: pairing("approve") });
        const started = await start(client);
        expect(started.code).toBe("482 915");

        await vi.advanceTimersByTimeAsync(2999);
        expect(client.getSnapshot().machines).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(await started.outcome).toEqual({
          kind: "paired",
          machine: { id: "mini", name: "Mac mini" },
        });
        expect(client.getSnapshot().machines.map((machine) => machine.name)).toEqual([
          "MacBook Pro",
          "Mac mini",
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("pairs nothing when the Machine declines, or when this device cancels", async () => {
      vi.useFakeTimers();
      try {
        const declining = createMockClient([mac], { pairing: pairing("decline") });
        const declined = await start(declining);
        await vi.advanceTimersByTimeAsync(3000);
        expect(await declined.outcome).toEqual({ kind: "declined" });
        expect(declining.getSnapshot().machines).toHaveLength(1);

        const approving = createMockClient([mac], { pairing: pairing("approve") });
        const cancelled = await start(approving);
        cancelled.cancel();
        await vi.advanceTimersByTimeAsync(3000);
        expect(approving.getSnapshot().machines).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("cannot reach a Machine that does not answer", async () => {
      const client = createMockClient([mac], { pairing: pairing("unreachable") });
      expect(await client.pair(link, "10.0.0.5")).toEqual({ kind: "unreachable" });
    });
  });
});

describe("the mock client's Tabs", () => {
  const zsh = (id: string, source: string | null = null) => ({
    id,
    name: "zsh",
    source,
    side: "right" as const,
    running: false,
    controlledElsewhere: false,
  });
  const split = {
    ...workspace,
    terminalSessions: 3,
    tabs: [
      { id: "t1", name: "zsh", worktree: null, panes: [zsh("p1"), zsh("p2", "p1")] },
      { id: "t2", name: "zsh", worktree: null, panes: [zsh("p3")] },
    ],
  };
  const listedNow = (client: ReturnType<typeof createMockClient>) =>
    client.getSnapshot().machines[0].workspaces?.[0];

  it("closes a Tab when its last Pane closes, and counts one Terminal Session per Pane", async () => {
    const client = createMockClient([{ ...mac, workspaces: [split] }]);
    const [, second] = split.tabs;

    await client.closePane("mac", split, second, second.panes[0], false);

    expect(listedNow(client)?.tabs.map((tab) => tab.id)).toEqual(["t1"]);
    expect(listedNow(client)?.terminalSessions).toBe(2);
  });

  it("adds a Tab last and a Pane beside a Tab's last Pane", async () => {
    const client = createMockClient([{ ...mac, workspaces: [split] }]);

    const opened = await client.newTab("mac", split, null, false);
    await client.newPane("mac", split, split.tabs[0], split.tabs[0].panes.at(-1)!, false);

    const tabs = listedNow(client)?.tabs ?? [];
    expect(opened.kind === "done" && tabs.at(-1)?.id).toBe(opened.kind === "done" && opened.tab);
    expect(tabs[0].panes.at(-1)?.source).toBe("p2");
    expect(listedNow(client)?.terminalSessions).toBe(5);
  });

  it("moves a Tab before or after another, for every device", async () => {
    const client = createMockClient([{ ...mac, workspaces: [split] }]);
    const [first, second] = split.tabs;
    const order = () => listedNow(client)?.tabs.map((tab) => tab.id);

    await client.moveTab("mac", split, first, second, "after");
    expect(order()).toEqual(["t2", "t1"]);
    await client.moveTab("mac", split, first, second, "before");
    expect(order()).toEqual(["t1", "t2"]);
  });
});
