//! What New Worktree reads from the Machine and what its answer comes to.
use spaceterm_client::hierarchy::{Inventory, Outcome};
use spaceterm_protocol::repository::WorktreeHead;
use spaceterm_protocol::worktree::{Branch, BranchName, Branches, Error, Removal, path_template};
use std::path::Path;

/// What New Worktree needs to fill its form: the branches, newest first, and the rule that places
/// a Worktree.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct WorktreeContext {
    /// The Main Worktree, as the Machine's path.
    pub root: String,
    pub local: Vec<String>,
    /// Remote branches the repository has fetched, such as `origin/topic`.
    pub remote: Vec<String>,
    /// Local branches that a Worktree has checked out, which Existing Branch cannot use.
    pub checked_out: Vec<String>,
    /// The branch Start From holds as the form opens.
    pub start_from: Option<String>,
    /// The Machine's rule for where a new Worktree goes, and its home directory.
    pub template: String,
    pub home: String,
}

/// The branch a new Worktree checks out.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum NewWorktreeBranch {
    /// A new branch named `name`, starting from `base`, a local or remote branch.
    New {
        name: String,
        base: String,
        base_is_remote: bool,
    },
    Existing {
        name: String,
    },
    /// A new local branch `name` that tracks the fetched remote branch `remote`.
    Remote {
        remote: String,
        name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum WorktreeCreation {
    /// The Worktree exists and its one Tab is `tab`.
    Created {
        tab: String,
    },
    /// Git does not allow the branch name.
    InvalidName,
    /// A branch with that name exists.
    BranchExists,
    /// The Machine cannot use the Location: it is not empty, or not a place it can create one.
    NotEmpty,
    Failed,
}

/// What Remove Worktree deletes, as the Machine checked it. The remove sends it back, and the
/// Machine refuses when the Worktree, its Tabs, or their Terminal Sessions changed since.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct WorktreeRemovalReview {
    /// The Main Worktree and the Worktree, as the Machine's paths.
    pub root: String,
    pub path: String,
    /// Opaque: the Machine's run and the check this review is.
    pub boot: String,
    pub confirmation: String,
    /// It has uncommitted changes or untracked files, which the remove deletes.
    pub changes: bool,
    /// It has submodule checkouts, which the remove deletes.
    pub submodules: bool,
    /// The Tabs the remove closes, in every Workspace, and the Terminal Sessions it ends.
    pub tabs: u32,
    pub sessions: u32,
}

/// Why a Worktree was not removed, or could not be checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum WorktreeRemovalFailure {
    /// The Main Worktree cannot be removed.
    Main,
    /// Git has the Worktree locked.
    Locked,
    /// The Machine has the directory pinned.
    Pinned,
    /// Git no longer lists the Worktree.
    Missing,
    /// The Worktree, its Tabs, or their Terminal Sessions changed after the check.
    Changed,
    /// The Worktree changed after its Tabs closed and their Terminal Sessions ended, so Git kept it.
    ChangedAfterClosing,
    /// The Machine stopped before it confirmed the result.
    Interrupted,
    /// The remove went out and no answer came back, so it may have removed the Worktree.
    Unanswered,
    /// The Machine did not answer, or refused for another reason.
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum WorktreeRemovalCheck {
    Review {
        review: WorktreeRemovalReview,
    },
    /// An earlier remove of this Worktree whose answer was lost went again and removed it.
    Removed,
    Failed {
        failure: WorktreeRemovalFailure,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum WorktreeRemoval {
    Removed,
    Failed { failure: WorktreeRemovalFailure },
}

pub(crate) fn review(removal: Removal) -> WorktreeRemovalReview {
    let count = |n: usize| u32::try_from(n).unwrap_or(u32::MAX);
    let sessions = removal
        .tabs
        .iter()
        .flat_map(|tab| &tab.panes)
        .filter(|pane| pane.session.is_some())
        .count();
    WorktreeRemovalReview {
        root: removal.root.to_string_lossy().into_owned(),
        path: removal.path.to_string_lossy().into_owned(),
        boot: crate::record_file::hex(&removal.boot),
        confirmation: crate::record_file::hex(&removal.confirmation),
        changes: removal.changes,
        submodules: removal.submodules,
        tabs: count(removal.tabs.len()),
        sessions: count(sessions),
    }
}

pub(crate) fn removal(outcome: Option<Outcome>) -> WorktreeRemoval {
    match outcome {
        Some(Outcome::Accepted { .. }) => WorktreeRemoval::Removed,
        Some(Outcome::WorktreeFailed(error)) => WorktreeRemoval::Failed {
            failure: removal_failure(error),
        },
        Some(Outcome::StaleConfirmation | Outcome::Conflict) => WorktreeRemoval::Failed {
            failure: WorktreeRemovalFailure::Changed,
        },
        Some(Outcome::Missing) => WorktreeRemoval::Failed {
            failure: WorktreeRemovalFailure::Missing,
        },
        None => WorktreeRemoval::Failed {
            failure: WorktreeRemovalFailure::Unanswered,
        },
        _ => WorktreeRemoval::Failed {
            failure: WorktreeRemovalFailure::Failed,
        },
    }
}

pub(crate) fn removal_failure(error: Error) -> WorktreeRemovalFailure {
    match error {
        Error::Main => WorktreeRemovalFailure::Main,
        Error::Locked => WorktreeRemovalFailure::Locked,
        Error::Pinned => WorktreeRemovalFailure::Pinned,
        Error::Missing => WorktreeRemovalFailure::Missing,
        Error::Changed => WorktreeRemovalFailure::Changed,
        Error::ChangedAfterClosing => WorktreeRemovalFailure::ChangedAfterClosing,
        Error::Interrupted => WorktreeRemovalFailure::Interrupted,
        _ => WorktreeRemovalFailure::Failed,
    }
}

pub(crate) fn context(
    root: &Path,
    inventory: Option<&Inventory>,
    template: String,
    home: &Path,
    branches: Branches,
    default_branch: Option<String>,
) -> WorktreeContext {
    let checked_out: Vec<String> = inventory
        .and_then(|inventory| inventory.repositories.as_ref())
        .and_then(|repositories| repositories.repository_worktrees(root))
        .map(|listed| {
            listed
                .worktrees
                .iter()
                .filter_map(|record| match &record.head {
                    WorktreeHead::Branch(name) => Some(name.clone()),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default();
    WorktreeContext {
        root: root.display().to_string(),
        start_from: start_from(&branches.local, default_branch),
        local: branches.local,
        remote: branches.remote,
        checked_out,
        template,
        home: home.display().to_string(),
    }
}

/// The Machine's default branch. A Machine that does not name one leaves the usual names to stand
/// in for it, then the newest local branch.
fn start_from(local: &[String], default_branch: Option<String>) -> Option<String> {
    default_branch.or_else(|| {
        ["main", "master"]
            .iter()
            .find(|name| local.iter().any(|branch| branch == *name))
            .map(|name| (*name).to_owned())
            .or_else(|| local.first().cloned())
    })
}

/// Where `template` places a Worktree of `root` for `branch`, starting with `~` inside `home`.
pub(crate) fn location(template: &str, home: &str, root: &str, branch: &str) -> Option<String> {
    let repository = Path::new(root).file_name()?.to_str()?;
    let path = path_template::expand(template, Path::new(home), repository, branch).ok()?;
    Some(match path.strip_prefix(home) {
        Ok(relative) if relative.as_os_str().is_empty() => "~".to_owned(),
        Ok(relative) => format!("~/{}", relative.display()),
        Err(_) => path.display().to_string(),
    })
}

/// Whether the Machine placed a Worktree at `path` for the Location the person typed, which it
/// expands as it does: `~/` is its `home`.
pub(crate) fn same_location(path: &Path, home: &str, location: &str) -> bool {
    match location.strip_prefix("~/") {
        Some(rest) => path == Path::new(home).join(rest),
        None => path == Path::new(location),
    }
}

pub(crate) fn branch(branch: NewWorktreeBranch) -> Branch {
    match branch {
        NewWorktreeBranch::New {
            name,
            base,
            base_is_remote,
        } => Branch::New {
            name,
            base: if base_is_remote {
                BranchName::Remote(base)
            } else {
                BranchName::Local(base)
            },
        },
        NewWorktreeBranch::Existing { name } => Branch::Existing { name },
        NewWorktreeBranch::Remote { remote, name } => Branch::Remote { remote, name },
    }
}

pub(crate) fn creation(outcome: Option<Outcome>) -> WorktreeCreation {
    match outcome {
        Some(Outcome::Accepted { target }) => WorktreeCreation::Created {
            tab: crate::record_file::hex(&target),
        },
        Some(Outcome::WorktreeFailed(error)) => failure(error),
        _ => WorktreeCreation::Failed,
    }
}

pub(crate) fn failure(error: Error) -> WorktreeCreation {
    match error {
        Error::InvalidName => WorktreeCreation::InvalidName,
        Error::BranchExists => WorktreeCreation::BranchExists,
        Error::Location => WorktreeCreation::NotEmpty,
        _ => WorktreeCreation::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| (*name).to_owned()).collect()
    }

    #[test]
    fn a_removal_review_counts_only_the_panes_with_a_terminal_session() {
        use spaceterm_protocol::hierarchy::ConfirmedPane;
        use spaceterm_protocol::worktree::AffectedTab;
        let pane = |id: u8, session: Option<u8>| ConfirmedPane {
            id: [id; 32],
            session: session.map(|s| [s; 32]),
        };
        let removal = Removal {
            boot: [1; 32],
            confirmation: [2; 32],
            root: "/repo".into(),
            path: "/wt/topic".into(),
            changes: true,
            submodules: false,
            tabs: vec![
                AffectedTab {
                    workspace: [3; 32],
                    tab: [4; 32],
                    panes: vec![pane(5, Some(6)), pane(7, None)],
                },
                AffectedTab {
                    workspace: [3; 32],
                    tab: [8; 32],
                    panes: vec![pane(9, Some(10))],
                },
            ],
        };
        let review = review(removal);
        assert_eq!((review.tabs, review.sessions), (2, 2));
        assert_eq!(review.boot, "01".repeat(32));
        assert_eq!(review.confirmation, "02".repeat(32));
    }

    #[test]
    fn a_remove_refused_for_a_stale_review_reads_as_changed() {
        let changed = WorktreeRemoval::Failed {
            failure: WorktreeRemovalFailure::Changed,
        };
        assert_eq!(removal(Some(Outcome::StaleConfirmation)), changed);
        assert_eq!(
            removal(Some(Outcome::WorktreeFailed(Error::Changed))),
            changed
        );
        assert_eq!(
            removal(Some(Outcome::Accepted { target: [0; 32] })),
            WorktreeRemoval::Removed
        );
        assert_eq!(
            removal(None),
            WorktreeRemoval::Failed {
                failure: WorktreeRemovalFailure::Unanswered
            }
        );
    }

    #[test]
    fn a_location_matches_the_path_the_machine_expanded_it_to() {
        let path = Path::new("/home/me/wt/api-topic");
        assert!(same_location(path, "/home/me", "~/wt/api-topic"));
        assert!(same_location(path, "/home/me", "/home/me/wt/api-topic"));
        assert!(!same_location(path, "/home/me", "~/wt/api-other"));
        assert!(!same_location(path, "/home/me", "/work/api-topic"));
        assert!(!same_location(
            Path::new("/mnt/me/wt/api-topic"),
            "/home/me",
            "~/wt/api-topic"
        ));
    }

    #[test]
    fn start_from_is_the_default_branch_else_main_or_master_then_the_newest_local_branch() {
        assert_eq!(
            start_from(
                &names(&["feat/a", "main", "trunk"]),
                Some("trunk".to_owned())
            ),
            Some("trunk".to_owned())
        );
        assert_eq!(
            start_from(&names(&["feat/a", "main"]), None),
            Some("main".to_owned())
        );
        assert_eq!(
            start_from(&names(&["feat/a", "master"]), None),
            Some("master".to_owned())
        );
        assert_eq!(
            start_from(&names(&["feat/a", "dev"]), None),
            Some("feat/a".to_owned())
        );
        assert_eq!(start_from(&[], None), None);
    }

    #[test]
    fn a_location_follows_the_machines_rule_and_starts_with_a_tilde_at_home() {
        let default = path_template::DEFAULT_WORKTREE_PATH_TEMPLATE;
        assert_eq!(
            location(
                default,
                "/Users/someone",
                "/Users/someone/Projects/api",
                "feat/themes"
            ),
            Some("~/.worktrees/api/feat-themes".to_owned())
        );
        assert_eq!(
            location(
                "/srv/{repository}-{branch}",
                "/Users/someone",
                "/srv/api",
                "fix"
            ),
            Some("/srv/api-fix".to_owned())
        );
        assert_eq!(
            location("{nothing}", "/Users/someone", "/srv/api", "fix"),
            None
        );
    }

    #[test]
    fn a_refused_worktree_says_why_when_the_form_can_show_it() {
        let target = [4; 32];
        assert_eq!(
            creation(Some(Outcome::Accepted { target })),
            WorktreeCreation::Created {
                tab: crate::record_file::hex(&target)
            }
        );
        assert_eq!(
            creation(Some(Outcome::WorktreeFailed(Error::InvalidName))),
            WorktreeCreation::InvalidName
        );
        assert_eq!(
            creation(Some(Outcome::WorktreeFailed(Error::BranchExists))),
            WorktreeCreation::BranchExists
        );
        assert_eq!(
            creation(Some(Outcome::WorktreeFailed(Error::Location))),
            WorktreeCreation::NotEmpty
        );
        assert_eq!(
            creation(Some(Outcome::WorktreeFailed(Error::Branch))),
            WorktreeCreation::Failed
        );
        assert_eq!(creation(None), WorktreeCreation::Failed);
    }
}
