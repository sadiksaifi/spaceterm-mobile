import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { CommandResult, MachinesSnapshot } from "@/shared/machines/model";

import type { HomeActions } from "./actions";
import type { WorkspaceRow } from "./model";
import { useRowAlerts, type RowAlerts, type RowFailure } from "./row-alerts";

const row = (id: string, name: string): WorkspaceRow => ({
  key: `mac/${id}`,
  machineId: "mac",
  machineName: "MacBook Pro",
  workspace: { id, name, directory: `~/Projects/${name}`, terminalSessions: 2 },
  connection: "connected",
});
const app = row("w1", "app");
const web = row("w2", "web");

/** One Machine that lists `rows`. */
const listing = (...rows: WorkspaceRow[]): MachinesSnapshot => ({
  machines: [
    {
      id: "mac",
      name: "MacBook Pro",
      connection: "connected",
      workspaces: rows.map((listed) => listed.workspace),
    },
  ],
  starting: false,
});

const refused = async (): Promise<CommandResult> => ({ kind: "failed" });
const done = async (): Promise<CommandResult> => ({ kind: "done" });

async function render(actions: Partial<HomeActions>) {
  return renderHook(
    ({ snapshot }: { snapshot: MachinesSnapshot }) =>
      useRowAlerts({ onGetDesktop: () => {}, ...actions }, snapshot),
    { initialProps: { snapshot: listing(app, web) } },
  );
}

function failureOf(alerts: RowAlerts): RowFailure {
  if (alerts.failure === null) throw new Error("No failure shows");
  return alerts.failure;
}

describe("a command the Machine refuses", () => {
  it("offers Try Again, which reopens Rename with the name that was typed", async () => {
    const { result } = await render({ renameWorkspace: refused });

    await act(async () => result.current.handlers.onRenameWorkspace?.(app));
    await act(async () => result.current.rename("  web "));
    expect(result.current.failure).toEqual({ command: "rename", row: app, name: "web" });

    await act(async () => result.current.retry(failureOf(result.current)));
    expect(result.current.failure).toBeNull();
    expect(result.current.alert).toEqual({ kind: "rename", row: app, initial: "web" });
  });

  it("offers Try Again, which kills the Workspace without asking again", async () => {
    const killWorkspace = jest.fn(refused);
    const { result } = await render({ killWorkspace });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    expect(result.current.failure).toEqual({ command: "kill", row: app });

    killWorkspace.mockImplementationOnce(done);
    await act(async () => result.current.retry(failureOf(result.current)));
    expect(killWorkspace).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toBeNull();
    expect(result.current.alert).toBeNull();
  });

  it("keeps Rename open when the failure it replaced reports closing late", async () => {
    const { result } = await render({ renameWorkspace: refused });

    await act(async () => result.current.handlers.onRenameWorkspace?.(app));
    await act(async () => result.current.rename("web"));
    const failed = failureOf(result.current);
    await act(async () => result.current.retry(failed));
    // iOS reports an alert closed after its button runs; by then Rename is open again.
    await act(async () => result.current.dismissFailure(failed));
    expect(result.current.alert).toEqual({ kind: "rename", row: app, initial: "web" });
  });

  it("keeps the open alert when an earlier command is refused, and holds the refusal too", async () => {
    let answer: (result: CommandResult) => void = () => {};
    const killWorkspace = () => new Promise<CommandResult>((resolve) => (answer = resolve));
    const { result } = await render({ killWorkspace, renameWorkspace: done });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    await act(async () => result.current.handlers.onRenameWorkspace?.(web));
    await act(async () => answer({ kind: "failed" }));

    expect(result.current.alert).toMatchObject({ kind: "rename" });
    expect(result.current.failure).toEqual({ command: "kill", row: app });

    // iOS shows the refusal once Rename closes, so renaming another Workspace keeps it.
    await act(async () => result.current.rename("site"));
    expect(result.current.failure).toEqual({ command: "kill", row: app });
  });

  it("does nothing on Try Again once a newer command has started", async () => {
    const killWorkspace = jest.fn(refused);
    const { result } = await render({ killWorkspace });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    const stale = failureOf(result.current);
    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());

    await act(async () => result.current.retry(stale));
    expect(killWorkspace).toHaveBeenCalledTimes(2);
  });
});

describe("a refusal that no longer applies", () => {
  it("is dropped once its Workspace is no longer listed", async () => {
    const { result, rerender } = await render({ killWorkspace: refused });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    expect(result.current.failure).toEqual({ command: "kill", row: app });

    // Another device, or an earlier Kill, took the Workspace away.
    await rerender({ snapshot: listing(web) });
    expect(result.current.failure).toBeNull();
  });
});

describe("a command under way", () => {
  it("shows on its row until the Machine answers, and keeps a second one from starting", async () => {
    let answer: (result: CommandResult) => void = () => {};
    const killWorkspace = jest.fn(
      () => new Promise<CommandResult>((resolve) => (answer = resolve)),
    );
    const { result } = await render({ killWorkspace, renameWorkspace: done });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    expect(result.current.underway.get(app.key)).toBe("kill");

    // The row offers nothing meanwhile; a handler called anyway opens no alert.
    await act(async () => result.current.handlers.onRenameWorkspace?.(app));
    expect(result.current.alert).toBeNull();

    await act(async () => answer({ kind: "done" }));
    expect(result.current.underway.size).toBe(0);
    expect(killWorkspace).toHaveBeenCalledTimes(1);
  });

  it("leaves other rows free", async () => {
    const killWorkspace = () => new Promise<CommandResult>(() => {});
    const { result } = await render({ killWorkspace });

    await act(async () => result.current.handlers.onKillWorkspace?.(app));
    await act(async () => result.current.kill());
    await act(async () => result.current.handlers.onKillWorkspace?.(web));
    expect(result.current.alert).toEqual({ kind: "kill", row: web });
  });
});

it("kills once when Kill Workspace is tapped twice before the alert closes", async () => {
  const killWorkspace = jest.fn(done);
  const { result } = await render({ killWorkspace });

  await act(async () => result.current.handlers.onKillWorkspace?.(app));
  const shown = result.current;
  await act(async () => {
    shown.kill();
    shown.kill();
  });
  expect(killWorkspace).toHaveBeenCalledTimes(1);
});
