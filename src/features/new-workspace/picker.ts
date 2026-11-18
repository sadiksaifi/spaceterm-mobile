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
  /** Cancel, in the create alert or the failure's. */
  | { type: "cancel" }
  | { type: "failed"; failure: PickerFailure };

export const initialPicker: PickerState = {
  field: HOME,
  listing: { kind: "loading", path: HOME },
  request: 0,
  confirm: { kind: "idle" },
};

export function reducePicker(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case "navigate":
      return {
        ...state,
        field: event.path,
        listing: { kind: "loading", path: event.path },
        request: state.request + 1,
      };
    case "answered": {
      if (event.request !== state.request || state.listing.kind !== "loading") return state;
      // A path typed while the directory loaded stays; otherwise the field shows the Machine's.
      const typed = state.field !== state.listing.path;
      return { ...state, listing: event.listing, field: typed ? state.field : event.listing.path };
    }
    case "edit":
      return { ...state, field: event.field };
    case "open":
    case "create":
      return { ...state, confirm: { kind: "opening" } };
    case "missing-directory":
      return { ...state, confirm: { kind: "asking-create", directory: event.directory } };
    case "cancel":
      // A system alert reports Cancel after its other button has run; an attempt keeps going.
      return state.confirm.kind === "opening" ? state : { ...state, confirm: { kind: "idle" } };
    case "failed":
      return { ...state, confirm: { kind: "failed", ...event.failure } };
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
  /** Open works once a directory is listed and the field holds a path, and no attempt is under way. */
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
      listing.kind === "listed" &&
      (state.confirm.kind === "idle" || state.confirm.kind === "failed") &&
      field.trim() !== "",
  };
}
