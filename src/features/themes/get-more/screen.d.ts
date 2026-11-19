import type { JSX } from "react";

import type { GetMorePage } from "./use-get-more";

export type GetMoreProps = {
  page: GetMorePage;
  onClose: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function GetMoreScreen(props: GetMoreProps): JSX.Element;
