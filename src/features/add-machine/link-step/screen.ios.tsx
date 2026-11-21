import { Host } from "@expo/ui";
import {
  Button,
  HStack,
  LabeledContent,
  List,
  SecureField,
  Section,
  Text,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  foregroundStyle,
  keyboardType,
  listStyle,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";

import { useColors } from "@/shared/theme/colors";
import { SectionHeader } from "@/shared/ui/ios/section-header";

import { ProblemAlert } from "../components/ios/problem-alert";
import { problemOf } from "../flow";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { LinkStepProps } from "./screen";

export default function LinkStepScreen({
  link,
  fieldVersion,
  formVersion,
  typed,
  reading,
  onEditLink,
  onPaste,
  onDismissProblem,
  onEditNetworkAddress,
  onJoin,
}: LinkStepProps) {
  const colors = useColors();
  // A link that cannot pair names no Machine; one already paired names the Machine it is for.
  const invitation = reading === null || reading.kind === "unusable" ? null : reading.invitation;
  const problem = problemOf(reading);

  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          variant="prominent"
          accessibilityLabel={text.join}
          disabled={onJoin === undefined}
          onPress={() => onJoin?.()}
        />
      </Stack.Toolbar>
      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <ProblemAlert problem={typed ? null : problem} onDismiss={onDismissProblem}>
          <List modifiers={[listStyle("insetGrouped")]}>
            <Section
              header={<SectionHeader>{text.invitationLink}</SectionHeader>}
              // Typed text says what is wrong here, so typing can go on; an alert would interrupt it.
              footer={
                typed && problem !== null ? (
                  <Text modifiers={[foregroundStyle(colors.error)]}>
                    {problem.kind === "unusable"
                      ? text.unusable
                      : text.alreadyPaired(problem.invitation.machineName)}
                  </Text>
                ) : undefined
              }
            >
              <HStack spacing={8}>
                <LinkField key={`link-${fieldVersion}`} initial={link} onEdit={onEditLink} />
                <Button
                  label={text.paste}
                  onPress={onPaste}
                  modifiers={[buttonStyle("borderless")]}
                />
              </HStack>
            </Section>
            {invitation !== null && (
              <Section>
                <LabeledContent label={text.machine}>
                  <Text>{invitation.machineName}</Text>
                </LabeledContent>
                <LabeledContent label={text.address}>
                  <Text>{invitation.address}</Text>
                </LabeledContent>
              </Section>
            )}
            <Section
              header={<SectionHeader>{text.networkAddress}</SectionHeader>}
              footer={<Text>{text.networkAddressFooter}</Text>}
            >
              <NetworkAddressField key={`address-${formVersion}`} onEdit={onEditNetworkAddress} />
            </Section>
          </List>
        </ProblemAlert>
      </Host>
    </>
  );
}

/** The link, hidden as a password is. Paste fills it; the system paste menu works too. */
function LinkField({ initial, onEdit }: { initial: string; onEdit: (link: string) => void }) {
  const field = useNativeState(initial);
  return (
    <SecureField
      text={field}
      onTextChange={onEdit}
      modifiers={[accessibilityLabel(text.invitationLink)]}
    />
  );
}

/** A host name or IP address: no capitals, no corrections, the URL keyboard. */
function NetworkAddressField({ onEdit }: { onEdit: (address: string) => void }) {
  const field = useNativeState("");
  return (
    <TextField
      text={field}
      onTextChange={onEdit}
      modifiers={[
        accessibilityLabel(text.networkAddress),
        textInputAutocapitalization("never"),
        autocorrectionDisabled(),
        keyboardType("url"),
      ]}
    />
  );
}

LinkStepScreen satisfies typeof ScreenContract;
