import type ScreenContract from "./screen";

/** Android shows the Workspaces in a sheet of the Workspace screen, so nothing opens this route. */
export default function WorkspacesScreen() {
  return null;
}

WorkspacesScreen satisfies typeof ScreenContract;
