import { useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Whether the camera step can show the camera: `asking` until the person answers. */
export type CameraAccess = "asking" | "allowed" | "off";

/**
 * Asks for the camera the first time the step shows, while it is `focused`. The answer is checked
 * again whenever the app comes to the front, so access allowed in Settings shows the camera.
 */
export function useCameraAccess(focused: boolean): CameraAccess {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const asked = useRef(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!focused || permission === null || permission.granted || !permission.canAskAgain) return;
    if (asked.current) return;
    asked.current = true;
    void requestPermission().finally(() => setAnswered(true));
  }, [focused, permission, requestPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  if (permission === null) return "asking";
  if (permission.granted) return "allowed";
  return answered || !permission.canAskAgain ? "off" : "asking";
}
