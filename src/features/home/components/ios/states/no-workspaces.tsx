import { text } from "../../../text";
import { Centered, StateBody, StateIcon, StateTitle } from "./layout";

export function NoWorkspaces() {
  return (
    <Centered>
      <StateIcon systemName="rectangle.stack" />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
