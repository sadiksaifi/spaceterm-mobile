import { text } from "../../../text";
import { Centered, StateBody, StateIcon, StateTitle } from "./layout";

export function NoWorkspaces() {
  return (
    <Centered>
      <StateIcon systemName="square.stack" />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
