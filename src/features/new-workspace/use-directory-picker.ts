import { useEffect, useRef, useState } from "react";

import { useMachineClient } from "@/shared/machines/client";
import type { CreateWorkspaceResult, DirectoryListing } from "@/shared/machines/model";

import {
  initialPicker,
  openPath,
  pickerView,
  reducePicker,
  type PickerEvent,
  type PickerFailure,
  type PickerView,
} from "./picker";

/** How long a directory may take to list before the spinner shows. */
export const SPINNER_DELAY_MS = 400;

export type DirectoryPicker = {
  view: PickerView;
  /** Changes each time the picker sets the field, which then shows the new path. */
  fieldVersion: number;
  /** The directory the create alert names, `null` while the alert is closed. */
  askingCreate: string | null;
  /**
   * The attempt the Machine refused last, until Try Again, Cancel, or picking another directory.
   * It stays the same object while it lasts.
   */
  failure: PickerFailure | null;
  /** Pull to refresh: lists the directory shown again. Settles once the Machine answers. */
  refresh: () => Promise<void>;
  edit: (field: string) => void;
  navigate: (path: string) => void;
  /**
   * Opens the field's path, once the Machine has listed it if it is loading. `submitted` is the
   * text the field shows, which can be ahead of the last keystroke's event. It is dropped where
   * the picker has set the field since this render, as a tap on a directory does.
   */
  open: (submitted?: string) => void;
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
 * runs once the Machine has created the Workspace, if the step is still mounted, and returns
 * whether it left the step. A step that stays, such as one under a newer step, can open again.
 */
export function useDirectoryPicker(machineId: string, onOpened: () => boolean): DirectoryPicker {
  const client = useMachineClient();
  const [state, setState] = useState(initialPicker);
  const { listing, request, confirm } = state;
  const loadingPath = listing.kind === "loading" ? listing.path : null;
  const listedForOpen = confirm.kind === "opening-when-listed" && listing.kind !== "loading";
  // The state after every event so far, including those the screen has not rendered yet: a tap
  // and then Open, or two taps, can arrive before the next render.
  const latest = useRef(state);
  const mounted = useRef(true);

  /** Applies `event` at once for the next decision; the screen shows the result next render. */
  function send(event: PickerEvent) {
    latest.current = reducePicker(latest.current, event);
    setState(latest.current);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (loadingPath === null) return;
    // A setup that has been cleaned up, as StrictMode does once, drops its answer.
    let live = true;
    void client
      .listDirectory(machineId, loadingPath)
      // A call that fails without an answer leaves the directory unlisted, as the Machine would.
      .catch((): DirectoryListing => ({ kind: "unavailable", path: loadingPath, parent: null }))
      .then((answer) => live && send({ type: "answered", request, listing: answer }));
    const slow = setTimeout(() => send({ type: "slow", request }), SPINNER_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(slow);
    };
  }, [client, machineId, loadingPath, request]);

  // Open pressed while the directory loaded: the Machine has answered, so it opens now.
  useEffect(() => {
    if (!listedForOpen) return;
    const path = openPath(latest.current);
    if (latest.current.confirm.kind === "opening-when-listed" && path !== null) {
      attempt(path, false);
    }
    // `attempt` reads only refs and stable values; the effect runs once per Open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listedForOpen]);

  function attempt(directory: string, createDirectory: boolean, again = false) {
    // Opening takes no second attempt until the Machine answers the first.
    send({ type: createDirectory ? "create" : "open" });
    void client
      .createWorkspace(machineId, directory, { createDirectory, again })
      // A call that fails without an answer is a refusal, which Try Again sends again.
      .catch((): CreateWorkspaceResult => ({ kind: "failed" }))
      .then((result) => {
        // The picker takes no other directory meanwhile, so only a closed step drops the answer.
        if (!mounted.current) return;
        switch (result.kind) {
          case "created":
            if (!onOpened()) send({ type: "created" });
            return;
          case "missing-directory":
            send({ type: "missing-directory", directory: result.directory });
            return;
          case "failed":
            send({ type: "failed", failure: { directory, createDirectory } });
        }
      });
  }

  return {
    view: pickerView(state),
    fieldVersion: state.fieldVersion,
    askingCreate: confirm.kind === "asking-create" ? confirm.directory : null,
    failure: confirm.kind === "failed" ? confirm : null,
    async refresh() {
      const { listing: shown, request: asked } = latest.current;
      if (shown.kind === "loading") return;
      // A refresh that fails without an answer keeps the listing shown.
      const answer = await client.listDirectory(machineId, shown.path).catch(() => null);
      if (answer !== null && mounted.current) {
        send({ type: "refreshed", request: asked, listing: answer });
      }
    },
    edit: (typed) => send({ type: "edit", field: typed }),
    navigate: (path) => send({ type: "navigate", path }),
    open(submitted) {
      if (submitted !== undefined && state.fieldVersion === latest.current.fieldVersion) {
        send({ type: "edit", field: submitted });
      }
      if (!pickerView(latest.current).canOpen) return;
      const path = openPath(latest.current);
      if (path === null) send({ type: "open-when-listed" });
      else attempt(path, false);
    },
    create() {
      const { confirm: now } = latest.current;
      if (now.kind === "asking-create") attempt(now.directory, true);
    },
    cancel: () => send({ type: "cancel" }),
    retry(failure) {
      if (failure === latest.current.confirm) {
        attempt(failure.directory, failure.createDirectory, true);
      }
    },
    dismissFailure: (failure) => send({ type: "dismiss-failure", failure }),
  };
}
