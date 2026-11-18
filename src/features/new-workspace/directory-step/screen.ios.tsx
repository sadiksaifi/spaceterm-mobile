import { Host } from "@expo/ui";
import {
  Alert,
  Button,
  HStack,
  Image,
  List,
  ProgressView,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  autocorrectionDisabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  lineLimit,
  listRowBackground,
  listStyle,
  onSubmit,
  padding,
  submitLabel,
  textCase,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import type { ComponentProps } from "react";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { SectionHeader } from "@/shared/ui/ios/section-header";
import { ActionButton, StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";

import type { PickerView } from "../picker";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { DirectoryStepProps } from "./screen";

const tertiary = foregroundStyle({ type: "hierarchical", style: "tertiary" });
/** A state sits below the rows, this far down. */
const STATE_TOP = 72;
const FILL = Number.POSITIVE_INFINITY;

export default function DirectoryStepScreen({
  machineName,
  picker,
  leading,
  onLeave,
}: DirectoryStepProps) {
  const colors = useColors();
  const { view, askingCreate, failure } = picker;

  return (
    <>
      <Stack.Screen.Title>{text.openDirectory}</Stack.Screen.Title>
      {/* Back is the system's own; Cancel takes its place where the flow opened on this step. */}
      {leading === "cancel" && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.cancel} onPress={onLeave} />
        </Stack.Toolbar>
      )}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          variant="prominent"
          accessibilityLabel={text.open}
          disabled={!view.canOpen}
          onPress={picker.open}
        />
      </Stack.Toolbar>

      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <Alert
          title={failure ? text.failedTitle(failure.directory) : ""}
          isPresented={failure !== null}
          onIsPresentedChange={(shown) => !shown && failure !== null && picker.cancel()}
        >
          <Alert.Trigger>
            <Alert
              title={text.createTitle}
              isPresented={askingCreate !== null}
              onIsPresentedChange={(shown) => !shown && askingCreate !== null && picker.cancel()}
            >
              <Alert.Trigger>
                <List modifiers={[listStyle("insetGrouped")]}>
                  <Section header={<SectionHeader>{text.directoryOn(machineName)}</SectionHeader>}>
                    <PathField
                      key={picker.fieldVersion}
                      label={text.directoryOn(machineName)}
                      initial={view.field}
                      onEdit={picker.edit}
                      onSubmit={picker.open}
                    />
                  </Section>
                  {view.parent !== null || view.content.kind === "directories" ? (
                    <Section>
                      {view.parent !== null && (
                        <DirectoryRow
                          label={text.parentDirectory}
                          symbol="arrow.turn.left.up"
                          onPress={() => view.parent !== null && picker.navigate(view.parent)}
                        />
                      )}
                      {view.content.kind === "directories" &&
                        view.content.directories.map((directory) => (
                          <DirectoryRow
                            key={directory.path}
                            label={directory.name}
                            symbol="folder"
                            tinted
                            onPress={() => picker.navigate(directory.path)}
                          />
                        ))}
                    </Section>
                  ) : null}
                  <ContentState content={view.content} onRetry={picker.navigate} />
                </List>
              </Alert.Trigger>
              <Alert.Actions>
                <Button label={text.cancel} role="cancel" onPress={picker.cancel} />
                <Button label={text.create} onPress={picker.create} />
              </Alert.Actions>
              {askingCreate !== null && (
                <Alert.Message>
                  <Text>{text.createBody(askingCreate, machineName).join("")}</Text>
                </Alert.Message>
              )}
            </Alert>
          </Alert.Trigger>
          <Alert.Actions>
            <Button label={text.cancel} role="cancel" onPress={picker.cancel} />
            <Button
              label={text.tryAgain}
              onPress={() => failure !== null && picker.retry(failure)}
            />
          </Alert.Actions>
        </Alert>
      </Host>
    </>
  );
}

/** The path of the directory to open. Return opens it, as the checkmark does. */
function PathField({
  label,
  initial,
  onEdit,
  onSubmit: submit,
}: {
  label: string;
  initial: string;
  onEdit: (field: string) => void;
  onSubmit: () => void;
}) {
  const field = useNativeState(initial);
  return (
    <TextField
      text={field}
      placeholder={label}
      onTextChange={onEdit}
      modifiers={[
        textInputAutocapitalization("never"),
        autocorrectionDisabled(),
        keyboardType("url"),
        submitLabel("go"),
        onSubmit(submit),
      ]}
    />
  );
}

/** Parent Directory, or a directory: a folder in the tint color, with a chevron. */
function DirectoryRow({
  label,
  symbol,
  tinted = false,
  onPress,
}: {
  label: string;
  symbol: ComponentProps<typeof Image>["systemName"];
  tinted?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Button onPress={onPress}>
      <HStack spacing={12} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <Image
          systemName={symbol}
          modifiers={[
            frame({ width: 24 }),
            tinted ? foregroundStyle({ type: "color", color: colors.tint }) : secondary,
            accessibilityHidden(),
          ]}
        />
        <Text modifiers={[lineLimit(1)]}>{label}</Text>
        <Spacer />
        {tinted && (
          <Image
            systemName="chevron.forward"
            modifiers={[
              font({ textStyle: "footnote", weight: "semibold" }),
              tertiary,
              accessibilityHidden(),
            ]}
          />
        )}
      </HStack>
    </Button>
  );
}

/** What shows below the rows while a directory loads, has no subdirectories, or cannot be listed. */
function ContentState({
  content,
  onRetry,
}: {
  content: PickerView["content"];
  onRetry: (path: string) => void;
}) {
  if (content.kind === "directories") return null;
  return (
    <Section>
      <VStack
        spacing={0}
        modifiers={[
          frame({ maxWidth: FILL }),
          padding({ top: STATE_TOP }),
          listRowBackground("clear"),
        ]}
      >
        {content.kind === "loading" ? (
          <VStack spacing={8} modifiers={[secondary]}>
            <ProgressView />
            <Text modifiers={[textCase("uppercase"), font({ textStyle: "caption" })]}>
              {text.loading}
            </Text>
          </VStack>
        ) : content.kind === "empty" ? (
          <>
            <StateIcon systemName="folder" />
            <StateTitle>{text.noSubdirectories}</StateTitle>
          </>
        ) : (
          <>
            <StateIcon systemName="exclamationmark.triangle" />
            <StateTitle>{text.cannotList}</StateTitle>
            <StateBody>{text.cannotListBody}</StateBody>
            <VStack modifiers={[padding({ top: 20 })]}>
              <ActionButton
                label={text.tryAgain}
                onPress={() => onRetry(content.retryPath)}
                prominent
              />
            </VStack>
          </>
        )}
      </VStack>
    </Section>
  );
}

DirectoryStepScreen satisfies typeof ScreenContract;
