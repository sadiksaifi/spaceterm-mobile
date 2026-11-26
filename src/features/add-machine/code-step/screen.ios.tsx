import { Host } from "@expo/ui";
import { Alert, Button, HStack, ProgressView, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityLabel,
  font,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { ActionButton, StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";
import { useLargeText } from "@/shared/ui/large-text";

import { failedBody, text } from "../text";
import type ScreenContract from "./screen";
import type { CodeStepProps } from "./screen";

/** The code, as the mockup sets it: 56 pt bold. It grows with the text, as far as Large Title does. */
const CODE_SIZE = 56;
const MAX_CODE_SCALE = 1.76;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

export default function CodeStepScreen({
  machineName,
  pairing,
  onTryAgain,
  onStopUnfinished,
  onClose,
}: CodeStepProps) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const [askingStop, setAskingStop] = useState(false);

  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      {/* Paired leaves only by Done. */}
      <Stack.Screen
        options={{
          headerBackVisible: pairing.kind !== "paired",
          gestureEnabled: pairing.kind !== "paired",
        }}
      />
      <Host style={{ flex: 1, backgroundColor: colors.background }}>
        {pairing.kind === "reaching" || pairing.kind === "comparing" ? (
          <ScrollView>
            <VStack
              spacing={0}
              modifiers={[
                padding({ top: 96, leading: 24, trailing: 24, bottom: 24 }),
                frame({ maxWidth: FILL }),
              ]}
            >
              <Text
                modifiers={[
                  font({ textStyle: "subheadline" }),
                  secondary,
                  multilineTextAlignment("center"),
                ]}
              >
                {text.comparisonCode}
              </Text>
              {pairing.kind === "reaching" ? (
                <VStack modifiers={[padding({ top: 24 })]}>
                  <ProgressView modifiers={[accessibilityLabel(text.loading)]} />
                </VStack>
              ) : (
                <>
                  <Text
                    modifiers={[
                      font({
                        size: CODE_SIZE * Math.min(fontScale, MAX_CODE_SCALE),
                        weight: "bold",
                      }),
                      monospacedDigit(),
                      kerning(1),
                      // The code is compared digit by digit, so it never breaks across lines.
                      lineLimit(1),
                      minimumScaleFactor(0.5),
                      padding({ top: 6 }),
                      accessibilityLabel(text.codeLabel(pairing.code)),
                    ]}
                  >
                    {pairing.code}
                  </Text>
                  <Text
                    modifiers={[
                      font({ textStyle: "body" }),
                      multilineTextAlignment("center"),
                      padding({ top: 16 }),
                    ]}
                  >
                    {text.sameCode(machineName)}
                  </Text>
                  <HStack
                    spacing={10}
                    modifiers={[padding({ top: 40 }), accessibilityElement("combine")]}
                  >
                    <ProgressView />
                    <Text
                      modifiers={[
                        font({ textStyle: "subheadline" }),
                        secondary,
                        multilineTextAlignment("center"),
                      ]}
                    >
                      {text.waiting(machineName)}
                    </Text>
                  </HStack>
                </>
              )}
              <VStack modifiers={[padding({ top: 28 })]}>
                <ActionButton label={text.cancel} onPress={onClose} />
              </VStack>
            </VStack>
          </ScrollView>
        ) : pairing.kind === "paired" ? (
          <Ended>
            <StateIcon systemName="checkmark.circle" />
            <StateTitle>{text.paired(machineName)}</StateTitle>
            <VStack modifiers={[padding({ top: 20 })]}>
              <ActionButton label={text.done} onPress={onClose} prominent />
            </VStack>
          </Ended>
        ) : (
          <Ended>
            <StateIcon systemName="xmark.circle" />
            <StateTitle>{text.couldNotPair(machineName)}</StateTitle>
            <StateBody>{failedBody(pairing, machineName)}</StateBody>
            <Alert
              title={pairing.kind === "full" ? text.stopTitle(pairing.unfinished) : ""}
              isPresented={askingStop}
              onIsPresentedChange={setAskingStop}
            >
              <Alert.Trigger>
                <VStack spacing={10} modifiers={[padding({ top: 20 })]}>
                  {pairing.kind !== "full" ? (
                    <ActionButton label={text.tryAgain} onPress={onTryAgain} prominent />
                  ) : (
                    pairing.unfinished > 0 && (
                      <ActionButton
                        label={text.stopUnfinished}
                        onPress={() => setAskingStop(true)}
                        prominent
                      />
                    )
                  )}
                  <ActionButton label={text.cancel} onPress={onClose} />
                </VStack>
              </Alert.Trigger>
              <Alert.Actions>
                <Button label={text.cancel} role="cancel" onPress={() => setAskingStop(false)} />
                <Button
                  label={text.stop}
                  role="destructive"
                  onPress={() => {
                    setAskingStop(false);
                    onStopUnfinished();
                  }}
                />
              </Alert.Actions>
              <Alert.Message>
                <Text>{text.stopBody}</Text>
              </Alert.Message>
            </Alert>
          </Ended>
        )}
      </Host>
    </>
  );
}

/**
 * How the pairing ended, centered above the middle of the sheet. At accessibility text sizes it
 * can be taller than the sheet, so it scrolls from the top instead.
 */
function Ended({ children }: { children: ReactNode }) {
  const largeText = useLargeText();
  const state = (
    <VStack
      spacing={0}
      modifiers={[
        padding({ top: largeText ? 24 : 0, leading: 32, trailing: 32, bottom: 120 }),
        frame({ maxWidth: FILL, maxHeight: largeText ? undefined : FILL }),
      ]}
    >
      {children}
    </VStack>
  );
  return largeText ? <ScrollView>{state}</ScrollView> : state;
}

CodeStepScreen satisfies typeof ScreenContract;
