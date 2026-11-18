import { LoadingIndicator } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";

import { text } from "../../../text";
import { Centered } from "./layout";

export function Loading({ bottom }: { bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <LoadingIndicator modifiers={[semantics({ contentDescription: text.loading })]} />
    </Centered>
  );
}
