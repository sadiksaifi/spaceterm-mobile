import { LoadingIndicator } from "@expo/ui/jetpack-compose";

import { Centered, StateBody } from "@/shared/ui/android/state";

import { text } from "../../../text";

export function Loading({ bottom }: { bottom: number }) {
  return (
    <Centered bottom={bottom}>
      {/* The word says what the shape means, as on iOS; screen readers read it too. */}
      <LoadingIndicator />
      <StateBody>{text.loading}</StateBody>
    </Centered>
  );
}
