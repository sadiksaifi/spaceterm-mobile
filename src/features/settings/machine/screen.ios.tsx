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
} from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled, listStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

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
                        <HStack>
                          <Text>{text.status}</Text>
                          <Spacer minLength={8} />
                          {reconnecting && (
                            <ProgressView modifiers={[accessibilityLabel(text.loading)]} />
                          )}
                          <Text modifiers={[secondary]}>{machineStatus(connection)}</Text>
                        </HStack>
                        <HStack>
                          <Text>{text.connection}</Text>
                          <Spacer minLength={8} />
                          <Text modifiers={[secondary]}>{text.network}</Text>
                        </HStack>
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
