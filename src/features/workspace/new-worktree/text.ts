import { cased } from "@/shared/text";

import type { FormProblem, WorktreeKind } from "./form";
import type { NewWorktreeFailure } from "./use-new-worktree";

export const text = {
  title: "New Worktree",
  close: "Close",
  create: "Create",
  cancel: "Cancel",
  tryAgain: cased("Try Again", "Try again"),
  kind: "Kind",
  branchName: cased("Branch Name", "Branch name"),
  startFrom: cased("Start From", "Start from"),
  location: "Location",
  branch: "Branch",
  remoteBranch: cased("Remote Branch", "Remote branch"),
  localBranchName: cased("Local Branch Name", "Local branch name"),
  noBranches: cased("No Branches", "No branches"),
  loading: "Loading",
  hooks: "Git hooks don’t run when the Worktree is created.",
};

export const kindText: Record<WorktreeKind, string> = {
  new: cased("New Branch", "New branch"),
  existing: cased("Existing Branch", "Existing branch"),
  remote: cased("Remote Branch", "Remote branch"),
};

/** The line that says why the form cannot be confirmed. */
export const problemText: Record<FormProblem, string> = {
  "invalid-name": "This branch name can’t be used.",
  "branch-exists": "This branch already exists.",
  "not-empty": "This directory is not empty.",
};

export const failureText: Record<NewWorktreeFailure, string> = {
  branches: cased("Couldn’t Load Branches", "Couldn’t load branches"),
  create: cased("Couldn’t Create the Worktree", "Couldn’t create the Worktree"),
};
