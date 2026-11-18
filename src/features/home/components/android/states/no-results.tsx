import searchOffIcon from "@expo/material-symbols/search_off.xml";

import { text } from "../../../text";
import { Centered, StateBody, StateTile } from "./layout";

export function NoResults({ query, bottom }: { query: string; bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <StateTile icon={searchOffIcon} />
      <StateBody>{text.noResultsTitle(query)}</StateBody>
    </Centered>
  );
}
