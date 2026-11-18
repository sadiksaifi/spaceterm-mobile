import { useState } from "react";

import { renameOutcome, type HomeActions, type RowHandlers } from "./actions";
import type { WorkspaceRow } from "./model";

/** The alert a row's command opened, or the failure the Machine answered with. */
export type RowAlert =
  /** `initial` is the name the field starts with, when it is not the Workspace's own. */
  | { kind: "rename"; row: WorkspaceRow; initial?: string }
  | { kind: "kill"; row: WorkspaceRow }
  /** The Machine refused. `name` is the name Rename asked for. */
  | { kind: "failed"; command: "rename"; row: WorkspaceRow; name: string }
  | { kind: "failed"; command: "kill"; row: WorkspaceRow };

export type RowFailure = Extract<RowAlert, { kind: "failed" }>;

export type RowAlerts = {
  alert: RowAlert | null;
  /** What each row's menu and swipe start. */
  handlers: RowHandlers;
  /** Grows each time an alert closes. Android puts a swiped row back with it. */
  closed: number;
  /** Closes the alert this render shows, if it is still open. */
  cancel: () => void;
  /** Rename with the field's text. Rename stays unavailable while the text is no name. */
  rename: (typed: string) => void;
  kill: () => void;
  /** Try Again, after `failure`: Rename reopens with the name asked for; Kill runs again. */
  retry: (failure: RowFailure) => void;
};

/**
 * Rename Workspace and Kill Workspace ask first, in an alert each platform draws. The alert
 * closes before the Machine answers; the list shows the answer, and a refusal shows as a failure
 * that offers Try Again. The failure is an alert too, unless `onFailed` shows it some other way;
 * its `retry` is Try Again.
 */
export function useRowAlerts(
  actions: HomeActions,
  onFailed?: (failure: RowFailure, retry: () => void) => void,
): RowAlerts {
  const [{ alert, closed }, setState] = useState<{ alert: RowAlert | null; closed: number }>({
    alert: null,
    closed: 0,
  });
  const { onNewTab, renameWorkspace, killWorkspace } = actions;

  const open = (next: RowAlert) => setState((state) => ({ ...state, alert: next }));
  /**
   * Closes `shown` if it is still open. A system alert reports closing after its button has run,
   * so a late report changes nothing.
   */
  const close = (shown: RowAlert | null = alert) =>
    setState((state) =>
      state.alert === shown && shown !== null ? { alert: null, closed: state.closed + 1 } : state,
    );
  const failed = (failure: RowFailure) =>
    onFailed ? onFailed(failure, () => retry(failure)) : open(failure);

  const runRename = (row: WorkspaceRow, name: string) => {
    renameWorkspace?.(row.machineId, row.workspace.id, name).catch(() =>
      failed({ kind: "failed", command: "rename", row, name }),
    );
  };

  const runKill = (row: WorkspaceRow) => {
    killWorkspace?.(row.machineId, row.workspace.id).catch(() =>
      failed({ kind: "failed", command: "kill", row }),
    );
  };

  function retry(failure: RowFailure) {
    if (failure.command === "rename") {
      open({ kind: "rename", row: failure.row, initial: failure.name });
    } else {
      close(failure);
      runKill(failure.row);
    }
  }

  return {
    alert,
    closed,
    handlers: {
      onNewTab: onNewTab && ((row) => onNewTab(row.machineId, row.workspace.id)),
      onRenameWorkspace: renameWorkspace && ((row) => open({ kind: "rename", row })),
      onKillWorkspace: killWorkspace && ((row) => open({ kind: "kill", row })),
    },
    cancel: () => close(),
    rename(typed) {
      if (alert?.kind !== "rename") return;
      const outcome = renameOutcome(alert.row.workspace.name, typed);
      if (outcome.kind === "unavailable") return;
      close();
      if (outcome.kind === "rename") runRename(alert.row, outcome.name);
    },
    kill() {
      if (alert?.kind !== "kill") return;
      close();
      runKill(alert.row);
    },
    retry,
  };
}
