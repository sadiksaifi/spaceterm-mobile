//! The libspaceterm surface the mobile app uses: Invitation Links, pairing, the Machines this
//! device has paired, and their Workspaces. Each platform supplies its secret storage; everything
//! else is here.
uniffi::setup_scaffolding!();

mod edits;
mod inventories;
mod record_file;
mod tabs;
mod workspaces;
mod worktrees;

use edits::Edits;
use inventories::Inventories;
use record_file::{PrivateRecordFile, hex};
use spaceterm_client::direct::{DirectError, Endpoint, Invitation, default_port};
use spaceterm_client::hierarchy::{
    Axis, CloseTarget, CreateControl, Mutation, Outcome, TabPosition,
};
use spaceterm_client::pane::control::ClientName;
use spaceterm_client::protocol::capability::Capability;
use spaceterm_client::protocol::{InventoryRevision, Operation, ReplyBody};
use spaceterm_client::records::PrivateRecords;
use spaceterm_client::{
    CredentialError, CredentialStore, DeviceName, DirectConnections, DirectRouteId,
    DirectRouteStatus, Interaction, JoinId, JoinStatus, UnpairKey,
};
use spaceterm_protocol::worktree::{self, Read, ReadReply};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tabs::read_confirmation;
use workspaces::{Seen, WorkspaceSummary, summaries};
use worktrees::{NewWorktreeBranch, WorktreeContext, WorktreeCreation};
use zeroize::Zeroizing;

/// The build identity of released SpaceTerm. An Invitation Link names the identity of the Core
/// that made it; this app pairs only with released Cores.
const IDENTITY: &str = "spaceterm";
const ENDPOINT_SCHEME: &str = "quic://";
/// The pairings this device can hold, counting unpairs and cancelled pairings that wait for their
/// Machine: libspaceterm's `records::CAPACITY`, which it does not export.
const ROOM: usize = 128;
/// How long a read from a Machine waits for its answer.
const READ_WAIT: Duration = Duration::from_secs(10);

/// The platform's secret storage: the Keychain on iOS, the Android Keystore on Android. Each
/// pairing keeps one immutable secret under its own key. Calls come from background threads.
#[uniffi::export(with_foreign)]
pub trait SecretStore: Send + Sync {
    fn read(&self, key: String) -> Result<Option<Vec<u8>>, SecretStoreError>;
    fn insert(&self, key: String, secret: Vec<u8>) -> Result<(), SecretStoreError>;
    fn remove(&self, key: String) -> Result<(), SecretStoreError>;
    /// Removes every secret this app saved. Runs only when no Saved Connections exist, so secrets
    /// a reinstall left behind name no pairing.
    fn clear(&self) -> Result<(), SecretStoreError>;
}

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum SecretStoreError {
    #[error("Secret storage is unavailable.")]
    Unavailable,
}

/// What an Invitation Link says about the Machine it pairs with.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct InvitedMachine {
    /// The Machine's SpaceTerm Core, as hexadecimal. The same Core always has the same id.
    pub machine_id: String,
    pub machine_name: String,
    /// Where the link says the Machine listens: a host name or IP address, with a port only when
    /// it is not the usual one.
    pub address: String,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum InvitationReading {
    Invitation {
        machine: InvitedMachine,
    },
    /// Not an Invitation Link, one for another edition of SpaceTerm, or one that has expired.
    Unusable,
    /// A link for a Machine this device has paired already.
    AlreadyPaired {
        machine: InvitedMachine,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum JoinState {
    /// Reaching the Machine, before it shows a Comparison Code.
    Reaching,
    /// The six digits the Machine shows too, waiting for approval there.
    Comparing {
        code: String,
    },
    /// The Machine did not answer. The join waits until `retry_join` or `cancel_join`.
    Paused,
    Paired {
        machine_id: String,
    },
    /// The Machine declined, or the Comparison Code expired.
    Declined,
    /// The Machine could not be reached, or pairing failed on this device.
    Unreachable,
    /// This device has no room for another pairing. `unfinished` of the pairings it holds are
    /// cancelled ones still waiting for their Machine to answer; `stop_unfinished_pairings` frees
    /// their room.
    Full {
        unfinished: u32,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum Connection {
    Connected,
    Connecting,
    Disconnected,
    /// The Machine refused this device, or this device cannot use the pairing.
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct PairedMachine {
    /// The Saved Connection, as hexadecimal.
    pub id: String,
    pub name: String,
    pub address: String,
    pub connection: Connection,
    /// The Machine's Workspaces while it is connected and has sent them, `None` otherwise.
    pub workspaces: Option<Vec<WorkspaceSummary>>,
}

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum MachinesError {
    #[error("This text is not an Invitation Link this device can use.")]
    UnusableInvitation,
    #[error("Enter a DNS name or IP address, with an optional port.")]
    InvalidAddress,
    #[error("No paired Machine has this id.")]
    UnknownMachine,
    #[error("Pairing could not start.")]
    Unavailable,
}

/// A Worktree of a repository: `root` is its Main Worktree and `path` the Worktree, as the
/// Machine's paths.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct WorktreeTarget {
    pub root: String,
    pub path: String,
}

/// The Machines this device has paired, and pairing with new ones.
#[derive(uniffi::Object)]
pub struct Machines {
    connections: DirectConnections,
    records: Arc<PrivateRecordFile>,
    device_name: String,
    inventories: Arc<Inventories>,
    edits: Arc<Edits>,
}

/// One listener's view of changes to the paired Machines, their Workspaces, and joins.
#[derive(uniffi::Object)]
pub struct Changes {
    connections: DirectConnections,
    /// Changes to the Machines and joins, which a thread forwards to `receiver`.
    routes: async_channel::Receiver<()>,
    receiver: async_channel::Receiver<()>,
}

#[uniffi::export]
impl Changes {
    /// Blocks until something about the paired Machines, their Workspaces, or a join changes.
    /// Returns `false` once `stop` has run, so a waiting thread can end.
    pub fn next(&self) -> bool {
        self.receiver.recv_blocking().is_ok()
    }

    /// Wakes and ends `next`. Later changes reach this listener no more.
    pub fn stop(&self) {
        self.connections.close_subscription(&self.routes);
        self.receiver.close();
    }
}

#[uniffi::export]
impl Machines {
    /// Opens the Saved Connections in `directory`, a private directory no backup copies, and
    /// starts connecting to the Machines left connected. `device_name` is what Machines call
    /// this device. Open one per process: two would write the same file.
    #[uniffi::constructor]
    pub fn new(directory: String, device_name: String, secrets: Arc<dyn SecretStore>) -> Arc<Self> {
        let directory = PathBuf::from(directory);
        let records = Arc::new(PrivateRecordFile::new(directory.clone()));
        if !records.exists() {
            let _ = secrets.clear();
        }
        let name = ClientName::for_computer(Some(&device_name), None);
        let names: DeviceName = Arc::new(move || name.clone());
        let connections = DirectConnections::with_credentials(
            IDENTITY,
            Arc::new(PrivateRecords::new(records.clone())),
            Arc::new(Secrets(secrets)),
            names,
            // Without a route-change signal, periodic path checks still run.
            Arc::new(|| None),
            None,
        );
        let edits = Arc::new(Edits::new(directory));
        let forgotten = Arc::clone(&edits);
        let saved = Arc::clone(&records);
        // libspaceterm reports a removal even when saving it failed. A pairing still saved keeps
        // its journal, as it comes back on the next start.
        connections.on_route_removed(Arc::new(move |route| {
            if saved.durably_without(route) {
                forgotten.forget(route);
            }
        }));
        connections.resume_retained();
        // After the Saved Connections are read, so only a durably removed pairing is swept.
        edits.sweep(|route| records.durably_without(route));
        Arc::new(Self {
            connections,
            records,
            device_name,
            inventories: Arc::new(Inventories::new()),
            edits,
        })
    }

    /// Reads an Invitation Link on this device, without asking the Machine.
    pub fn read_invitation(&self, link: String) -> InvitationReading {
        let Some(invitation) = usable(&link) else {
            return InvitationReading::Unusable;
        };
        let machine = invited(&invitation);
        let paired = self
            .connections
            .routes()
            .iter()
            .filter_map(|(id, _)| self.connections.route(id))
            .any(|route| route.paired.pin.core == invitation.machine_pin().core);
        if paired {
            InvitationReading::AlreadyPaired { machine }
        } else {
            InvitationReading::Invitation { machine }
        }
    }

    /// Starts pairing with the Machine of `link`, at `network_address` when it is given. Returns
    /// the join to follow with `join_state`.
    pub fn join(
        &self,
        link: String,
        network_address: Option<String>,
    ) -> Result<String, MachinesError> {
        let invitation = usable(&link).ok_or(MachinesError::UnusableInvitation)?;
        let endpoint = network_address
            .map(|address| {
                Endpoint::parse(
                    address.trim(),
                    default_port(&invitation.machine_pin().build),
                )
            })
            .transpose()
            .map_err(|_| MachinesError::InvalidAddress)?;
        let name = ClientName::for_computer(Some(&self.device_name), None);
        let id = self
            .connections
            .join(Zeroizing::new(link), endpoint, name)
            .map_err(|error| match error {
                DirectError::InvalidInvitation | DirectError::IdentityMismatch => {
                    MachinesError::UnusableInvitation
                }
                DirectError::InvalidAddress => MachinesError::InvalidAddress,
                _ => MachinesError::Unavailable,
            })?;
        Ok(hex(&id))
    }

    pub fn join_state(&self, join: String) -> JoinState {
        let Some((id, status)) =
            decode(&join).and_then(|id| Some((id, self.connections.join_status(id)?)))
        else {
            return JoinState::Unreachable;
        };
        match status {
            JoinStatus::Validating => JoinState::Reaching,
            JoinStatus::AwaitingApproval { comparison_code } => JoinState::Comparing {
                code: comparison_code.to_string(),
            },
            JoinStatus::Approved(route) | JoinStatus::ApprovedUncertain(route) => {
                JoinState::Paired {
                    machine_id: hex(&route),
                }
            }
            JoinStatus::Rejected | JoinStatus::Expired => JoinState::Declined,
            JoinStatus::Retryable { .. } => JoinState::Paused,
            JoinStatus::Failed(DirectError::Capacity) => {
                self.full(id).unwrap_or(JoinState::Unreachable)
            }
            JoinStatus::PublicationUnconfirmed | JoinStatus::Failed(_) => JoinState::Unreachable,
        }
    }

    /// Tries a paused join again. Returns `false` when the join is not paused or has expired.
    pub fn retry_join(&self, join: String) -> bool {
        decode(&join).is_some_and(|id| self.connections.retry_join(id).is_ok())
    }

    /// Ends a join. A join the Machine approved meanwhile is unpaired again.
    pub fn cancel_join(&self, join: String) {
        if let Some(id) = decode(&join) {
            let _ = self.connections.cancel_join(id);
        }
    }

    /// Stops waiting for the Machines of cancelled pairings to answer, which frees the room each
    /// holds. Returns whether every one stopped. A Machine that approved this device may still
    /// list it, as this does not ask the Machine to revoke it. Call only after the person confirms.
    pub fn stop_unfinished_pairings(&self) -> bool {
        // Every one is tried, so one that fails still frees the room of the others.
        let keys = self.unfinished();
        let stopped = keys
            .iter()
            .filter(|key| self.connections.abandon_enrollment_cleanup(**key).is_ok())
            .count();
        stopped == keys.len()
    }

    /// The paired Machines, in the order they were paired.
    pub fn paired(&self) -> Vec<PairedMachine> {
        let statuses = self.connections.routes();
        let mut order = self.records.order();
        for (id, _) in &statuses {
            if !order.contains(id) {
                order.push(*id);
            }
        }
        order
            .iter()
            .filter_map(|id| {
                let status = statuses.iter().find(|(route, _)| route == id)?.1;
                let route = self.connections.route(id)?;
                let connection = connection_of(status);
                let workspaces = match connection {
                    Connection::Connected => self.inventory(id).map(|revision| {
                        let core = self.connections.core(id);
                        let client = core.as_ref().map(|core| core.paired().client);
                        let reorders = core.as_ref().is_some_and(|core| {
                            core.work()
                                .capabilities()
                                .check(Capability::ReorderTab)
                                .is_ok()
                        });
                        summaries(&revision.inventory, client, reorders)
                    }),
                    _ => None,
                };
                Some(PairedMachine {
                    id: hex(id),
                    name: route.label,
                    address: address_of(&route.endpoint),
                    connection,
                    workspaces,
                })
            })
            .collect()
    }

    pub fn connect(&self, machine_id: String) -> Result<(), MachinesError> {
        self.connections.connect(&self.known(&machine_id)?);
        Ok(())
    }

    pub fn disconnect(&self, machine_id: String) -> Result<(), MachinesError> {
        self.connections.disconnect(&self.known(&machine_id)?);
        Ok(())
    }

    /// Removes the Machine from this device and asks it to revoke this device's pairing.
    pub fn unpair(&self, machine_id: String) -> Result<(), MachinesError> {
        self.connections
            .unpair_self(&self.known(&machine_id)?)
            .map_err(|_| MachinesError::Unavailable)
    }

    /// Renames a Workspace, as listed with `seen`. Returns whether the Machine renamed it. A
    /// Machine whose Workspace was renamed since refuses.
    pub fn rename_workspace(
        &self,
        machine_id: String,
        workspace_id: String,
        seen: String,
        name: String,
    ) -> bool {
        let (Some(workspace), Some(seen)) = (decode(&workspace_id), Seen::read(&seen)) else {
            return false;
        };
        self.edit(
            &machine_id,
            Mutation::RenameWorkspace {
                workspace,
                version: seen.version,
                name,
            },
        )
    }

    /// Ends a Workspace, as listed with `seen`, and every Terminal Session in it. Returns whether
    /// the Machine ended it. A Machine whose Workspace gained or lost a Terminal Session since
    /// refuses, so no session ends that the person was not told about.
    pub fn kill_workspace(&self, machine_id: String, workspace_id: String, seen: String) -> bool {
        let Some(workspace) = decode(&workspace_id) else {
            return false;
        };
        let Some(confirmation) = Seen::read(&seen).and_then(|seen| seen.confirmation) else {
            return false;
        };
        self.edit(
            &machine_id,
            Mutation::Close {
                target: CloseTarget::KillWorkspace { workspace },
                confirmation,
            },
        )
    }

    /// Opens a Tab with a shell as the Workspace's last Tab, in `worktree` when it is given: the
    /// path of one of the Worktrees of the repository whose Main Worktree is `root`. Returns the
    /// new Tab, or `None` when the Machine did not open it.
    pub fn new_tab(
        &self,
        machine_id: String,
        workspace_id: String,
        worktree: Option<WorktreeTarget>,
    ) -> Option<String> {
        let workspace = decode(&workspace_id)?;
        // No device controls the new shell, so whichever opens it first takes it.
        let control = CreateControl::Unclaimed;
        let mutation = match worktree {
            None => Mutation::CreateTab {
                workspace,
                source: None,
                control,
            },
            Some(WorktreeTarget { root, path }) => {
                Mutation::Worktree(worktree::Operation::OpenTab {
                    workspace,
                    source: None,
                    root: PathBuf::from(root),
                    path: PathBuf::from(path),
                    control,
                })
            }
        };
        match self.outcome(&machine_id, mutation)? {
            Outcome::Accepted { target } => Some(hex(&target)),
            _ => None,
        }
    }

    /// Adds a Pane with a shell to a Tab, beside `source`, one of its Panes. Returns whether the
    /// Machine added it.
    pub fn new_pane(
        &self,
        machine_id: String,
        workspace_id: String,
        tab_id: String,
        source: String,
    ) -> bool {
        let (Some(workspace), Some(tab), Some(source)) =
            (decode(&workspace_id), decode(&tab_id), decode(&source))
        else {
            return false;
        };
        self.edit(
            &machine_id,
            Mutation::SplitPane {
                workspace,
                tab,
                source,
                axis: Axis::Right,
                control: CreateControl::Unclaimed,
            },
        )
    }

    /// Moves a Tab beside `beside`, another Tab of its Worktree, in the order the Machine keeps
    /// for every device: after it when `after`, else before it. Returns whether the Machine
    /// moved it.
    pub fn move_tab(
        &self,
        machine_id: String,
        workspace_id: String,
        tab_id: String,
        beside: String,
        after: bool,
    ) -> bool {
        let (Some(workspace), Some(tab), Some(beside)) =
            (decode(&workspace_id), decode(&tab_id), decode(&beside))
        else {
            return false;
        };
        let position = if after {
            TabPosition::After(beside)
        } else {
            TabPosition::Before(beside)
        };
        self.edit(
            &machine_id,
            Mutation::ReorderTab {
                workspace,
                tab,
                position,
            },
        )
    }

    /// Closes a Tab, or one Pane of it when `pane_id` is given, as listed with `seen`. `asked` is
    /// whether the person agreed to close it. Returns whether the Machine closed it. A Machine
    /// whose Tab or Pane gained or lost a Terminal Session since refuses, and so does one where
    /// a close nobody was asked about would now end work it can guard.
    pub fn close(
        &self,
        machine_id: String,
        workspace_id: String,
        tab_id: String,
        pane_id: Option<String>,
        seen: String,
        asked: bool,
    ) -> bool {
        let (Some(workspace), Some(tab), Some(mut confirmation)) = (
            decode(&workspace_id),
            decode(&tab_id),
            read_confirmation(&seen, asked),
        ) else {
            return false;
        };
        // A Machine before work 1.5 cannot close only what is idle; it checks only that the
        // Terminal Sessions are the same.
        if confirmation.is_close_if_idle() && !self.supports(&machine_id, Capability::CloseIfIdle) {
            confirmation.own_controls = None;
        }
        let target = match pane_id {
            None => CloseTarget::Tab { workspace, tab },
            Some(pane) => {
                let Some(pane) = decode(&pane) else {
                    return false;
                };
                CloseTarget::Pane {
                    workspace,
                    tab,
                    pane,
                }
            }
        };
        self.edit(
            &machine_id,
            Mutation::Close {
                target,
                confirmation,
            },
        )
    }

    /// What New Worktree needs from the Machine for the repository whose Main Worktree is `root`.
    /// `None` when the Machine did not answer.
    pub fn worktree_context(&self, machine_id: String, root: String) -> Option<WorktreeContext> {
        let root = PathBuf::from(root);
        let (settings, home, branches, default_branch) =
            if self.supports(&machine_id, Capability::WorktreeDefaultBranch) {
                let read = Read::ContextWithDefault { root: root.clone() };
                match self.read_worktree(&machine_id, read)? {
                    Ok(ReadReply::ContextWithDefault {
                        settings,
                        home,
                        branches,
                        default_branch,
                    }) => (settings, home, branches, default_branch),
                    _ => return None,
                }
            } else {
                match self.read_worktree(&machine_id, Read::Context { root: root.clone() })? {
                    Ok(ReadReply::Context {
                        settings,
                        home,
                        branches,
                    }) => (settings, home, branches, None),
                    _ => return None,
                }
            };
        let inventory = self
            .known(&machine_id)
            .ok()
            .and_then(|route| self.inventory(&route));
        Some(worktrees::context(
            &root,
            inventory.as_ref().map(|revision| &revision.inventory),
            settings.template,
            &home,
            branches,
            default_branch,
        ))
    }

    /// Where the Machine's rule places a Worktree of `root` for `branch`, from a
    /// `WorktreeContext`. Reads nothing from the Machine.
    pub fn worktree_location(
        &self,
        template: String,
        home: String,
        root: String,
        branch: String,
    ) -> Option<String> {
        worktrees::location(&template, &home, &root, &branch)
    }

    /// Creates a Worktree of the repository whose Main Worktree is `root` at `location`, which can
    /// start with `~/` for the Machine's `home`, and opens one Tab in it.
    pub fn create_worktree(
        &self,
        machine_id: String,
        workspace_id: String,
        root: String,
        home: String,
        location: String,
        branch: NewWorktreeBranch,
    ) -> WorktreeCreation {
        let Some(workspace) = decode(&workspace_id) else {
            return WorktreeCreation::Failed;
        };
        let root = PathBuf::from(root);
        let branch = worktrees::branch(branch);
        // A Create of this branch at this Location whose answer was lost may have made the
        // Worktree, which the Location check would then find not empty. It goes again instead,
        // as it would anyway before any other edit, and its answer is this one's.
        let resumed = self.resume(&machine_id, |pending| {
            matches!(pending, Mutation::Worktree(worktree::Operation::Create {
                workspace: listed,
                root: from,
                path,
                branch: checked_out,
                ..
            }) if *listed == workspace
                && *from == root
                && *checked_out == branch
                && worktrees::same_location(path, &home, &location))
        });
        if let Some(outcome) = resumed {
            return worktrees::creation(outcome);
        }
        // The Machine expands the Location and checks it is missing or empty.
        let path = match self.read_worktree(
            &machine_id,
            Read::Location {
                root: root.clone(),
                location,
            },
        ) {
            Some(Ok(ReadReply::Location(path))) => path,
            Some(Err(error)) => return worktrees::failure(error),
            _ => return WorktreeCreation::Failed,
        };
        worktrees::creation(self.outcome(
            &machine_id,
            Mutation::Worktree(worktree::Operation::Create {
                workspace,
                root,
                path,
                branch,
                control: CreateControl::Unclaimed,
            }),
        ))
    }

    /// A new listener for changes, such as one per JavaScript runtime.
    pub fn changes(&self) -> Arc<Changes> {
        let routes = self.connections.subscribe();
        let (forward, receiver) = self.inventories.listen();
        self.inventories.follow(&self.connections);
        let connections = self.connections.clone();
        let inventories = Arc::clone(&self.inventories);
        let changes = routes.clone();
        // A connected Machine's revisions are followed before listeners read the change.
        std::thread::Builder::new()
            .name("libspaceterm routes".to_owned())
            .spawn(move || {
                while changes.recv_blocking().is_ok() {
                    inventories.follow(&connections);
                    let _ = forward.try_send(());
                }
                forward.close();
            })
            .ok();
        Arc::new(Changes {
            connections: self.connections.clone(),
            routes,
            receiver,
        })
    }
}

impl Machines {
    /// `Full` when `join` found no room for another pairing on this device. A Machine with too many
    /// pairings waiting for approval refuses with the same error, and freeing room here would not
    /// help it. A join that reached the Machine holds room of its own, under its own id, until
    /// libspaceterm cleans it up.
    fn full(&self, join: JoinId) -> Option<JoinState> {
        let pending = self.connections.pending_unpairs();
        let reached = pending.iter().any(|p| p.key == join);
        if reached || self.connections.routes().len() + pending.len() < ROOM {
            return None;
        }
        let unfinished = pending.iter().filter(|p| p.enrollment_cleanup).count();
        Some(JoinState::Full {
            unfinished: u32::try_from(unfinished).unwrap_or(u32::MAX),
        })
    }

    /// The cancelled pairings that still wait for their Machine to answer.
    fn unfinished(&self) -> Vec<UnpairKey> {
        self.connections
            .pending_unpairs()
            .into_iter()
            .filter(|pending| pending.enrollment_cleanup)
            .map(|pending| pending.key)
            .collect()
    }

    /// The Inventory a connected Machine sent last, `None` before its first.
    fn inventory(&self, id: &DirectRouteId) -> Option<Arc<InventoryRevision>> {
        let link = self.connections.core(id)?.work().live_link()?;
        Some(link.inventory()?.1)
    }

    /// Sends `mutation` to a connected Machine and waits for its answer: whether it made the
    /// change.
    fn edit(&self, machine_id: &str, mutation: Mutation) -> bool {
        matches!(
            self.outcome(machine_id, mutation),
            Some(Outcome::Accepted { .. })
        )
    }

    /// Sends `mutation` to a connected Machine and waits for its outcome, `None` without one.
    fn outcome(&self, machine_id: &str, mutation: Mutation) -> Option<Outcome> {
        let route = self.known(machine_id).ok()?;
        let machine = self.connections.core(&route)?;
        self.edits.submit(route, &machine, mutation)
    }

    /// Sends again the edit to a connected Machine whose answer was lost, if `matches` takes it.
    fn resume(
        &self,
        machine_id: &str,
        matches: impl FnOnce(&Mutation) -> bool,
    ) -> Option<Option<Outcome>> {
        let route = self.known(machine_id).ok()?;
        let machine = self.connections.core(&route)?;
        self.edits.resume(route, &machine, matches)
    }

    /// The connected Machine's work protocol has `capability`.
    fn supports(&self, machine_id: &str, capability: Capability) -> bool {
        self.known(machine_id)
            .ok()
            .and_then(|route| self.connections.core(&route))
            .is_some_and(|machine| machine.work().capabilities().check(capability).is_ok())
    }

    /// Asks a connected Machine for Worktree facts and waits for the answer, `None` without one.
    fn read_worktree(
        &self,
        machine_id: &str,
        read: Read,
    ) -> Option<Result<ReadReply, worktree::Error>> {
        let route = self.known(machine_id).ok()?;
        let link = self.connections.core(&route)?.work().live_link()?;
        match link
            .request(Operation::WorktreeRead(read))
            .ok()?
            .wait_for(READ_WAIT)?
        {
            Ok(ReplyBody::Worktree(reply)) => Some(reply),
            _ => None,
        }
    }
    fn known(&self, machine_id: &str) -> Result<DirectRouteId, MachinesError> {
        decode(machine_id)
            .filter(|id| self.connections.route(id).is_some())
            .ok_or(MachinesError::UnknownMachine)
    }
}

/// An Invitation Link this app can pair with: one for released SpaceTerm that has not expired.
fn usable(link: &str) -> Option<Invitation> {
    let invitation = Invitation::parse(link.trim()).ok()?;
    if invitation.machine_pin().build != IDENTITY {
        return None;
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    // The Machine decides expiry; a minute's grace keeps a slow clock from refusing early.
    if invitation.expires_at_unix_seconds().saturating_add(60) < now {
        return None;
    }
    Some(invitation)
}

fn invited(invitation: &Invitation) -> InvitedMachine {
    InvitedMachine {
        machine_id: hex(&invitation.machine_pin().core),
        machine_name: invitation.machine_name().to_owned(),
        address: address_of(invitation.endpoint()),
    }
}

/// `quic://mac-mini.local:9231` reads as `mac-mini.local`; another port stays.
fn address_of(endpoint: &str) -> String {
    let authority = endpoint.strip_prefix(ENDPOINT_SCHEME).unwrap_or(endpoint);
    let usual = format!(":{}", default_port(IDENTITY));
    authority
        .strip_suffix(&usual)
        .unwrap_or(authority)
        .to_owned()
}

fn connection_of(status: DirectRouteStatus) -> Connection {
    match status {
        DirectRouteStatus::Connected => Connection::Connected,
        DirectRouteStatus::Connecting | DirectRouteStatus::Reconnecting => Connection::Connecting,
        DirectRouteStatus::Disconnected => Connection::Disconnected,
        DirectRouteStatus::NeedsInteraction
        | DirectRouteStatus::Refused(_)
        | DirectRouteStatus::Unavailable(_) => Connection::Unavailable,
    }
}

fn decode(text: &str) -> Option<[u8; 32]> {
    if text.len() != 64 {
        return None;
    }
    let mut out = [0; 32];
    for (index, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(text.get(index * 2..index * 2 + 2)?, 16).ok()?;
    }
    Some(out)
}

/// The platform's secret storage as libspaceterm asks for it. Mobile storage never asks the
/// person, so every interaction is quiet.
struct Secrets(Arc<dyn SecretStore>);

impl CredentialStore for Secrets {
    fn read(
        &self,
        key: &[u8; 32],
        _interaction: Interaction,
    ) -> Result<Option<Zeroizing<Vec<u8>>>, CredentialError> {
        self.0
            .read(hex(key))
            .map(|secret| secret.map(Zeroizing::new))
            .map_err(|_| CredentialError::Unavailable)
    }

    fn insert(&self, key: &[u8; 32], secret: &[u8]) -> Result<(), CredentialError> {
        self.0
            .insert(hex(key), secret.to_vec())
            .map_err(|_| CredentialError::Unavailable)
    }

    fn remove(&self, key: &[u8; 32], _interaction: Interaction) -> Result<(), CredentialError> {
        self.0
            .remove(hex(key))
            .map_err(|_| CredentialError::Unavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_usual_port_is_left_out_of_an_address() {
        assert_eq!(address_of("quic://mac-mini.local:9231"), "mac-mini.local");
        assert_eq!(address_of("quic://192.168.1.4:9300"), "192.168.1.4:9300");
    }

    #[test]
    fn an_id_reads_back_from_its_hexadecimal() {
        let id = [7u8; 32];
        assert_eq!(decode(&hex(&id)), Some(id));
        assert_eq!(decode("not an id"), None);
    }

    #[test]
    fn text_that_is_no_invitation_link_cannot_be_used() {
        assert!(usable("spaceterm://pair/not-a-payload").is_none());
        assert!(usable("hello").is_none());
    }
}
