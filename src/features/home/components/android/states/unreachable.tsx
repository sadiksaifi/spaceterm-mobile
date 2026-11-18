import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import { Button, LoadingIndicator, Text, TextButton } from "@expo/ui/jetpack-compose";
import { padding, semantics } from "@expo/ui/jetpack-compose/modifiers";

import { machineSettingsAction, type HomeActions } from "../../../actions";
import type { HomeView } from "../../../model";
import { text, unreachableText } from "../../../text";
import { Centered, StateActions, StateBody, StateTile, StateTitle } from "./layout";

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
  const onMachineSettings = machineSettingsAction(view.machine, actions);

  return (
    <Centered bottom={bottom}>
      {reconnecting ? (
        <LoadingIndicator
          modifiers={[semantics({ contentDescription: text.loading }), padding(0, 0, 0, 20)]}
        />
      ) : (
        <StateTile icon={notConnectedIcon} failed={view.state === "still-not-connected"} />
      )}
      <StateTitle>{title}</StateTitle>
      {body !== undefined && <StateBody>{body}</StateBody>}
      <StateActions>
        {!reconnecting && (
          <Button onClick={actions.onTryAgain} enabled={!!actions.onTryAgain}>
            <Text>{text.tryAgain}</Text>
          </Button>
        )}
        <TextButton onClick={onMachineSettings} enabled={!!onMachineSettings}>
          <Text>{text.machineSettings}</Text>
        </TextButton>
      </StateActions>
    </Centered>
  );
}
