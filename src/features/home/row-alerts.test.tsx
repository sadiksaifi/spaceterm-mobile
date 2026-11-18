import { act, renderHook } from "@testing-library/react-native";

import type { WorkspaceRow } from "./model";
import { useRowAlerts, type RowAlerts, type RowFailure } from "./row-alerts";

const row: WorkspaceRow = {
  key: "mac/w1",
  machineId: "mac",
  machineName: "MacBook Pro",
  workspace: { id: "w1", name: "app", directory: "~/Projects/app", terminalSessions: 2 },
  connection: "connected",
};

const refused = () => Promise.reject(new Error("The Machine refused"));

function failureOf(alerts: RowAlerts): RowFailure {
  if (alerts.alert?.kind !== "failed") throw new Error("No failure shows");
  return alerts.alert;
}

describe("a command the Machine refuses", () => {
  it("offers Try Again, which reopens Rename with the name that was typed", async () => {
    const { result } = await renderHook(() =>
      useRowAlerts({ renameWorkspace: refused, onGetDesktop: () => {} }),
    );

    await act(async () => result.current.handlers.onRenameWorkspace?.(row));
    await act(async () => result.current.rename("  web "));
    expect(result.current.alert).toEqual({ kind: "failed", command: "rename", row, name: "web" });

    await act(async () => result.current.retry(failureOf(result.current)));
    expect(result.current.alert).toEqual({ kind: "rename", row, initial: "web" });
  });

  it("keeps Rename open when the failure it replaced reports closing late", async () => {
    const { result } = await renderHook(() =>
      useRowAlerts({ renameWorkspace: refused, onGetDesktop: () => {} }),
    );

    await act(async () => result.current.handlers.onRenameWorkspace?.(row));
    await act(async () => result.current.rename("web"));
    const failed = result.current;
    await act(async () => failed.retry(failureOf(failed)));
    // iOS reports an alert closed after its button runs; by then Rename is open again.
    await act(async () => failed.cancel());
    expect(result.current.alert).toEqual({ kind: "rename", row, initial: "web" });
  });

  it("offers Try Again, which kills the Workspace without asking again", async () => {
    const killWorkspace = jest.fn((): Promise<void> => refused());
    const { result } = await renderHook(() =>
      useRowAlerts({ killWorkspace, onGetDesktop: () => {} }),
    );

    await act(async () => result.current.handlers.onKillWorkspace?.(row));
    await act(async () => result.current.kill());
    expect(result.current.alert).toEqual({ kind: "failed", command: "kill", row });

    killWorkspace.mockResolvedValueOnce(undefined);
    await act(async () => result.current.retry(failureOf(result.current)));
    expect(killWorkspace).toHaveBeenCalledTimes(2);
    expect(result.current.alert).toBeNull();
  });

  it("leaves the alerts free when the screen shows failures itself", async () => {
    const shown: RowFailure[] = [];
    const { result } = await renderHook(() =>
      useRowAlerts({ killWorkspace: refused, onGetDesktop: () => {} }, (failure) =>
        shown.push(failure),
      ),
    );

    await act(async () => result.current.handlers.onKillWorkspace?.(row));
    await act(async () => result.current.kill());
    expect(shown).toEqual([{ kind: "failed", command: "kill", row }]);
    expect(result.current.alert).toBeNull();
  });
});
