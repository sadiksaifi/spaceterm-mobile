import { describe, expect, it } from "vitest";

import type { DirectoryListing } from "@/shared/machines/model";

import {
  initialPicker,
  openPath,
  pickerView,
  reducePicker,
  type PickerEvent,
  type PickerState,
} from "./picker";

const home: DirectoryListing = {
  kind: "listed",
  path: "~/",
  parent: "/Users/",
  directories: [
    { name: "Projects", path: "~/Projects/" },
    { name: "scratch", path: "~/scratch/" },
  ],
};
const scratch: DirectoryListing = {
  kind: "listed",
  path: "~/scratch/",
  parent: "~/",
  directories: [],
};
const root: DirectoryListing = { kind: "unavailable", path: "/var/root/", parent: "/var/" };

const run = (events: PickerEvent[], state: PickerState = initialPicker) =>
  events.reduce(reducePicker, state);

/** The state after the home directory arrives. */
const atHome = run([{ type: "answered", request: initialPicker.request, listing: home }]);

describe("the Directory Picker", () => {
  it("starts at the home directory, showing nothing until the spinner, with Open waiting for it", () => {
    expect(pickerView(initialPicker)).toEqual({
      field: "~/",
      content: { kind: "none" },
      parent: null,
      opening: false,
      canOpen: true,
    });
    const slow = run([{ type: "slow", request: initialPicker.request }]);
    expect(pickerView(slow)).toMatchObject({ content: { kind: "loading" }, parent: null });
  });

  it("lists the directory that arrives, with Parent Directory, and offers Open", () => {
    expect(pickerView(atHome)).toEqual({
      field: "~/",
      content: { kind: "directories", directories: home.directories },
      parent: "/Users/",
      opening: false,
      canOpen: true,
    });
  });

  it("loads a tapped directory in place, showing its path at once and the rows before it", () => {
    const loading = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    expect(pickerView(loading)).toMatchObject({
      field: "~/scratch/",
      content: { kind: "directories", directories: home.directories },
      parent: "/Users/",
      canOpen: true,
    });
    const listed = run([{ type: "answered", request: loading.request, listing: scratch }], loading);
    expect(pickerView(listed)).toMatchObject({
      content: { kind: "empty" },
      parent: "~/",
      canOpen: true,
    });
  });

  it("drops an answer for a directory it has since left", () => {
    const first = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    const second = run([{ type: "navigate", path: "~/" }], first);
    const late = run([{ type: "answered", request: first.request, listing: scratch }], second);
    expect(late.listing).toMatchObject({ kind: "loading", path: "~/" });
  });

  it("shows the spinner only once the directory is slow, and keeps it for the next one", () => {
    const loading = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    const stale = run([{ type: "slow", request: atHome.request }], loading);
    expect(pickerView(stale).content).toEqual({
      kind: "directories",
      directories: home.directories,
    });

    const slow = run([{ type: "slow", request: loading.request }], loading);
    expect(pickerView(slow)).toMatchObject({ content: { kind: "loading" }, parent: null });
    const next = run([{ type: "navigate", path: "~/Projects/" }], slow);
    expect(pickerView(next).content).toEqual({ kind: "loading" });

    const listed = run([{ type: "answered", request: loading.request, listing: scratch }], slow);
    expect(pickerView(listed).content).toEqual({ kind: "empty" });
    const after = run([{ type: "slow", request: loading.request }], listed);
    expect(after).toBe(listed);
  });

  it("opens a directory pressed while it loads once the Machine lists it", () => {
    const loading = run(
      [{ type: "navigate", path: "~/scratch/" }, { type: "open-when-listed" }],
      atHome,
    );
    expect(pickerView(loading)).toMatchObject({ opening: true, canOpen: false });
    // Opening takes no other directory meanwhile.
    expect(run([{ type: "navigate", path: "~/" }], loading)).toBe(loading);
    expect(run([{ type: "edit", field: "~/x" }], loading)).toBe(loading);

    const listed = run([{ type: "answered", request: loading.request, listing: scratch }], loading);
    expect(listed.confirm).toEqual({ kind: "opening-when-listed" });
    expect(openPath(listed)).toBe("~/scratch/");
  });

  it("lets an Open pressed while loading lapse where the Machine cannot list the directory", () => {
    const loading = run(
      [{ type: "navigate", path: "/var/root/" }, { type: "open-when-listed" }],
      atHome,
    );
    const listed = run([{ type: "answered", request: loading.request, listing: root }], loading);
    expect(listed.confirm).toEqual({ kind: "idle" });
    expect(pickerView(listed)).toMatchObject({ opening: false, canOpen: false });
  });

  it("lists the directory again in place on refresh, keeping a typed path", () => {
    const typed = run([{ type: "edit", field: "~/new" }], atHome);
    const notes = { name: "notes", path: "~/notes/" };
    const relisted = { ...home, directories: [...home.directories, notes] };
    const refreshed = run(
      [{ type: "refreshed", request: typed.request, listing: relisted }],
      typed,
    );
    expect(pickerView(refreshed)).toMatchObject({
      field: "~/new",
      content: { kind: "directories", directories: relisted.directories },
    });
    expect(refreshed.fieldVersion).toBe(typed.fieldVersion);
  });

  it("drops a refresh of a directory it has since left", () => {
    const left = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    const late = run([{ type: "refreshed", request: atHome.request, listing: home }], left);
    expect(late.listing).toMatchObject({ kind: "loading", path: "~/scratch/" });
  });

  it("keeps Parent Directory and Try Again where the Machine cannot list, and opens only a typed path", () => {
    const state = run(
      [
        { type: "navigate", path: "/var/root/" },
        { type: "answered", request: atHome.request + 1, listing: root },
      ],
      atHome,
    );
    expect(pickerView(state)).toEqual({
      field: "/var/root/",
      content: { kind: "unavailable", retryPath: "/var/root/" },
      parent: "/var/",
      opening: false,
      canOpen: false,
    });
    const typed = run([{ type: "edit", field: "~/notes " }], state);
    expect(pickerView(typed).canOpen).toBe(true);
    expect(openPath(typed)).toBe("~/notes");
  });

  it("opens the typed directory, and Open is unavailable while the field is empty", () => {
    const typed = run([{ type: "edit", field: "~/Projects/notes" }], atHome);
    expect(pickerView(typed)).toMatchObject({ field: "~/Projects/notes", canOpen: true });
    expect(pickerView(run([{ type: "edit", field: "  " }], atHome)).canOpen).toBe(false);
  });

  it("keeps the typed path when the listing it replaced arrives late", () => {
    const loading = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    const typed = run([{ type: "edit", field: "~/notes" }], loading);
    const listed = run([{ type: "answered", request: loading.request, listing: scratch }], typed);
    expect(pickerView(listed).field).toBe("~/notes");
  });

  it("asks before creating a directory that does not exist, and Cancel goes back to picking", () => {
    const asking = run(
      [
        { type: "edit", field: "~/Projects/notes" },
        { type: "open" },
        { type: "missing-directory", directory: "~/Projects/notes" },
      ],
      atHome,
    );
    expect(asking.confirm).toEqual({ kind: "asking-create", directory: "~/Projects/notes" });
    expect(pickerView(asking).canOpen).toBe(false);

    const cancelled = run([{ type: "cancel" }], asking);
    expect(cancelled.confirm).toEqual({ kind: "idle" });
    expect(pickerView(cancelled)).toMatchObject({ field: "~/Projects/notes", canOpen: true });
  });

  it("lists its directory again when it stays after the Machine creates the Workspace", () => {
    const atScratch = run(
      [
        { type: "navigate", path: "~/scratch/" },
        { type: "answered", request: atHome.request + 1, listing: scratch },
      ],
      atHome,
    );
    const created = run(
      [{ type: "edit", field: "~/scratch/notes" }, { type: "create" }, { type: "created" }],
      atScratch,
    );
    expect(created.confirm).toEqual({ kind: "idle" });
    expect(created.listing).toEqual({
      kind: "loading",
      path: "~/scratch/",
      previous: scratch,
      spinner: false,
    });

    const notes = { name: "notes", path: "~/scratch/notes/" };
    const relisted = run(
      [
        {
          type: "answered",
          request: created.request,
          listing: { ...scratch, directories: [notes] },
        },
      ],
      created,
    );
    expect(pickerView(relisted)).toMatchObject({
      field: "~/scratch/notes",
      content: { kind: "directories", directories: [notes] },
    });
  });

  it("keeps a failed attempt for Try Again, and offers Open again", () => {
    const failed = run(
      [{ type: "open" }, { type: "failed", failure: { directory: "~/", createDirectory: false } }],
      atHome,
    );
    expect(failed.confirm).toEqual({ kind: "failed", directory: "~/", createDirectory: false });
    expect(pickerView(failed).canOpen).toBe(true);
  });

  it("drops a failure once it is dismissed, or once another directory is picked", () => {
    const failed = run(
      [{ type: "open" }, { type: "failed", failure: { directory: "~/", createDirectory: false } }],
      atHome,
    );
    const failure = { kind: "failed" as const, directory: "~/", createDirectory: false };
    expect(
      run([{ type: "dismiss-failure", failure: failed.confirm as typeof failure }], failed).confirm,
    ).toEqual({ kind: "idle" });
    // A failure that has since been replaced stays.
    expect(run([{ type: "dismiss-failure", failure }], failed).confirm).toMatchObject({
      kind: "failed",
    });
    expect(run([{ type: "navigate", path: "~/scratch/" }], failed).confirm).toEqual({
      kind: "idle",
    });
    expect(run([{ type: "edit", field: "~/notes" }], failed).confirm).toEqual({ kind: "idle" });
  });

  it("takes no other directory while an attempt is under way, so its answer still applies", () => {
    const opening = run([{ type: "edit", field: "~/notes" }, { type: "open" }], atHome);
    expect(pickerView(opening).opening).toBe(true);
    expect(run([{ type: "navigate", path: "~/Projects/" }], opening)).toBe(opening);
    expect(run([{ type: "edit", field: "~/notes2" }], opening)).toBe(opening);
    expect(run([{ type: "missing-directory", directory: "~/notes" }], opening).confirm).toEqual({
      kind: "asking-create",
      directory: "~/notes",
    });
  });

  it("shows the path the Machine answers with, written its way", () => {
    const loading = run([{ type: "navigate", path: "~/scratch" }], atHome);
    const listed = run([{ type: "answered", request: loading.request, listing: scratch }], loading);
    expect(pickerView(listed).field).toBe("~/scratch/");
    expect(listed.fieldVersion).toBe(loading.fieldVersion + 1);
  });

  it("leaves an attempt under way alone when a closing alert reports Cancel late", () => {
    const opening = run([{ type: "open" }], atHome);
    expect(run([{ type: "cancel" }], opening).confirm).toEqual({ kind: "opening" });
  });
});
