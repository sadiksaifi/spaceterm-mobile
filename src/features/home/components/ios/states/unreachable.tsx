import { ProgressView } from "@expo/ui/swift-ui";
import { controlSize, padding } from "@expo/ui/swift-ui/modifiers";

import { machineSettingsAction, type HomeActions } from "../../../actions";
import type { HomeView } from "../../../model";
import { text, unreachableText } from "../../../text";
import { secondary } from "../modifiers";
import { ActionButton, Centered, StateActions, StateBody, StateIcon, StateTitle } from "./layout";

export function Unreachable({
  view,
  actions,
}: {
  view: Extract<HomeView, { kind: "unreachable" }>;
  actions: HomeActions;
}) {
  const { title, body } = unreachableText(view.state, view.machine?.name ?? null);
  const reconnecting = view.state === "reconnecting";

  return (
    <Centered>
      {reconnecting ? (
        <ProgressView modifiers={[controlSize("large"), secondary, padding({ bottom: 16 })]} />
      ) : (
        <StateIcon systemName="desktopcomputer.trianglebadge.exclamationmark" />
      )}
      <StateTitle>{title}</StateTitle>
      {body !== undefined && <StateBody>{body}</StateBody>}
      <StateActions top={reconnecting ? 24 : 20}>
        {!reconnecting && (
          <ActionButton label={text.tryAgain} onPress={actions.onTryAgain} prominent />
        )}
        <ActionButton
          label={text.machineSettings}
          onPress={machineSettingsAction(view.machine, actions)}
        />
      </StateActions>
    </Centered>
  );
}
