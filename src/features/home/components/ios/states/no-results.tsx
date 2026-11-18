import { text } from "../../../text";
import { Centered, StateBody, StateIcon, StateTitle } from "./layout";

export function NoResults({ query }: { query: string }) {
  return (
    <Centered>
      <StateIcon systemName="magnifyingglass" />
      <StateTitle>{text.noResultsTitle(query)}</StateTitle>
      <StateBody>{text.noResultsBody}</StateBody>
    </Centered>
  );
}
