import { useRef, useState } from "react";

import type { MachinesSnapshot } from "@/shared/machines/model";

import { renameOutcome, type HomeActions, type RowHandlers } from "./actions";
import type { WorkspaceRow } from "./model";

/** The alert a row's command opened. */
export type RowAlert =
  /** `initial` is the name the field starts with, when it is not the Workspace's own. */
  { kind: "rename"; row: WorkspaceRow; initial?: string } | { kind: "kill"; row: WorkspaceRow };

/** A command the Machine refused. `name` is the name Rename asked for. */
export type RowFailure =
  | { command: "rename"; row: WorkspaceRow; name: string }
  | { command: "kill"; row: WorkspaceRow };

export type RowAlerts = {
  alert: RowAlert | null;
  /**
   * The last refusal, until Try Again, Cancel, or the next command for the same Workspace, and
   * while the Workspace is still listed.
   */
  failure: RowFailure | null;
  /** What each row's menu and swipe start. */
  handlers: RowHandlers;
  /** Grows each time an alert closes. Android puts a swiped row back with it. */
  closed: number;
  /** Closes the alert this render shows, if it is still open. */
  cancel: () => void;
  /** Rename with the field's text. Rename stays unavailable while the text is no name. */
  rename: (typed: string) => void;
  kill: () => void;
  /** Try Again: Rename reopens with the name asked for; Kill runs again. */
  retry: (failure: RowFailure) => void;
  /** Cancel, or the close button, on `failure`. */
  dismissFailure: (failure: RowFailure) => void;
};

type State = { alert: RowAlert | null; failure: RowFailure | null; closed: number };

/**
 * Rename Workspace and Kill Workspace ask first, in an alert each platform draws. The alert
 * closes before the Machine answers; the list shows the answer, and a refusal becomes `failure`,
 * which offers Try Again. Each platform shows the failure its own way. `snapshot` is what Home
 * lists: a refusal for a Workspace that has gone offers nothing to try again.
 */
export function useRowAlerts(actions: HomeActions, snapshot: MachinesSnapshot): RowAlerts {
  const [{ alert, failure: stored, closed }, setState] = useState<State>({
    alert: null,
    failure: null,
    closed: 0,
  });
  // The alert whose button already ran, so a second tap before the next render does nothing.
  const answered = useRef<RowAlert | null>(null);
  // The latest command for each Workspace, by row key; the answer to an earlier one is dropped.
  const commands = useRef(new Map<string, number>());
  const count = useRef(0);
  const failure = stored !== null && listed(snapshot, stored.row) ? stored : null;
  const { onNewTab, renameWorkspace, killWorkspace } = actions;

  const open = (next: RowAlert) => setState((state) => ({ ...state, alert: next }));
  /**
   * Closes `shown` if it is still open. A system alert reports closing after its button has run,
   * so a late report changes nothing.
   */
  const close = (shown: RowAlert | null = alert) =>
    setState((state) =>
      state.alert === shown && shown !== null
        ? { ...state, alert: null, closed: state.closed + 1 }
        : state,
    );
  /** Clears the failure, if it is still `which`. */
  const clearFailure = (which: RowFailure) =>
    setState((state) => (state.failure === which ? { ...state, failure: null } : state));
  /**
   * A new command makes a refusal for the same Workspace out of date. A refusal for another one
   * stays: iOS may not have shown it yet, as it waits for the open alert to close.
   */
  const supersede = (row: WorkspaceRow) =>
    setState((state) =>
      state.failure !== null &&
      state.failure.row.machineId === row.machineId &&
      state.failure.row.workspace.id === row.workspace.id
        ? { ...state, failure: null }
        : state,
    );
  const fail = (next: RowFailure) => setState((state) => ({ ...state, failure: next }));

  /** Starts a command for `row`; the returned check tells whether it is still the latest. */
  const start = (row: WorkspaceRow) => {
    supersede(row);
    const id = ++count.current;
    commands.current.set(row.key, id);
    return () => commands.current.get(row.key) === id;
  };

  const runRename = (row: WorkspaceRow, name: string) => {
    if (renameWorkspace === undefined) return;
    const latest = start(row);
    void renameWorkspace(row.machineId, row.workspace.id, name).then((result) => {
      if (result.kind === "failed" && latest()) fail({ command: "rename", row, name });
    });
  };

  const runKill = (row: WorkspaceRow) => {
    if (killWorkspace === undefined) return;
    const latest = start(row);
    void killWorkspace(row.machineId, row.workspace.id).then((result) => {
      if (result.kind === "failed" && latest()) fail({ command: "kill", row });
    });
  };

  /** True the first time `shown`'s button runs. */
  const firstAnswer = (shown: RowAlert) => {
    if (answered.current === shown) return false;
    answered.current = shown;
    return true;
  };

  return {
    alert,
    failure,
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
      if (outcome.kind === "unavailable" || !firstAnswer(alert)) return;
      close();
      if (outcome.kind === "rename") runRename(alert.row, outcome.name);
    },
    kill() {
      if (alert?.kind !== "kill" || !firstAnswer(alert)) return;
      close();
      runKill(alert.row);
    },
    retry(shown) {
      // A failure that has since been replaced or dismissed offers nothing.
      if (shown !== failure) return;
      if (shown.command === "rename") {
        clearFailure(shown);
        open({ kind: "rename", row: shown.row, initial: shown.name });
      } else {
        runKill(shown.row);
      }
    },
    dismissFailure: (shown) => clearFailure(shown),
  };
}

/** Whether Home still lists the Workspace `row` shows. */
function listed({ machines }: MachinesSnapshot, row: WorkspaceRow): boolean {
  const machine = machines.find((candidate) => candidate.id === row.machineId);
  return machine?.workspaces?.some((workspace) => workspace.id === row.workspace.id) ?? false;
}
