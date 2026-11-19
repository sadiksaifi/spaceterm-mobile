import addIcon from "@expo/material-symbols/add.xml";
import backIcon from "@expo/material-symbols/arrow_back.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import deleteIcon from "@expo/material-symbols/delete.xml";
import searchIcon from "@expo/material-symbols/search.xml";
import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  LazyColumn,
  ListItem,
  RadioButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Surface,
  Text,
  TextField,
  TopAppBar,
  useMaterialColors,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  combinedClickable,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  selectable,
  selectableGroup,
  semantics,
  Shapes,
  weight,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack, useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radioSelected } from "@/modules/compose-modifiers";
import type { TerminalTheme } from "@/shared/preferences/model";
import { useColors } from "@/shared/theme/colors";
import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";
import { GROUPED_GAP, groupedCorners } from "@/shared/ui/android/grouped";
import { GroupedRow, GroupHeader } from "@/shared/ui/android/grouped-row";
import { GROUP_SPACE, PageTopBar } from "@/shared/ui/android/page";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { useLargeText } from "@/shared/ui/large-text";

import { TerminalPreview, ThemeThumbnail } from "./components/android/terminal-preview";
import { removable } from "./model";
import { THUMBNAIL } from "./preview";
import type ScreenContract from "./screen";
import type { ThemesProps } from "./screen";
import { appearances, text, themeSource } from "./text";

/** A theme row's height, for the list to place rows it has not drawn yet. */
const ROW_HEIGHT = 72;
/** A card's corners: 16 dp outside, 4 dp where the pair meets. */
const OUTER = 16;
const INNER = 4;
const LEFT_CARD = { topStart: OUTER, bottomStart: OUTER, topEnd: INNER, bottomEnd: INNER };
const RIGHT_CARD = { topStart: INNER, bottomStart: INNER, topEnd: OUTER, bottomEnd: OUTER };
/** A radio button that leaves the taps to its row draws 24 dp wide. */
const RADIO_WIDTH = 24;
const LEADING_GAP = 16;
/** The touch and hold menu, as wide as the design draws it. */
const MENU_WIDTH = 220;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;

export default function ThemesScreen({
  appearance,
  shown,
  chosen,
  themes,
  query,
  removing,
  onAppearance,
  onShow,
  onChoose,
  onQuery,
  onAskRemove,
  onCancelRemove,
  onRemove,
  onGetMore,
}: ThemesProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // The search action turns the top bar into the search field until Back closes it.
  const [searching, setSearching] = useState(false);
  const filtering = query.trim() !== "";

  const endSearch = () => {
    setSearching(false);
    onQuery("");
  };

  // Back closes the search only while Themes is in front, not under Get More Themes.
  const focused = useIsFocused();
  useEffect(() => {
    if (!searching || !focused) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSearching(false);
      onQuery("");
      return true;
    });
    return () => subscription.remove();
  }, [searching, focused, onQuery]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          {searching ? (
            <SearchTopBar onQuery={onQuery} onClose={endSearch} />
          ) : (
            <PageTopBar
              title={text.title}
              backLabel={text.back}
              actions={
                <IconButton onClick={() => setSearching(true)}>
                  <Icon source={searchIcon} contentDescription={text.searchThemes} />
                </IconButton>
              }
            />
          )}
          {/* Lazy, so a family of hundreds of themes draws only the rows on screen. */}
          <LazyColumn
            verticalArrangement={{ spacedBy: GROUPED_GAP }}
            contentPadding={{ start: 16, end: 16, top: 0, bottom: insets.bottom + GROUP_SPACE }}
            // The theme rows are radio buttons; a lazy list cannot group only some of its items.
            modifiers={[weight(1), fillMaxWidth(), selectableGroup()]}
          >
            {/* While a search has text, the page shows only the themes it finds. */}
            {!filtering && (
              <>
                <GroupHeader>{text.appearance}</GroupHeader>
                <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                  {appearances.map(({ value, label }) => (
                    <SegmentedButton
                      key={value}
                      selected={appearance === value}
                      onClick={() => onAppearance(value)}
                      modifiers={[weight(1)]}
                    >
                      <SegmentedButton.Label>
                        <Text maxLines={1} overflow="ellipsis">
                          {label}
                        </Text>
                      </SegmentedButton.Label>
                    </SegmentedButton>
                  ))}
                </SingleChoiceSegmentedButtonRow>

                <GroupHeader>{text.currentTheme}</GroupHeader>
                {appearance === "automatic" ? (
                  <>
                    <Row
                      horizontalArrangement={{ spacedBy: GROUPED_GAP }}
                      modifiers={[fillMaxWidth(), selectableGroup()]}
                    >
                      <ThemeCard
                        label={text.light}
                        theme={chosen.light}
                        corners={LEFT_CARD}
                        selected={shown === "light"}
                        onSelect={() => onShow("light")}
                      />
                      <ThemeCard
                        label={text.dark}
                        theme={chosen.dark}
                        corners={RIGHT_CARD}
                        selected={shown === "dark"}
                        onSelect={() => onShow("dark")}
                      />
                    </Row>
                    <Text
                      style={{ typography: "bodySmall" }}
                      color={colors.secondaryText}
                      modifiers={[padding(16, 6, 16, 0)]}
                    >
                      {text.cardsFooter}
                    </Text>
                  </>
                ) : (
                  <CurrentTheme theme={chosen[shown]} />
                )}
              </>
            )}

            <GroupHeader>{text.themesFor(shown)}</GroupHeader>
            {filtering && themes.length === 0 && (
              <GroupedRow
                first
                last={false}
                headline={text.noResultsTitle(query.trim())}
                supporting={text.noResultsBody}
              />
            )}
            <LazyColumn.Items
              data={themes}
              keyExtractor={(theme) => theme.id}
              estimatedItemSize={ROW_HEIGHT}
            >
              {({ item, index }: { item: TerminalTheme; index: number }) => (
                <ThemeRow
                  key={item.id}
                  theme={item}
                  first={index === 0}
                  chosen={item.id === chosen[shown].id}
                  onChoose={() => onChoose(item.id)}
                  onAskRemove={() => onAskRemove(item)}
                />
              )}
            </LazyColumn.Items>
            <GetMoreRow first={themes.length === 0 && !filtering} onClick={onGetMore} />
          </LazyColumn>
        </Column>
        {removing !== null && (
          <ConfirmDialog
            title={text.removeTitle(removing.name)}
            cancel={text.cancel}
            action={text.remove}
            onCancel={onCancelRemove}
            onConfirm={onRemove}
          />
        )}
      </ScreenHost>
    </>
  );
}

/** The top bar while search is open: Back, the field, and Clear once it has text. */
function SearchTopBar({
  onQuery,
  onClose,
}: {
  onQuery: (query: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const field = useNativeState("");
  const [empty, setEmpty] = useState(true);
  return (
    <TopAppBar>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={onClose}>
          <Icon source={backIcon} contentDescription={text.back} />
        </IconButton>
      </TopAppBar.NavigationIcon>
      <TopAppBar.Title>
        <TextField
          value={field}
          autoFocus
          singleLine
          onValueChange={(value) => {
            setEmpty(value === "");
            onQuery(value);
          }}
          keyboardOptions={{ imeAction: "search" }}
          colors={{
            focusedContainerColor: "transparent",
            unfocusedContainerColor: "transparent",
            focusedIndicatorColor: "transparent",
            unfocusedIndicatorColor: "transparent",
          }}
          modifiers={[fillMaxWidth()]}
        >
          <TextField.Placeholder>
            <Text color={colors.secondaryText}>{text.searchThemes}</Text>
          </TextField.Placeholder>
        </TextField>
      </TopAppBar.Title>
      {!empty && (
        <TopAppBar.Actions>
          <IconButton
            onClick={() => {
              field.set("");
              setEmpty(true);
              onQuery("");
            }}
          >
            <Icon source={closeIcon} contentDescription={text.clearText} />
          </IconButton>
        </TopAppBar.Actions>
      )}
    </TopAppBar>
  );
}

/**
 * One appearance's current theme under Automatic, half of a connected pair. The selected card
 * takes the secondary container, and its list shows below.
 */
function ThemeCard({
  label,
  theme,
  corners,
  selected,
  onSelect,
}: {
  label: string;
  theme: TerminalTheme;
  corners: typeof LEFT_CARD;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const largeText = useLargeText();
  const material = useMaterialColors();
  return (
    <Surface
      color={selected ? material.secondaryContainer : colors.groupedRow}
      contentColor={selected ? material.onSecondaryContainer : colors.text}
      modifiers={[
        weight(1),
        clip(Shapes.RoundedCorner(corners)),
        selectable(selected, onSelect, "tab"),
      ]}
    >
      <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[padding(12, 12, 12, 14)]}>
        <TerminalPreview colors={theme.colors} size="card" />
        <Column modifiers={[padding(4, 0, 4, 0)]}>
          <Text style={{ typography: "titleSmall" }} maxLines={1}>
            {label}
          </Text>
          <Text
            style={{ typography: "bodySmall" }}
            color={selected ? material.onSecondaryContainer : colors.secondaryText}
            // Large text shows the whole name, as the theme rows do.
            maxLines={largeText ? undefined : 1}
            overflow="ellipsis"
          >
            {theme.name}
          </Text>
        </Column>
      </Column>
    </Surface>
  );
}

/** Under Light or Dark, the one current theme: a larger preview and its name. */
function CurrentTheme({ theme }: { theme: TerminalTheme }) {
  const colors = useColors();
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(OUTER))]}
    >
      <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[padding(12, 12, 12, 14)]}>
        <TerminalPreview colors={theme.colors} size="single" />
        <Text style={{ typography: "titleSmall" }} modifiers={[padding(4, 0, 4, 0)]}>
          {theme.name}
        </Text>
      </Column>
    </Surface>
  );
}

/**
 * A theme: a radio button, its thumbnail, name and source. Tapping it chooses it. A theme the
 * person added has a remove button, and touch and hold opens a menu with Remove.
 */
function ThemeRow({
  theme,
  first,
  chosen,
  onChoose,
  onAskRemove,
}: {
  theme: TerminalTheme;
  first: boolean;
  chosen: boolean;
  onChoose: () => void;
  onAskRemove: () => void;
}) {
  const colors = useColors();
  const material = useMaterialColors();
  const [held, setHeld] = useState(false);
  const canRemove = removable(theme);

  const row = (
    <Surface
      color={held ? material.surfaceContainerHighest : colors.groupedRow}
      contentColor={colors.text}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(groupedCorners(first, false)))]}
    >
      <ListItem
        colors={{
          containerColor: "transparent",
          contentColor: colors.text,
          supportingContentColor: colors.secondaryText,
        }}
        // On the list item, which merges the name and source into one node for screen readers, so
        // the radio reads with its label. The remove button stays a control of its own.
        modifiers={[
          combinedClickable({
            onClick: onChoose,
            onLongClick: canRemove ? () => setHeld(true) : undefined,
          }),
          radioSelected(chosen),
        ]}
      >
        <ListItem.LeadingContent>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: LEADING_GAP }}>
            <RadioButton selected={chosen} />
            <ThemeThumbnail colors={theme.colors} />
          </Row>
        </ListItem.LeadingContent>
        <ListItem.HeadlineContent>
          <Text>{theme.name}</Text>
        </ListItem.HeadlineContent>
        <ListItem.SupportingContent>
          <Text>{themeSource(theme)}</Text>
        </ListItem.SupportingContent>
        {canRemove && (
          <ListItem.TrailingContent>
            {/* The row takes its children's descriptions, so the button names itself. */}
            <IconButton
              onClick={onAskRemove}
              modifiers={[semantics({ contentDescription: text.removeLabel(theme.name) })]}
            >
              <Icon source={deleteIcon} tint={colors.secondaryText} />
            </IconButton>
          </ListItem.TrailingContent>
        )}
      </ListItem>
    </Surface>
  );

  if (!canRemove) return row;
  // Touch and hold opens the menu at the row with no dimming; the held row takes a higher tone.
  return (
    <DropdownMenu
      expanded={held}
      onDismissRequest={() => setHeld(false)}
      color={material.surfaceContainerHigh}
      cornerRadius={MENU_CORNER}
      shadowElevation={MENU_ELEVATION}
    >
      <DropdownMenu.Trigger>{row}</DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenuItem
          modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
          onClick={() => {
            setHeld(false);
            onAskRemove();
          }}
        >
          <DropdownMenuItem.Text>
            <Text>{text.remove}</Text>
          </DropdownMenuItem.Text>
        </DropdownMenuItem>
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}

/** The last row: Get more themes, its icon lined up with the thumbnails above. */
function GetMoreRow({ first, onClick }: { first: boolean; onClick: () => void }) {
  const colors = useColors();
  return (
    <GroupedRow
      first={first}
      last
      leading={
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: LEADING_GAP }}>
          <Box modifiers={[width(RADIO_WIDTH)]} />
          <Box contentAlignment="center" modifiers={[width(THUMBNAIL.width)]}>
            <Icon source={addIcon} tint={colors.secondaryText} />
          </Box>
        </Row>
      }
      headline={text.getMoreThemes}
      onClick={onClick}
    />
  );
}

ThemesScreen satisfies typeof ScreenContract;
