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
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  lineLimit,
  listRowBackground,
  listStyle,
  onGeometryChange,
  onSubmit,
  padding,
  submitLabel,
  textCase,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useImperativeHandle, useRef, useState, type ComponentProps, type Ref } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { ActionButton, StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";
import { useLargeText } from "@/shared/ui/large-text";

import { SectionHeader } from "../components/ios/section-header";
import type { PickerView } from "../picker";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { DirectoryStepProps } from "./screen";

const tertiary = foregroundStyle({ type: "hierarchical", style: "tertiary" });
/** Space above a state until its place on screen is known. */
const STATE_TOP = 72;
/**
 * Each state centers in the space below the rows, clear of the sheet's bottom edge by the
 * mockup's margin: less for the small loading state.
 */
const STATE_BOTTOM = { loading: 60, empty: 80, unavailable: 80 } as const;
/** The column a row's symbol sits in at the default text size; it grows with the text. */
const SYMBOL_WIDTH = 24;
const FILL = Number.POSITIVE_INFINITY;

export default function DirectoryStepScreen({
  machineName,
  picker,
  leading,
  onLeave,
}: DirectoryStepProps) {
  const colors = useColors();
  const { view, askingCreate, failure } = picker;
  // Where the list ends on screen, so a state can fill the space below the rows.
  const [listBottom, setListBottom] = useState<number | null>(null);
  const field = useRef<FieldText>(null);

  return (
    <>
      <Stack.Screen.Title>{text.openDirectory}</Stack.Screen.Title>
      {/* Back is the system's own; Cancel takes its place where the flow opened on this step. */}
      {leading === "cancel" && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.cancel} onPress={onLeave} />
        </Stack.Toolbar>
      )}
      {/* The system spinner stands in for the checkmark until the Machine answers. */}
      <Stack.Toolbar placement="right">
        {view.opening ? (
          <Stack.Toolbar.View>
            {/* The indicator reads as "In progress"; the view around it says what is. */}
            <View accessible accessibilityLabel={text.opening}>
              <ActivityIndicator />
            </View>
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button
            icon="checkmark"
            variant="prominent"
            accessibilityLabel={text.open}
            disabled={!view.canOpen}
            onPress={() => picker.open(field.current?.text())}
          />
        )}
      </Stack.Toolbar>

      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <Alert
          title={failure ? text.failedTitle(failure.directory) : ""}
          isPresented={failure !== null}
          onIsPresentedChange={(shown) =>
            !shown && failure !== null && picker.dismissFailure(failure)
          }
        >
          <Alert.Trigger>
            <Alert
              title={text.createTitle}
              isPresented={askingCreate !== null}
              onIsPresentedChange={(shown) => !shown && askingCreate !== null && picker.cancel()}
            >
              <Alert.Trigger>
                <List
                  modifiers={[
                    listStyle("insetGrouped"),
                    onGeometryChange((list) => setListBottom(list.y + list.height)),
                  ]}
                >
                  <Section header={<SectionHeader>{text.directoryOn(machineName)}</SectionHeader>}>
                    <PathField
                      ref={field}
                      key={picker.fieldVersion}
                      label={text.directoryOn(machineName)}
                      initial={view.field}
                      enabled={!view.opening}
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
                          enabled={!view.opening}
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
                            enabled={!view.opening}
                            onPress={() => picker.navigate(directory.path)}
                          />
                        ))}
                    </Section>
                  ) : null}
                  <ContentState
                    key={view.content.kind}
                    content={view.content}
                    listBottom={listBottom}
                    onRetry={view.opening ? undefined : picker.navigate}
                  />
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
            <Button
              label={text.cancel}
              role="cancel"
              onPress={() => failure !== null && picker.dismissFailure(failure)}
            />
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

/** The text a path field shows now, which can be ahead of the last keystroke's event. */
type FieldText = { text: () => string };

/**
 * The path of the directory to open. Return opens it, as the checkmark does, with the text it
 * shows. The keyboard has a space bar, which the URL keyboard lacks, as paths such as
 * `~/Library/Application Support` need.
 */
function PathField({
  ref,
  label,
  initial,
  enabled,
  onEdit,
  onSubmit: submit,
}: {
  ref: Ref<FieldText>;
  label: string;
  initial: string;
  enabled: boolean;
  onEdit: (field: string) => void;
  onSubmit: (submitted: string) => void;
}) {
  const field = useNativeState(initial);
  useImperativeHandle(ref, () => ({ text: () => field.get() }), [field]);
  return (
    <TextField
      text={field}
      placeholder={label}
      onTextChange={onEdit}
      modifiers={[
        textInputAutocapitalization("never"),
        autocorrectionDisabled(),
        keyboardType("ascii-capable"),
        submitLabel("go"),
        onSubmit(() => submit(field.get())),
        disabled(!enabled),
      ]}
    />
  );
}

/**
 * Parent Directory, or a directory: a folder in the tint color, with a chevron. The name keeps to
 * one line; at an accessibility size it wraps, so sibling names that start alike stay apart.
 */
function DirectoryRow({
  label,
  symbol,
  tinted = false,
  enabled,
  onPress,
}: {
  label: string;
  symbol: ComponentProps<typeof Image>["systemName"];
  tinted?: boolean;
  enabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = useLargeText();
  return (
    <Button onPress={onPress} modifiers={[disabled(!enabled)]}>
      <HStack spacing={12} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <Image
          systemName={symbol}
          modifiers={[
            font({ textStyle: "body" }),
            frame({ width: SYMBOL_WIDTH * fontScale }),
            tinted ? foregroundStyle({ type: "color", color: colors.tint }) : secondary,
            accessibilityHidden(),
          ]}
        />
        <Text modifiers={largeText ? [] : [lineLimit(1)]}>{label}</Text>
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
  listBottom,
  onRetry,
}: {
  content: PickerView["content"];
  /** Where the list ends on screen, `null` until it is known. */
  listBottom: number | null;
  /** Try Again, where the Machine cannot list; unavailable while `undefined`. */
  onRetry: ((path: string) => void) | undefined;
}) {
  // Where the state starts on screen, taken once: scrolling moves it, and the state must not
  // grow with the scroll.
  const [top, setTop] = useState<number | null>(null);
  if (content.kind === "directories") return null;
  const fill =
    top === null || listBottom === null ? null : listBottom - top - STATE_BOTTOM[content.kind];
  return (
    <Section>
      <VStack
        spacing={0}
        modifiers={[
          fill === null
            ? frame({ maxWidth: FILL })
            : frame({ maxWidth: FILL, minHeight: Math.max(fill, 0) }),
          ...(fill === null ? [padding({ top: STATE_TOP })] : []),
          onGeometryChange((frame) => top === null && setTop(frame.y)),
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
                onPress={onRetry && (() => onRetry(content.retryPath))}
                prominent
                fitsLabel
              />
            </VStack>
          </>
        )}
      </VStack>
    </Section>
  );
}

DirectoryStepScreen satisfies typeof ScreenContract;
