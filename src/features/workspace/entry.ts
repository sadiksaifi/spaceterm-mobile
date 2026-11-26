import type { Href } from "expo-router";

/** The `action` that opens New Tab once the Workspace's Tabs show. */
export const NEW_TAB = "new-tab";

/** The Workspace screen, opening New Tab first with `newTab`, as a row's menu on Home asks. */
export function workspaceHref(machineId: string, workspaceId: string, newTab = false): Href {
  return {
    pathname: "/workspace/[machineId]/[workspaceId]",
    params: { machineId, workspaceId, ...(newTab && { action: NEW_TAB }) },
  };
}
