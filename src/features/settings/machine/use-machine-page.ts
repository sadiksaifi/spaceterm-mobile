import { useRef, useState } from "react";

import { useMachineClient } from "@/shared/machines/client";

/** A Restart SpaceTerm Core the Machine refused. A new refusal is a new object. */
export type RestartFailure = { machineId: string };

export type MachinePage = {
  /** The confirmation that shows, if any. */
  alert: "restart" | "unpair" | null;
  /** A restart waits for the Machine's answer. */
  restarting: boolean;
  failure: RestartFailure | null;
  connect: () => void;
  disconnect: () => void;
  askRestart: () => void;
  askUnpair: () => void;
  /** Cancel, or an alert closing by itself. A system alert reports it after its other button too. */
  cancel: () => void;
  restart: () => void;
  unpair: () => void;
  retry: (failure: RestartFailure) => void;
  dismissFailure: (failure: RestartFailure) => void;
};

/** What the page of one Machine can do, and the alerts on the way. `onUnpaired` leaves the page. */
export function useMachinePage(machineId: string, onUnpaired: () => void): MachinePage {
  const client = useMachineClient();
  const [alert, setAlert] = useState<MachinePage["alert"]>(null);
  const [restarting, setRestarting] = useState(false);
  const [failure, setFailure] = useState<RestartFailure | null>(null);
  // Taps can arrive before the next render; these see them at once.
  const underway = useRef(false);
  const unpaired = useRef(false);

  async function restartNow() {
    if (underway.current) return;
    underway.current = true;
    setRestarting(true);
    setFailure(null);
    const result = await client.restartCore(machineId);
    underway.current = false;
    setRestarting(false);
    if (result.kind === "failed") setFailure({ machineId });
  }

  return {
    alert,
    restarting,
    failure,
    connect: () => void client.connect(machineId),
    disconnect: () => client.disconnect(machineId),
    askRestart: () => setAlert("restart"),
    askUnpair: () => setAlert("unpair"),
    cancel: () => setAlert(null),
    restart: () => {
      setAlert(null);
      void restartNow();
    },
    unpair: () => {
      setAlert(null);
      if (unpaired.current) return;
      unpaired.current = true;
      client.unpair(machineId);
      onUnpaired();
    },
    retry: (answered) => {
      // A refusal that has since been replaced is out of date.
      if (answered === failure) void restartNow();
    },
    dismissFailure: (answered) => setFailure((shown) => (shown === answered ? null : shown)),
  };
}
