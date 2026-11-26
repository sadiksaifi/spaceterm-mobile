import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

import { useAddMachineFlow, type PairingRequest } from "../flow";
import { usePairing } from "../use-pairing";
import CodeStepScreen from "./screen";

/** The Comparison Code, while the Machine waits for approval, and how the pairing ends. */
export default function CodeStepRoute() {
  const flow = useAddMachineFlow();
  // A link can open this step without a pairing to show; the flow then closes.
  const { request, close } = flow;
  useEffect(() => {
    if (request === null) close();
  }, [request, close]);
  if (request === null) return null;
  return <Pairing request={request} />;
}

function Pairing({ request }: { request: PairingRequest }) {
  const flow = useAddMachineFlow();
  const router = useRouter();
  // A link from another app can open the Invitation Link step over this one.
  const { view: pairing, end, stopUnfinished } = usePairing(request, useIsFocused());
  const { kind } = pairing;
  const { cameraBeneath, close } = flow;

  // After a failed pairing, Back and the iOS swipe go to the camera, not the step before.
  const failed = kind === "declined" || kind === "unreachable" || kind === "full";
  useEffect(() => {
    if (failed) cameraBeneath();
  }, [failed, cameraBeneath]);

  // Paired leaves only by Done, which Android's system Back stands for.
  useFocusEffect(
    useCallback(() => {
      if (kind !== "paired") return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [kind, close]),
  );

  return (
    <CodeStepScreen
      machineName={request.machineName}
      pairing={pairing}
      onBack={() => {
        end();
        router.back();
      }}
      onTryAgain={flow.restart}
      onStopUnfinished={stopUnfinished}
      onClose={() => {
        end();
        close();
      }}
    />
  );
}
