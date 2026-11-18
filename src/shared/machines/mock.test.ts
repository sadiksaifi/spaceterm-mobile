import { describe, expect, it } from "vitest";

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

  it("refuses every other command when asked to, so Try Again succeeds", async () => {
    const client = createMockClient([{ ...mac, workspaces: [workspace] }], { refuse: true });

    await expect(client.renameWorkspace("mac", "w1", "web")).rejects.toThrow();
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("app");
    await client.renameWorkspace("mac", "w1", "web");
    expect(client.getSnapshot().machines[0]?.workspaces?.[0]?.name).toBe("web");

    await expect(client.killWorkspace("mac", "w1")).rejects.toThrow();
    await client.killWorkspace("mac", "w1");
    expect(client.getSnapshot().machines[0]?.workspaces).toEqual([]);

    expect(await client.createWorkspace("mac", "~/Projects/app")).toEqual({ kind: "failed" });
    expect(await client.createWorkspace("mac", "~/Projects/app")).toMatchObject({
      kind: "created",
    });
  });
});
