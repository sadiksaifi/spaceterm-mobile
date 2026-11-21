import type { MockMachine } from "./mock";

const MAC_HOME = "/Users/you";
const LINUX_HOME = "/home/you";

export const macbook: MockMachine = {
  id: "macbook-pro",
  name: "MacBook Pro",
  connection: "connected",
  home: MAC_HOME,
  directories: {
    "/": ["Applications", "Library", "System", "Users", "private", "var"],
    "/Users": ["Shared", "you"],
    [MAC_HOME]: ["Desktop", "Documents", "Downloads", "Projects", "scratch"],
    [`${MAC_HOME}/Desktop`]: [],
    [`${MAC_HOME}/Documents`]: ["notes", "talks"],
    [`${MAC_HOME}/Documents/notes`]: [],
    [`${MAC_HOME}/Documents/talks`]: [],
    [`${MAC_HOME}/Downloads`]: [],
    [`${MAC_HOME}/Projects`]: ["accesskit", "spaceterm-desktop", "spaceterm-mobile", "zed"],
    [`${MAC_HOME}/Projects/accesskit`]: ["crates", "platforms"],
    [`${MAC_HOME}/Projects/spaceterm-desktop`]: ["crates", "docs", "src"],
    [`${MAC_HOME}/Projects/spaceterm-mobile`]: ["assets", "modules", "src"],
    [`${MAC_HOME}/Projects/zed`]: ["crates", "docs"],
    [`${MAC_HOME}/scratch`]: [],
    "/var": ["log", "root", "tmp"],
    "/var/log": [],
    "/var/root": "unavailable",
    "/var/tmp": [],
  },
  branches: {
    [`${MAC_HOME}/Projects/accesskit`]: "main",
    [`${MAC_HOME}/Projects/spaceterm-desktop`]: "fix/sidebar",
    [`${MAC_HOME}/Projects/spaceterm-mobile`]: "main",
    [`${MAC_HOME}/Projects/zed`]: "main",
  },
  workspaces: [
    {
      id: "w-mobile",
      name: "spaceterm-mobile",
      directory: "~/Projects/spaceterm-mobile",
      branch: "main",
      terminalSessions: 5,
    },
    {
      id: "w-desktop",
      name: "spaceterm-desktop",
      directory: "~/Projects/spaceterm-desktop",
      branch: "fix/sidebar",
      terminalSessions: 3,
    },
  ],
};

const buildServer: MockMachine = {
  id: "build-server",
  name: "build-server",
  connection: "connected",
  home: LINUX_HOME,
  directories: {
    "/": ["etc", "home", "srv", "var"],
    "/home": ["you"],
    [LINUX_HOME]: ["srv"],
    [`${LINUX_HOME}/srv`]: ["api", "worker"],
    [`${LINUX_HOME}/srv/api`]: ["cmd", "internal"],
    [`${LINUX_HOME}/srv/worker`]: [],
    "/etc": "unavailable",
    "/srv": [],
    "/var": ["log"],
    "/var/log": [],
  },
  branches: {
    [`${LINUX_HOME}/srv/api`]: "main",
    [`${LINUX_HOME}/srv/worker`]: "main",
  },
  workspaces: [
    { id: "w-api", name: "api", directory: "~/srv/api", branch: "main", terminalSessions: 2 },
    { id: "w-logs", name: "logs", directory: "/var/log", terminalSessions: 1 },
  ],
};

const homeServer: MockMachine = {
  id: "home-server",
  name: "Home Server",
  connection: "not-connected",
  home: LINUX_HOME,
  directories: {},
  workspaces: [{ id: "w-homelab", name: "homelab", directory: "~/homelab", terminalSessions: 1 }],
};

/** The Machine Add Machine pairs in the mockups. */
export const macMini: MockMachine = {
  ...macbook,
  id: "mac-mini",
  name: "Mac mini",
  workspaces: [],
};

/**
 * The Machines each mock scenario pairs, chosen with `EXPO_PUBLIC_MOCK_DATA`. They follow the
 * mockups' examples.
 */
export const scenarios = {
  /** Three Machines, one of them not connected. */
  machines: [macbook, buildServer, homeServer],
  /** One connected Machine with no Workspaces, so New Workspace skips the Machine step. */
  "one-machine": [macMini],
  /** One Machine that is not connected. */
  "not-connected": [homeServer],
} satisfies Record<string, readonly MockMachine[]>;

export type Scenario = keyof typeof scenarios;
