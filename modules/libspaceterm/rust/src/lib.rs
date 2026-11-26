//! The libspaceterm surface the mobile app uses: Invitation Links, pairing, and the Machines
//! this device has paired. Each platform supplies its secret storage; everything else is here.
uniffi::setup_scaffolding!();

mod record_file;

use record_file::{PrivateRecordFile, hex};
use spaceterm_client::direct::{DirectError, Endpoint, Invitation, default_port};
use spaceterm_client::pane::control::ClientName;
use spaceterm_client::records::PrivateRecords;
use spaceterm_client::{
    CredentialError, CredentialStore, DeviceName, DirectConnections, DirectRouteId,
    DirectRouteStatus, Interaction, JoinStatus,
};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use zeroize::Zeroizing;

/// The build identity of released SpaceTerm. An Invitation Link names the identity of the Core
/// that made it; this app pairs only with released Cores.
const IDENTITY: &str = "spaceterm";
const ENDPOINT_SCHEME: &str = "quic://";

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
    Invitation { machine: InvitedMachine },
    /// Not an Invitation Link, one for another edition of SpaceTerm, or one that has expired.
    Unusable,
    /// A link for a Machine this device has paired already.
    AlreadyPaired { machine: InvitedMachine },
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum JoinState {
    /// Reaching the Machine, before it shows a Comparison Code.
    Reaching,
    /// The six digits the Machine shows too, waiting for approval there.
    Comparing { code: String },
    /// The Machine did not answer. The join waits until `retry_join` or `cancel_join`.
    Paused,
    Paired { machine_id: String },
    /// The Machine declined, or the Comparison Code expired.
    Declined,
    /// The Machine could not be reached, or pairing failed on this device.
    Unreachable,
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

/// The Machines this device has paired, and pairing with new ones.
#[derive(uniffi::Object)]
pub struct Machines {
    connections: DirectConnections,
    records: Arc<PrivateRecordFile>,
    device_name: String,
}

/// One listener's view of changes to the paired Machines and joins.
#[derive(uniffi::Object)]
pub struct Changes {
    connections: DirectConnections,
    receiver: async_channel::Receiver<()>,
}

#[uniffi::export]
impl Changes {
    /// Blocks until something about the paired Machines or a join changes. Returns `false` once
    /// `stop` has run, so a waiting thread can end.
    pub fn next(&self) -> bool {
        self.receiver.recv_blocking().is_ok()
    }

    /// Wakes and ends `next`. Later changes reach this listener no more.
    pub fn stop(&self) {
        self.connections.close_subscription(&self.receiver);
    }
}

#[uniffi::export]
impl Machines {
    /// Opens the Saved Connections in `directory`, a private directory no backup copies, and
    /// starts connecting to the Machines left connected. `device_name` is what Machines call
    /// this device. Open one per process: two would write the same file.
    #[uniffi::constructor]
    pub fn new(directory: String, device_name: String, secrets: Arc<dyn SecretStore>) -> Arc<Self> {
        let records = Arc::new(PrivateRecordFile::new(PathBuf::from(directory)));
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
        connections.resume_retained();
        Arc::new(Self {
            connections,
            records,
            device_name,
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
    pub fn join(&self, link: String, network_address: Option<String>) -> Result<String, MachinesError> {
        let invitation = usable(&link).ok_or(MachinesError::UnusableInvitation)?;
        let endpoint = network_address
            .map(|address| Endpoint::parse(address.trim(), default_port(&invitation.machine_pin().build)))
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
        let Some(status) = decode(&join).and_then(|id| self.connections.join_status(id)) else {
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
            JoinStatus::PublicationUnconfirmed | JoinStatus::Failed(_) => JoinState::Unreachable,
        }
    }

    /// Ends a join. A join the Machine approved meanwhile is unpaired again.
    /// Tries a paused join again. Returns `false` when the join is not paused or has expired.
    pub fn retry_join(&self, join: String) -> bool {
        decode(&join).is_some_and(|id| self.connections.retry_join(id).is_ok())
    }

    pub fn cancel_join(&self, join: String) {
        if let Some(id) = decode(&join) {
            let _ = self.connections.cancel_join(id);
        }
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
                Some(PairedMachine {
                    id: hex(id),
                    name: route.label,
                    address: address_of(&route.endpoint),
                    connection: connection_of(status),
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

    /// A new listener for changes, such as one per JavaScript runtime.
    pub fn changes(&self) -> Arc<Changes> {
        Arc::new(Changes {
            receiver: self.connections.subscribe(),
            connections: self.connections.clone(),
        })
    }
}

impl Machines {
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
