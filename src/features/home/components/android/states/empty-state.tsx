import type { HomeActions } from "../../../actions";
import type { HomeView } from "../../../model";
import { Loading } from "./loading";
import { NoMachines } from "./no-machines";
import { NoResults } from "./no-results";
import { NoWorkspaces } from "./no-workspaces";
import { Unreachable } from "./unreachable";

/** What Home shows when it has no Workspace rows. `bottom` is the space kept free below it. */
export function EmptyState({
  view,
  actions,
  bottom,
}: {
  view: Exclude<HomeView, { kind: "workspaces" }>;
  actions: HomeActions;
  bottom: number;
}) {
  switch (view.kind) {
    case "loading":
      return <Loading bottom={bottom} />;
    case "no-machines":
      return <NoMachines actions={actions} bottom={bottom} />;
    case "no-workspaces":
      return <NoWorkspaces bottom={bottom} />;
    case "no-results":
      return <NoResults query={view.query} bottom={bottom} />;
    case "unreachable":
      return <Unreachable view={view} actions={actions} bottom={bottom} />;
  }
}
