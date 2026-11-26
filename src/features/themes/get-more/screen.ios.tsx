import { Host } from "@expo/ui";
import {
  Alert,
  Button,
  ContentUnavailableView,
  HStack,
  List,
  ListForEach,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  font,
  frame,
  lineLimit,
  listRowBackground,
  listStyle,
  refreshable,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { type ReactNode, useState } from "react";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { useLargeText } from "@/shared/ui/large-text";

import type { CatalogExtension } from "./catalog";
import type ScreenContract from "./screen";
import type { GetMoreProps } from "./screen";
import { failureText, text } from "./text";
import type { GetMoreFailure, GetMorePage } from "./use-get-more";

/** The Get, spinner and Remove slot, as wide as the design draws it, so rows line up. */
const CONTROL = { width: 64, height: 32 } as const;
/** How long an iOS alert takes to close, after which another can open. */
const ALERT_CLOSE_MS = 400;
/** The empty, loading and error states sit lower in the space below the Import row. */
const STATE_PADDING = 48;

export default function GetMoreScreen({ page, onClose }: GetMoreProps) {
  const colors = useColors();
  const filtering = page.query.trim() !== "";
  // A failure waits for an open alert to close. The alert keeps the failure it opened with until
  // it closes, so closing it answers only that one; a failure that arrives meanwhile opens next.
  const [failure, setFailure] = useState<GetMoreFailure | null>(null);
  const waiting = page.removing === null ? page.failure : null;
  // The native alert opens again only once it has seen `isPresented` turn false and finished
  // closing, so the next failure waits that long.
  const [closing, setClosing] = useState(false);
  if (failure === null && !closing && waiting !== null) setFailure(waiting);
  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.close} onPress={onClose} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="arrow.clockwise"
          accessibilityLabel={text.refresh}
          onPress={() => void page.refresh()}
        />
      </Stack.Toolbar>
      <Stack.SearchBar
        placeholder={text.search}
        onChangeText={(event) => page.setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => page.setQuery("")}
        // The sheet keeps Close and its title while a search has text.
        hideNavigationBar={false}
      />
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.SearchBarSlot />
      </Stack.Toolbar>

      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <Alert
          title={failure === null ? "" : failureText(failure).title}
          isPresented={failure !== null}
          // The alert reports closing after Try Again too; by then its failure is answered.
          onIsPresentedChange={(shown) => {
            if (shown || failure === null) return;
            page.dismissFailure(failure);
            setFailure(null);
            setClosing(true);
            setTimeout(() => setClosing(false), ALERT_CLOSE_MS);
          }}
        >
          <Alert.Trigger>
            <Alert
              title={page.removing === null ? "" : text.removeTitle(page.removing.name)}
              isPresented={page.removing !== null}
              onIsPresentedChange={(shown) => !shown && page.cancelRemove()}
            >
              <Alert.Trigger>
                <List modifiers={[listStyle("insetGrouped"), refreshable(page.refresh)]}>
                  {/* While a search has text, the page shows only what it finds. */}
                  {!filtering && (
                    <Section
                      header={
                        <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
                          {text.intro}
                        </Text>
                      }
                    >
                      <Button label={text.importFromFile} onPress={page.importFile} />
                    </Section>
                  )}
                  <CatalogSection page={page} filtering={filtering} />
                </List>
              </Alert.Trigger>
              <Alert.Actions>
                <Button label={text.cancel} role="cancel" onPress={page.cancelRemove} />
                <Button label={text.remove} role="destructive" onPress={page.remove} />
              </Alert.Actions>
              <Alert.Message>
                <Text>{text.removeBody}</Text>
              </Alert.Message>
            </Alert>
          </Alert.Trigger>
          <Alert.Actions>
            <Button
              label={text.cancel}
              role="cancel"
              onPress={() => failure !== null && page.dismissFailure(failure)}
            />
            <Button
              label={text.tryAgain}
              onPress={() => failure !== null && page.retryFailure(failure)}
            />
          </Alert.Actions>
          {failure !== null && (
            <Alert.Message>
              <Text>{failureText(failure).body}</Text>
            </Alert.Message>
          )}
        </Alert>
      </Host>
    </>
  );
}

/** The extension list, or what shows in its place while it loads, fails or finds nothing. */
function CatalogSection({ page, filtering }: { page: GetMorePage; filtering: boolean }) {
  const { list } = page;
  if (list.kind === "loading") {
    return (
      <StateSection>
        <ProgressView modifiers={[accessibilityLabel(text.loading)]}>
          <Text>{text.loading}</Text>
        </ProgressView>
      </StateSection>
    );
  }
  if (list.kind === "unavailable") {
    return (
      <StateSection>
        <ContentUnavailableView
          title={text.unavailableTitle}
          systemImage="exclamationmark.triangle"
          description={text.checkConnection}
          actions={
            <Button
              label={text.tryAgain}
              onPress={page.retry}
              modifiers={[buttonStyle("borderedProminent"), buttonBorderShape("capsule")]}
            />
          }
        />
      </StateSection>
    );
  }
  if (list.extensions.length === 0 && filtering) {
    return (
      <StateSection>
        <ContentUnavailableView
          title={text.noResults(page.query.trim())}
          systemImage="magnifyingglass"
          description={text.noResultsBody}
        />
      </StateSection>
    );
  }
  return (
    <Section>
      <ListForEach
        data={list.extensions}
        keyExtractor={(extension) => extension.id}
        recycling
        estimatedItemSize={60}
      >
        {({ item }) => <ExtensionRow extension={item} page={page} />}
      </ListForEach>
    </Section>
  );
}

/** A section that shows one centered state on the page background, not on a row. */
function StateSection({ children }: { children: ReactNode }) {
  return (
    <Section>
      <VStack
        modifiers={[
          frame({ maxWidth: Number.POSITIVE_INFINITY }),
          padding({ vertical: STATE_PADDING }),
          listRowBackground("clear"),
        ]}
      >
        {children}
      </VStack>
    </Section>
  );
}

/** An extension: its name, authors and downloads, and Get, a spinner, or Remove. */
function ExtensionRow({ extension, page }: { extension: CatalogExtension; page: GetMorePage }) {
  const largeText = useLargeText();
  const state = page.state(extension);
  const capsule = [buttonStyle("bordered"), buttonBorderShape("capsule")];
  // Get and Remove share one label style, at least as wide as the slot, so rows line up.
  const label = (title: string) => (
    <Text
      modifiers={[
        font({ textStyle: "subheadline", weight: "semibold" }),
        frame({ minWidth: CONTROL.width - 24 }),
      ]}
    >
      {title}
    </Text>
  );
  const details = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={largeText ? [] : [lineLimit(1)]}>{extension.name}</Text>
      <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
        {text.details(extension.author, extension.downloads)}
      </Text>
    </VStack>
  );
  const control =
    state === "installing" ? (
      <VStack
        modifiers={[
          frame({ width: CONTROL.width, height: CONTROL.height }),
          accessibilityLabel(text.installing(extension.name)),
        ]}
      >
        <ProgressView />
      </VStack>
    ) : state === "installed" ? (
      <Button
        role="destructive"
        onPress={() => page.askRemove(extension)}
        modifiers={[...capsule, accessibilityLabel(text.removeLabel(extension.name))]}
      >
        {label(text.remove)}
      </Button>
    ) : (
      <Button
        onPress={() => page.get(extension)}
        modifiers={[...capsule, accessibilityLabel(text.getLabel(extension.name))]}
      >
        {label(text.get)}
      </Button>
    );
  // Large text gives the name the row's width and puts the control under it.
  return largeText ? (
    <VStack alignment="leading" spacing={8}>
      {details}
      {control}
    </VStack>
  ) : (
    <HStack spacing={12}>
      {details}
      <Spacer minLength={8} />
      {control}
    </HStack>
  );
}

GetMoreScreen satisfies typeof ScreenContract;
