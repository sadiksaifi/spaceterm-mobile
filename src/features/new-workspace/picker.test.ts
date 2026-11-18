import { describe, expect, it } from "vitest";

import type { DirectoryListing } from "@/shared/machines/model";

import {
  initialPicker,
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
  it("starts at the home directory, loading, with Open unavailable", () => {
    expect(pickerView(initialPicker)).toEqual({
      field: "~/",
      content: { kind: "loading" },
      parent: null,
      canOpen: false,
    });
  });

  it("lists the directory that arrives, with Parent Directory, and offers Open", () => {
    expect(pickerView(atHome)).toEqual({
      field: "~/",
      content: { kind: "directories", directories: home.directories },
      parent: "/Users/",
      canOpen: true,
    });
  });

  it("loads a tapped directory in place, showing its path at once", () => {
    const loading = run([{ type: "navigate", path: "~/scratch/" }], atHome);
    expect(pickerView(loading)).toMatchObject({
      field: "~/scratch/",
      content: { kind: "loading" },
      parent: null,
      canOpen: false,
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
    expect(pickerView(late)).toMatchObject({ field: "~/", content: { kind: "loading" } });
  });

  it("keeps Parent Directory and Try Again where the Machine cannot list, with Open unavailable", () => {
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
      canOpen: false,
    });
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

  it("keeps a failed attempt for Try Again, and offers Open again", () => {
    const failed = run(
      [{ type: "open" }, { type: "failed", failure: { directory: "~/", createDirectory: false } }],
      atHome,
    );
    expect(failed.confirm).toEqual({ kind: "failed", directory: "~/", createDirectory: false });
    expect(pickerView(failed).canOpen).toBe(true);

    expect(run([{ type: "cancel" }], failed).confirm).toEqual({ kind: "idle" });
  });

  it("leaves an attempt under way alone when a closing alert reports Cancel late", () => {
    const opening = run([{ type: "open" }], atHome);
    expect(run([{ type: "cancel" }], opening).confirm).toEqual({ kind: "opening" });
  });
});
