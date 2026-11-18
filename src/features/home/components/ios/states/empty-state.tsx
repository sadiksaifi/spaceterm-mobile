import type { HomeActions } from "../../../actions";
import type { HomeView } from "../../../model";
import { Loading } from "./loading";
import { NoMachines } from "./no-machines";
import { NoResults } from "./no-results";
import { NoWorkspaces } from "./no-workspaces";
import { Unreachable } from "./unreachable";

/** What Home shows when it has no Workspace rows. */
export function EmptyState({
  view,
  actions,
}: {
  view: Exclude<HomeView, { kind: "workspaces" }>;
  actions: HomeActions;
}) {
  switch (view.kind) {
    case "loading":
      return <Loading />;
    case "no-machines":
      return <NoMachines actions={actions} />;
    case "no-workspaces":
      return <NoWorkspaces />;
    case "no-results":
      return <NoResults query={view.query} />;
    case "unreachable":
      return <Unreachable view={view} actions={actions} />;
  }
}
