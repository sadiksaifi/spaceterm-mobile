import { ProgressView } from "@expo/ui/swift-ui";
import { accessibilityLabel, controlSize, padding } from "@expo/ui/swift-ui/modifiers";

import { unreachableControls, type HomeActions } from "../../../actions";
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
  const { tryAgain, machineSettings } = unreachableControls(view, actions);

  return (
    <Centered>
      {reconnecting ? (
        <ProgressView
          modifiers={[
            controlSize("large"),
            secondary,
            padding({ bottom: 16 }),
            accessibilityLabel(text.loading),
          ]}
        />
      ) : (
        <StateIcon systemName="desktopcomputer.trianglebadge.exclamationmark" />
      )}
      <StateTitle>{title}</StateTitle>
      {body !== undefined && <StateBody>{body}</StateBody>}
      <StateActions top={reconnecting ? 24 : 20}>
        {tryAgain && <ActionButton label={text.tryAgain} onPress={tryAgain.onPress} prominent />}
        <ActionButton label={text.machineSettings} onPress={machineSettings.onPress} />
      </StateActions>
    </Centered>
  );
}
