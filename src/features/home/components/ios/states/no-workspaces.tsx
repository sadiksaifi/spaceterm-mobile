import { StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";

import { text } from "../../../text";
import { Centered } from "./layout";

export function NoWorkspaces({ onRefresh }: { onRefresh?: () => Promise<void> }) {
  return (
    <Centered onRefresh={onRefresh}>
      <StateIcon systemName="rectangle.stack" />
      <StateTitle>{text.noWorkspaces}</StateTitle>
      <StateBody>{text.noWorkspacesBody}</StateBody>
    </Centered>
  );
}
