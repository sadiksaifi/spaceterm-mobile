import { useRef, useState } from "react";

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
   * while the Machine is not connected, and while a removal is under way.
   */
  start: (() => void) | undefined;
  /** Remove in the alert. */
  confirm: () => void;
  /** Cancel or OK in the alert, or the alert closing by itself. */
  dismiss: () => void;
};

type Shown = { key: string; alert: RemovalAlert };

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
  // The screen stays when it changes Workspace, so each alert names its own.
  const key = `${machineId}/${workspaceId}`;
  const [shown, setShown] = useState<Shown | null>(null);
  const [underway, setUnderway] = useState(false);
  // As of the last event, so a second tap before the next render starts nothing.
  const busy = useRef(false);
  const alert = shown?.key === key ? shown.alert : null;

  const run = async (work: () => Promise<RemovalAlert | null>) => {
    if (busy.current) return;
    busy.current = true;
    setUnderway(true);
    const next = await work();
    busy.current = false;
    setUnderway(false);
    if (next !== null) setShown({ key, alert: next });
  };

  const removable =
    repository !== null && active !== null && active.path !== repository.root && connected;

  return {
    alert,
    start:
      removable && !underway && alert === null
        ? () =>
            void run(async () => {
              const check = await client.checkWorktreeRemoval(machineId, repository, active);
              return check.kind === "review"
                ? { kind: "confirm", review: check.review }
                : { kind: "failed", worktree: active, failure: check.failure, checking: true };
            })
        : undefined,
    confirm() {
      if (alert?.kind !== "confirm" || repository === null) return;
      const { review } = alert;
      setShown(null);
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
    dismiss: () => setShown((current) => (current?.key === key ? null : current)),
  };
}
