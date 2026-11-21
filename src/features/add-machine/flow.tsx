import { useNavigation, useRouter, type Href } from "expo-router";
import { getStringAsync } from "expo-clipboard";
import { createContext, use, useState, type ReactNode } from "react";

import { invitationLinkIn } from "@/shared/machines/invitation";
import type { InvitationReading } from "@/shared/machines/model";

/** What the Comparison Code step pairs with: the link, and the name it shows for the Machine. */
export type PairingRequest = { link: string; machineName: string; networkAddress: string | null };

/** Why an Invitation Link cannot pair, as the person is told. */
export type InvitationProblem = Exclude<InvitationReading, { kind: "invitation" }>;

/** The problem a reading has, or `null` when the link can pair. */
export function problemOf(reading: InvitationReading | null): InvitationProblem | null {
  return reading === null || reading.kind === "invitation" ? null : reading;
}

/** The Invitation Link step, with `link` in its field, or empty. The camera step is under it. */
export function linkStepHref(link: string | null): Href {
  // Each delivery is new, so the step resets even for the same link again.
  const delivery = String(Date.now());
  return {
    pathname: "/add-machine/link",
    params: link === null ? { delivery } : { link, delivery },
  };
}

/**
 * The Invitation Link on the clipboard. `null` when the clipboard holds something else, or when
 * the person refuses the iOS paste prompt.
 */
export async function pastedInvitationLink(): Promise<string | null> {
  try {
    return invitationLinkIn(await getStringAsync());
  } catch {
    return null;
  }
}

type FlowState = {
  request: PairingRequest | null;
  setRequest: (request: PairingRequest) => void;
};

const FlowContext = createContext<FlowState | null>(null);

/** Holds the pairing the Comparison Code step starts, for as long as the flow shows. */
export function AddMachineFlowProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PairingRequest | null>(null);
  return <FlowContext value={{ request, setRequest }}>{children}</FlowContext>;
}

/** The moves between the steps of Add Machine. */
export function useAddMachineFlow() {
  const flow = use(FlowContext);
  if (flow === null) throw new Error("useAddMachineFlow needs an AddMachineFlowProvider");
  const router = useRouter();
  const navigation = useNavigation();
  return {
    request: flow.request,
    /** Opens the Comparison Code step, which pairs with `request`. */
    startPairing: (request: PairingRequest) => {
      flow.setRequest(request);
      // Navigate, not push: a second tap before the step shows must not stack it twice.
      router.navigate("/add-machine/code");
    },
    /** Returns to the camera, the first step. */
    restart: () => router.dismissTo("/add-machine"),
    /**
     * Makes the camera the one step under the step that shows, so Back and the iOS swipe both go to
     * it: under the Invitation Link step where the flow opened there, and under a failed pairing.
     */
    cameraBeneath: () => {
      const state = navigation.getState();
      const current = state?.routes[state.index];
      if (state === undefined || current === undefined || current.name === "index") return;
      const camera = state.routes.find((route) => route.name === "index") ?? { name: "index" };
      if (state.routes.length === 2 && state.routes[0] === camera) return;
      // A route without a key is a new one, which the stack names; the step that shows stays as it is.
      navigation.dispatch({
        type: "RESET",
        payload: { ...state, index: 1, routes: [camera, current] },
      });
    },
    /** Closes the flow, back to the screen it was opened from. */
    close: () => navigation.getParent()?.goBack(),
  };
}
