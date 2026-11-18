import { Centered, StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";

import { text } from "../../../text";

export function NoWorkspaces() {
  return (
    <Centered>
      <StateIcon systemName="rectangle.stack" />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
