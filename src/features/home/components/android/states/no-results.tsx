import searchOffIcon from "@expo/material-symbols/search_off.xml";

import { Centered, StateBody, StateTile } from "@/shared/ui/android/state";

import { text } from "../../../text";

export function NoResults({ query, bottom }: { query: string; bottom: number }) {
  return (
    <Centered bottom={bottom}>
      <StateTile icon={searchOffIcon} />
      <StateBody>{text.noResultsTitle(query)}</StateBody>
    </Centered>
  );
}
