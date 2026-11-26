import { useRef, useState } from "react";

import type { CommandResult, MachinesSnapshot } from "@/shared/machines/model";

import { renameOutcome, type HomeActions, type RowCommand, type RowHandlers } from "./actions";
import type { WorkspaceRow } from "./model";

/** The alert a row's command opened. */
export type RowAlert =
  /** `initial` is the name the field starts with, when it is not the Workspace's own. */
  { kind: "rename"; row: WorkspaceRow; initial?: string } | { kind: "kill"; row: WorkspaceRow };

/** A command the Machine refused. `name` is the name Rename asked for. */
export type RowFailure =
  | { command: Extract<RowCommand, "rename">; row: WorkspaceRow; name: string }
  | { command: Extract<RowCommand, "kill">; row: WorkspaceRow };

export type RowAlerts = {
  alert: RowAlert | null;
  /**
   * The last refusal, until Try Again, Cancel, or the next command for the same Workspace, and
   * while the Workspace is still listed.
   */
  failure: RowFailure | null;
  /** What each row's menu and swipe start. */
  handlers: RowHandlers;
  /** The command under way on each row, by row key, until its Machine answers. */
  underway: ReadonlyMap<string, RowCommand>;
  /** Grows each time an alert closes. Android puts a swiped row back with it. */
  closed: number;
  /** Closes the alert this render shows, if it is still open. */
  cancel: () => void;
  /** Rename with the field's text. Rename stays unavailable while the text is no name. */
  rename: (typed: string) => void;
  kill: () => void;
  /** Try Again: Rename reopens with the name asked for; Kill runs again, or asks again if it changed. */
  retry: (failure: RowFailure) => void;
  /** Cancel, or the close button, on `failure`. */
  dismissFailure: (failure: RowFailure) => void;
};

type State = {
  alert: RowAlert | null;
  failure: RowFailure | null;
  closed: number;
  underway: ReadonlyMap<string, RowCommand>;
};

/**
 * Rename Workspace and Kill Workspace ask first, in an alert each platform draws. The alert
 * closes before the Machine answers; the list shows the answer, and a refusal becomes `failure`,
 * which offers Try Again. Try Again works on the Workspace as listed then, and asks again before
 * a Kill whose alert would now say something else. Each platform shows the failure its own way. `snapshot` is what Home
 * lists: a refusal for a Workspace that has gone offers nothing to try again.
 */
export function useRowAlerts(actions: HomeActions, snapshot: MachinesSnapshot): RowAlerts {
  const [{ alert, failure: stored, closed, underway }, setState] = useState<State>({
    alert: null,
    failure: null,
    closed: 0,
    underway: new Map(),
  });
  // The alerts and refusals a button has already answered, so a second button tapped before the
  // next render, the same or another, does nothing.
  const answered = useRef(new WeakSet<RowAlert | RowFailure>());
  // The rows with a command under way, by key, as of the last event rather than the last render.
  const inFlight = useRef(new Set<string>());
  const failure = stored !== null && listed(snapshot, stored.row) ? stored : null;
  const { onNewTab, renameWorkspace, killWorkspace } = actions;

  /** Opens `next`, unless its row already has a command under way. */
  const open = (next: RowAlert) => {
    if (inFlight.current.has(next.row.key)) return;
    setState((state) => ({ ...state, alert: next }));
  };
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
   * Runs `send` for `failure`'s row, one command per row at a time. The row shows it under way
   * until the answer. A new command makes a refusal for the same Workspace out of date; a refusal
   * for another one stays, as iOS may not have shown it yet while an alert was open.
   */
  const run = (failure: RowFailure, send: () => Promise<CommandResult>) => {
    const { row } = failure;
    if (inFlight.current.has(row.key)) return;
    inFlight.current.add(row.key);
    setState((state) => ({
      ...state,
      failure: state.failure?.row.key === row.key ? null : state.failure,
      underway: new Map(state.underway).set(row.key, failure.command),
    }));
    void send().then((result) => {
      inFlight.current.delete(row.key);
      setState((state) => {
        const rest = new Map(state.underway);
        rest.delete(row.key);
        return {
          ...state,
          failure: result.kind === "failed" ? failure : state.failure,
          underway: rest,
        };
      });
    });
  };

  const runRename = (row: WorkspaceRow, name: string) => {
    if (renameWorkspace === undefined) return;
    run({ command: "rename", row, name }, () =>
      renameWorkspace(row.machineId, row.workspace, name),
    );
  };

  const runKill = (row: WorkspaceRow) => {
    if (killWorkspace === undefined) return;
    // The Workspace as the alert showed it, so the Machine ends only what the person approved.
    run({ command: "kill", row }, () => killWorkspace(row.machineId, row.workspace));
  };

  /** True the first time one of `shown`'s buttons runs. */
  const firstAnswer = (shown: RowAlert | RowFailure) => {
    if (answered.current.has(shown)) return false;
    answered.current.add(shown);
    return true;
  };

  return {
    alert,
    failure,
    closed,
    underway,
    handlers: {
      onNewTab: onNewTab && ((row) => onNewTab(row.machineId, row.workspace.id)),
      onRenameWorkspace: renameWorkspace && ((row) => open({ kind: "rename", row })),
      onKillWorkspace: killWorkspace && ((row) => open({ kind: "kill", row })),
    },
    cancel() {
      // A system alert reports closing after its button has run; that report closes nothing new.
      if (alert !== null) answered.current.add(alert);
      close();
    },
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
      if (shown !== failure || !firstAnswer(shown)) return;
      // The Workspace as listed now: the Machine refuses one the person has not seen.
      const row = relisted(snapshot, shown.row);
      if (shown.command === "rename") {
        clearFailure(shown);
        open({ kind: "rename", row, initial: shown.name });
      } else if (sameToKill(row, shown.row)) {
        runKill(row);
      } else {
        // What Kill ends has changed since the person agreed to it, so they are asked again.
        clearFailure(shown);
        open({ kind: "kill", row });
      }
    },
    dismissFailure(shown) {
      if (firstAnswer(shown)) clearFailure(shown);
    },
  };
}

/** `row` with its Workspace as Home lists it now, or as it was when Home no longer lists it. */
function relisted({ machines }: MachinesSnapshot, row: WorkspaceRow): WorkspaceRow {
  const machine = machines.find((candidate) => candidate.id === row.machineId);
  const workspace = machine?.workspaces?.find((listed) => listed.id === row.workspace.id);
  return workspace === undefined ? row : { ...row, workspace };
}

/**
 * Whether Kill would end what the person agreed to: the same Workspace name and Terminal Sessions.
 * The revision tells a replaced session from the one it replaced, which the count does not.
 */
function sameToKill(now: WorkspaceRow, agreed: WorkspaceRow): boolean {
  return (
    now.workspace.name === agreed.workspace.name &&
    now.workspace.terminalSessions === agreed.workspace.terminalSessions &&
    now.workspace.revision === agreed.workspace.revision
  );
}

/** Whether Home still lists the Workspace `row` shows. */
function listed({ machines }: MachinesSnapshot, row: WorkspaceRow): boolean {
  const machine = machines.find((candidate) => candidate.id === row.machineId);
  return machine?.workspaces?.some((workspace) => workspace.id === row.workspace.id) ?? false;
}
