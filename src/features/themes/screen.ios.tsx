import { Host } from "@expo/ui";
import {
  Alert,
  Button,
  ContentUnavailableView,
  HStack,
  Image,
  List,
  ListForEach,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHidden,
  background,
  buttonStyle,
  deleteDisabled,
  environment,
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
  padding,
  pickerStyle,
  shapes,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";

import type { Appearance, TerminalTheme } from "@/shared/preferences/model";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { useLargeText } from "@/shared/ui/large-text";

import { ThemeThumbnail, TerminalPreview } from "./components/ios/terminal-preview";
import { removable } from "./model";
import type ScreenContract from "./screen";
import type { ThemesProps } from "./screen";
import { text, themeSource } from "./text";

const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: "light", label: text.light },
  { value: "dark", label: text.dark },
  { value: "automatic", label: text.automatic },
];

/** The selected card's outline: a gap in the row's color, then the tint, around the preview. */
const RING = { gap: 2, width: 2, corner: 14 } as const;

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
  // While a search has text, the page shows only the themes it finds.
  const filtering = query.trim() !== "";
  // Edit shows a removal control on each theme that was added.
  const [editing, setEditing] = useState(false);
  // Delete takes the row out of the list before the alert asks. Keeping it out until the alert
  // closes keeps the data in step with the list, which otherwise stops the app; Cancel puts it back.
  const rows = removing === null ? themes : themes.filter((theme) => theme.id !== removing.id);

  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      {/* Edit mode ends with Done, so Back gives way to it until then. */}
      <Stack.Screen options={{ headerBackVisible: !editing }} />
      <Stack.Toolbar placement="right">
        {editing ? (
          <Stack.Toolbar.Button
            icon="checkmark"
            variant="prominent"
            accessibilityLabel={text.done}
            onPress={() => setEditing(false)}
          />
        ) : (
          <Stack.Toolbar.Button onPress={() => setEditing(true)}>{text.edit}</Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <Stack.SearchBar
        placeholder={text.search}
        onChangeText={(event) => onQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => onQuery("")}
      />
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
      </Stack.Toolbar>

      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <Alert
          title={removing ? text.removeTitle(removing.name) : ""}
          isPresented={removing !== null}
          onIsPresentedChange={(presented) => !presented && onCancelRemove()}
        >
          <Alert.Trigger>
            <List
              modifiers={[
                listStyle("insetGrouped"),
                environment({ key: "editMode", value: editing ? "active" : "inactive" }),
              ]}
            >
              {!filtering && (
                <>
                  <Section title={text.appearance}>
                    <Picker
                      selection={appearance}
                      onSelectionChange={onAppearance}
                      modifiers={[pickerStyle("segmented")]}
                    >
                      {APPEARANCES.map(({ value, label }) => (
                        <Text key={value} modifiers={[tag(value)]}>
                          {label}
                        </Text>
                      ))}
                    </Picker>
                  </Section>
                  <Section
                    title={text.currentTheme}
                    footer={
                      appearance === "automatic" ? <Text>{text.cardsFooter}</Text> : undefined
                    }
                  >
                    {appearance === "automatic" ? (
                      <HStack spacing={16} alignment="top">
                        <ThemeCard
                          label={text.light}
                          theme={chosen.light}
                          selected={shown === "light"}
                          onPress={() => onShow("light")}
                        />
                        <ThemeCard
                          label={text.dark}
                          theme={chosen.dark}
                          selected={shown === "dark"}
                          onPress={() => onShow("dark")}
                        />
                      </HStack>
                    ) : (
                      <VStack alignment="leading" spacing={10}>
                        <TerminalPreview colors={chosen[shown].colors} size="single" />
                        <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" })]}>
                          {chosen[shown].name}
                        </Text>
                      </VStack>
                    )}
                  </Section>
                </>
              )}

              <Section title={text.themesFor(shown)}>
                {filtering && themes.length === 0 && (
                  <ContentUnavailableView
                    title={text.noResultsTitle(query.trim())}
                    systemImage="magnifyingglass"
                    description={text.noResultsBody}
                  />
                )}
                <ListForEach
                  data={rows}
                  keyExtractor={(theme) => theme.id}
                  onDelete={(indices) => {
                    const theme = indices[0] === undefined ? undefined : rows[indices[0]];
                    if (theme !== undefined) onAskRemove(theme);
                  }}
                >
                  {({ item }) => (
                    <ThemeRow
                      theme={item}
                      chosen={item.id === chosen[shown].id}
                      editing={editing}
                      onChoose={onChoose}
                    />
                  )}
                </ListForEach>
                <Button label={text.getMoreThemes} onPress={onGetMore} />
              </Section>
            </List>
          </Alert.Trigger>
          <Alert.Actions>
            <Button label={text.cancel} role="cancel" onPress={onCancelRemove} />
            <Button label={text.remove} role="destructive" onPress={onRemove} />
          </Alert.Actions>
        </Alert>
      </Host>
    </>
  );
}

/** One appearance's current theme under Automatic. The selected card's list shows below. */
function ThemeCard({
  label,
  theme,
  selected,
  onPress,
}: {
  label: string;
  theme: TerminalTheme;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("plain"),
        ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
      ]}
    >
      <VStack alignment="leading" spacing={8}>
        {/* Both cards keep the outline's room, so selecting one moves nothing. */}
        <VStack
          modifiers={[
            padding({ all: RING.gap }),
            background(
              colors.groupedRow,
              shapes.roundedRectangle({ cornerRadius: RING.corner + RING.gap }),
            ),
            padding({ all: RING.width }),
            background(
              selected ? colors.tint : colors.groupedRow,
              shapes.roundedRectangle({ cornerRadius: RING.corner + RING.gap + RING.width }),
            ),
          ]}
        >
          <TerminalPreview colors={theme.colors} size="card" />
        </VStack>
        <VStack alignment="leading" spacing={2} modifiers={[padding({ horizontal: 4 })]}>
          <Text
            modifiers={[
              font({ textStyle: "subheadline", weight: "semibold" }),
              foregroundStyle({ type: "color", color: colors.text }),
            ]}
          >
            {label}
          </Text>
          <Text modifiers={[font({ textStyle: "footnote" }), secondary, lineLimit(1)]}>
            {theme.name}
          </Text>
        </VStack>
      </VStack>
    </Button>
  );
}

/**
 * A theme: its thumbnail, name and source, with a checkmark on the chosen one. Tapping it
 * chooses it; in edit mode the checkmark gives way to the removal control.
 */
function ThemeRow({
  theme,
  chosen,
  editing,
  onChoose,
}: {
  theme: TerminalTheme;
  chosen: boolean;
  editing: boolean;
  onChoose: (themeId: string) => void;
}) {
  const colors = useColors();
  const largeText = useLargeText();
  return (
    <Button
      onPress={() => onChoose(theme.id)}
      modifiers={[
        deleteDisabled(!removable(theme)),
        ...(chosen ? [accessibilityAddTraits(["isSelected"])] : []),
      ]}
    >
      <HStack spacing={16} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <ThemeThumbnail colors={theme.colors} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={largeText ? [] : [lineLimit(1)]}>{theme.name}</Text>
          <Text
            modifiers={[
              font({ textStyle: "footnote" }),
              secondary,
              ...(largeText ? [] : [lineLimit(1)]),
            ]}
          >
            {themeSource(theme)}
          </Text>
        </VStack>
        <Spacer minLength={8} />
        {chosen && !editing && (
          <Image
            systemName="checkmark"
            modifiers={[
              font({ textStyle: "body", weight: "semibold" }),
              foregroundStyle({ type: "color", color: colors.tint }),
              accessibilityHidden(),
            ]}
          />
        )}
      </HStack>
    </Button>
  );
}

ThemesScreen satisfies typeof ScreenContract;
