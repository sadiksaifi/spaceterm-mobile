import arrowBackIcon from "@expo/material-symbols/arrow_back.xml";
import arrowUpwardIcon from "@expo/material-symbols/arrow_upward.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import folderIcon from "@expo/material-symbols/folder.xml";
import warningIcon from "@expo/material-symbols/warning.xml";
import {
  AlertDialog,
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  Icon,
  IconButton,
  LazyColumn,
  LoadingIndicator,
  OutlinedButton,
  OutlinedTextField,
  Row,
  Shape,
  Surface,
  Text,
  TopAppBar,
  useMaterialColors,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  alpha,
  background,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  semantics,
  size,
  weight,
  type ModifierConfig,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useImperativeHandle, useRef, type Ref } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { Refreshable } from "@/shared/ui/android/refreshable";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import {
  Centered,
  StateActions,
  StateBody,
  StateTile,
  StateTitle,
} from "@/shared/ui/android/state";

import type { PickerView } from "../picker";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { DirectoryStepProps } from "./screen";

/** A state keeps this much space below itself, so it sits above center. */
const STATE_BOTTOM = 120;
/** The path in the create dialog, as the design sets it: 13 sp monospace in the text color. */
const PATH_SIZE = 13;
const SNACKBAR_MARGIN = 16;
/** The spinner in Open: Material's size for an indicator in a button, in the disabled text color. */
const SPINNER_SIZE = 18;
const SPINNER_STROKE = 2;
const DISABLED_CONTENT = 0.38;

export default function DirectoryStepScreen({
  machineName,
  picker,
  leading,
  onLeave,
}: DirectoryStepProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { view, askingCreate, failure } = picker;
  const { content, parent } = view;
  const field = useRef<FieldText>(null);
  // Android reports a refusal in a snackbar, which leaves the picker usable.
  const snackbar = useSnackbar(
    failure,
    (shown) => ({ message: text.failedTitle(shown.directory), actionLabel: text.tryAgain }),
    picker.retry,
    picker.dismissFailure,
  );
  const rows: ListRow[] = [
    ...(parent === null ? [] : [{ key: "parent", label: text.parentDirectory, path: parent }]),
    ...(content.kind === "directories"
      ? content.directories.map((directory) => ({
          key: directory.path,
          label: directory.name,
          path: directory.path,
        }))
      : []),
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground), imePadding()]}>
          <Column modifiers={[fillMaxSize()]}>
            <TopAppBar>
              <TopAppBar.NavigationIcon>
                <IconButton onClick={onLeave}>
                  {leading === "back" ? (
                    <Icon source={arrowBackIcon} contentDescription={text.back} />
                  ) : (
                    <Icon source={closeIcon} contentDescription={text.close} />
                  )}
                </IconButton>
              </TopAppBar.NavigationIcon>
              <TopAppBar.Title>
                <Text maxLines={1} overflow="ellipsis" style={{ typography: "titleLarge" }}>
                  {text.openDirectory}
                </Text>
              </TopAppBar.Title>
              <TopAppBar.Actions>
                <Button
                  onClick={() => picker.open(field.current?.text())}
                  enabled={view.canOpen}
                  modifiers={[padding(8, 0, 12, 0)]}
                >
                  <OpenLabel opening={view.opening} />
                </Button>
              </TopAppBar.Actions>
            </TopAppBar>

            <PathField
              ref={field}
              key={picker.fieldVersion}
              label={text.directoryOn(machineName)}
              initial={view.field}
              enabled={!view.opening}
              onEdit={picker.edit}
              onGo={picker.open}
            />

            {content.kind === "directories" ? (
              // Only a list of directories scrolls, so only it pulls to refresh.
              <Refreshable onRefresh={picker.refresh} modifiers={[fillMaxWidth(), weight(1)]}>
                <DirectoryList rows={rows} picker={picker} modifiers={[fillMaxSize()]} />
              </Refreshable>
            ) : (
              <DirectoryList rows={rows} picker={picker} modifiers={[fillMaxWidth()]} />
            )}

            {content.kind !== "directories" && (
              <Column modifiers={[fillMaxWidth(), weight(1)]}>
                <ContentState
                  content={content}
                  onRetry={view.opening ? undefined : picker.navigate}
                />
              </Column>
            )}
          </Column>
          <SnackbarSlot {...snackbar} bottom={insets.bottom + SNACKBAR_MARGIN} />
        </Box>

        {askingCreate !== null && (
          <CreateDialog
            directory={askingCreate}
            machineName={machineName}
            onCancel={picker.cancel}
            onCreate={picker.create}
          />
        )}
      </ScreenHost>
    </>
  );
}

/** Parent Directory and the directories, as rows. */
type ListRow = { key: string; label: string; path: string };

function DirectoryList({
  rows,
  picker,
  modifiers,
}: {
  rows: readonly ListRow[];
  picker: DirectoryStepProps["picker"];
  modifiers: ModifierConfig[];
}) {
  const { opening } = picker.view;
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: GROUPED_GAP }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: 16 }}
      modifiers={modifiers}
    >
      <LazyColumn.Items data={rows} keyExtractor={(row) => row.key}>
        {({ item, index }: { item: ListRow; index: number }) => (
          <DirectoryRow
            label={item.label}
            icon={item.key === "parent" ? arrowUpwardIcon : folderIcon}
            first={index === 0}
            last={index === rows.length - 1}
            enabled={!opening}
            onPress={() => picker.navigate(item.path)}
          />
        )}
      </LazyColumn.Items>
    </LazyColumn>
  );
}

/**
 * Open, or a spinner in its place until the Machine answers. The word stays, unseen, so the
 * button keeps its width.
 */
function OpenLabel({ opening }: { opening: boolean }) {
  const material = useMaterialColors();
  return (
    <Box contentAlignment="center">
      <Text modifiers={opening ? [alpha(0)] : []}>{text.open}</Text>
      {opening && (
        <CircularProgressIndicator
          color={material.onSurface}
          strokeWidth={SPINNER_STROKE}
          modifiers={[
            size(SPINNER_SIZE, SPINNER_SIZE),
            alpha(DISABLED_CONTENT),
            semantics({ contentDescription: text.opening }),
          ]}
        />
      )}
    </Box>
  );
}

/** The text a path field shows now, which can be ahead of the last keystroke's event. */
type FieldText = { text: () => string };

/** The path of the directory to open, in a monospaced font. Go opens it, as Open does. */
function PathField({
  ref,
  label,
  initial,
  enabled,
  onEdit,
  onGo,
}: {
  ref: Ref<FieldText>;
  label: string;
  initial: string;
  enabled: boolean;
  onEdit: (field: string) => void;
  onGo: (submitted: string) => void;
}) {
  const field = useNativeState(initial);
  useImperativeHandle(ref, () => ({ text: () => field.get() }), [field]);
  // The cursor starts after the path.
  const selection = useNativeState({ start: initial.length, end: initial.length });
  return (
    <OutlinedTextField
      value={field}
      selection={selection}
      singleLine
      enabled={enabled}
      onValueChange={onEdit}
      textStyle={{ fontFamily: "monospace" }}
      keyboardOptions={{
        capitalization: "none",
        autoCorrectEnabled: false,
        keyboardType: "uri",
        imeAction: "go",
      }}
      keyboardActions={{ onGo }}
      modifiers={[fillMaxWidth(), padding(16, 12, 16, 0)]}
    >
      <OutlinedTextField.Label>
        <Text>{label}</Text>
      </OutlinedTextField.Label>
    </OutlinedTextField>
  );
}

function DirectoryRow({
  label,
  icon,
  first,
  last,
  enabled,
  onPress,
}: {
  label: string;
  icon: number;
  first: boolean;
  last: boolean;
  enabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({ cornerRadii: groupedCorners(first, last) })}
      onClick={onPress}
      enabled={enabled}
      modifiers={[fillMaxWidth()]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
      >
        <Icon source={icon} tint={colors.secondaryText} />
        <Text maxLines={1} overflow="ellipsis" style={{ typography: "bodyLarge" }}>
          {label}
        </Text>
      </Row>
    </Surface>
  );
}

/** What fills the space below the rows while a directory loads, is empty, or cannot be listed. */
function ContentState({
  content,
  onRetry,
}: {
  content: Exclude<PickerView["content"], { kind: "directories" }>;
  /** Try Again, where the Machine cannot list; unavailable while `undefined`. */
  onRetry: ((path: string) => void) | undefined;
}) {
  switch (content.kind) {
    case "loading":
      return (
        <Centered bottom={STATE_BOTTOM}>
          {/* The word says what the shape means, as on iOS; screen readers read it too. */}
          <LoadingIndicator />
          <StateBody>{text.loading}</StateBody>
        </Centered>
      );
    case "empty":
      return (
        <Centered bottom={STATE_BOTTOM}>
          <StateTile icon={folderIcon} />
          <StateTitle>{text.noSubdirectories}</StateTitle>
        </Centered>
      );
    case "unavailable":
      return (
        <Centered bottom={STATE_BOTTOM}>
          <StateTile icon={warningIcon} failed />
          <StateTitle>{text.cannotList}</StateTitle>
          <StateBody>{text.cannotListBody}</StateBody>
          <StateActions>
            <Button onClick={() => onRetry?.(content.retryPath)} enabled={onRetry !== undefined}>
              <Text>{text.tryAgain}</Text>
            </Button>
          </StateActions>
        </Centered>
      );
  }
}

function CreateDialog({
  directory,
  machineName,
  onCancel,
  onCreate,
}: {
  directory: string;
  machineName: string;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const colors = useColors();
  const [path, rest] = text.createBody(directory, machineName);
  return (
    <AlertDialog onDismissRequest={onCancel}>
      <AlertDialog.Title>
        <Text style={{ typography: "headlineSmall" }}>{text.createTitle}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Text>
          <Text style={{ fontFamily: "monospace", fontSize: PATH_SIZE }} color={colors.text}>
            {path}
          </Text>
          {rest}
        </Text>
      </AlertDialog.Text>
      <AlertDialog.DismissButton>
        <OutlinedButton onClick={onCancel}>
          <Text>{text.cancel}</Text>
        </OutlinedButton>
      </AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton>
        <Button onClick={onCreate}>
          <Text>{text.create}</Text>
        </Button>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  );
}

DirectoryStepScreen satisfies typeof ScreenContract;
