import { useEffect, useReducer, useRef } from "react";

import { useMachineClient } from "@/shared/machines/client";

import {
  initialPicker,
  openPath,
  pickerView,
  reducePicker,
  type PickerFailure,
  type PickerView,
} from "./picker";

export type DirectoryPicker = {
  view: PickerView;
  /** Changes each time a directory is asked for, when the field takes its path. */
  fieldVersion: number;
  /** The directory the create alert names, `null` while the alert is closed. */
  askingCreate: string | null;
  /**
   * The attempt the Machine refused last, until Try Again, Cancel, or picking another directory.
   * It stays the same object while it lasts.
   */
  failure: PickerFailure | null;
  edit: (field: string) => void;
  navigate: (path: string) => void;
  open: () => void;
  create: () => void;
  /** Cancel, in the create alert. */
  cancel: () => void;
  /** Try Again: repeats the attempt `failure` describes, if it is still the latest. */
  retry: (failure: PickerFailure) => void;
  /** Cancel, or the close button, on `failure`. */
  dismissFailure: (failure: PickerFailure) => void;
};

/**
 * Browses one Machine's directories and opens a Workspace in the one in the field. `onOpened`
 * runs once the Machine has created the Workspace, if the step still shows.
 */
export function useDirectoryPicker(machineId: string, onOpened: () => void): DirectoryPicker {
  const client = useMachineClient();
  const [state, dispatch] = useReducer(reducePicker, initialPicker);
  const { listing, request, confirm } = state;
  const loadingPath = listing.kind === "loading" ? listing.path : null;
  // One attempt at a time: a second tap can arrive before the render that disables the first.
  const attempting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (loadingPath === null) return;
    void client
      .listDirectory(machineId, loadingPath)
      .then((answer) => dispatch({ type: "answered", request, listing: answer }));
  }, [client, machineId, loadingPath, request]);

  function attempt(directory: string, createDirectory: boolean) {
    if (attempting.current) return;
    attempting.current = true;
    dispatch({ type: createDirectory ? "create" : "open" });
    void client
      .createWorkspace(machineId, directory, { createDirectory })
      .then((result) => {
        switch (result.kind) {
          case "created":
            if (mounted.current) onOpened();
            return;
          case "missing-directory":
            dispatch({ type: "missing-directory", directory: result.directory });
            return;
          case "failed":
            dispatch({ type: "failed", failure: { directory, createDirectory } });
        }
      })
      .finally(() => {
        attempting.current = false;
      });
  }

  return {
    view: pickerView(state),
    fieldVersion: request,
    askingCreate: confirm.kind === "asking-create" ? confirm.directory : null,
    failure: confirm.kind === "failed" ? confirm : null,
    edit: (typed) => dispatch({ type: "edit", field: typed }),
    navigate: (path) => dispatch({ type: "navigate", path }),
    open() {
      const path = openPath(state);
      if (pickerView(state).canOpen && path !== null) attempt(path, false);
    },
    create() {
      if (confirm.kind === "asking-create") attempt(confirm.directory, true);
    },
    cancel: () => dispatch({ type: "cancel" }),
    retry(failure) {
      if (failure === confirm) attempt(failure.directory, failure.createDirectory);
    },
    dismissFailure: (failure) => dispatch({ type: "dismiss-failure", failure }),
  };
}
