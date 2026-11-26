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

    // Each waits for the Machine's answer, off the main thread.
    AsyncFunction("renameWorkspace") { (machineId: String, workspaceId: String, name: String) -> Bool in
      shared.renameWorkspace(machineId: machineId, workspaceId: workspaceId, name: name)
    }

    AsyncFunction("killWorkspace") { (machineId: String, workspaceId: String) -> Bool in
      shared.killWorkspace(machineId: machineId, workspaceId: workspaceId)
    }
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
      case .paired, .declined, .unreachable:
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
