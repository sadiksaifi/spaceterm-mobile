import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import { Button, FilledTonalButton, Text, TextButton } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import { useColors } from "@/shared/theme/colors";
import {
  Centered,
  StateActions,
  StateBody,
  StateTile,
  StateTitle,
} from "@/shared/ui/android/state";

import type { HomeActions } from "../../../actions";
import { text } from "../../../text";

/** The command in the sentence, as the mockup sets it: 13 sp monospace, medium, in the text color. */
const COMMAND_SIZE = 13;
/** The space between the sentence's two paragraphs. */
const PARAGRAPH_GAP = 12;

export function NoMachines({ actions, bottom }: { actions: HomeActions; bottom: number }) {
  const colors = useColors();
  const [choose, invite, inDesktop, machines, settings] = text.noMachinesInvite;
  const [orRun, command, onMachine] = text.noMachinesCommand;
  const name = (value: string) => (
    <Text style={{ fontWeight: "600" }} color={colors.text}>
      {value}
    </Text>
  );

  return (
    <Centered bottom={bottom}>
      <StateTile icon={machineIcon} />
      <StateTitle>{text.noMachines}</StateTitle>
      <StateBody>
        {choose}
        {name(invite)}
        {inDesktop}
        {name(machines)}
        {settings}
      </StateBody>
      <StateBody top={PARAGRAPH_GAP}>
        {orRun}
        <Text
          style={{ fontFamily: "monospace", fontSize: COMMAND_SIZE, fontWeight: "500" }}
          color={colors.text}
        >
          {command}
        </Text>
        {onMachine}
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
