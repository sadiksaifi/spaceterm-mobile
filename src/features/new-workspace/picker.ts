import type { DirectoryEntry, DirectoryListing } from "@/shared/machines/model";

/** The step starts at the home directory, which a Machine shows as `~/`. */
const HOME = "~/";

/**
 * The Directory Picker of one Machine: the path in the field, the directory listed under it, and
 * how far opening has got.
 */
export type PickerState = {
  /** The path the field shows. Tapping a directory sets it; the person can also type one. */
  field: string;
  /** The directory last asked for: loading until the Machine answers. */
  listing: Loading | DirectoryListing;
  /** Counts the directories asked for, so a late answer for one left behind is dropped. */
  request: number;
  /** Changes each time the picker, not the person, sets the field, so the field shows it. */
  fieldVersion: number;
  confirm:
    | { kind: "idle" }
    | { kind: "opening" }
    /** Open was pressed while the directory loaded; it opens once the Machine answers. */
    | { kind: "opening-when-listed" }
    /** The directory in the field does not exist; the alert asks to create it. */
    | { kind: "asking-create"; directory: string }
    /** The Machine refused; Try Again repeats the attempt. */
    | ({ kind: "failed" } & PickerFailure);
};

/**
 * A directory the Machine has yet to list. Most answer within a moment, so the screen keeps
 * showing the directory before it, or nothing at first, and shows the spinner only once `slow`
 * arrives. A spinner shown for a moment reads as a flicker.
 */
export type Loading = {
  kind: "loading";
  path: string;
  /** The listing the screen keeps showing until the spinner shows, `null` at first. */
  previous: DirectoryListing | null;
  spinner: boolean;
};

/** An attempt to open a Workspace that the Machine refused. */
export type PickerFailure = { directory: string; createDirectory: boolean };

export type PickerEvent =
  /** A directory row, Parent Directory or Try Again. */
  | { type: "navigate"; path: string }
  | { type: "answered"; request: number; listing: DirectoryListing }
  /** The directory `request` asked for has taken long enough to show the spinner. */
  | { type: "slow"; request: number }
  /** Pull to refresh: the directory shown, listed again. */
  | { type: "refreshed"; request: number; listing: DirectoryListing }
  | { type: "edit"; field: string }
  /** The checkmark on iOS, Open on Android, or Try Again. */
  | { type: "open" }
  /** The checkmark or Open while the directory loads. */
  | { type: "open-when-listed" }
  | { type: "missing-directory"; directory: string }
  /** Create, in the alert. */
  | { type: "create" }
  /** Cancel, in the create alert. */
  | { type: "cancel" }
  | { type: "failed"; failure: PickerFailure }
  /** The Machine created the Workspace, and the step stays without leaving. */
  | { type: "created" }
  /** Cancel or the close button on `failure`, the refusal as the picker gave it. */
  | { type: "dismiss-failure"; failure: PickerFailure };

export const initialPicker: PickerState = {
  field: HOME,
  listing: { kind: "loading", path: HOME, previous: null, spinner: false },
  request: 0,
  fieldVersion: 0,
  confirm: { kind: "idle" },
};

/** Opening takes no other directory until the Machine answers, so the answer applies to it. */
const opening = (state: PickerState) =>
  state.confirm.kind === "opening" || state.confirm.kind === "opening-when-listed";

/**
 * Loads `path`. The screen keeps what it shows: the listing before, or the spinner once a
 * directory has been slow.
 */
const loading = (state: PickerState, path: string): Loading =>
  state.listing.kind === "loading"
    ? { ...state.listing, path }
    : { kind: "loading", path, previous: state.listing, spinner: false };

/** Picking another directory makes a refusal out of date. */
const pickingAnother = (state: PickerState): PickerState =>
  state.confirm.kind === "failed" ? { ...state, confirm: { kind: "idle" } } : state;

export function reducePicker(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case "navigate":
      // While an attempt is under way the picker takes no other directory, so its answer, which
      // may be a new Workspace, always applies to what the picker shows.
      if (opening(state)) return state;
      return {
        ...pickingAnother(state),
        field: event.path,
        listing: loading(state, event.path),
        request: state.request + 1,
        fieldVersion: state.fieldVersion + 1,
      };
    case "answered": {
      if (event.request !== state.request || state.listing.kind !== "loading") return state;
      // A path typed while the directory loaded stays; otherwise the field shows the Machine's,
      // which can be written differently from the one asked for.
      const typed = state.field !== state.listing.path;
      const field = typed ? state.field : event.listing.path;
      const listed: PickerState = {
        ...state,
        listing: event.listing,
        field,
        fieldVersion: field === state.field ? state.fieldVersion : state.fieldVersion + 1,
      };
      // An Open pressed meanwhile lapses where the field shows a directory the Machine cannot list.
      return listed.confirm.kind === "opening-when-listed" && openPath(listed) === null
        ? { ...listed, confirm: { kind: "idle" } }
        : listed;
    }
    case "slow":
      return event.request === state.request && state.listing.kind === "loading"
        ? { ...state, listing: { ...state.listing, spinner: true } }
        : state;
    case "refreshed":
      // The field stays as it is, typed or not.
      return event.request === state.request && state.listing.kind !== "loading"
        ? { ...state, listing: event.listing }
        : state;
    case "edit":
      return event.field === state.field || opening(state)
        ? state
        : { ...pickingAnother(state), field: event.field };
    case "open":
    case "create":
      return { ...state, confirm: { kind: "opening" } };
    case "open-when-listed":
      return state.listing.kind === "loading" && !opening(state)
        ? { ...state, confirm: { kind: "opening-when-listed" } }
        : state;
    case "missing-directory":
      return state.confirm.kind === "opening"
        ? { ...state, confirm: { kind: "asking-create", directory: event.directory } }
        : state;
    case "cancel":
      // A system alert reports Cancel after its other button has run; an attempt keeps going.
      return state.confirm.kind === "asking-create"
        ? { ...state, confirm: { kind: "idle" } }
        : state;
    case "failed":
      return state.confirm.kind === "opening"
        ? { ...state, confirm: { kind: "failed", ...event.failure } }
        : state;
    case "created":
      if (state.confirm.kind !== "opening") return state;
      // The Workspace may have made a directory the listing shows, so the listing loads again; a
      // typed path stays in the field.
      return state.listing.kind === "loading"
        ? { ...state, confirm: { kind: "idle" } }
        : {
            ...state,
            confirm: { kind: "idle" },
            listing: loading(state, state.listing.path),
            request: state.request + 1,
          };
    case "dismiss-failure":
      // A failure that has since been replaced stays.
      return state.confirm === event.failure ? { ...state, confirm: { kind: "idle" } } : state;
  }
}

export type PickerView = {
  field: string;
  content:
    /** The spinner: the Machine has been slow to list the directory. */
    | { kind: "loading" }
    /** Nothing yet: the first directory is loading, and the spinner waits. */
    | { kind: "none" }
    | { kind: "directories"; directories: readonly DirectoryEntry[] }
    /** A directory with no subdirectories. Open still opens it. */
    | { kind: "empty" }
    | { kind: "unavailable"; retryPath: string };
  /** Where Parent Directory leads, `null` while it does not show or does not lead anywhere yet. */
  parent: string | null;
  /**
   * Parent Directory shows but leads nowhere until the Machine answers: the directory is loading,
   * and its path does not tell its parent, as `~/` does not. It shows anyway, so the rows below it
   * do not move when the answer arrives.
   */
  parentWaits: boolean;
  /** An attempt is under way: the field and the rows take no input until the Machine answers. */
  opening: boolean;
  /**
   * Open works while the field holds a path and no attempt is under way. It opens a typed path
   * even where the directory shown cannot be listed. While the directory loads, it waits for the
   * Machine to answer.
   */
  canOpen: boolean;
};

export function pickerView(state: PickerState): PickerView {
  const { field, listing } = state;
  const ready = state.confirm.kind === "idle" || state.confirm.kind === "failed";
  const base = { field, opening: opening(state), parentWaits: false };
  if (listing.kind === "loading") {
    const canOpen = ready && field.trim() !== "";
    if (listing.spinner || listing.previous === null) {
      const parent = parentOf(listing.path);
      return {
        ...base,
        content: { kind: listing.spinner ? "loading" : "none" },
        parent: parent ?? null,
        parentWaits: parent === undefined,
        canOpen,
      };
    }
    return {
      ...base,
      content: contentOf(listing.previous),
      parent: listing.previous.parent,
      canOpen,
    };
  }
  return {
    ...base,
    content: contentOf(listing),
    parent: listing.parent,
    canOpen: ready && openPath(state) !== null,
  };
}

/**
 * The parent of a directory the Machine has yet to list, as its path tells it: `null` for the
 * root, `undefined` where the path does not tell, as `~/` does not. The Machine's answer then
 * says it.
 */
export function parentOf(path: string): string | null | undefined {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (trimmed === "" && path.trim().startsWith("/")) return null;
  if (!trimmed.startsWith("/") && !trimmed.startsWith("~/")) return undefined;
  const cut = trimmed.lastIndexOf("/");
  const name = trimmed.slice(cut + 1);
  if (name === "" || name === ".") return undefined;
  // Only the Machine knows where `..` leads past a symbolic link, so the parent is one more.
  if (name === "..") return `${trimmed}/../`;
  return cut === 0 ? "/" : `${trimmed.slice(0, cut)}/`;
}

function contentOf(listing: DirectoryListing): PickerView["content"] {
  if (listing.kind === "unavailable") return { kind: "unavailable", retryPath: listing.path };
  return listing.directories.length === 0
    ? { kind: "empty" }
    : { kind: "directories", directories: listing.directories };
}

/**
 * The directory Open opens: the field without the spaces around it. `null` while there is none,
 * or while the field still shows a directory the Machine cannot list.
 */
export function openPath(state: PickerState): string | null {
  const { listing } = state;
  const path = state.field.trim();
  if (listing.kind === "loading" || path === "") return null;
  if (listing.kind === "unavailable" && path === listing.path) return null;
  return path;
}
