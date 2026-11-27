import type { JSX } from "react";

import type { WorkspaceScreenProps } from "./props";

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function WorkspaceScreen(props: WorkspaceScreenProps): JSX.Element;
