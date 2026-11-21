import { Host } from "@expo/ui";
import { Button, RNHostView, ScrollView, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import type { ColorValue } from "react-native";

import { commandGuidance, inviteGuidance } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { ActionButton, StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";
import { useLargeText } from "@/shared/ui/large-text";

import { CameraPreview, type PreviewMetrics } from "../components/camera-preview";
import { ProblemAlert } from "../components/ios/problem-alert";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { CameraStepProps } from "./screen";

const PREVIEW: PreviewMetrics = {
  size: 300,
  radius: 32,
  bracket: { size: 34, inset: 18, stroke: 3, radius: 14 },
  bracketColor: "#FFFFFF",
};
/** The instructions keep to the preview's width. */
const TEXT_WIDTH = 300;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

export default function CameraStepScreen({
  access,
  scanning,
  onScan,
  onFakeScan,
  problem,
  onDismissProblem,
  onOpenSettings,
  onPaste,
  onCancel,
}: CameraStepProps) {
  const colors = useColors();
  const largeText = useLargeText();
  const body =
    access === "off" ? (
      <CameraOff onOpenSettings={onOpenSettings} />
    ) : (
      <VStack
        spacing={0}
        modifiers={[
          padding({ top: 14, leading: 24, trailing: 24, bottom: 24 }),
          frame({ maxWidth: FILL }),
        ]}
      >
        <RNHostView matchContents>
          <CameraPreview
            metrics={PREVIEW}
            scanning={scanning}
            onScan={onScan}
            onFakeScan={onFakeScan}
          />
        </RNHostView>
        <Guidance color={colors.text} />
      </VStack>
    );
  const paste = (
    <Button
      onPress={onPaste}
      modifiers={[
        buttonStyle("bordered"),
        buttonBorderShape("capsule"),
        controlSize("large"),
        padding({ leading: 20, trailing: 20, bottom: 4 }),
      ]}
    >
      <Text modifiers={[font({ textStyle: "body", weight: "medium" }), frame({ maxWidth: FILL })]}>
        {text.pasteInvitationLink}
      </Text>
    </Button>
  );
  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.cancel} onPress={onCancel} />
      </Stack.Toolbar>
      <Host style={{ flex: 1, backgroundColor: colors.background }}>
        <ProblemAlert problem={problem} onDismiss={onDismissProblem}>
          {largeText ? (
            // At accessibility text sizes Paste Invitation Link scrolls with the rest, as pinned
            // it would cover half the sheet.
            <ScrollView>
              <VStack spacing={0} modifiers={[padding({ bottom: 24 }), frame({ maxWidth: FILL })]}>
                {body}
                {paste}
              </VStack>
            </ScrollView>
          ) : (
            <VStack spacing={0} modifiers={[frame({ maxWidth: FILL, maxHeight: FILL })]}>
              {access === "off" ? body : <ScrollView>{body}</ScrollView>}
              {paste}
            </VStack>
          )}
        </ProblemAlert>
      </Host>
    </>
  );
}

/** Where the QR code comes from, under the preview. */
function Guidance({ color }: { color: ColorValue }) {
  const [choose, invite, inDesktop, machines, settings] = inviteGuidance;
  const [orRun, command, onMachine] = commandGuidance;
  const paragraph = [
    font({ textStyle: "subheadline" }),
    secondary,
    multilineTextAlignment("center"),
    frame({ maxWidth: TEXT_WIDTH }),
  ];
  return (
    <>
      <Text modifiers={[...paragraph, padding({ top: 24 })]}>
        {choose}
        {nameText(invite, color)}
        {inDesktop}
        {nameText(machines, color)}
        {settings}
      </Text>
      <Text modifiers={[...paragraph, padding({ top: 8 })]}>
        {orRun}
        <Text
          modifiers={[
            font({ textStyle: "subheadline", design: "monospaced" }),
            foregroundStyle({ type: "color", color }),
          ]}
        >
          {command}
        </Text>
        {onMachine}
      </Text>
    </>
  );
}

/**
 * A name inside a sentence, in semibold and the text color. A plain function, not a component: a
 * nested Text renders only when the element passed in is a Text itself.
 */
function nameText(name: string, color: ColorValue) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "subheadline", weight: "semibold" }),
        foregroundStyle({ type: "color", color }),
      ]}
    >
      {name}
    </Text>
  );
}

/** What takes the camera's place when the app may not use it. */
function CameraOff({ onOpenSettings }: { onOpenSettings: () => void }) {
  // At accessibility text sizes the screen scrolls, so the state keeps to its own height.
  const largeText = useLargeText();
  const state = (
    <VStack
      spacing={0}
      modifiers={[
        padding({ top: largeText ? 24 : 0, leading: 40, trailing: 40, bottom: 24 }),
        frame({ maxWidth: FILL, maxHeight: largeText ? undefined : FILL }),
      ]}
    >
      <StateIcon systemName="camera" />
      <StateTitle>{text.cameraOff}</StateTitle>
      <StateBody>{text.cameraOffBody}</StateBody>
      <VStack modifiers={[padding({ top: 20 })]}>
        <ActionButton label={text.openSettings} onPress={onOpenSettings} prominent fitsLabel />
      </VStack>
    </VStack>
  );
  return state;
}

CameraStepScreen satisfies typeof ScreenContract;
