import type { NewWorktreeBranch, WorktreeContext } from "@/shared/machines/model";

export type WorktreeKind = "new" | "existing" | "remote";

/**
 * What the person has typed and picked, per kind, so a change of kind loses nothing. `null`
 * stands for the value the form fills in: the first branch of a list, the local name of the
 * remote branch, the Location the Machine's rule gives.
 */
export type FormState = {
  kind: WorktreeKind;
  newBranch: { name: string; startFrom: string | null; location: string | null };
  existing: { branch: string | null; location: string | null };
  remote: { remote: string | null; local: string | null; location: string | null };
  /** The Location the Machine found not empty. The form says so while it shows that Location. */
  notEmpty: string | null;
  /** A branch name the Machine refused. The form says why while it shows that name. */
  refused: { name: string; problem: "invalid-name" | "branch-exists" } | null;
};

export const EMPTY_FORM: FormState = {
  kind: "new",
  newBranch: { name: "", startFrom: null, location: null },
  existing: { branch: null, location: null },
  remote: { remote: null, local: null, location: null },
  notEmpty: null,
  refused: null,
};

export type FormProblem = "invalid-name" | "branch-exists" | "not-empty";

/** One branch picker: its value, and the branches it lists, newest first. */
export type Picker = { value: string | null; options: readonly string[] };

export type FormView =
  | { kind: "new"; name: string; startFrom: Picker; location: string }
  | { kind: "existing"; branch: Picker; location: string }
  | { kind: "remote"; remote: Picker; local: string; location: string };

export type Form = {
  view: FormView;
  problem: FormProblem | null;
  /** What Create sends, `null` while the form cannot be confirmed. */
  request: { branch: NewWorktreeBranch; location: string } | null;
};

/**
 * The form as it shows with `context`, the Machine's branches. `location` gives the Location the
 * Machine's rule places a branch at.
 */
export function worktreeForm(
  state: FormState,
  context: WorktreeContext,
  location: (branch: string) => string | null,
): Form {
  const placed = (typed: string | null, branch: string) =>
    typed ?? (branch === "" ? "" : (location(branch) ?? ""));
  const exists = (name: string) => context.local.includes(name);
  const nameProblem = (name: string): FormProblem | null =>
    name === ""
      ? null
      : state.refused?.name === name
        ? state.refused.problem
        : !usableBranchName(name)
          ? "invalid-name"
          : exists(name)
            ? "branch-exists"
            : null;
  const confirmable = (problem: FormProblem | null, where: string) =>
    problem === null && where.trim() !== "";
  const notEmpty = (where: string) =>
    state.notEmpty !== null && where.trim() === state.notEmpty ? ("not-empty" as const) : null;

  switch (state.kind) {
    case "new": {
      const { name, startFrom: picked } = state.newBranch;
      const options = [...context.local, ...context.remote];
      const startFrom = pick(picked ?? context.startFrom, options);
      const where = placed(state.newBranch.location, name.trim());
      const problem = nameProblem(name.trim()) ?? notEmpty(where);
      const base = startFrom.value;
      return {
        view: { kind: "new", name, startFrom, location: where },
        problem,
        request:
          name.trim() !== "" && base !== null && confirmable(problem, where)
            ? {
                branch: {
                  kind: "new",
                  name: name.trim(),
                  base,
                  baseIsRemote: !context.local.includes(base),
                },
                location: where.trim(),
              }
            : null,
      };
    }
    case "existing": {
      const free = context.local.filter((branch) => !context.checkedOut.includes(branch));
      const branch = pick(state.existing.branch, free);
      const where = placed(state.existing.location, branch.value ?? "");
      return {
        view: { kind: "existing", branch, location: where },
        problem: notEmpty(where),
        request:
          branch.value !== null && confirmable(notEmpty(where), where)
            ? { branch: { kind: "existing", name: branch.value }, location: where.trim() }
            : null,
      };
    }
    case "remote": {
      const remote = pick(state.remote.remote, context.remote);
      const local = state.remote.local ?? (remote.value === null ? "" : localName(remote.value));
      const where = placed(state.remote.location, local.trim());
      const problem = nameProblem(local.trim()) ?? notEmpty(where);
      return {
        view: { kind: "remote", remote, local, location: where },
        problem,
        request:
          remote.value !== null && local.trim() !== "" && confirmable(problem, where)
            ? {
                branch: { kind: "remote", remote: remote.value, name: local.trim() },
                location: where.trim(),
              }
            : null,
      };
    }
  }
}

/** The value a picker holds: the one picked while it is listed, else the first. */
function pick(picked: string | null, options: readonly string[]): Picker {
  const value = picked !== null && options.includes(picked) ? picked : (options[0] ?? null);
  return { value, options };
}

/** A remote branch's name without its remote: `origin/feat/find` is `feat/find`. */
export function localName(remote: string): string {
  const cut = remote.indexOf("/");
  return cut === -1 ? remote : remote.slice(cut + 1);
}

/**
 * Whether Git allows `name` as a branch name, by the rules of `git check-ref-format --branch`. The
 * Machine checks again when the Worktree is made.
 */
export function usableBranchName(name: string): boolean {
  if (name === "" || name === "@" || name === "HEAD" || name.startsWith("-")) return false;
  if (name.startsWith("/") || name.endsWith("/") || name.endsWith(".")) return false;
  if (name.includes("..") || name.includes("//") || name.includes("@{")) return false;
  // Control characters, space, and ~ ^ : ? * [ \ are refused anywhere.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f~^:?*[\\]/.test(name)) return false;
  return name.split("/").every((part) => !part.startsWith(".") && !part.endsWith(".lock"));
}
