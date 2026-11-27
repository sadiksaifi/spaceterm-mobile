import { describe, expect, it } from "vitest";

import type { WorktreeContext } from "@/shared/machines/model";

import { EMPTY_FORM, usableBranchName, worktreeForm, type FormState } from "./form";

const context: WorktreeContext = {
  root: "/Users/you/Projects/api",
  local: ["main", "feat/pairing", "docs/readme"],
  remote: ["origin/feat/find", "origin/main"],
  checkedOut: ["main", "feat/pairing"],
  startFrom: "main",
  template: "~/Projects/{repository}-{branch}",
  home: "/Users/you",
};
const location = (branch: string) => `~/Projects/api-${branch.replaceAll("/", "-")}`;
const form = (state: Partial<FormState>) =>
  worktreeForm({ ...EMPTY_FORM, ...state }, context, location);
const newBranch = (name: string, extra: Partial<FormState["newBranch"]> = {}) =>
  form({ newBranch: { ...EMPTY_FORM.newBranch, name, ...extra } });

describe("New Worktree", () => {
  it("opens on New Branch from the default branch, with no Location and nothing to confirm", () => {
    const opened = form({});
    expect(opened.view).toEqual({
      kind: "new",
      name: "",
      startFrom: { value: "main", options: [...context.local, ...context.remote] },
      location: "",
    });
    expect(opened.request).toBeNull();
  });

  it("places the Worktree by the Machine's rule until the person changes the Location", () => {
    const named = newBranch("feat/themes");
    expect(named.view).toMatchObject({ location: "~/Projects/api-feat-themes" });
    expect(named.request).toEqual({
      branch: { kind: "new", name: "feat/themes", base: "main", baseIsRemote: false },
      location: "~/Projects/api-feat-themes",
    });
    expect(newBranch("feat/themes", { location: "~/elsewhere" }).request?.location).toBe(
      "~/elsewhere",
    );
  });

  it("starts from a remote branch as a remote base", () => {
    const fromRemote = newBranch("fix", { startFrom: "origin/main" });
    expect(fromRemote.request?.branch).toEqual({
      kind: "new",
      name: "fix",
      base: "origin/main",
      baseIsRemote: true,
    });
  });

  it("lists a local branch named like a remote one once, as the local one Git starts from", () => {
    const named = { ...context, local: [...context.local, "origin/main"] };
    const shown = worktreeForm(
      {
        ...EMPTY_FORM,
        newBranch: { ...EMPTY_FORM.newBranch, name: "fix", startFrom: "origin/main" },
      },
      named,
      location,
    );
    expect(shown.view).toMatchObject({
      startFrom: {
        options: ["main", "feat/pairing", "docs/readme", "origin/main", "origin/feat/find"],
      },
    });
    expect(shown.request?.branch).toMatchObject({ base: "origin/main", baseIsRemote: false });
  });

  it("says why a branch name cannot be used while it is typed", () => {
    expect(newBranch("feat themes")).toMatchObject({ problem: "invalid-name", request: null });
    expect(newBranch("docs/readme")).toMatchObject({ problem: "branch-exists", request: null });
  });

  it("keeps a Location the Machine found not empty off until it changes", () => {
    const named = (name: string) => ({ ...EMPTY_FORM.newBranch, name });
    const location = form({ newBranch: named("x") }).view.location;

    expect(form({ newBranch: named("x"), notEmpty: location })).toMatchObject({
      problem: "not-empty",
      request: null,
    });
    expect(form({ newBranch: named("y"), notEmpty: location })).toMatchObject({ problem: null });
    expect(form({ kind: "existing", notEmpty: location }).problem).toBeNull();
  });

  it("lists for Existing Branch only branches no Worktree has checked out", () => {
    const existing = form({ kind: "existing" });
    expect(existing.view).toEqual({
      kind: "existing",
      branch: { value: "docs/readme", options: ["docs/readme"] },
      location: "~/Projects/api-docs-readme",
    });
    expect(existing.request?.branch).toEqual({ kind: "existing", name: "docs/readme" });
  });

  it("fills in the local name from the remote branch picked", () => {
    const remote = form({ kind: "remote" });
    expect(remote.view).toMatchObject({ local: "feat/find", location: "~/Projects/api-feat-find" });
    expect(remote.request?.branch).toEqual({
      kind: "remote",
      remote: "origin/feat/find",
      name: "feat/find",
    });
  });

  it("keeps each kind's fields when the kind changes", () => {
    const typed: Partial<FormState> = {
      newBranch: { name: "fix", startFrom: "origin/main", location: null },
    };
    const back = form({ ...typed, kind: "existing" }) && form({ ...typed, kind: "new" });
    expect(back.view).toMatchObject({ name: "fix", startFrom: { value: "origin/main" } });
  });

  it("cannot confirm with a list that has no branch", () => {
    const bare = worktreeForm(
      { ...EMPTY_FORM, kind: "existing" },
      { ...context, local: ["main"] },
      location,
    );
    expect(bare.view).toMatchObject({ branch: { value: null, options: [] } });
    expect(bare.request).toBeNull();
  });
});

describe("a branch name Git allows", () => {
  it("follows git check-ref-format", () => {
    const allowed = ["main", "feat/themes", "v1.2", "fix-1", "a@b"];
    const refused = [
      "",
      "@",
      "-x",
      "/x",
      "x/",
      "x.",
      "a..b",
      "a//b",
      "a@{b",
      "a b",
      "a~b",
      "a^b",
      "a:b",
      "a?b",
      "a*b",
      "a[b",
      "a\\b",
      ".hidden",
      "x/.y",
      "x.lock",
      "x/y.lock/z",
    ];
    expect(allowed.filter((name) => !usableBranchName(name))).toEqual([]);
    expect(refused.filter(usableBranchName)).toEqual([]);
  });
});
