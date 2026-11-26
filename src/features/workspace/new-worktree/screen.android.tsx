import closeIcon from "@expo/material-symbols/close.xml";
import dropDownIcon from "@expo/material-symbols/arrow_drop_down.xml";
import {
  Button,
  Column,
  CircularProgressIndicator,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Icon,
  IconButton,
  OutlinedTextField,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  TopAppBar,
  useMaterialColors,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  menuAnchor,
  padding,
  size,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import type { FormProblem, Picker, WorktreeKind } from "./form";
import type ScreenContract from "./screen";
import type { NewWorktreeScreenProps } from "./screen";
import { failureText, kindText, problemText, text } from "./text";

const KINDS: readonly WorktreeKind[] = ["new", "existing", "remote"];
const SPINNER = 24;

export default function NewWorktreeScreen({ worktree, onClose }: NewWorktreeScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { form, state, creating, failure } = worktree;
  const view = form?.view ?? null;
  const problem = form?.problem ?? null;
  const kind = view?.kind ?? state.kind;
  // The snackbar takes an object, the same one until the failure changes.
  const shown = useMemo(() => (failure === null ? null : { failure }), [failure]);
  const snackbar = useSnackbar(
    shown,
    ({ failure: shown }) => ({ message: failureText[shown], actionLabel: text.tryAgain }),
    worktree.retry,
    worktree.dismissFailure,
  );
  // A name problem shows under its field; a Location found not empty shows under the Location.
  const nameProblem = problem === "not-empty" ? null : problem;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Column modifiers={[fillMaxSize(), background(colors.background)]}>
          <TopAppBar colors={{ containerColor: colors.background }}>
            <TopAppBar.NavigationIcon>
              <IconButton onClick={onClose}>
                <Icon source={closeIcon} contentDescription={text.close} />
              </IconButton>
            </TopAppBar.NavigationIcon>
            <TopAppBar.Title>
              <Text maxLines={1} overflow="ellipsis" style={{ typography: "titleLarge" }}>
                {text.title}
              </Text>
            </TopAppBar.Title>
            <TopAppBar.Actions>
              {creating ? (
                <CircularProgressIndicator
                  modifiers={[size(SPINNER, SPINNER), padding(0, 0, 16, 0)]}
                />
              ) : (
                <Button
                  onClick={worktree.create}
                  enabled={form?.request != null}
                  modifiers={[padding(0, 0, 8, 0)]}
                >
                  <Text>{text.create}</Text>
                </Button>
              )}
            </TopAppBar.Actions>
          </TopAppBar>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[fillMaxWidth(), verticalScroll(), padding(16, 8, 16, insets.bottom + 16)]}
          >
            <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
              {KINDS.map((each) => (
                <SegmentedButton
                  key={each}
                  selected={state.kind === each}
                  onClick={() => worktree.setKind(each)}
                >
                  <SegmentedButton.Label>
                    <Text maxLines={1}>{kindText[each]}</Text>
                  </SegmentedButton.Label>
                </SegmentedButton>
              ))}
            </SingleChoiceSegmentedButtonRow>
            {kind === "new" && (
              <>
                <NameField
                  label={text.branchName}
                  value={view?.kind === "new" ? view.name : state.newBranch.name}
                  problem={nameProblem}
                  onChange={worktree.setName}
                />
                <BranchField
                  label={text.startFrom}
                  picker={view?.kind === "new" ? view.startFrom : null}
                  onPick={worktree.pick}
                />
              </>
            )}
            {kind === "existing" && (
              <BranchField
                label={text.branch}
                picker={view?.kind === "existing" ? view.branch : null}
                onPick={worktree.pick}
              />
            )}
            {kind === "remote" && (
              <>
                <BranchField
                  label={text.remoteBranch}
                  picker={view?.kind === "remote" ? view.remote : null}
                  onPick={worktree.pick}
                />
                <NameField
                  label={text.localBranchName}
                  value={view?.kind === "remote" ? view.local : ""}
                  problem={nameProblem}
                  onChange={worktree.setName}
                />
              </>
            )}
            <LocationField
              key={state.kind}
              value={view?.location ?? ""}
              notEmpty={problem === "not-empty"}
              onChange={worktree.setLocation}
            />
          </Column>
        </Column>
        <SnackbarSlot {...snackbar} bottom={insets.bottom + 16} />
      </ScreenHost>
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

function NameField({
  label,
  value,
  problem,
  onChange,
}: {
  label: string;
  value: string;
  problem: FormProblem | null;
  onChange: (typed: string) => void;
}) {
  const { field, onTextChange } = useBoundField(value, onChange);
  return (
    <OutlinedTextField
      value={field}
      singleLine
      isError={problem !== null}
      onValueChange={onTextChange}
      keyboardOptions={{ autoCorrectEnabled: false }}
      modifiers={[fillMaxWidth()]}
    >
      <OutlinedTextField.Label>
        <Text>{label}</Text>
      </OutlinedTextField.Label>
      {problem !== null && (
        <OutlinedTextField.SupportingText>
          <Text>{problemText[problem]}</Text>
        </OutlinedTextField.SupportingText>
      )}
    </OutlinedTextField>
  );
}

/**
 * Start From, Branch or Remote Branch: a dropdown menu. A loading indicator shows until the
 * branches arrive; a list with no branch reads No branches and cannot be opened.
 */
function BranchField({
  label,
  picker,
  onPick,
}: {
  label: string;
  picker: Picker | null;
  onPick: (branch: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = picker === null ? "" : (picker.value ?? text.noBranches);
  const { field } = useBoundField(shown);
  const usable = picker !== null && picker.value !== null;
  return (
    <ExposedDropdownMenuBox
      expanded={expanded}
      onExpandedChange={(open) => setExpanded(open && usable)}
    >
      <OutlinedTextField
        value={field}
        readOnly
        singleLine
        enabled={usable}
        modifiers={[fillMaxWidth(), menuAnchor("primaryNotEditable", usable)]}
      >
        <OutlinedTextField.Label>
          <Text>{label}</Text>
        </OutlinedTextField.Label>
        <OutlinedTextField.TrailingIcon>
          {picker === null ? (
            <CircularProgressIndicator modifiers={[size(SPINNER - 4, SPINNER - 4)]} />
          ) : (
            <Icon source={dropDownIcon} />
          )}
        </OutlinedTextField.TrailingIcon>
      </OutlinedTextField>
      <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        {(picker?.options ?? []).map((branch) => (
          <DropdownMenuItem
            key={branch}
            onClick={() => {
              setExpanded(false);
              onPick(branch);
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{branch}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </ExposedDropdownMenu>
    </ExposedDropdownMenuBox>
  );
}

/** Location, in the monospaced font, with the line about Git hooks or why it cannot be used. */
function LocationField({
  value,
  notEmpty,
  onChange,
}: {
  value: string;
  notEmpty: boolean;
  onChange: (typed: string) => void;
}) {
  const { field, onTextChange } = useBoundField(value, onChange);
  const material = useMaterialColors();
  return (
    <OutlinedTextField
      value={field}
      isError={notEmpty}
      onValueChange={onTextChange}
      textStyle={{ fontFamily: "monospace", color: material.onSurface }}
      keyboardOptions={{ autoCorrectEnabled: false }}
      modifiers={[fillMaxWidth()]}
    >
      <OutlinedTextField.Label>
        <Text>{text.location}</Text>
      </OutlinedTextField.Label>
      <OutlinedTextField.SupportingText>
        <Text>{notEmpty ? problemText["not-empty"] : text.hooks}</Text>
      </OutlinedTextField.SupportingText>
    </OutlinedTextField>
  );
}

NewWorktreeScreen satisfies typeof ScreenContract;
