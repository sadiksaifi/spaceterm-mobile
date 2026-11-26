import ExpoModulesCore
import UIKit

/// One `Machines` per process. A development reload makes a new module, and two `Machines` would
/// write the same Saved Connections file.
private let shared: Machines = {
  _ = keepConnectionsOutOfBackup()
  let service = "\(Bundle.main.bundleIdentifier ?? "spaceterm").pairing"
  return Machines(
    directory: connections.path,
    deviceName: deviceName(),
    secrets: KeychainSecretStore(service: service)
  )
}()

/// Workspace edits run concurrently; libspaceterm runs one per Machine at a time.
private let edits = DispatchQueue(
  label: "libspaceterm.edits", qos: .userInitiated, attributes: .concurrent)

private let connections = FileManager.default
  .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  .appendingPathComponent("connections", isDirectory: true)

/// Saved Connections are useless without their secrets, which never leave this device, so they stay
/// out of backups. Returns `false` when the directory can't be made or excluded.
private func keepConnectionsOutOfBackup() -> Bool {
  var directory = connections
  var values = URLResourceValues()
  values.isExcludedFromBackup = true
  do {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try directory.setResourceValues(values)
    return true
  } catch {
    return false
  }
}

private func deviceName() -> String {
  if Thread.isMainThread {
    return MainActor.assumeIsolated { UIDevice.current.name }
  }
  return DispatchQueue.main.sync { UIDevice.current.name }
}

public class LibspacetermModule: Module {
  private var changes: Changes?
  private var joins = Set<String>()
  private let joinsLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("Libspaceterm")

    Events("onChange")

    OnStartObserving {
      self.startListening()
    }

    OnStopObserving {
      self.stopListening()
    }

    OnDestroy {
      self.stopListening()
      self.endUnfinishedJoins()
    }

    Function("readInvitation") { (link: String) -> [String: Any] in
      switch shared.readInvitation(link: link) {
      case .invitation(let machine):
        return invited("invitation", machine)
      case .alreadyPaired(let machine):
        return invited("already-paired", machine)
      case .unusable:
        return ["kind": "unusable"]
      }
    }

    Function("join") { (link: String, networkAddress: String?) -> [String: Any] in
      // A pairing saves the Machine's name and address, which must not reach a backup.
      guard keepConnectionsOutOfBackup() else { return ["kind": "unavailable"] }
      do {
        let join = try shared.join(link: link, networkAddress: networkAddress)
        self.joinsLock.withLock { _ = self.joins.insert(join) }
        return ["kind": "joining", "join": join]
      } catch MachinesError.UnusableInvitation {
        return ["kind": "unusable"]
      } catch MachinesError.InvalidAddress {
        return ["kind": "invalid-address"]
      } catch {
        return ["kind": "unavailable"]
      }
    }

    Function("joinState") { (join: String) -> [String: Any] in
      switch shared.joinState(join: join) {
      case .reaching:
        return ["kind": "reaching"]
      case .comparing(let code):
        return ["kind": "comparing", "code": code]
      case .paired(let machineId):
        return ["kind": "paired", "machineId": machineId]
      case .paused:
        return ["kind": "paused"]
      case .declined:
        return ["kind": "declined"]
      case .unreachable:
        return ["kind": "unreachable"]
      case .full(let unfinished):
        return ["kind": "full", "unfinished": Int(unfinished)]
      }
    }

    Function("retryJoin") { (join: String) -> Bool in
      shared.retryJoin(join: join)
    }

    // iOS asks for Local Network access itself, the first time the app reaches a Machine.
    AsyncFunction("allowLocalNetwork") { () -> Bool in
      true
    }

    AsyncFunction("cancelJoin") { (join: String) in
      shared.cancelJoin(join: join)
    }

    AsyncFunction("stopUnfinishedPairings") { () -> Bool in
      shared.stopUnfinishedPairings()
    }

    Function("paired") { () -> [[String: Any]] in
      shared.paired().map { machine in
        [
          "id": machine.id,
          "name": machine.name,
          "address": machine.address,
          "connection": connection(machine.connection),
          "workspaces": machine.workspaces.map { $0.map(workspace) } as Any? ?? NSNull(),
        ]
      }
    }

    AsyncFunction("connect") { (machineId: String) -> Bool in
      (try? shared.connect(machineId: machineId)) != nil
    }

    AsyncFunction("disconnect") { (machineId: String) -> Bool in
      (try? shared.disconnect(machineId: machineId)) != nil
    }

    AsyncFunction("unpair") { (machineId: String) -> Bool in
      (try? shared.unpair(machineId: machineId)) != nil
    }

    // Each waits up to ten seconds for the Machine's answer, on a queue of its own: Expo's shared
    // queue would hold every other call of this module behind it.
    AsyncFunction("renameWorkspace") {
      (machineId: String, workspaceId: String, seen: String, name: String) -> Bool in
      shared.renameWorkspace(machineId: machineId, workspaceId: workspaceId, seen: seen, name: name)
    }.runOnQueue(edits)

    AsyncFunction("killWorkspace") { (machineId: String, workspaceId: String, seen: String) -> Bool in
      shared.killWorkspace(machineId: machineId, workspaceId: workspaceId, seen: seen)
    }.runOnQueue(edits)

    AsyncFunction("newTab") {
      (machineId: String, workspaceId: String, root: String?, path: String?) -> String? in
      let worktree = root.flatMap { root in path.map { WorktreeTarget(root: root, path: $0) } }
      return shared.newTab(machineId: machineId, workspaceId: workspaceId, worktree: worktree)
    }.runOnQueue(edits)

    AsyncFunction("newPane") {
      (machineId: String, workspaceId: String, tabId: String, source: String) -> Bool in
      shared.newPane(machineId: machineId, workspaceId: workspaceId, tabId: tabId, source: source)
    }.runOnQueue(edits)

    AsyncFunction("moveTab") {
      (machineId: String, workspaceId: String, tabId: String, beside: String, after: Bool) -> Bool
      in
      shared.moveTab(
        machineId: machineId, workspaceId: workspaceId, tabId: tabId, beside: beside, after: after)
    }.runOnQueue(edits)

    AsyncFunction("close") {
      (
        machineId: String, workspaceId: String, tabId: String, paneId: String?, seen: String,
        asked: Bool
      ) -> Bool in
      shared.close(
        machineId: machineId, workspaceId: workspaceId, tabId: tabId, paneId: paneId, seen: seen,
        asked: asked)
    }.runOnQueue(edits)

    AsyncFunction("worktreeContext") { (machineId: String, root: String) -> [String: Any]? in
      shared.worktreeContext(machineId: machineId, root: root).map { context in
        [
          "root": context.root,
          "local": context.local,
          "remote": context.remote,
          "checkedOut": context.checkedOut,
          "startFrom": context.startFrom as Any? ?? NSNull(),
          "template": context.template,
          "home": context.home,
        ]
      }
    }.runOnQueue(edits)

    Function("worktreeLocation") {
      (template: String, home: String, root: String, branch: String) -> String? in
      shared.worktreeLocation(template: template, home: home, root: root, branch: branch)
    }

    AsyncFunction("createWorktree") {
      (machineId: String, workspaceId: String, root: String, home: String, location: String,
        kind: String,
        name: String, base: String) -> [String: Any] in
      let branch: NewWorktreeBranch
      switch kind {
      case "existing": branch = .existing(name: name)
      case "remote": branch = .remote(remote: base, name: name)
      case "new-from-remote": branch = .new(name: name, base: base, baseIsRemote: true)
      default: branch = .new(name: name, base: base, baseIsRemote: false)
      }
      switch shared.createWorktree(
        machineId: machineId, workspaceId: workspaceId, root: root, home: home, location: location,
        branch: branch)
      {
      case .created(let tab): return ["kind": "created", "tab": tab]
      case .invalidName: return ["kind": "invalid-name"]
      case .branchExists: return ["kind": "branch-exists"]
      case .notEmpty: return ["kind": "not-empty"]
      case .failed: return ["kind": "failed"]
      }
    }.runOnQueue(edits)
  }

  private func startListening() {
    guard changes == nil else { return }
    let listener = shared.changes()
    changes = listener
    let thread = Thread { [weak self] in
      while listener.next() {
        self?.sendEvent("onChange")
      }
    }
    thread.name = "libspaceterm-changes"
    thread.start()
    // A change before the subscription reached no one, so JavaScript reads everything once now.
    sendEvent("onChange")
  }

  /// A join this runtime started ends with it, so no pairing completes that nobody saw.
  private func endUnfinishedJoins() {
    let started = joinsLock.withLock {
      let started = joins
      joins.removeAll()
      return started
    }
    for join in started {
      switch shared.joinState(join: join) {
      case .reaching, .comparing, .paused:
        shared.cancelJoin(join: join)
      case .paired, .declined, .unreachable, .full:
        break
      }
    }
  }

  private func stopListening() {
    changes?.stop()
    changes = nil
  }
}

private func invited(_ kind: String, _ machine: InvitedMachine) -> [String: Any] {
  [
    "kind": kind,
    "machineId": machine.machineId,
    "machineName": machine.machineName,
    "address": machine.address,
  ]
}

private func workspace(_ workspace: WorkspaceSummary) -> [String: Any] {
  [
    "id": workspace.id,
    "name": workspace.name,
    "directory": workspace.directory,
    "branch": workspace.branch as Any? ?? NSNull(),
    "terminalSessions": Int(workspace.terminalSessions),
    "seen": workspace.seen,
    "tabs": workspace.tabs.map(tab),
    "repository": workspace.repository.map(repository) as Any? ?? NSNull(),
    "fixedTabOrder": workspace.fixedTabOrder,
  ]
}

private func tab(_ tab: TabSummary) -> [String: Any] {
  [
    "id": tab.id,
    "name": tab.name,
    "worktree": tab.worktree as Any? ?? NSNull(),
    "panes": tab.panes.map(pane),
    "seen": tab.seen,
  ]
}

private func pane(_ pane: PaneSummary) -> [String: Any] {
  [
    "id": pane.id,
    "name": pane.name,
    "source": pane.source as Any? ?? NSNull(),
    "side": side(pane.side),
    "running": pane.running,
    "controlledElsewhere": pane.controlledElsewhere,
    "seen": pane.seen,
  ]
}

private func side(_ side: PaneSide) -> String {
  switch side {
  case .right: return "right"
  case .down: return "down"
  case .left: return "left"
  case .up: return "up"
  }
}

private func repository(_ repository: RepositorySummary) -> [String: Any] {
  [
    "root": repository.root,
    "worktrees": repository.worktrees.map { ["path": $0.path, "name": $0.name] },
  ]
}

private func connection(_ connection: Connection) -> String {
  switch connection {
  case .connected: return "connected"
  case .connecting: return "connecting"
  case .disconnected: return "disconnected"
  case .unavailable: return "unavailable"
  }
}
