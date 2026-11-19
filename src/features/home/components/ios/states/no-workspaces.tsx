import { StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";

import { text } from "../../../text";
import { Centered } from "./layout";

export function NoWorkspaces() {
  return (
    <Centered>
      <StateIcon systemName="rectangle.stack" />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
