import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import { FAKE_SCAN, useMachineClient } from "@/shared/machines/client";

import {
  linkStepHref,
  pastedInvitationLink,
  problemOf,
  useAddMachineFlow,
  type InvitationProblem,
} from "../flow";
import CameraStepScreen from "./screen";
import { useCameraAccess } from "./use-camera-access";

/**
 * The first step: scan the QR code that Invite Device or `spaceterm pair` shows, or paste its
 * Invitation Link. A code that can pair goes straight to the Comparison Code.
 */
export default function CameraStepRoute() {
  const client = useMachineClient();
  const flow = useAddMachineFlow();
  const router = useRouter();
  const focused = useIsFocused();
  const access = useCameraAccess(focused);
  const [problem, setProblem] = useState<InvitationProblem | null>(null);
  // The camera reads a code many times a second while it is in view. One read is acted on until
  // the step shows again, and a code that cannot pair is not read again until another one is.
  const acting = useRef(false);
  const refused = useRef<string | null>(null);
  useEffect(() => {
    if (focused) acting.current = false;
  }, [focused]);

  const fakeScan = FAKE_SCAN;
  const scan = (data: string) => {
    if (acting.current || data === refused.current) return;
    acting.current = true;
    const reading = client.readInvitation(data);
    if (reading.kind === "invitation") {
      refused.current = null;
      flow.startPairing({
        link: data,
        machineName: reading.invitation.machineName,
        networkAddress: null,
      });
      return;
    }
    refused.current = data;
    // iOS says why over the camera; Android shows it under the Invitation Link field.
    if (process.env.EXPO_OS === "ios") setProblem(problemOf(reading));
    else router.navigate(linkStepHref(data));
  };

  return (
    <CameraStepScreen
      access={access}
      scanning={focused && access === "allowed"}
      onScan={scan}
      onFakeScan={
        fakeScan === null
          ? undefined
          : () => {
              // Each tap is a new scan, even of a code that could not pair.
              refused.current = null;
              scan(fakeScan);
            }
      }
      problem={problem}
      onDismissProblem={() => {
        setProblem(null);
        acting.current = false;
      }}
      onOpenSettings={() => void Linking.openSettings()}
      onPaste={() =>
        void pastedInvitationLink().then((link) => router.navigate(linkStepHref(link)))
      }
      onCancel={flow.close}
    />
  );
}
