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
  listing: { kind: "loading"; path: string } | DirectoryListing;
  /** Counts the directories asked for, so a late answer for one left behind is dropped. */
  request: number;
  /** Changes each time the picker, not the person, sets the field, so the field shows it. */
  fieldVersion: number;
  confirm:
    | { kind: "idle" }
    | { kind: "opening" }
    /** The directory in the field does not exist; the alert asks to create it. */
    | { kind: "asking-create"; directory: string }
    /** The Machine refused; Try Again repeats the attempt. */
    | ({ kind: "failed" } & PickerFailure);
};

/** An attempt to open a Workspace that the Machine refused. */
export type PickerFailure = { directory: string; createDirectory: boolean };

export type PickerEvent =
  /** A directory row, Parent Directory or Try Again. */
  | { type: "navigate"; path: string }
  | { type: "answered"; request: number; listing: DirectoryListing }
  | { type: "edit"; field: string }
  /** The checkmark on iOS, Open on Android, or Try Again. */
  | { type: "open" }
  | { type: "missing-directory"; directory: string }
  /** Create, in the alert. */
  | { type: "create" }
  /** Cancel, in the create alert. */
  | { type: "cancel" }
  | { type: "failed"; failure: PickerFailure }
  /** Cancel or the close button on `failure`, the refusal as the picker gave it. */
  | { type: "dismiss-failure"; failure: PickerFailure };

export const initialPicker: PickerState = {
  field: HOME,
  listing: { kind: "loading", path: HOME },
  request: 0,
  fieldVersion: 0,
  confirm: { kind: "idle" },
};

/**
 * Picking another directory makes a refusal out of date, and leaves an attempt under way behind:
 * its answer no longer applies to what the picker shows.
 */
const pickingAnother = (state: PickerState): PickerState =>
  state.confirm.kind === "failed" || state.confirm.kind === "opening"
    ? { ...state, confirm: { kind: "idle" } }
    : state;

export function reducePicker(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case "navigate":
      return {
        ...pickingAnother(state),
        field: event.path,
        listing: { kind: "loading", path: event.path },
        request: state.request + 1,
        fieldVersion: state.fieldVersion + 1,
      };
    case "answered": {
      if (event.request !== state.request || state.listing.kind !== "loading") return state;
      // A path typed while the directory loaded stays; otherwise the field shows the Machine's,
      // which can be written differently from the one asked for.
      const typed = state.field !== state.listing.path;
      const field = typed ? state.field : event.listing.path;
      return {
        ...state,
        listing: event.listing,
        field,
        fieldVersion: field === state.field ? state.fieldVersion : state.fieldVersion + 1,
      };
    }
    case "edit":
      return event.field === state.field ? state : { ...pickingAnother(state), field: event.field };
    case "open":
    case "create":
      return { ...state, confirm: { kind: "opening" } };
    case "missing-directory":
      // An answer for an attempt the person has left behind is dropped.
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
    case "dismiss-failure":
      // A failure that has since been replaced stays.
      return state.confirm === event.failure ? { ...state, confirm: { kind: "idle" } } : state;
  }
}

export type PickerView = {
  field: string;
  content:
    | { kind: "loading" }
    | { kind: "directories"; directories: readonly DirectoryEntry[] }
    /** A directory with no subdirectories. Open still opens it. */
    | { kind: "empty" }
    | { kind: "unavailable"; retryPath: string };
  /** Where Parent Directory leads, `null` while it does not show. */
  parent: string | null;
  /**
   * Open works once the Machine has answered and the field holds a path, and no attempt is under
   * way. It opens a typed path even where the directory shown cannot be listed.
   */
  canOpen: boolean;
};

export function pickerView(state: PickerState): PickerView {
  const { listing, field } = state;
  if (listing.kind === "loading") {
    return { field, content: { kind: "loading" }, parent: null, canOpen: false };
  }
  return {
    field,
    content:
      listing.kind === "unavailable"
        ? { kind: "unavailable", retryPath: listing.path }
        : listing.directories.length === 0
          ? { kind: "empty" }
          : { kind: "directories", directories: listing.directories },
    parent: listing.parent,
    canOpen:
      (state.confirm.kind === "idle" || state.confirm.kind === "failed") &&
      openPath(state) !== null,
  };
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
