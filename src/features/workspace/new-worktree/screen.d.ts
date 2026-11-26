import type { JSX } from "react";

import type { NewWorktree } from "./use-new-worktree";

export type NewWorktreeScreenProps = {
  worktree: NewWorktree;
  onClose: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function NewWorktreeScreen(props: NewWorktreeScreenProps): JSX.Element;
