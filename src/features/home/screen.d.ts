import type { JSX } from "react";

import type { HomeScreenProps } from "./actions";

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function HomeScreen(props: HomeScreenProps): JSX.Element;
