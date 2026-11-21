import arrowBackIcon from "@expo/material-symbols/arrow_back.xml";
import {
  Button,
  Column,
  Icon,
  IconButton,
  OutlinedTextField,
  Text,
  TextButton,
  TopAppBar,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";

import { heading } from "@/modules/compose-modifiers";
import { commandGuidance, inviteGuidance } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP } from "@/shared/ui/android/grouped";
import { GroupedRow } from "@/shared/ui/android/grouped-row";
import { ScreenHost } from "@/shared/ui/android/screen-host";

import { problemOf, type InvitationProblem } from "../flow";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { LinkStepProps } from "./screen";

/** The command in the error text, as the mockup sets it: 13 sp monospace, medium. */
const COMMAND_SIZE = 13;

export default function LinkStepScreen({
  link,
  fieldVersion,
  formVersion,
  reading,
  onEditLink,
  onPaste,
  onEditNetworkAddress,
  onJoin,
  onBack,
}: LinkStepProps) {
  const colors = useColors();
  const problem = problemOf(reading);
  // A link that cannot pair names no Machine; one already paired names the Machine it is for.
  const invitation = reading === null || reading.kind === "unusable" ? null : reading.invitation;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.background), imePadding()]}>
          <TopAppBar>
            <TopAppBar.NavigationIcon>
              <IconButton onClick={onBack}>
                <Icon source={arrowBackIcon} contentDescription={text.back} />
              </IconButton>
            </TopAppBar.NavigationIcon>
            <TopAppBar.Title>
              <Text
                maxLines={1}
                overflow="ellipsis"
                style={{ typography: "titleLarge" }}
                modifiers={[heading()]}
              >
                {text.title}
              </Text>
            </TopAppBar.Title>
            <TopAppBar.Actions>
              <Button
                onClick={() => onJoin?.()}
                enabled={onJoin !== undefined}
                modifiers={[padding(8, 0, 12, 0)]}
              >
                <Text>{text.join}</Text>
              </Button>
            </TopAppBar.Actions>
          </TopAppBar>

          <Column modifiers={[fillMaxWidth(), verticalScroll()]}>
            <LinkField
              key={`link-${fieldVersion}`}
              initial={link}
              problem={problem}
              onEdit={onEditLink}
              onPaste={onPaste}
            />
            {invitation !== null && (
              <Column
                verticalArrangement={{ spacedBy: GROUPED_GAP }}
                modifiers={[fillMaxWidth(), padding(16, 20, 16, 0)]}
              >
                <GroupedRow
                  first
                  last={false}
                  headline={text.machine}
                  supporting={invitation.machineName}
                />
                <GroupedRow
                  first={false}
                  last
                  headline={text.address}
                  supporting={invitation.address}
                />
              </Column>
            )}
            <NetworkAddressField key={`address-${formVersion}`} onEdit={onEditNetworkAddress} />
          </Column>
        </Column>
      </ScreenHost>
    </>
  );
}

/**
 * The link, hidden as a password is, with Paste at its end. A link that cannot pair turns the
 * field to the error color and says why under it.
 */
function LinkField({
  initial,
  problem,
  onEdit,
  onPaste,
}: {
  initial: string;
  problem: InvitationProblem | null;
  onEdit: (link: string) => void;
  onPaste: () => void;
}) {
  const field = useNativeState(initial);
  return (
    <OutlinedTextField
      value={field}
      singleLine
      visualTransformation="password"
      isError={problem !== null}
      onValueChange={onEdit}
      keyboardOptions={{
        capitalization: "none",
        autoCorrectEnabled: false,
        keyboardType: "password",
      }}
      modifiers={[fillMaxWidth(), padding(16, 12, 16, 0)]}
    >
      <OutlinedTextField.Label>
        <Text>{text.invitationLink}</Text>
      </OutlinedTextField.Label>
      <OutlinedTextField.TrailingIcon>
        <TextButton onClick={onPaste} modifiers={[padding(0, 0, 4, 0)]}>
          <Text>{text.paste}</Text>
        </TextButton>
      </OutlinedTextField.TrailingIcon>
      {problem !== null && (
        <OutlinedTextField.SupportingText>
          <ProblemText problem={problem} />
        </OutlinedTextField.SupportingText>
      )}
    </OutlinedTextField>
  );
}

/** Why the link cannot pair: for a link that cannot be used, also how to get a new one. */
function ProblemText({ problem }: { problem: InvitationProblem }) {
  if (problem.kind === "already-paired") {
    return <Text>{text.alreadyPaired(problem.invitation.machineName)}</Text>;
  }
  const [orRun, command, onMachine] = commandGuidance;
  return (
    <Column verticalArrangement={{ spacedBy: 4 }}>
      <Text>{text.unusable}</Text>
      <Text>{inviteGuidance.join("")}</Text>
      <Text>
        {orRun}
        <Text style={{ fontFamily: "monospace", fontSize: COMMAND_SIZE, fontWeight: "500" }}>
          {command}
        </Text>
        {onMachine}
      </Text>
    </Column>
  );
}

/** A host name or IP address: no capitals, no corrections, the URL keyboard. */
function NetworkAddressField({ onEdit }: { onEdit: (address: string) => void }) {
  const field = useNativeState("");
  return (
    <OutlinedTextField
      value={field}
      singleLine
      onValueChange={onEdit}
      keyboardOptions={{ capitalization: "none", autoCorrectEnabled: false, keyboardType: "uri" }}
      modifiers={[fillMaxWidth(), padding(16, 20, 16, 16)]}
    >
      <OutlinedTextField.Label>
        <Text>{text.networkAddress}</Text>
      </OutlinedTextField.Label>
      <OutlinedTextField.SupportingText>
        <Text>{text.networkAddressFooter}</Text>
      </OutlinedTextField.SupportingText>
    </OutlinedTextField>
  );
}

LinkStepScreen satisfies typeof ScreenContract;
