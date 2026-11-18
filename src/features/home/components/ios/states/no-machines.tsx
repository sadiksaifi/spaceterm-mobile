import { Button, Text } from "@expo/ui/swift-ui";
import { buttonStyle, font, frame, multilineTextAlignment } from "@expo/ui/swift-ui/modifiers";

import { useColors } from "@/shared/theme/colors";
import {
  ACTION_HEIGHT,
  ActionButton,
  Centered,
  commandText,
  StateActions,
  StateBody,
  StateIcon,
  StateTitle,
} from "@/shared/ui/ios/state";
import { useLargeText } from "@/shared/ui/large-text";

import type { HomeActions } from "../../../actions";
import { text } from "../../../text";

export function NoMachines({ actions }: { actions: HomeActions }) {
  const colors = useColors();
  const largeText = useLargeText();
  const [before, command, after] = text.noMachinesBody;

  return (
    <Centered>
      <StateIcon systemName="desktopcomputer" />
      <StateTitle>{text.noMachines}</StateTitle>
      <StateBody>
        {before}
        {commandText(command, colors.text)}
        {after}
      </StateBody>
      <StateActions>
        <ActionButton label={text.scanQrCode} onPress={actions.onScanQrCode} prominent />
        <ActionButton label={text.pasteInvitationLink} onPress={actions.onPasteInvitationLink} />
        <Button
          onPress={actions.onGetDesktop}
          modifiers={[
            buttonStyle("borderless"),
            largeText ? frame({ minHeight: ACTION_HEIGHT }) : frame({ height: ACTION_HEIGHT }),
          ]}
        >
          <Text modifiers={[font({ textStyle: "subheadline" }), multilineTextAlignment("center")]}>
            {text.getDesktop}
          </Text>
        </Button>
      </StateActions>
    </Centered>
  );
}
