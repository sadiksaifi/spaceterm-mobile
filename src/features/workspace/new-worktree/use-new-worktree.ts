import { useEffect, useRef, useState } from "react";

import type { MachineClient, Workspace, WorktreeContext } from "@/shared/machines/model";

import { changeGridState } from "../grid-store";
import { EMPTY_FORM, worktreeForm, type Form, type FormState, type WorktreeKind } from "./form";

export type NewWorktreeClient = Pick<
  MachineClient,
  "worktreeContext" | "worktreeLocation" | "createWorktree"
>;

/** A refusal: the branch lists did not load, or the Worktree was not created. */
export type NewWorktreeFailure = "branches" | "create";

export type NewWorktree = {
  /** `null` until the Machine sends its branches. */
  form: Form | null;
  state: FormState;
  creating: boolean;
  failure: NewWorktreeFailure | null;
  setKind: (kind: WorktreeKind) => void;
  /** Branch Name, or Local Branch Name for a remote branch. */
  setName: (typed: string) => void;
  /** The Location the person typed. Typing the Location the rule gives keeps following the rule. */
  setLocation: (typed: string) => void;
  /** Start From, Branch or Remote Branch, by the kind on screen. */
  pick: (branch: string) => void;
  create: () => void;
  retry: () => void;
  dismissFailure: () => void;
};

/**
 * New Worktree: the Machine's branches fill the form, and Create makes the Worktree, opens one
 * Tab in it and makes it the active Worktree. `onCreated` closes the form.
 */
export function useNewWorktree({
  client,
  machineId,
  workspace,
  onCreated,
}: {
  client: NewWorktreeClient;
  machineId: string;
  workspace: Workspace;
  onCreated: () => void;
}): NewWorktree {
  const [context, setContext] = useState<WorktreeContext | null>(null);
  const [state, setState] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<NewWorktreeFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sending = useRef(false);
  const { repository } = workspace;

  useEffect(() => {
    if (repository === null) return;
    let current = true;
    void client.worktreeContext(machineId, repository).then((loaded) => {
      if (!current) return;
      if (loaded === null) setFailure("branches");
      else setContext(loaded);
    });
    return () => {
      current = false;
    };
    // The lists load once per attempt; a new snapshot of the Workspace does not reload them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, machineId, repository?.root]);

  const formOf = (of: FormState) =>
    context === null
      ? null
      : worktreeForm(of, context, (branch) => client.worktreeLocation(context, branch));
  const form = formOf(state);

  /** Applies `change`. A change of the Location shown clears a Location found not empty. */
  const edit = (change: (state: FormState) => FormState) =>
    setState((current) => {
      const next = change(current);
      if (next === current) return current;
      const moved = formOf(next)?.view.location !== formOf(current)?.view.location;
      return moved ? { ...next, notEmpty: false } : next;
    });

  const create = () => {
    const request = form?.request;
    if (context === null || request == null || sending.current) return;
    sending.current = true;
    setCreating(true);
    void client.createWorktree(machineId, workspace, context, request).then((result) => {
      sending.current = false;
      setCreating(false);
      switch (result.kind) {
        case "created":
          // The new Tab is the one used last, so its Worktree is the active one once it is listed.
          changeGridState(`${machineId}/${workspace.id}`, (grid) => ({
            ...grid,
            picked: null,
            expecting: result.tab,
            used: [result.tab, ...grid.used],
          }));
          return onCreated();
        case "not-empty":
          return setState((current) => ({ ...current, notEmpty: true }));
        default:
          return setFailure("create");
      }
    });
  };

  return {
    form,
    state,
    creating,
    failure,
    setKind: (kind) => setState((current) => ({ ...current, kind })),
    setName: (typed) =>
      edit((current) =>
        current.kind === "remote"
          ? typed === localShown(formOf(current))
            ? current
            : { ...current, remote: { ...current.remote, local: typed } }
          : { ...current, newBranch: { ...current.newBranch, name: typed } },
      ),
    setLocation: (typed) =>
      edit((current) => {
        if (typed === formOf(current)?.view.location) return current;
        switch (current.kind) {
          case "new":
            return { ...current, newBranch: { ...current.newBranch, location: typed } };
          case "existing":
            return { ...current, existing: { ...current.existing, location: typed } };
          case "remote":
            return { ...current, remote: { ...current.remote, location: typed } };
        }
      }),
    pick: (branch) =>
      edit((current) => {
        switch (current.kind) {
          case "new":
            return { ...current, newBranch: { ...current.newBranch, startFrom: branch } };
          case "existing":
            return { ...current, existing: { ...current.existing, branch } };
          case "remote":
            return { ...current, remote: { ...current.remote, remote: branch, local: null } };
        }
      }),
    create,
    retry() {
      const failed = failure;
      setFailure(null);
      if (failed === "branches") setAttempt((count) => count + 1);
      else create();
    },
    dismissFailure: () => setFailure(null),
  };
}

/** The Local Branch Name the form shows for a remote branch. */
function localShown(form: Form | null): string | null {
  return form?.view.kind === "remote" ? form.view.local : null;
}
