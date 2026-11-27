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

/**
 * `path`, a link another app opened, without the `action` of a Workspace link: only the app asks
 * for New Tab, so a link from outside cannot open a Tab on a Machine.
 */
export function linkFromOutside(path: string): string {
  const [before, query] = path.split("?", 2);
  if (query === undefined || !/(^|\/)workspace\//.test(before)) return path;
  const params = new URLSearchParams(query);
  params.delete("action");
  const rest = params.toString();
  return rest === "" ? before : `${before}?${rest}`;
}
