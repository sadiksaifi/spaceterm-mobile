import { expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { MachinesProvider } from "@/shared/machines/client";
import type {
  CreateWorkspaceResult,
  DirectoryListing,
  MachineClient,
} from "@/shared/machines/model";

import { SPINNER_DELAY_MS, useDirectoryPicker } from "./use-directory-picker";

const home: DirectoryListing = { kind: "listed", path: "~/", parent: null, directories: [] };
const created: CreateWorkspaceResult = { kind: "created", workspaceId: "w1" };

/** A Machine that lists `home` and answers Create Workspace from `answers`, in order. */
function machine(answers: CreateWorkspaceResult[]) {
  const createWorkspace = jest.fn(
    async (): Promise<CreateWorkspaceResult> => answers.shift() ?? created,
  );
  const client: MachineClient = {
    getSnapshot: () => ({ machines: [], starting: false }),
    subscribe: () => () => {},
    listDirectory: async () => home,
    createWorkspace: createWorkspace as MachineClient["createWorkspace"],
    renameWorkspace: async () => ({ kind: "done" }),
    killWorkspace: async () => ({ kind: "done" }),
    newTab: async () => ({ kind: "failed" }),
    newPane: async () => ({ kind: "failed" }),
    closeTab: async () => ({ kind: "failed" }),
    closePane: async () => ({ kind: "failed" }),
    moveTab: async () => ({ kind: "failed" }),
    panePreviews: async () => ({}),
    worktreeContext: async () => null,
    worktreeLocation: () => null,
    createWorktree: async () => ({ kind: "failed" }),
    checkWorktreeRemoval: async () => ({ kind: "failed", failure: "failed" }),
    removeWorktree: async () => ({ kind: "failed", failure: "failed" }),
    disconnect: () => {},
    connect: async () => {},
    restartCore: async () => ({ kind: "done" }),
    unpair: () => {},
    readInvitation: () => ({ kind: "unusable" }),
    stopUnfinishedPairings: async () => true,
    pair: async () => ({ kind: "unreachable" }),
  };
  return { client, createWorkspace };
}

async function render(client: MachineClient, onOpened = jest.fn(() => true)) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MachinesProvider client={client}>{children}</MachinesProvider>
  );
  const hook = await renderHook(() => useDirectoryPicker("mac", onOpened), { wrapper });
  return { ...hook, onOpened };
}

it("creates the missing directory on Create, and Try Again asks for it again", async () => {
  const { client, createWorkspace } = machine([
    { kind: "missing-directory", directory: "~/notes" },
    { kind: "failed" },
  ]);
  const { result, onOpened } = await render(client);

  await act(async () => result.current.edit("~/notes"));
  await act(async () => result.current.open());
  expect(result.current.askingCreate).toBe("~/notes");
  await act(async () => result.current.create());
  expect(result.current.failure).toEqual({
    kind: "failed",
    directory: "~/notes",
    createDirectory: true,
  });

  const failure = result.current.failure;
  await act(async () => failure && result.current.retry(failure));
  expect(createWorkspace.mock.calls).toEqual([
    ["mac", "~/notes", { createDirectory: false, again: false }],
    ["mac", "~/notes", { createDirectory: true, again: false }],
    // Try Again: a create whose answer was lost made the Workspace, and it makes no second one.
    ["mac", "~/notes", { createDirectory: true, again: true }],
  ]);
  expect(onOpened).toHaveBeenCalledTimes(1);
});

it("opens once when Open is tapped twice before the next render", async () => {
  const { client, createWorkspace } = machine([]);
  const { result } = await render(client);

  const shown = result.current;
  await act(async () => {
    shown.open();
    shown.open();
  });
  expect(createWorkspace).toHaveBeenCalledTimes(1);
});

it("does not leave the step that has already closed when the Machine answers", async () => {
  let answer: (result: CreateWorkspaceResult) => void = () => {};
  const { client, createWorkspace } = machine([]);
  createWorkspace.mockImplementationOnce(
    () => new Promise<CreateWorkspaceResult>((resolve) => (answer = resolve)),
  );
  const { result, unmount, onOpened } = await render(client);

  await act(async () => result.current.open());
  await unmount();
  await act(async () => answer(created));
  expect(onOpened).not.toHaveBeenCalled();
});

it("can open again when the Machine answers while a newer step covers it", async () => {
  const { client, createWorkspace } = machine([]);
  const { result, onOpened } = await render(
    client,
    jest.fn(() => false),
  );

  await act(async () => result.current.open());
  expect(onOpened).toHaveBeenCalledTimes(1);
  expect(result.current.view.opening).toBe(false);
  await act(async () => result.current.open());
  expect(createWorkspace).toHaveBeenCalledTimes(2);
});

it("opens the Workspace it asked for when the person taps a row before the Machine answers", async () => {
  let answer: (result: CreateWorkspaceResult) => void = () => {};
  const { client, createWorkspace } = machine([]);
  createWorkspace.mockImplementationOnce(
    () => new Promise<CreateWorkspaceResult>((resolve) => (answer = resolve)),
  );
  const { result, onOpened } = await render(client);

  await act(async () => result.current.edit("~/notes"));
  await act(async () => result.current.open());
  await act(async () => result.current.navigate("~/Projects/"));
  expect(result.current.view.field).toBe("~/notes");

  await act(async () => answer(created));
  expect(onOpened).toHaveBeenCalledTimes(1);
});

it("opens the text Go sent, even before the field's last change has rendered", async () => {
  const { client, createWorkspace } = machine([]);
  const { result } = await render(client);

  await act(async () => result.current.open("~/notes"));
  expect(createWorkspace.mock.calls).toEqual([
    ["mac", "~/notes", { createDirectory: false, again: false }],
  ]);
});

it("opens the tapped directory once listed when Open follows the tap before the next render", async () => {
  const { client, createWorkspace } = machine([]);
  client.listDirectory = async (_machineId, path) => ({ ...home, path });
  const { result } = await render(client);

  const shown = result.current;
  await act(async () => {
    shown.navigate("~/Projects/");
    // The field still shows the path from before the tap, which Open drops.
    shown.open("~/");
  });
  expect(createWorkspace.mock.calls).toEqual([
    ["mac", "~/Projects/", { createDirectory: false, again: false }],
  ]);
});

it("shows the spinner only once a directory is slow, and opens it once listed if Open came first", async () => {
  jest.useFakeTimers();
  try {
    const { client, createWorkspace } = machine([]);
    const listings: ((listing: DirectoryListing) => void)[] = [];
    client.listDirectory = () => new Promise((resolve) => listings.push(resolve));
    const { result } = await render(client);

    expect(result.current.view.content).toEqual({ kind: "none" });
    await act(async () => jest.advanceTimersByTime(SPINNER_DELAY_MS - 1));
    expect(result.current.view.content).toEqual({ kind: "none" });
    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.view.content).toEqual({ kind: "loading" });

    await act(async () => result.current.open());
    expect(result.current.view.opening).toBe(true);
    expect(createWorkspace).not.toHaveBeenCalled();
    await act(async () => listings[0]?.(home));
    expect(createWorkspace.mock.calls).toEqual([
      ["mac", "~/", { createDirectory: false, again: false }],
    ]);
  } finally {
    jest.useRealTimers();
  }
});

it("offers Try Again when a create fails without an answer, rather than staying locked", async () => {
  const { client, createWorkspace } = machine([]);
  createWorkspace.mockRejectedValueOnce(new Error("bridge"));
  const { result } = await render(client);

  await act(async () => result.current.open());
  expect(result.current.view.opening).toBe(false);
  expect(result.current.failure).toEqual({
    kind: "failed",
    directory: "~/",
    createDirectory: false,
  });
});

it("cannot list a directory whose listing fails without an answer, and lets a waiting Open lapse", async () => {
  jest.useFakeTimers();
  try {
    const { client, createWorkspace } = machine([]);
    const listings: ((error: Error) => void)[] = [];
    client.listDirectory = () => new Promise((_, reject) => listings.push(reject));
    const { result } = await render(client);

    await act(async () => result.current.open());
    expect(result.current.view.opening).toBe(true);
    await act(async () => listings[0]?.(new Error("bridge")));
    expect(result.current.view).toMatchObject({
      content: { kind: "unavailable", retryPath: "~/" },
      opening: false,
      canOpen: false,
    });
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
