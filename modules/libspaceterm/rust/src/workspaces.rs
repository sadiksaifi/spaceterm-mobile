//! A Machine's Workspaces as Home lists them, read from the Inventory its Core publishes.
use crate::record_file::hex;
use spaceterm_client::hierarchy::{CloseConfirmation, CloseTarget, Inventory, Workspace};
use spaceterm_protocol::repository::RepositoryHead;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct WorkspaceSummary {
    /// The Workspace, as hexadecimal.
    pub id: String,
    pub name: String,
    /// The Pinned Directory, or else where the Workspace's first shell is. It starts with `~`
    /// inside the Machine's home directory.
    pub directory: String,
    /// `None` outside a repository and on a detached `HEAD`.
    pub branch: Option<String>,
    /// The Terminal Sessions that Kill Workspace ends, across every Worktree.
    pub terminal_sessions: u32,
    /// The Workspace as listed, which Rename and Kill send back, so the Machine refuses a change
    /// the person did not see. Opaque outside this crate.
    pub seen: String,
}

/// What a listed Workspace's `seen` holds: the name version Rename expects, and the Panes and
/// Terminal Sessions Kill Workspace ends.
pub(crate) struct Seen {
    pub(crate) version: u64,
    pub(crate) confirmation: Option<CloseConfirmation>,
}

impl Seen {
    fn write(&self) -> String {
        serde_json::json!({ "version": self.version, "confirmation": self.confirmation })
            .to_string()
    }

    pub(crate) fn read(text: &str) -> Option<Self> {
        let value: serde_json::Value = serde_json::from_str(text).ok()?;
        Some(Self {
            version: value.get("version")?.as_u64()?,
            confirmation: serde_json::from_value(value.get("confirmation")?.clone()).ok()?,
        })
    }
}

/// The Workspaces of `inventory`, in the order the Machine keeps them.
pub(crate) fn summaries(inventory: &Inventory) -> Vec<WorkspaceSummary> {
    let home = home(inventory);
    inventory
        .workspaces
        .iter()
        .map(|workspace| {
            let directory = directory(workspace);
            let confirmation = inventory.close_confirmation(CloseTarget::KillWorkspace {
                workspace: workspace.id,
            });
            let seen = Seen {
                version: workspace.name_version,
                confirmation,
            };
            WorkspaceSummary {
                id: hex(&workspace.id),
                name: workspace.name.clone(),
                directory: directory.map(|path| shown(path, home)).unwrap_or_default(),
                branch: directory.and_then(|path| branch(inventory, path)),
                terminal_sessions: sessions(seen.confirmation.as_ref()),
                seen: seen.write(),
            }
        })
        .collect()
}

/// The Machine's home directory, as its shells report it. The Inventory names it nowhere else.
fn home(inventory: &Inventory) -> Option<&str> {
    inventory
        .workspaces
        .iter()
        .flat_map(|workspace| &workspace.tabs)
        .flat_map(|tab| &tab.panes)
        .find_map(|pane| pane.presentation.as_ref()?.home.as_deref())
}

/// As SpaceTerm Desktop places a Workspace: its Pinned Directory, else its Root Pane's.
fn directory(workspace: &Workspace) -> Option<&Path> {
    if let Some(pinned) = &workspace.pinned_directory {
        return Some(pinned);
    }
    let tab = workspace
        .tabs
        .iter()
        .find(|tab| tab.id == workspace.root_tab)?;
    let pane = tab.panes.iter().find(|pane| pane.id == tab.root_pane)?;
    Some(pane.repository_directory())
}

fn branch(inventory: &Inventory, directory: &Path) -> Option<String> {
    let facts = inventory.repositories.as_ref()?.facts(directory)?;
    match &facts.repository.as_ref()?.head {
        RepositoryHead::Branch(branch) | RepositoryHead::Unborn(branch) => Some(branch.to_string()),
        RepositoryHead::Detached(_) => None,
    }
}

/// Counted as SpaceTerm Desktop counts them for its Kill Workspace confirmation.
fn sessions(confirmation: Option<&CloseConfirmation>) -> u32 {
    confirmation.map_or(0, |confirmation| {
        let live = confirmation
            .panes
            .iter()
            .filter(|pane| pane.session.is_some());
        u32::try_from(live.count()).unwrap_or(u32::MAX)
    })
}

/// `path`, starting with `~` where it is in `home`.
fn shown(path: &Path, home: Option<&str>) -> String {
    match home.and_then(|home| path.strip_prefix(home).ok()) {
        Some(relative) if relative.as_os_str().is_empty() => "~".to_owned(),
        Some(relative) => format!("~/{}", relative.display()),
        None => path.display().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use spaceterm_client::hierarchy::{
        CloseInventory, ConfirmedPane, Id, Pane, PaneObservers, Side, Tab, WorktreeMembership,
    };
    use std::path::PathBuf;

    fn id(byte: u8) -> Id {
        [byte; 32]
    }

    fn pane(byte: u8, directory: &str) -> Pane {
        Pane {
            id: id(byte),
            source: None,
            side: Side::Right,
            starting_directory: PathBuf::from(directory),
            current_directory: None,
            repository_directory: None,
            presentation: None,
            observers: PaneObservers::default(),
            confirmed_directory: None,
            creator: None,
        }
    }

    fn workspace(byte: u8, name: &str, panes: Vec<Pane>) -> Workspace {
        Workspace {
            id: id(byte),
            name: name.to_owned(),
            name_version: 0,
            pin_version: 0,
            pinned_directory: None,
            root_tab: id(byte + 100),
            tabs: vec![Tab {
                worktree_membership: WorktreeMembership::default(),
                worktree: None,
                worktree_repository: None,
                id: id(byte + 100),
                root_pane: panes[0].id,
                panes,
            }],
        }
    }

    /// An Inventory where the Panes named in `live` have a Terminal Session.
    fn inventory(workspaces: Vec<Workspace>, live: &[u8]) -> Inventory {
        let sessions = workspaces
            .iter()
            .flat_map(|workspace| &workspace.tabs)
            .flat_map(|tab| &tab.panes)
            .map(|pane| ConfirmedPane {
                id: pane.id,
                session: live.contains(&pane.id[0]).then_some(id(pane.id[0] + 50)),
            })
            .collect();
        Inventory {
            repositories: None,
            revision: 1,
            workspaces,
            close: Some(CloseInventory {
                boot: id(200),
                sessions,
                controls: Vec::new(),
            }),
        }
    }

    #[test]
    fn a_workspace_shows_where_its_first_shell_is_and_the_sessions_kill_would_end() {
        let api = workspace(1, "api", vec![pane(10, "/srv/api"), pane(11, "/tmp")]);
        let listed = inventory(vec![api], &[10, 11]);
        let summaries = summaries(&listed);
        assert_eq!(summaries.len(), 1);
        let WorkspaceSummary {
            id: listed_id,
            name,
            directory,
            branch,
            terminal_sessions,
            seen: _,
        } = summaries[0].clone();
        assert_eq!(
            (listed_id, name, directory, branch, terminal_sessions),
            (
                hex(&id(1)),
                "api".to_owned(),
                "/srv/api".to_owned(),
                None,
                2
            )
        );
    }

    #[test]
    fn a_listed_workspace_carries_what_rename_and_kill_send_back() {
        let mut api = workspace(1, "api", vec![pane(10, "/srv/api")]);
        api.name_version = 7;
        let listed = inventory(vec![api], &[10]);
        let seen = Seen::read(&summaries(&listed)[0].seen).unwrap();
        assert_eq!(seen.version, 7);
        assert_eq!(
            seen.confirmation,
            listed.close_confirmation(CloseTarget::KillWorkspace { workspace: id(1) })
        );
    }

    #[test]
    fn a_pinned_directory_comes_before_the_first_shell() {
        let mut logs = workspace(2, "logs", vec![pane(20, "/tmp")]);
        logs.pinned_directory = Some(PathBuf::from("/var/log"));
        let summaries = summaries(&inventory(vec![logs], &[]));
        assert_eq!(summaries[0].directory, "/var/log");
        assert_eq!(summaries[0].terminal_sessions, 0);
    }

    #[test]
    fn a_path_in_the_home_directory_starts_with_a_tilde() {
        let home = Some("/Users/someone");
        assert_eq!(shown(Path::new("/Users/someone"), home), "~");
        assert_eq!(
            shown(Path::new("/Users/someone/srv/api"), home),
            "~/srv/api"
        );
        assert_eq!(
            shown(Path::new("/Users/someone-else"), home),
            "/Users/someone-else"
        );
        assert_eq!(shown(Path::new("/var/log"), None), "/var/log");
    }
}
