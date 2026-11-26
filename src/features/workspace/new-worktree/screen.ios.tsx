import { Host } from "@expo/ui";
import {
  Alert,
  Button,
  HStack,
  List,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  autocorrectionDisabled,
  foregroundStyle,
  listRowBackground,
  listRowInsets,
  listStyle,
  multilineTextAlignment,
  pickerStyle,
  tag,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { Color, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

import type { Picker as BranchPicker, WorktreeKind } from "./form";
import type ScreenContract from "./screen";
import type { NewWorktreeScreenProps } from "./screen";
import { failureText, kindText, problemText, text } from "./text";

const KINDS: readonly WorktreeKind[] = ["new", "existing", "remote"];

export default function NewWorktreeScreen({ worktree, onClose }: NewWorktreeScreenProps) {
  const colors = useColors();
  const { form, state, creating, failure } = worktree;
  const view = form?.view ?? null;
  const problem = form?.problem ?? null;

  return (
    <>
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel={text.close} onPress={onClose} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {creating ? (
          <Stack.Toolbar.View>
            <ActivityIndicator style={styles.spinner} />
          </Stack.Toolbar.View>
        ) : (
          // Gray until the form can be confirmed.
          <Stack.Toolbar.Button
            icon="checkmark"
            variant="prominent"
            accessibilityLabel={text.create}
            disabled={form?.request == null}
            onPress={worktree.create}
          />
        )}
      </Stack.Toolbar>
      <Host style={[styles.fill, { backgroundColor: colors.groupedBackground }]}>
        <Alert
          title={failure ? failureText[failure] : ""}
          isPresented={failure !== null}
          onIsPresentedChange={(shown) => !shown && failure && worktree.dismissFailure()}
        >
          <Alert.Trigger>
            <List modifiers={[listStyle("insetGrouped")]}>
              <Section>
                <Picker
                  selection={state.kind}
                  onSelectionChange={worktree.setKind}
                  modifiers={[
                    pickerStyle("segmented"),
                    listRowBackground("clear"),
                    listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
                    accessibilityLabel(text.kind),
                  ]}
                >
                  {KINDS.map((kind) => (
                    <Text key={kind} modifiers={[tag(kind)]}>
                      {kindText[kind]}
                    </Text>
                  ))}
                </Picker>
              </Section>
              <Section
                footer={
                  problem === null ? (
                    <Text>{text.hooks}</Text>
                  ) : (
                    <Text
                      modifiers={[foregroundStyle({ type: "color", color: Color.ios.systemRed })]}
                    >
                      {problemText[problem]}
                    </Text>
                  )
                }
              >
                {(view?.kind ?? state.kind) === "new" && (
                  <>
                    <NameRow
                      label={text.branchName}
                      value={view?.kind === "new" ? view.name : state.newBranch.name}
                      onChange={worktree.setName}
                    />
                    <BranchRow
                      label={text.startFrom}
                      picker={view?.kind === "new" ? view.startFrom : null}
                      onPick={worktree.pick}
                    />
                  </>
                )}
                {(view?.kind ?? state.kind) === "existing" && (
                  <BranchRow
                    label={text.branch}
                    picker={view?.kind === "existing" ? view.branch : null}
                    onPick={worktree.pick}
                  />
                )}
                {(view?.kind ?? state.kind) === "remote" && (
                  <>
                    <BranchRow
                      label={text.remoteBranch}
                      picker={view?.kind === "remote" ? view.remote : null}
                      onPick={worktree.pick}
                    />
                    <NameRow
                      label={text.localBranchName}
                      value={view?.kind === "remote" ? view.local : ""}
                      onChange={worktree.setName}
                    />
                  </>
                )}
                <LocationRow
                  key={state.kind}
                  value={view?.location ?? ""}
                  onChange={worktree.setLocation}
                />
              </Section>
            </List>
          </Alert.Trigger>
          <Alert.Actions>
            <Button label={text.cancel} role="cancel" onPress={worktree.dismissFailure} />
            <Button label={text.tryAgain} onPress={worktree.retry} />
          </Alert.Actions>
        </Alert>
      </Host>
    </>
  );
}

/**
 * A text field that shows `value`, which can change without typing, as the Location does while
 * it follows the rule. Only such a change is pushed into the field. A value that echoes typed
 * text can arrive after more keys were typed; pushing it would drop those keys.
 */
function useBoundField(value: string, onChange?: (typed: string) => void) {
  const field = useNativeState(value);
  const typed = useRef<string[]>([]);
  useEffect(() => {
    const echo = typed.current.indexOf(value);
    if (echo === -1) {
      typed.current = [];
      if (field.get() !== value) field.set(value);
    } else {
      typed.current = typed.current.slice(echo + 1);
    }
  }, [field, value]);
  const onTextChange = (text: string) => {
    typed.current.push(text);
    onChange?.(text);
  };
  return { field, onTextChange };
}

/** Branch Name or Local Branch Name: the label, and the name typed at the trailing edge. */
function NameRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (typed: string) => void;
}) {
  const { field, onTextChange } = useBoundField(value, onChange);
  return (
    <HStack>
      <Text>{label}</Text>
      <Spacer minLength={12} />
      {/* Branch names are lowercase and use slashes, which autocorrect would mangle. */}
      <TextField
        text={field}
        onTextChange={onTextChange}
        modifiers={[
          multilineTextAlignment("trailing"),
          textInputAutocapitalization("never"),
          autocorrectionDisabled(),
          accessibilityLabel(label),
        ]}
      />
    </HStack>
  );
}

/**
 * Start From, Branch or Remote Branch: the system's menu picker. A loading indicator shows until
 * the branches arrive; a list with no branch reads No Branches and cannot be opened.
 */
function BranchRow({
  label,
  picker,
  onPick,
}: {
  label: string;
  picker: BranchPicker | null;
  onPick: (branch: string) => void;
}) {
  if (picker === null || picker.value === null) {
    return (
      <HStack>
        <Text>{label}</Text>
        <Spacer />
        {picker === null ? (
          <ProgressView modifiers={[accessibilityLabel(text.loading)]} />
        ) : (
          <Text modifiers={[secondary]}>{text.noBranches}</Text>
        )}
      </HStack>
    );
  }
  return (
    <Picker
      label={label}
      selection={picker.value}
      onSelectionChange={(branch: string | null) => branch !== null && onPick(branch)}
      modifiers={[pickerStyle("menu")]}
    >
      {picker.options.map((branch) => (
        <Text key={branch} modifiers={[tag(branch)]}>
          {branch}
        </Text>
      ))}
    </Picker>
  );
}

/** Location over the path, which follows the rule until the person changes it. */
function LocationRow({ value, onChange }: { value: string; onChange: (typed: string) => void }) {
  const { field, onTextChange } = useBoundField(value, onChange);
  return (
    <VStack alignment="leading" spacing={2}>
      <Text>{text.location}</Text>
      <TextField
        text={field}
        onTextChange={onTextChange}
        modifiers={[
          secondary,
          textInputAutocapitalization("never"),
          autocorrectionDisabled(),
          accessibilityLabel(text.location),
        ]}
      />
    </VStack>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spinner: { width: 36, height: 36 },
});

NewWorktreeScreen satisfies typeof ScreenContract;
