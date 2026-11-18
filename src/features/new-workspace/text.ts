import { cased } from "@/shared/text";

export const text = {
  title: "New Workspace",
  machine: "Machine",
  cancel: "Cancel",
  close: "Close",
  back: "Back",
  loading: "Loading",

  openDirectory: cased("Open Directory", "Open directory"),
  open: "Open",
  directoryOn: (machine: string) => `Directory on ${machine}`,
  parentDirectory: cased("Parent Directory", "Parent directory"),
  noSubdirectories: cased("No Subdirectories", "No subdirectories"),
  cannotList: cased("Couldn’t List This Directory", "Couldn’t list this directory"),
  cannotListBody: "Check that you have permission.",
  tryAgain: cased("Try Again", "Try again"),

  createTitle: cased("Create This Directory?", "Create this directory?"),
  /** The sentence around the path, which is set in a monospaced font where the platform allows. */
  createBody: (directory: string, machine: string) =>
    [directory, ` doesn’t exist on ${machine}.`] as const,
  create: "Create",
  /** The Machine refused to open a Workspace there: an alert on iOS, a snackbar on Android. */
  failedTitle: (directory: string) =>
    cased(`Couldn’t Open “${directory}”`, `Couldn’t open ${directory}`),
};
