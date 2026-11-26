import { useCallback, useEffect, useRef, useState } from "react";

import { useMachineClient } from "@/shared/machines/client";

import type { PairingRequest } from "./flow";

/** Where a pairing is, as the Comparison Code step shows it. */
export type PairingView =
  /** Until the Machine answers with the Comparison Code. */
  | { kind: "reaching" }
  | { kind: "comparing"; code: string }
  | { kind: "paired" }
  | { kind: "declined" }
  | { kind: "unreachable" }
  /** This device has no room for another pairing; `unfinished` cancelled pairings hold some. */
  | { kind: "full"; unfinished: number };

/**
 * Pairs with the Machine of `request` while `showing`. Leaving the step, or covering it with
 * another, before the Machine answers ends the pairing, so a later approval pairs nothing. Shown
 * again, the step starts a new pairing. `end` ends it at once, for Cancel: the step may close only
 * after an approval arrives. `stopUnfinished` stops the unfinished pairings that fill this device,
 * once the person confirms it, then pairs again with the same link while the step still shows.
 */
export function usePairing(
  request: PairingRequest,
  showing: boolean,
): { view: PairingView; end: () => void; stopUnfinished: () => void } {
  const client = useMachineClient();
  // Each time the step shows is a round with a pairing of its own; a view is kept with its round.
  const [shown, setShown] = useState({ showing, round: 0 });
  if (showing !== shown.showing) {
    setShown({ showing, round: showing ? shown.round + 1 : shown.round });
  }
  const { round } = shown;
  const [answer, setAnswer] = useState<{ round: number; view: PairingView } | null>(null);
  const ending = useRef(() => {});

  useEffect(() => {
    if (!showing) return;
    const setView = (view: PairingView) => setAnswer({ round, view });
    let left = false;
    let cancel: (() => void) | undefined;
    // Ends a pairing that is still reaching the Machine, before there is a `cancel`.
    const leaving = new AbortController();
    void client
      .pair(request.link, request.networkAddress, {
        signal: leaving.signal,
      })
      .then((started) => {
        if (started.kind !== "comparing") {
          if (!left) setView(started);
          return;
        }
        if (left) {
          started.cancel();
          return;
        }
        cancel = started.cancel;
        setView({ kind: "comparing", code: started.code });
        void started.outcome.then((outcome) => {
          cancel = undefined;
          if (!left) setView(outcome.kind === "paired" ? { kind: "paired" } : outcome);
        });
      });
    const end = () => {
      left = true;
      leaving.abort();
      cancel?.();
      cancel = undefined;
    };
    ending.current = end;
    return end;
  }, [client, request, showing, round]);

  const end = useCallback(() => ending.current(), []);
  const latest = useRef(shown);
  useEffect(() => {
    latest.current = shown;
  }, [shown]);
  const stopping = useRef(false);
  const stopUnfinished = useCallback(() => {
    // A second tap can arrive before the step shows that it waits.
    if (stopping.current) return;
    stopping.current = true;
    const asked = latest.current.round;
    setAnswer({ round: asked, view: { kind: "reaching" } });
    // A pairing that did not stop still holds its room, which the next pairing reports.
    void client.stopUnfinishedPairings().then(() => {
      stopping.current = false;
      const now = latest.current;
      if (now.showing && now.round === asked) {
        setShown({ showing: true, round: asked + 1 });
      }
    });
  }, [client]);
  // Covered, the step keeps what it showed, as when it closes. Shown again, it waits for the new
  // pairing's code.
  return {
    view: answer?.round === round ? answer.view : { kind: "reaching" },
    end,
    stopUnfinished,
  };
}
