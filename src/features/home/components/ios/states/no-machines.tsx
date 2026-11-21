import { Button, Text } from "@expo/ui/swift-ui";
import { buttonStyle, font, frame, multilineTextAlignment } from "@expo/ui/swift-ui/modifiers";

import { useColors } from "@/shared/theme/colors";
import {
  ACTION_HEIGHT,
  ActionButton,
  StateBody,
  StateIcon,
  StateTitle,
} from "@/shared/ui/ios/state";
import { useLargeText } from "@/shared/ui/large-text";

import type { HomeActions } from "../../../actions";
import { text } from "../../../text";
import { Centered, commandText, nameText, StateActions } from "./layout";

/** The space between the sentence's two paragraphs. */
const PARAGRAPH_GAP = 12;

export function NoMachines({ actions }: { actions: HomeActions }) {
  const colors = useColors();
  const largeText = useLargeText();
  const [choose, invite, inDesktop, machines, settings] = text.noMachinesInvite;
  const [orRun, command, onMachine] = text.noMachinesCommand;

  return (
    <Centered>
      <StateIcon systemName="desktopcomputer" />
      <StateTitle>{text.noMachines}</StateTitle>
      <StateBody>
        {choose}
        {nameText(invite, colors.text)}
        {inDesktop}
        {nameText(machines, colors.text)}
        {settings}
      </StateBody>
      <StateBody top={PARAGRAPH_GAP}>
        {orRun}
        {commandText(command, colors.text)}
        {onMachine}
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
