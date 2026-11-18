import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import { Button, LoadingIndicator, Text, TextButton } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import {
  Centered,
  StateActions,
  StateBody,
  StateTile,
  StateTitle,
} from "@/shared/ui/android/state";

import { unreachableControls, type HomeActions } from "../../../actions";
import type { HomeView } from "../../../model";
import { text, unreachableText } from "../../../text";

export function Unreachable({
  view,
  actions,
  bottom,
}: {
  view: Extract<HomeView, { kind: "unreachable" }>;
  actions: HomeActions;
  bottom: number;
}) {
  const { title, body } = unreachableText(view.state, view.machine?.name ?? null);
  const reconnecting = view.state === "reconnecting";
  const { tryAgain, machineSettings } = unreachableControls(view, actions);

  return (
    <Centered bottom={bottom}>
      {reconnecting ? (
        // The title under it says what the shape means, and screen readers read it.
        <LoadingIndicator modifiers={[padding(0, 0, 0, 20)]} />
      ) : (
        <StateTile icon={notConnectedIcon} failed={view.state === "still-not-connected"} />
      )}
      <StateTitle>{title}</StateTitle>
      {body !== undefined && <StateBody>{body}</StateBody>}
      <StateActions>
        {tryAgain && (
          <Button onClick={tryAgain.onPress} enabled={!!tryAgain.onPress}>
            <Text>{text.tryAgain}</Text>
          </Button>
        )}
        <TextButton onClick={machineSettings.onPress} enabled={!!machineSettings.onPress}>
          <Text>{text.machineSettings}</Text>
        </TextButton>
      </StateActions>
    </Centered>
  );
}
