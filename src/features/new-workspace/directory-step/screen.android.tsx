import arrowBackIcon from "@expo/material-symbols/arrow_back.xml";
import arrowUpwardIcon from "@expo/material-symbols/arrow_upward.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import folderIcon from "@expo/material-symbols/folder.xml";
import warningIcon from "@expo/material-symbols/warning.xml";
import { Host } from "@expo/ui";
import {
  AlertDialog,
  Box,
  Button,
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
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";
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
  // Android reports a refusal in a snackbar, which leaves the picker usable.
  const snackbar = useSnackbar(
    failure,
    (shown) => ({ message: text.failedTitle(shown.directory), actionLabel: text.tryAgain }),
    picker.retry,
    picker.dismissFailure,
  );
  const rows = [
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
      <Host style={{ flex: 1 }}>
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
                  onClick={picker.open}
                  enabled={view.canOpen}
                  modifiers={[padding(8, 0, 12, 0)]}
                >
                  <Text>{text.open}</Text>
                </Button>
              </TopAppBar.Actions>
            </TopAppBar>

            <PathField
              key={picker.fieldVersion}
              label={text.directoryOn(machineName)}
              initial={view.field}
              onEdit={picker.edit}
              onGo={picker.open}
            />

            <LazyColumn
              verticalArrangement={{ spacedBy: GROUPED_GAP }}
              contentPadding={{ start: 16, end: 16, top: 16, bottom: 16 }}
              modifiers={
                content.kind === "directories" ? [fillMaxWidth(), weight(1)] : [fillMaxWidth()]
              }
            >
              <LazyColumn.Items data={rows} keyExtractor={(row) => row.key}>
                {({ item, index }: { item: (typeof rows)[number]; index: number }) => (
                  <DirectoryRow
                    label={item.label}
                    icon={item.key === "parent" ? arrowUpwardIcon : folderIcon}
                    first={index === 0}
                    last={index === rows.length - 1}
                    onPress={() => picker.navigate(item.path)}
                  />
                )}
              </LazyColumn.Items>
            </LazyColumn>

            {content.kind !== "directories" && (
              <Column modifiers={[fillMaxWidth(), weight(1)]}>
                <ContentState content={content} onRetry={picker.navigate} />
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
      </Host>
    </>
  );
}

/** The path of the directory to open, in a monospaced font. Go opens it, as Open does. */
function PathField({
  label,
  initial,
  onEdit,
  onGo,
}: {
  label: string;
  initial: string;
  onEdit: (field: string) => void;
  onGo: () => void;
}) {
  const field = useNativeState(initial);
  // The cursor starts after the path.
  const selection = useNativeState({ start: initial.length, end: initial.length });
  return (
    <OutlinedTextField
      value={field}
      selection={selection}
      singleLine
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
  onPress,
}: {
  label: string;
  icon: number;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({ cornerRadii: groupedCorners(first, last) })}
      onClick={onPress}
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
  onRetry: (path: string) => void;
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
            <Button onClick={() => onRetry(content.retryPath)}>
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
