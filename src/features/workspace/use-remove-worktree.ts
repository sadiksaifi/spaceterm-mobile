import { useLayoutEffect, useRef, useState } from "react";

import type {
  MachineClient,
  Repository,
  Worktree,
  WorktreeRemovalFailure,
  WorktreeRemovalReview,
} from "@/shared/machines/model";

export type RemovalClient = Pick<MachineClient, "checkWorktreeRemoval" | "removeWorktree">;

/** The alert Remove Worktree shows: what it deletes, to confirm, or why nothing was removed. */
export type RemovalAlert =
  | { kind: "confirm"; review: WorktreeRemovalReview }
  /** `checking`: the Machine could not say what removing deletes, so nothing was asked. */
  | { kind: "failed"; worktree: Worktree; failure: WorktreeRemovalFailure; checking: boolean };

export type RemoveWorktree = {
  alert: RemovalAlert | null;
  /**
   * Remove Worktree for the active Worktree. Absent for the Main Worktree, outside a repository,
   * while the Machine is not connected, and while a removal is under way on the Machine.
   */
  start: (() => void) | undefined;
  /** Remove in the alert, or Try Again after the Machine didn't answer a remove. */
  confirm: () => void;
  /** Cancel or OK in the alert, or the alert closing by itself. */
  dismiss: () => void;
};

type Shown = { machine: string; alert: RemovalAlert };

/**
 * Remove Worktree asks the Machine what removing deletes and closes, and asks the person to
 * confirm that. The remove sends the check back, so the Machine refuses when anything changed
 * since. The alert closes before the Machine answers; the Worktree list shows the answer, and a
 * refusal becomes an alert that says why.
 */
export function useRemoveWorktree({
  client,
  machineId,
  workspaceId,
  repository,
  active,
  connected,
}: {
  client: RemovalClient;
  machineId: string;
  workspaceId: string;
  repository: Repository | null;
  active: Worktree | null;
  connected: boolean;
}): RemoveWorktree {
  // The screen stays when it changes Workspace, so each Workspace keeps its own alert.
  const key = `${machineId}/${workspaceId}`;
  const [shown, setShown] = useState<ReadonlyMap<string, Shown>>(new Map());
  // The Machines with a check or remove under way. A Machine keeps one check for each device, so
  // a second check on it, even from another Workspace, would undo the first.
  const [underway, setUnderway] = useState<ReadonlySet<string>>(new Set());
  // As of the last event, so a second tap before the next render starts nothing.
  const busy = useRef(new Set<string>());
  // Counts the visits to Workspaces, so a check that answers after its visit ended asks nothing.
  // Before paint, so an answer right after a change of Workspace already sees the new visit.
  const visit = useRef(0);
  useLayoutEffect(() => {
    visit.current += 1;
  }, [key]);
  const alert = shown.get(key)?.alert ?? null;

  const keep = (test: (key: string, each: Shown) => boolean) =>
    setShown((current) => new Map([...current].filter(([other, each]) => test(other, each))));

  const mark = (machine: string, on: boolean) =>
    setUnderway((current) => {
      const next = new Set(current);
      if (on) next.add(machine);
      else next.delete(machine);
      return next;
    });

  const run = async (work: () => Promise<RemovalAlert | null>) => {
    const machine = machineId;
    if (busy.current.has(machine)) return;
    busy.current.add(machine);
    mark(machine, true);
    const started = visit.current;
    const next = await work();
    busy.current.delete(machine);
    mark(machine, false);
    // A refusal still says why when the person comes back. A question for a visit that ended
    // would ask about what they may no longer be looking at.
    if (next === null || (next.kind === "confirm" && visit.current !== started)) return;
    setShown((current) => new Map(current).set(key, { machine, alert: next }));
  };

  const check = (root: Repository, worktree: Worktree) =>
    void run(async () => {
      // This check undoes the Machine's earlier ones, so the questions they asked go.
      keep((_, each) => each.machine !== machineId || each.alert.kind !== "confirm");
      const check = await client.checkWorktreeRemoval(machineId, root, worktree);
      // A remove whose answer was lost went again and removed it: the list shows that.
      if (check.kind === "removed") return null;
      return check.kind === "review"
        ? { kind: "confirm", review: check.review }
        : { kind: "failed", worktree, failure: check.failure, checking: true };
    });

  const removable =
    repository !== null && active !== null && active.path !== repository.root && connected;

  return {
    alert,
    start:
      removable && !underway.has(machineId) && alert === null
        ? () => check(repository, active)
        : undefined,
    confirm() {
      if (alert === null || repository === null) return;
      keep((other) => other !== key);
      if (alert.kind === "failed") {
        // The check sends a lost remove again first, which finds out what became of it.
        if (alert.failure === "unanswered") check(repository, alert.worktree);
        return;
      }
      const { review } = alert;
      void run(async () => {
        const removal = await client.removeWorktree(machineId, repository, review);
        return removal.kind === "removed"
          ? null
          : {
              kind: "failed",
              worktree: review.worktree,
              failure: removal.failure,
              checking: false,
            };
      });
    },
    dismiss: () => keep((other) => other !== key),
  };
}
