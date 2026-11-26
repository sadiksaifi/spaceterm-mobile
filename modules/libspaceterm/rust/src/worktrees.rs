//! What New Worktree reads from the Machine and what its answer comes to.
use spaceterm_client::hierarchy::{Inventory, Outcome};
use spaceterm_protocol::repository::WorktreeHead;
use spaceterm_protocol::worktree::{Branch, BranchName, Branches, Error, path_template};
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
    /// The Location exists and is not empty.
    NotEmpty,
    Failed,
}

pub(crate) fn context(
    root: &Path,
    inventory: Option<&Inventory>,
    template: String,
    home: &Path,
    branches: Branches,
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
        start_from: start_from(&branches.local),
        local: branches.local,
        remote: branches.remote,
        checked_out,
        template,
        home: home.display().to_string(),
    }
}

/// The Machine names no default branch yet (sadiksaifi/SpaceTerm#950), so the usual names stand
/// in for it, then the newest local branch.
fn start_from(local: &[String]) -> Option<String> {
    ["main", "master"]
        .iter()
        .find(|name| local.iter().any(|branch| branch == *name))
        .map(|name| (*name).to_owned())
        .or_else(|| local.first().cloned())
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
    fn start_from_is_main_or_master_then_the_newest_local_branch() {
        assert_eq!(
            start_from(&names(&["feat/a", "main"])),
            Some("main".to_owned())
        );
        assert_eq!(
            start_from(&names(&["feat/a", "master"])),
            Some("master".to_owned())
        );
        assert_eq!(
            start_from(&names(&["feat/a", "dev"])),
            Some("feat/a".to_owned())
        );
        assert_eq!(start_from(&[]), None);
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
