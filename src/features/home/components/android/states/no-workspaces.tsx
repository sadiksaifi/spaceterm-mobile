import { Centered, StateBody, StateTile, StateTitle } from "@/shared/ui/android/state";

import { text } from "../../../text";
import workspacesIcon from "./workspaces.xml";

export function NoWorkspaces({ bottom }: { bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <StateTile icon={workspacesIcon} />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
