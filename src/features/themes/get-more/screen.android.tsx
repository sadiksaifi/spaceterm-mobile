import closeIcon from "@expo/material-symbols/close.xml";
import downloadIcon from "@expo/material-symbols/download.xml";
import searchIcon from "@expo/material-symbols/search.xml";
import searchOffIcon from "@expo/material-symbols/search_off.xml";
import warningIcon from "@expo/material-symbols/warning.xml";
import {
  Box,
  Button,
  Column,
  FilledTonalButton,
  Icon,
  IconButton,
  LazyColumn,
  ListItem,
  LoadingIndicator,
  Shape,
  Surface,
  Text,
  TextButton,
  TextField,
  TopAppBar,
  useMaterialColors,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  semantics,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { heading, hiddenFromAccessibility } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { GroupedRow } from "@/shared/ui/android/grouped-row";
import { GROUP_SPACE } from "@/shared/ui/android/page";
import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import type { CatalogExtension } from "./catalog";
import type ScreenContract from "./screen";
import type { GetMoreProps } from "./screen";
import { text } from "./text";
import type { GetMoreFailure, GetMorePage } from "./use-get-more";

/** A row's height at the default font scale, for rows not measured yet. */
const ROW_HEIGHT = 72;
/** The Get, indicator and Remove slot, so the indicator sits where Get was. */
const CONTROL = { width: 64, height: 40, indicator: 32 } as const;
const SEARCH_CORNER = 28;
/** The tile behind an empty or error state's icon, as the design draws it. */
const TILE = { size: 80, corner: 28, icon: 40 } as const;
const STATE_TOP = 48;
const LOADING_SIZE = 48;

export default function GetMoreScreen({ page, onClose }: GetMoreProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const filtering = page.query.trim() !== "";
  const snackbar = useSnackbar(
    page.failure,
    (failure) => ({ message: failureMessage(failure), actionLabel: text.tryAgain }),
    page.retryFailure,
    page.dismissFailure,
  );
  const { list } = page;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <Column modifiers={[fillMaxSize()]}>
            <TopAppBar>
              <TopAppBar.NavigationIcon>
                <IconButton onClick={onClose}>
                  <Icon source={closeIcon} contentDescription={text.close} />
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
            </TopAppBar>
            <SearchField onQuery={page.setQuery} />
            <LazyColumn
              verticalArrangement={{ spacedBy: GROUPED_GAP }}
              contentPadding={{ start: 16, end: 16, top: 0, bottom: insets.bottom + GROUP_SPACE }}
              modifiers={[weight(1), fillMaxWidth()]}
            >
              {/* While a search has text, the page shows only what it finds. */}
              {!filtering && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.secondaryText}
                  modifiers={[padding(8, 16, 8, 16)]}
                >
                  {text.intro}
                </Text>
              )}
              {!filtering && (
                <Column modifiers={[padding(0, 0, 0, 12)]}>
                  <GroupedRow
                    first
                    last
                    leading={<Icon source={downloadIcon} tint={colors.secondaryText} />}
                    headline={text.importFromFile}
                    onClick={page.importFile}
                  />
                </Column>
              )}
              {list.kind === "loading" && <Loading />}
              {list.kind === "unavailable" && <Unavailable onRetry={page.retry} />}
              {list.kind === "ready" && list.extensions.length === 0 && filtering && (
                <NoResults query={page.query.trim()} />
              )}
              {list.kind === "ready" && (
                <LazyColumn.Items
                  data={list.extensions}
                  keyExtractor={(extension) => extension.id}
                  estimatedItemSize={ROW_HEIGHT}
                >
                  {({ item, index }: { item: CatalogExtension; index: number }) => (
                    <ExtensionRow
                      key={item.id}
                      extension={item}
                      first={index === 0}
                      last={index === list.extensions.length - 1}
                      page={page}
                    />
                  )}
                </LazyColumn.Items>
              )}
            </LazyColumn>
          </Column>
          <SnackbarSlot {...snackbar} bottom={insets.bottom + GROUP_SPACE} />
        </Box>
        {page.removing !== null && (
          <ConfirmDialog
            title={text.removeTitle(page.removing.name)}
            body={text.removeBody}
            cancel={text.cancel}
            action={text.remove}
            onCancel={page.cancelRemove}
            onConfirm={page.remove}
          />
        )}
      </ScreenHost>
    </>
  );
}

/** Material's search bar in its place below the top bar: Search themes, and Clear once typed in. */
function SearchField({ onQuery }: { onQuery: (query: string) => void }) {
  const colors = useColors();
  const material = useMaterialColors();
  const field = useNativeState("");
  const [empty, setEmpty] = useState(true);
  return (
    <TextField
      value={field}
      singleLine
      onValueChange={(value) => {
        setEmpty(value === "");
        onQuery(value);
      }}
      keyboardOptions={{ imeAction: "search" }}
      shape={Shape.RoundedCorner({ cornerRadii: corners(SEARCH_CORNER) })}
      colors={{
        focusedContainerColor: material.surfaceContainerHigh,
        unfocusedContainerColor: material.surfaceContainerHigh,
        focusedIndicatorColor: "transparent",
        unfocusedIndicatorColor: "transparent",
      }}
      modifiers={[fillMaxWidth(), padding(16, 4, 16, 8)]}
    >
      <TextField.LeadingIcon>
        <Icon source={searchIcon} />
      </TextField.LeadingIcon>
      <TextField.Placeholder>
        <Text color={colors.secondaryText}>{text.searchThemes}</Text>
      </TextField.Placeholder>
      {!empty && (
        <TextField.TrailingIcon>
          <IconButton
            onClick={() => {
              field.set("");
              setEmpty(true);
              onQuery("");
            }}
          >
            <Icon source={closeIcon} contentDescription={text.clearText} />
          </IconButton>
        </TextField.TrailingIcon>
      )}
    </TextField>
  );
}

/** An extension: its name, authors and downloads, and Get, an indicator, or Remove. */
function ExtensionRow({
  extension,
  first,
  last,
  page,
}: {
  extension: CatalogExtension;
  first: boolean;
  last: boolean;
  page: GetMorePage;
}) {
  const colors = useColors();
  const material = useMaterialColors();
  const state = page.state(extension);
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(groupedCorners(first, last)))]}
    >
      <ListItem
        colors={{
          containerColor: "transparent",
          contentColor: colors.text,
          supportingContentColor: colors.secondaryText,
        }}
      >
        <ListItem.HeadlineContent>
          <Text>{extension.name}</Text>
        </ListItem.HeadlineContent>
        <ListItem.SupportingContent>
          <Text>{text.details(extension.author, extension.downloads)}</Text>
        </ListItem.SupportingContent>
        <ListItem.TrailingContent>
          {state === "installing" ? (
            <Box
              contentAlignment="center"
              modifiers={[
                size(CONTROL.width, CONTROL.height),
                semantics({ contentDescription: text.installing(extension.name) }),
              ]}
            >
              <LoadingIndicator
                color={material.primary}
                modifiers={[size(CONTROL.indicator, CONTROL.indicator)]}
              />
            </Box>
          ) : state === "installed" ? (
            <TextButton
              onClick={() => page.askRemove(extension)}
              modifiers={[semantics({ contentDescription: text.removeLabel(extension.name) })]}
            >
              {/* The button's description names the extension; its text would say Remove again. */}
              <Text modifiers={[hiddenFromAccessibility()]}>{text.remove}</Text>
            </TextButton>
          ) : (
            <FilledTonalButton
              onClick={() => page.get(extension)}
              modifiers={[semantics({ contentDescription: text.getLabel(extension.name) })]}
            >
              <Text modifiers={[hiddenFromAccessibility()]}>{text.get}</Text>
            </FilledTonalButton>
          )}
        </ListItem.TrailingContent>
      </ListItem>
    </Surface>
  );
}

function Loading() {
  const colors = useColors();
  const material = useMaterialColors();
  return (
    <StateColumn>
      <LoadingIndicator
        color={material.primary}
        modifiers={[
          size(LOADING_SIZE, LOADING_SIZE),
          semantics({ contentDescription: text.loading }),
        ]}
      />
      <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
        {text.loading}
      </Text>
    </StateColumn>
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  const material = useMaterialColors();
  return (
    <StateColumn>
      <Tile icon={warningIcon} color={material.errorContainer} tint={material.onErrorContainer} />
      <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
        <Text style={{ typography: "titleLarge" }}>{text.unavailableTitle}</Text>
        <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
          {text.checkConnection}
        </Text>
      </Column>
      <Button onClick={onRetry} modifiers={[padding(0, 4, 0, 0)]}>
        <Text>{text.tryAgain}</Text>
      </Button>
    </StateColumn>
  );
}

function NoResults({ query }: { query: string }) {
  const colors = useColors();
  const material = useMaterialColors();
  return (
    <StateColumn>
      <Tile
        icon={searchOffIcon}
        color={material.secondaryContainer}
        tint={material.onSecondaryContainer}
      />
      <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
        {text.noResults(query)}
      </Text>
    </StateColumn>
  );
}

/** One state, centered under the rows above it. */
function StateColumn({ children }: { children: ReactNode }) {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 20 }}
      modifiers={[fillMaxWidth(), padding(16, STATE_TOP, 16, 0)]}
    >
      {children}
    </Column>
  );
}

/** A state's icon on a tinted rounded tile. */
function Tile({ icon, color, tint }: { icon: number; color: ColorValue; tint: ColorValue }) {
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        size(TILE.size, TILE.size),
        clip(Shapes.RoundedCorner(TILE.corner)),
        background(color),
      ]}
    >
      <Icon source={icon} size={TILE.icon} tint={tint} />
    </Box>
  );
}

const corners = (radius: number) => ({
  topStart: radius,
  topEnd: radius,
  bottomStart: radius,
  bottomEnd: radius,
});

const failureMessage = (failure: GetMoreFailure) =>
  failure.kind === "import"
    ? `${text.importFailed(failure.fileName)}. ${text.notATheme}`
    : `${text.getFailed(failure.extension.name)}. ${
        failure.reason === "no-themes" ? text.noThemes : text.checkConnection
      }`;

GetMoreScreen satisfies typeof ScreenContract;
