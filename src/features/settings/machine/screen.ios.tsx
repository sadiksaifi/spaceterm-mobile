import { Host } from "@expo/ui";
import {
  Alert,
  Button,
  HStack,
  List,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled, listStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";
import { useLargeText } from "@/shared/ui/large-text";

import { machineStatus, restartBody, text } from "../text";
import type ScreenContract from "./screen";
import type { MachinePageProps } from "./screen";

export default function MachinePageScreen({ machine, terminalSessions, page }: MachinePageProps) {
  const colors = useColors();
  const { connection } = machine;
  const connected = connection === "connected";
  const reconnecting = connection === "reconnecting";
  const sessions = restartBody(terminalSessions, machine.name);
  // A failure waits for an open alert to close.
  const failure = page.alert === null ? page.failure : null;
  return (
    <>
      <Stack.Screen.Title>{machine.name}</Stack.Screen.Title>
      <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
        <Alert
          title={text.restartFailed}
          isPresented={failure !== null}
          onIsPresentedChange={(shown) => !shown && failure && page.dismissFailure(failure)}
        >
          <Alert.Trigger>
            <Alert
              title={text.restartTitle}
              isPresented={page.alert === "restart"}
              onIsPresentedChange={(shown) => !shown && page.cancel()}
            >
              <Alert.Trigger>
                <Alert
                  title={text.unpairTitle}
                  isPresented={page.alert === "unpair"}
                  onIsPresentedChange={(shown) => !shown && page.cancel()}
                >
                  <Alert.Trigger>
                    <List modifiers={[listStyle("insetGrouped")]}>
                      <Section>
                        <ValueRow
                          label={text.status}
                          value={machineStatus(connection)}
                          busy={reconnecting}
                        />
                        <ValueRow label={text.connection} value={text.network} />
                      </Section>
                      <Section>
                        {connected ? (
                          <Button label={text.disconnect} onPress={page.disconnect} />
                        ) : (
                          <Button
                            label={text.connect}
                            onPress={page.connect}
                            modifiers={[disabled(reconnecting)]}
                          />
                        )}
                        <Button
                          label={text.restartCore}
                          onPress={page.askRestart}
                          modifiers={[disabled(!connected || page.restarting)]}
                        />
                      </Section>
                      <Section>
                        <Button label={text.unpair} role="destructive" onPress={page.askUnpair} />
                      </Section>
                    </List>
                  </Alert.Trigger>
                  <Alert.Actions>
                    <Button label={text.cancel} role="cancel" onPress={page.cancel} />
                    <Button label={text.unpairAction} role="destructive" onPress={page.unpair} />
                  </Alert.Actions>
                  <Alert.Message>
                    <Text>{text.unpairBody(machine.name)}</Text>
                  </Alert.Message>
                </Alert>
              </Alert.Trigger>
              <Alert.Actions>
                <Button label={text.cancel} role="cancel" onPress={page.cancel} />
                <Button label={text.restart} role="destructive" onPress={page.restart} />
              </Alert.Actions>
              {sessions && (
                <Alert.Message>
                  <Text>{sessions}</Text>
                </Alert.Message>
              )}
            </Alert>
          </Alert.Trigger>
          <Alert.Actions>
            <Button
              label={text.cancel}
              role="cancel"
              onPress={() => failure && page.dismissFailure(failure)}
            />
            <Button label={text.tryAgain} onPress={() => failure && page.retry(failure)} />
          </Alert.Actions>
        </Alert>
      </Host>
    </>
  );
}

MachinePageScreen satisfies typeof ScreenContract;

/** A label and its value. Large text puts the value under the label, whole, as iOS Settings does. */
function ValueRow({
  label,
  value,
  busy = false,
}: {
  label: string;
  value: string;
  busy?: boolean;
}) {
  const largeText = useLargeText();
  const shown = (
    <HStack spacing={12}>
      {busy && <ProgressView modifiers={[accessibilityLabel(text.loading)]} />}
      <Text modifiers={[secondary]}>{value}</Text>
    </HStack>
  );
  return largeText ? (
    <VStack alignment="leading" spacing={2}>
      <Text>{label}</Text>
      {shown}
    </VStack>
  ) : (
    <HStack>
      <Text>{label}</Text>
      <Spacer minLength={8} />
      {shown}
    </HStack>
  );
}
