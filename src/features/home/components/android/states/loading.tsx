import { LoadingIndicator } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";

import { Centered } from "@/shared/ui/android/state";

import { text } from "../../../text";

export function Loading({ bottom }: { bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <LoadingIndicator modifiers={[semantics({ contentDescription: text.loading })]} />
    </Centered>
  );
}
