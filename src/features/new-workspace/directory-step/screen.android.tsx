import arrowBackIcon from "@expo/material-symbols/arrow_back.xml";
import arrowUpwardIcon from "@expo/material-symbols/arrow_upward.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import folderIcon from "@expo/material-symbols/folder.xml";
import refreshIcon from "@expo/material-symbols/refresh.xml";
import warningIcon from "@expo/material-symbols/warning.xml";
import {
  AlertDialog,
  AnimatedVisibility,
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  EnterTransition,
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
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
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
  const { content, parent, parentWaits } = view;
  const entrance = useEntrance(view.shownVersion);
  const field = useRef<FieldText>(null);
  // Android reports a refusal in a snackbar, which leaves the picker usable.
  const snackbar = useSnackbar(
    failure,
    (shown) => ({ message: text.failedTitle(shown.directory), actionLabel: text.tryAgain }),
    picker.retry,
    picker.dismissFailure,
  );
  const rows: ListRow[] = [
    ...(parent === null && !parentWaits
      ? []
      : [{ key: "parent", label: text.parentDirectory, path: parent }]),
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
                <IconButton onClick={() => void picker.refresh()}>
                  <Icon source={refreshIcon} contentDescription={text.refresh} />
                </IconButton>
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

            {/* The list stays mounted when a state replaces the directories, so Parent Directory
                does not redraw. It fills the space only while it shows directories. */}
            <Refreshable
              onRefresh={picker.refresh}
              modifiers={
                content.kind === "directories" ? [fillMaxWidth(), weight(1)] : [fillMaxWidth()]
              }
            >
              <DirectoryList
                rows={rows}
                picker={picker}
                entrance={entrance}
                modifiers={content.kind === "directories" ? [fillMaxSize()] : [fillMaxWidth()]}
              />
            </Refreshable>

            {content.kind !== "directories" && (
              // The state scrolls, so a directory with no subdirectories can be listed again.
              <Refreshable onRefresh={picker.refresh} modifiers={[fillMaxWidth(), weight(1)]}>
                <Entering
                  key={entrance.key}
                  entrance={entrance}
                  enter={STATE_ENTER}
                  modifiers={[fillMaxSize()]}
                >
                  <ContentState
                    content={content}
                    onRetry={view.opening ? undefined : picker.navigate}
                  />
                </Entering>
              </Refreshable>
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

/** How long a new row or state stays hidden before it comes in: two frames. */
const HIDDEN_MS = 32;
/**
 * How long after a change a row that mounts still comes in. The list mounts its rows as it lays
 * them out, which can be a few frames late; a row that scrolls into view later just shows.
 */
const ENTERING_MS = 300;
/** New rows open downward as they fade in, so the list grows to its new length. */
const ROW_ENTER = EnterTransition.fadeIn().plus(EnterTransition.expandVertically());
/** A state fades in where it stands. */
const STATE_ENTER = EnterTransition.fadeIn();

/**
 * What shows below the field since it last changed. `key` changes with it, so each row and state
 * mounts again; `entering` holds for a moment after the change, so whatever mounts meanwhile comes
 * in.
 */
type Entrance = { key: number; entering: boolean };

function useEntrance(version: number): Entrance {
  const [settled, setSettled] = useState(version);
  useEffect(() => {
    if (settled === version) return;
    const timer = setTimeout(() => setSettled(version), ENTERING_MS);
    return () => clearTimeout(timer);
  }, [settled, version]);
  return { key: version, entering: settled !== version };
}

/**
 * A row or state that comes in from its own mount: hidden for two frames, so Compose draws it
 * hidden first, then shown with `enter`. A view that mounts shown does not animate. Mount it with
 * `key={entrance.key}`.
 */
function Entering({
  entrance,
  enter,
  modifiers,
  children,
}: {
  entrance: Entrance;
  enter: typeof ROW_ENTER;
  modifiers: ModifierConfig[];
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(!entrance.entering);
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setVisible(true), HIDDEN_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  return (
    <AnimatedVisibility visible={visible} enterTransition={enter} modifiers={modifiers}>
      {children}
    </AnimatedVisibility>
  );
}

/** The size of a row's Material symbol, its intrinsic size. */
const ROW_ICON = 24;

/**
 * Parent Directory and the directories, as rows. A row with no path, Parent Directory while the
 * Machine has yet to say where it leads, takes no tap.
 */
type ListRow = { key: string; label: string; path: string | null };

function DirectoryList({
  rows,
  picker,
  entrance,
  modifiers,
}: {
  rows: readonly ListRow[];
  picker: DirectoryStepProps["picker"];
  /** How the directories come in; Parent Directory stays where it is. */
  entrance: Entrance;
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
            enabled={!opening && item.path !== null}
            entrance={item.key === "parent" ? undefined : entrance}
            onPress={() => item.path !== null && picker.navigate(item.path)}
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
  entrance,
  onPress,
}: {
  label: string;
  icon: number;
  first: boolean;
  last: boolean;
  enabled: boolean;
  /** How the row comes in; `undefined` keeps it in place. */
  entrance?: Entrance;
  onPress: () => void;
}) {
  const colors = useColors();
  const row = (
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
        {/* The Icon draws nothing until its symbol loads; the Box holds its place meanwhile. */}
        <Box modifiers={[size(ROW_ICON, ROW_ICON)]}>
          <Icon source={icon} tint={colors.secondaryText} size={ROW_ICON} />
        </Box>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: "bodyLarge" }}>
          {label}
        </Text>
      </Row>
    </Surface>
  );
  return entrance === undefined ? (
    row
  ) : (
    <Entering key={entrance.key} entrance={entrance} enter={ROW_ENTER} modifiers={[fillMaxWidth()]}>
      {row}
    </Entering>
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
    case "none":
      return null;
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
