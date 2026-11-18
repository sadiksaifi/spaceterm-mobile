import workspacesIcon from "./workspaces.xml";

import { text } from "../../../text";
import { Centered, StateBody, StateTile, StateTitle } from "./layout";

export function NoWorkspaces({ bottom }: { bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <StateTile icon={workspacesIcon} />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
