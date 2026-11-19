import { expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { MachinesProvider } from "@/shared/machines/client";
import type {
  CreateWorkspaceResult,
  DirectoryListing,
  MachineClient,
  Workspace,
} from "@/shared/machines/model";

import { useDirectoryPicker } from "./use-directory-picker";

const home: DirectoryListing = { kind: "listed", path: "~/", parent: null, directories: [] };
const notes: Workspace = { id: "w1", name: "notes", directory: "~/notes", terminalSessions: 1 };
const created: CreateWorkspaceResult = { kind: "created", workspace: notes };

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
    disconnect: () => {},
    connect: async () => {},
    restartCore: async () => ({ kind: "done" }),
    unpair: () => {},
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
    ["mac", "~/notes", { createDirectory: false }],
    ["mac", "~/notes", { createDirectory: true }],
    ["mac", "~/notes", { createDirectory: true }],
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
  expect(createWorkspace.mock.calls).toEqual([["mac", "~/notes", { createDirectory: false }]]);
});

it("opens nothing when Open follows a tap on a directory before the next render", async () => {
  const { client, createWorkspace } = machine([]);
  const { result } = await render(client);

  const shown = result.current;
  await act(async () => {
    shown.navigate("~/Projects/");
    // The field still shows the path from before the tap.
    shown.open("~/");
  });
  // The tapped directory is loading, so Open waits for it rather than opening the one before.
  expect(createWorkspace).not.toHaveBeenCalled();
});
