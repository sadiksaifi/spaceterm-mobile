import { useEffect, useReducer } from "react";

import { useMachineClient } from "@/shared/machines/client";

import {
  initialPicker,
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
  /** The attempt the Machine refused last, `null` once another starts or Cancel closes it. */
  failure: PickerFailure | null;
  edit: (field: string) => void;
  navigate: (path: string) => void;
  open: () => void;
  create: () => void;
  /** Cancel, in the create alert or the failure's. */
  cancel: () => void;
  /** Try Again: repeats the attempt `failure` describes. */
  retry: (failure: PickerFailure) => void;
};

/**
 * Browses one Machine's directories and opens a Workspace in the one in the field. `onOpened`
 * runs once the Machine has created the Workspace. A refusal is kept as `failure`; `onFailed`
 * also hears of it, with Try Again as `retry`, where the screen shows it outside an alert.
 */
export function useDirectoryPicker(
  machineId: string,
  onOpened: () => void,
  onFailed?: (failure: PickerFailure, retry: () => void) => void,
): DirectoryPicker {
  const client = useMachineClient();
  const [state, dispatch] = useReducer(reducePicker, initialPicker);
  const { listing, request, field } = state;
  const loadingPath = listing.kind === "loading" ? listing.path : null;

  useEffect(() => {
    if (loadingPath === null) return;
    client.listDirectory(machineId, loadingPath).then(
      (answer) => dispatch({ type: "answered", request, listing: answer }),
      // A Machine that cannot answer cannot list the directory either.
      () =>
        dispatch({
          type: "answered",
          request,
          listing: { kind: "unavailable", path: loadingPath, parent: null },
        }),
    );
  }, [client, machineId, loadingPath, request]);

  async function createWorkspace(directory: string, createDirectory: boolean) {
    const result = await client
      .createWorkspace(machineId, directory, { createDirectory })
      .catch(() => ({ kind: "failed" }) as const);
    switch (result.kind) {
      case "created":
        onOpened();
        return;
      case "missing-directory":
        dispatch({ type: "missing-directory", directory: result.directory });
        return;
      case "failed": {
        const failure = { directory, createDirectory };
        dispatch({ type: "failed", failure });
        onFailed?.(failure, () => retry(failure));
      }
    }
  }

  function retry(failure: PickerFailure) {
    dispatch({ type: "open" });
    void createWorkspace(failure.directory, failure.createDirectory);
  }

  return {
    view: pickerView(state),
    fieldVersion: request,
    askingCreate: state.confirm.kind === "asking-create" ? state.confirm.directory : null,
    // The same object while the failure lasts, so a screen can tell a new one apart.
    failure: state.confirm.kind === "failed" ? state.confirm : null,
    edit: (typed) => dispatch({ type: "edit", field: typed }),
    navigate: (path) => dispatch({ type: "navigate", path }),
    open() {
      if (!pickerView(state).canOpen) return;
      dispatch({ type: "open" });
      void createWorkspace(field, false);
    },
    create() {
      if (state.confirm.kind !== "asking-create") return;
      dispatch({ type: "create" });
      void createWorkspace(state.confirm.directory, true);
    },
    cancel: () => dispatch({ type: "cancel" }),
    retry,
  };
}
