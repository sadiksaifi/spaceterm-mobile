import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import { Button, FilledTonalButton, Text, TextButton } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import { useColors } from "@/shared/theme/colors";

import type { HomeActions } from "../../../actions";
import { text } from "../../../text";
import { Centered, StateActions, StateBody, StateTile, StateTitle } from "./layout";

/** The command in the sentence, as the mockup sets it: 13 sp monospace, medium, in the text color. */
const COMMAND_SIZE = 13;

export function NoMachines({ actions, bottom }: { actions: HomeActions; bottom: number }) {
  const colors = useColors();
  const [before, command, after] = text.noMachinesBody;

  return (
    <Centered bottom={bottom}>
      <StateTile icon={machineIcon} />
      <StateTitle>{text.noMachines}</StateTitle>
      <StateBody>
        {before}
        <Text
          style={{ fontFamily: "monospace", fontSize: COMMAND_SIZE, fontWeight: "500" }}
          color={colors.text}
        >
          {command}
        </Text>
        {after}
      </StateBody>
      <StateActions>
        <Button onClick={actions.onScanQrCode} enabled={!!actions.onScanQrCode}>
          <Text>{text.scanQrCode}</Text>
        </Button>
        <FilledTonalButton
          onClick={actions.onPasteInvitationLink}
          enabled={!!actions.onPasteInvitationLink}
        >
          <Text>{text.pasteInvitationLink}</Text>
        </FilledTonalButton>
        <TextButton onClick={actions.onGetDesktop} modifiers={[padding(0, 4, 0, 0)]}>
          <Text>{text.getDesktop}</Text>
        </TextButton>
      </StateActions>
    </Centered>
  );
}
