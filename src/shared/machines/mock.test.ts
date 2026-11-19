import { describe, expect, it, vi } from "vitest";

import { createMockClient, type MockMachine } from "./mock";

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

      const killed = client.killWorkspace("mac", "w1");
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

    expect(await client.renameWorkspace("mac", "w1", "web")).toEqual({ kind: "failed" });
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("app");
    expect(await client.renameWorkspace("mac", "w1", "web")).toEqual({ kind: "done" });
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("web");

    expect(await client.killWorkspace("mac", "w1")).toEqual({ kind: "failed" });
    expect(await client.killWorkspace("mac", "w1")).toEqual({ kind: "done" });
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
    expect(await client.killWorkspace("mac", "w2")).toEqual({ kind: "failed" });
    expect(await client.renameWorkspace("gone", "w1", "web")).toEqual({ kind: "failed" });
  });
});
