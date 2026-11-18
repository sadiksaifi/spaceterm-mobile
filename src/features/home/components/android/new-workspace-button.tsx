import addIcon from "@expo/material-symbols/add.xml";
import { ExtendedFloatingActionButton, Icon, Text } from "@expo/ui/jetpack-compose";
import { align, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { text } from "../../text";

/** The floating New Workspace button, at the bottom end of its Box. */
export function NewWorkspaceButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ExtendedFloatingActionButton
      onClick={onPress}
      modifiers={[align("bottomEnd"), padding(16, 16, 16, insets.bottom + 16)]}
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
