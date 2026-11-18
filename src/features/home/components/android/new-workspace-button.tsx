import addIcon from "@expo/material-symbols/add.xml";
import { ExtendedFloatingActionButton, Icon, Text } from "@expo/ui/jetpack-compose";
import { align, alpha, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { text } from "../../text";

/**
 * A Material floating action button has no disabled state, so an unavailable one takes the
 * opacity Material gives disabled content.
 */
const UNAVAILABLE = 0.38;

/** The floating New Workspace button, at the bottom end of its Box. */
export function NewWorkspaceButton({ onPress }: { onPress: (() => void) | undefined }) {
  const insets = useSafeAreaInsets();
  return (
    <ExtendedFloatingActionButton
      onClick={onPress}
      modifiers={[
        align("bottomEnd"),
        padding(16, 16, 16, insets.bottom + 16),
        ...(onPress ? [] : [alpha(UNAVAILABLE)]),
      ]}
    >
      <ExtendedFloatingActionButton.Icon>
        <Icon source={addIcon} />
      </ExtendedFloatingActionButton.Icon>
      <ExtendedFloatingActionButton.Text>
        <Text>{text.newWorkspace}</Text>
      </ExtendedFloatingActionButton.Text>
    </ExtendedFloatingActionButton>
  );
}
