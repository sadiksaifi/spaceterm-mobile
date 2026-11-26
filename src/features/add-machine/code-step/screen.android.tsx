import arrowBackIcon from "@expo/material-symbols/arrow_back.xml";
import cancelIcon from "@expo/material-symbols/cancel.xml";
import checkCircleIcon from "@expo/material-symbols/check_circle.xml";
import {
  Button,
  Column,
  Icon,
  IconButton,
  LoadingIndicator,
  Text,
  TextButton,
  TopAppBar,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  padding,
  semantics,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";

import { heading } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";
import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import {
  Centered,
  StateActions,
  StateBody,
  StateTile,
  StateTitle,
} from "@/shared/ui/android/state";

import { failedBody, text } from "../text";
import type ScreenContract from "./screen";
import type { CodeStepProps } from "./screen";

/** The code, as the mockup sets it: 48 sp monospace, medium, spaced out. */
const CODE_SIZE = 48;
/** The most the code grows with the text: as far as seven characters still fit a phone's width. */
const MAX_CODE_SCALE = 1.5;
const CODE_SPACING = 2;
const LOADING_SIZE = 48;

export default function CodeStepScreen({
  machineName,
  pairing,
  onBack,
  onTryAgain,
  onStopUnfinished,
  onClose,
}: CodeStepProps) {
  const colors = useColors();
  const material = useMaterialColors();
  const { fontScale } = useWindowDimensions();
  const [askingStop, setAskingStop] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.background)]}>
          <TopAppBar>
            {/* Paired leaves only by Done. */}
            {pairing.kind !== "paired" && (
              <TopAppBar.NavigationIcon>
                <IconButton onClick={onBack}>
                  <Icon source={arrowBackIcon} contentDescription={text.back} />
                </IconButton>
              </TopAppBar.NavigationIcon>
            )}
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

          {pairing.kind === "reaching" || pairing.kind === "comparing" ? (
            <Centered bottom={140}>
              <Text
                style={{ typography: "labelLarge", textAlign: "center" }}
                color={colors.secondaryText}
              >
                {text.comparisonCode}
              </Text>
              {pairing.kind === "reaching" ? (
                <LoadingIndicator
                  color={material.primary}
                  modifiers={[
                    padding(0, 16, 0, 0),
                    size(LOADING_SIZE, LOADING_SIZE),
                    semantics({ contentDescription: text.loading }),
                  ]}
                />
              ) : (
                <>
                  {/* The code is compared digit by digit, so it never breaks across lines. */}
                  <Text
                    maxLines={1}
                    softWrap={false}
                    style={{
                      fontFamily: "monospace",
                      // Sizes in sp grow with the text; this stops the growth at MAX_CODE_SCALE.
                      fontSize: CODE_SIZE * Math.min(1, MAX_CODE_SCALE / fontScale),
                      fontWeight: "500",
                      letterSpacing: CODE_SPACING,
                    }}
                    modifiers={[
                      padding(0, 8, 0, 0),
                      semantics({ contentDescription: text.codeLabel(pairing.code) }),
                    ]}
                  >
                    {pairing.code}
                  </Text>
                  <StateBody top={16}>{text.sameCode(machineName)}</StateBody>
                  <Column horizontalAlignment="center" modifiers={[padding(0, 24, 0, 0)]}>
                    <LoadingIndicator
                      color={material.primary}
                      modifiers={[
                        size(LOADING_SIZE, LOADING_SIZE),
                        semantics({ contentDescription: text.loading }),
                      ]}
                    />
                    <Text
                      style={{ typography: "bodyLarge", textAlign: "center" }}
                      modifiers={[padding(0, 4, 0, 0)]}
                    >
                      {text.waiting(machineName)}
                    </Text>
                  </Column>
                </>
              )}
              <TextButton onClick={onClose} modifiers={[padding(0, 16, 0, 0)]}>
                <Text>{text.cancel}</Text>
              </TextButton>
            </Centered>
          ) : pairing.kind === "paired" ? (
            <Centered bottom={120}>
              <StateTile icon={checkCircleIcon} />
              <StateTitle>{text.paired(machineName)}</StateTitle>
              <StateActions>
                <Button onClick={onClose}>
                  <Text>{text.done}</Text>
                </Button>
              </StateActions>
            </Centered>
          ) : (
            <Centered bottom={120}>
              <StateTile icon={cancelIcon} failed />
              <StateTitle>{text.couldNotPair(machineName)}</StateTitle>
              <StateBody>{failedBody(pairing, machineName)}</StateBody>
              <StateActions>
                {pairing.kind !== "full" ? (
                  <Button onClick={onTryAgain}>
                    <Text>{text.tryAgain}</Text>
                  </Button>
                ) : (
                  pairing.unfinished > 0 && (
                    <Button onClick={() => setAskingStop(true)}>
                      <Text>{text.stopUnfinished}</Text>
                    </Button>
                  )
                )}
                <TextButton onClick={onClose}>
                  <Text>{text.cancel}</Text>
                </TextButton>
              </StateActions>
              {pairing.kind === "full" && askingStop && (
                <ConfirmDialog
                  title={text.stopTitle(pairing.unfinished)}
                  body={text.stopBody}
                  cancel={text.cancel}
                  action={text.stop}
                  onCancel={() => setAskingStop(false)}
                  onConfirm={() => {
                    setAskingStop(false);
                    onStopUnfinished();
                  }}
                />
              )}
            </Centered>
          )}
        </Column>
      </ScreenHost>
    </>
  );
}

CodeStepScreen satisfies typeof ScreenContract;
