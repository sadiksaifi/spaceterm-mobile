import type { MockMachine } from "./mock";
import type { Pane, Tab } from "./model";

const MAC_HOME = "/Users/you";
const LINUX_HOME = "/home/you";
const MOBILE = `${MAC_HOME}/Projects/spaceterm-mobile`;

/** A Pane as the mockups draw it: idle unless `running`. */
function pane(id: string, name: string, place: Partial<Pane> = {}): Pane {
  return {
    id,
    name,
    source: null,
    side: "right",
    running: false,
    controlledElsewhere: false,
    ...place,
  };
}

/** A Tab named after its first Pane. */
function tab(id: string, worktree: string | null, panes: Pane[]): Tab {
  return { id, name: panes[0].name, worktree, panes };
}

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
  git: {
    [MOBILE]: {
      local: ["main", "feat/pairing", "feat/home", "fix/scroll"],
      remote: ["origin/main", "origin/feat/pairing", "origin/feat/themes", "origin/fix/scroll"],
    },
  },
  worktreeTemplate: "~/Projects/{repository}-{branch}",
  workspaces: [
    {
      id: "w-mobile",
      name: "spaceterm-mobile",
      directory: "~/Projects/spaceterm-mobile",
      branch: "main",
      terminalSessions: 5,
      // The mockups' example: Claude Code, a Tab of three Panes, and an idle shell.
      tabs: [
        tab("t-claude", MOBILE, [pane("p-claude", "Claude Code", { running: true })]),
        tab("t-expo", MOBILE, [
          pane("p-expo", "expo start", { running: true }),
          pane("p-tests", "zsh", { source: "p-expo", side: "right" }),
          pane("p-log", "git log", { source: "p-tests", side: "down", running: true }),
        ]),
        tab("t-zsh", MOBILE, [pane("p-zsh", "zsh")]),
      ],
      repository: {
        root: MOBILE,
        worktrees: [
          { path: MOBILE, name: "main" },
          { path: `${MOBILE}-feat-pairing`, name: "feat/pairing" },
        ],
      },
    },
    {
      id: "w-desktop",
      name: "spaceterm-desktop",
      directory: "~/Projects/spaceterm-desktop",
      branch: "fix/sidebar",
      terminalSessions: 3,
      tabs: [
        tab("t-cargo", null, [
          pane("p-cargo", "cargo run", { running: true }),
          pane("p-desktop-zsh", "zsh", { source: "p-cargo", side: "right" }),
          pane("p-nvim", "nvim", {
            source: "p-desktop-zsh",
            side: "down",
            controlledElsewhere: true,
          }),
        ]),
      ],
      repository: null,
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
    {
      id: "w-api",
      name: "api",
      directory: "~/srv/api",
      branch: "main",
      terminalSessions: 2,
      tabs: [
        tab("t-api", null, [pane("p-api", "go run ./cmd/api", { running: true })]),
        tab("t-api-zsh", null, [pane("p-api-zsh", "zsh")]),
      ],
      repository: null,
    },
    {
      id: "w-logs",
      name: "logs",
      directory: "/var/log",
      terminalSessions: 1,
      tabs: [tab("t-logs", null, [pane("p-logs", "zsh")])],
      repository: null,
    },
  ],
};

const homeServer: MockMachine = {
  id: "home-server",
  name: "Home Server",
  connection: "not-connected",
  home: LINUX_HOME,
  directories: {},
  workspaces: [
    {
      id: "w-homelab",
      name: "homelab",
      directory: "~/homelab",
      terminalSessions: 1,
      tabs: [tab("t-homelab", null, [pane("p-homelab", "zsh")])],
      repository: null,
    },
  ],
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
