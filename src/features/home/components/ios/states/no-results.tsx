import { StateBody, StateIcon, StateTitle } from "@/shared/ui/ios/state";

import { text } from "../../../text";
import { Centered } from "./layout";

/** Search keeps the keyboard up, and the search field sits on it in the toolbar's place. */
const ABOVE_SEARCH_FIELD = -60;

export function NoResults({
  query,
  onRefresh,
}: {
  query: string;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <Centered extraBottom={ABOVE_SEARCH_FIELD} onRefresh={onRefresh}>
      <StateIcon systemName="magnifyingglass" />
      <StateTitle>{text.noResultsTitle(query)}</StateTitle>
      <StateBody>{text.noResultsBody}</StateBody>
    </Centered>
  );
}
