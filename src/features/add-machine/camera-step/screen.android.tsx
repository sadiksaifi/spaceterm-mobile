import cameraIcon from "@expo/material-symbols/photo_camera.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import {
  Button,
  Column,
  FilledTonalButton,
  Icon,
  IconButton,
  RNHostView,
  Shape,
  Surface,
  Text,
  TopAppBar,
} from "@expo/ui/jetpack-compose";
import {
  background,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";

import { heading } from "@/modules/compose-modifiers";
import { commandGuidance, inviteGuidance } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { StateBody, StateTile } from "@/shared/ui/android/state";

import { CameraPreview, type PreviewMetrics } from "../components/camera-preview";
import { text } from "../text";
import type ScreenContract from "./screen";
import type { CameraStepProps } from "./screen";

const PREVIEW_SIZE = 316;
const PREVIEW_RADIUS = 28;
/** The command in the sentence, as the mockup sets it: 13 sp monospace, medium, in the text color. */
const COMMAND_SIZE = 13;

export default function CameraStepScreen({
  access,
  scanning,
  onScan,
  onFakeScan,
  onOpenSettings,
  onPaste,
  onCancel,
}: CameraStepProps) {
  const colors = useColors();
  const preview: PreviewMetrics = {
    size: PREVIEW_SIZE,
    radius: PREVIEW_RADIUS,
    bracket: { size: 36, inset: 44, stroke: 4, radius: 12 },
    bracketColor: String(colors.text),
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.background)]}>
          <TopAppBar>
            <TopAppBar.NavigationIcon>
              <IconButton onClick={onCancel}>
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

          <Column
            horizontalAlignment="center"
            modifiers={[fillMaxWidth(), weight(1), verticalScroll()]}
          >
            {access === "off" ? (
              <CameraOff onOpenSettings={onOpenSettings} />
            ) : (
              <>
                <Guidance />
                <RNHostView matchContents>
                  <CameraPreview
                    metrics={preview}
                    scanning={scanning}
                    onScan={onScan}
                    onFakeScan={onFakeScan}
                  />
                </RNHostView>
              </>
            )}
            <FilledTonalButton onClick={onPaste} modifiers={[padding(0, 24, 0, 24)]}>
              <Text>{text.pasteInvitationLink}</Text>
            </FilledTonalButton>
          </Column>
        </Column>
      </ScreenHost>
    </>
  );
}

/** Where the QR code comes from, above the preview. */
function Guidance() {
  const colors = useColors();
  const [choose, invite, inDesktop, machines, settings] = inviteGuidance;
  const [orRun, command, onMachine] = commandGuidance;
  const name = (value: string) => (
    <Text style={{ fontWeight: "600" }} color={colors.text}>
      {value}
    </Text>
  );
  const paragraph = { typography: "bodyLarge", textAlign: "center" } as const;
  return (
    <>
      <Text style={paragraph} color={colors.secondaryText} modifiers={[padding(32, 4, 32, 0)]}>
        {choose}
        {name(invite)}
        {inDesktop}
        {name(machines)}
        {settings}
      </Text>
      <Text style={paragraph} color={colors.secondaryText} modifiers={[padding(32, 8, 32, 24)]}>
        {orRun}
        <Text
          style={{ fontFamily: "monospace", fontSize: COMMAND_SIZE, fontWeight: "500" }}
          color={colors.text}
        >
          {command}
        </Text>
        {onMachine}
      </Text>
    </>
  );
}

/** A card in the camera's place when the app may not use it. It grows with large text. */
function CameraOff({ onOpenSettings }: { onOpenSettings: () => void }) {
  const colors = useColors();
  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({ cornerRadii: corners(PREVIEW_RADIUS) })}
      modifiers={[padding(0, 8, 0, 0), width(PREVIEW_SIZE)]}
    >
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[defaultMinSize({ minHeight: PREVIEW_SIZE }), padding(32, 24, 32, 24)]}
      >
        <StateTile icon={cameraIcon} />
        <Text style={{ typography: "titleMedium", textAlign: "center" }} modifiers={[heading()]}>
          {text.cameraOff}
        </Text>
        <StateBody>{text.cameraOffBody}</StateBody>
        <Button onClick={onOpenSettings} modifiers={[padding(0, 20, 0, 0)]}>
          <Text>{text.openSettings}</Text>
        </Button>
      </Column>
    </Surface>
  );
}

const corners = (radius: number) => ({
  topStart: radius,
  topEnd: radius,
  bottomStart: radius,
  bottomEnd: radius,
});

CameraStepScreen satisfies typeof ScreenContract;
