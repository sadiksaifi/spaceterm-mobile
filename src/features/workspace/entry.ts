import type { Href } from "expo-router";

/**
 * The New Tab requests this app made and the Workspace screen has not opened yet. A request is a
 * one-time `action` in the Workspace link, so a link from another app cannot open a Tab.
 */
const asked = new Set<string>();

/** A new `action` that opens New Tab once the Workspace's Tabs show. */
export function newTabAction(): string {
  const action = `new-tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  asked.add(action);
  return action;
}

/** Whether `action` is a New Tab this app asked for, which it then no longer is. */
export function takeNewTab(action: string | undefined): boolean {
  return action !== undefined && asked.delete(action);
}

/** The Workspace screen, opening New Tab first with `newTab`, as a row's menu on Home asks. */
export function workspaceHref(machineId: string, workspaceId: string, newTab = false): Href {
  return {
    pathname: "/workspace/[machineId]/[workspaceId]",
    params: { machineId, workspaceId, ...(newTab && { action: newTabAction() }) },
  };
}
