//! A Workspace's Tabs, Panes and Worktrees, as its grid of Tabs shows them.
use crate::record_file::hex;
use spaceterm_client::hierarchy::{
    CloseConfirmation, CloseTarget, Id, Inventory, Pane, Side, Tab, Workspace,
};
use spaceterm_client::pane::metadata::{self, CommandState, Snapshot, TitleProvenance};
use spaceterm_protocol::repository::WorktreeHead;

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct TabSummary {
    /// The Tab, as hexadecimal.
    pub id: String,
    /// Its Root Pane's name, as SpaceTerm Desktop names the Tab.
    pub name: String,
    /// The Worktree the Tab belongs to, as the Machine's path. `None` outside a repository.
    pub worktree: Option<String>,
    /// In the order the Machine keeps them. The first is the Root Pane.
    pub panes: Vec<PaneSummary>,
    /// What Close Tab sends back, so the Machine ends only the Terminal Sessions the person saw.
    /// Opaque outside this crate.
    pub seen: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum PaneSide {
    Right,
    Down,
    Left,
    Up,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct PaneSummary {
    /// The Pane, as hexadecimal.
    pub id: String,
    pub name: String,
    /// The Pane this one was placed beside, and on which side of it. Every client without a saved
    /// arrangement draws the split from these.
    pub source: Option<String>,
    pub side: PaneSide,
    /// The shell reports a command running. The Machine's own view of the foreground is not
    /// published yet: sadiksaifi/SpaceTerm#949.
    pub running: bool,
    /// Another device controls the Pane.
    pub controlled_elsewhere: bool,
    /// What Close Pane sends back. Opaque outside this crate.
    pub seen: String,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct WorktreeSummary {
    /// The Worktree's root, as the Machine's path.
    pub path: String,
    /// The branch it has checked out, or the short commit of a detached `HEAD`.
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct RepositorySummary {
    /// The Main Worktree, as the Machine's path.
    pub root: String,
    /// As `git worktree list` lists them, the Main Worktree first. Missing ones are left out.
    pub worktrees: Vec<WorktreeSummary>,
}

/// The Tabs of `workspace`, in the order the Machine keeps them. `client` is this device's
/// identity on the Machine, which tells its own control from another device's.
pub(crate) fn tabs(
    inventory: &Inventory,
    workspace: &Workspace,
    client: Option<Id>,
) -> Vec<TabSummary> {
    workspace
        .tabs
        .iter()
        .map(|tab| TabSummary {
            id: hex(&tab.id),
            name: tab_name(tab),
            worktree: tab.worktree.as_ref().map(|path| path.display().to_string()),
            panes: tab
                .panes
                .iter()
                .map(|pane| PaneSummary {
                    id: hex(&pane.id),
                    name: pane_name(pane),
                    source: pane.source.as_ref().map(|source| hex(source)),
                    side: side(pane.side),
                    running: running(pane),
                    controlled_elsewhere: controlled_elsewhere(inventory, pane, client),
                    seen: write_confirmation(inventory.close_confirmation(CloseTarget::Pane {
                        workspace: workspace.id,
                        tab: tab.id,
                        pane: pane.id,
                    })),
                })
                .collect(),
            seen: write_confirmation(inventory.close_confirmation(CloseTarget::Tab {
                workspace: workspace.id,
                tab: tab.id,
            })),
        })
        .collect()
}

/// The repository `workspace` is in, with every Worktree Git lists for it, or `None` outside one.
pub(crate) fn repository(
    inventory: &Inventory,
    workspace: &Workspace,
) -> Option<RepositorySummary> {
    let root = workspace.repository()?;
    let listed = inventory
        .repositories
        .as_ref()
        .and_then(|repositories| repositories.repository_worktrees(root));
    let worktrees = listed.map_or_else(Vec::new, |listed| {
        listed
            .worktrees
            .iter()
            .filter(|record| !record.missing)
            .filter_map(|record| {
                let name = match &record.head {
                    WorktreeHead::Branch(name) | WorktreeHead::Detached(name) => name.clone(),
                    WorktreeHead::Bare => return None,
                };
                Some(WorktreeSummary {
                    path: record.root.display().to_string(),
                    name,
                })
            })
            .collect()
    });
    Some(RepositorySummary {
        root: root.display().to_string(),
        worktrees,
    })
}

pub(crate) fn write_confirmation(confirmation: Option<CloseConfirmation>) -> String {
    serde_json::to_string(&confirmation).unwrap_or_default()
}

pub(crate) fn read_confirmation(text: &str) -> Option<CloseConfirmation> {
    serde_json::from_str::<Option<CloseConfirmation>>(text).ok()?
}

/// A Tab takes its Root Pane's name.
fn tab_name(tab: &Tab) -> String {
    tab.panes
        .iter()
        .find(|pane| pane.id == tab.root_pane)
        .map_or_else(|| FALLBACK.to_owned(), pane_name)
}

const FALLBACK: &str = "Terminal";

/// As SpaceTerm Core names a Pane: a title the program set, else the command running, else the
/// shell.
fn pane_name(pane: &Pane) -> String {
    pane.presentation
        .as_deref()
        .map_or_else(|| FALLBACK.to_owned(), activity)
}

fn activity(snapshot: &Snapshot) -> String {
    if snapshot.title_provenance == TitleProvenance::TerminalControl {
        let title = metadata::sanitize(&snapshot.title, metadata::MAX_TITLE_CHARS);
        let words = title_words(&title);
        return if words.is_empty() {
            FALLBACK.to_owned()
        } else {
            words.to_owned()
        };
    }
    let running = snapshot
        .command
        .as_ref()
        .filter(|command| command.state == CommandState::Running)
        .map(|command| metadata::sanitize(&command.line, metadata::MAX_TITLE_CHARS))
        .filter(|line| !line.is_empty());
    if let Some(line) = running {
        return line;
    }
    let shell = metadata::sanitize(snapshot.shell_name.trim(), metadata::MAX_TITLE_CHARS);
    if shell.is_empty() {
        FALLBACK.to_owned()
    } else {
        shell
    }
}

/// A title without the glyph a program put in front of it, as SpaceTerm Core's
/// `labels::reported_title` reads it: `✳ Claude Code` is named `Claude Code`.
fn title_words(title: &str) -> &str {
    let title = title.trim();
    let Some(split) = title.find(char::is_whitespace) else {
        return title;
    };
    let (first, rest) = title.split_at(split);
    if !is_glyph_word(first) {
        return title;
    }
    let words = words_after_glyph(rest);
    if words.is_empty() { title } else { words }
}

/// Characters a title keeps, because a Terminal Session can be named after them.
const TITLE_WORD_CHARS: &str = "~/\\._-:@$#([{'\"";
/// Characters that separate a program's glyph from the words after it.
const TITLE_SEPARATOR_CHARS: &str = "-\u{2013}\u{2014}\u{00b7}|:";
/// How many characters the first word of a title can hold and still be a glyph.
const MAXIMUM_GLYPH_CHARS: usize = 2;

fn words_after_glyph(rest: &str) -> &str {
    let words = rest.trim_start();
    let Some(split) = words.find(char::is_whitespace) else {
        return words.trim_end();
    };
    let (first, remainder) = words.split_at(split);
    if first.chars().count() == 1 && first.chars().all(|c| TITLE_SEPARATOR_CHARS.contains(c)) {
        remainder.trim()
    } else {
        words.trim_end()
    }
}

fn is_glyph_word(word: &str) -> bool {
    let bases = word.chars().filter(|c| !is_glyph_mark(*c)).count();
    let decorative = bases == 1 || word.chars().all(|c| !c.is_alphanumeric());
    (1..=MAXIMUM_GLYPH_CHARS).contains(&bases)
        && decorative
        && word
            .chars()
            .all(|c| !c.is_ascii_alphanumeric() && !TITLE_WORD_CHARS.contains(c))
}

fn is_glyph_mark(character: char) -> bool {
    matches!(
        u32::from(character),
        0xFE00..=0xFE0F | 0x200D | 0x1F3FB..=0x1F3FF | 0xE0100..=0xE01EF
    )
}

fn running(pane: &Pane) -> bool {
    pane.presentation
        .as_deref()
        .and_then(|snapshot| snapshot.command.as_ref())
        .is_some_and(|command| command.state == CommandState::Running)
}

fn controlled_elsewhere(inventory: &Inventory, pane: &Pane, client: Option<Id>) -> bool {
    inventory.close.as_ref().is_some_and(|close| {
        close
            .controls
            .iter()
            .any(|control| control.pane == pane.id && Some(control.owner) != client)
    })
}

fn side(side: Side) -> PaneSide {
    match side {
        Side::Right => PaneSide::Right,
        Side::Down => PaneSide::Down,
        Side::Left => PaneSide::Left,
        Side::Up => PaneSide::Up,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use spaceterm_client::hierarchy::{
        CloseInventory, ConfirmedControl, ConfirmedPane, PaneObservers, WorktreeMembership,
    };
    use spaceterm_client::pane::metadata::{
        Command, DirectoryProvenance, Freshness, Progress, PromptZone, TitleGlyph,
    };
    use std::path::PathBuf;

    fn id(byte: u8) -> Id {
        [byte; 32]
    }

    fn snapshot(
        shell: &str,
        title: &str,
        provenance: TitleProvenance,
        command: Option<Command>,
    ) -> Snapshot {
        Snapshot {
            revision: 1,
            shell_name: shell.to_owned(),
            title: title.to_owned(),
            title_provenance: provenance,
            directory: "/srv/api".to_owned(),
            directory_provenance: DirectoryProvenance::Osc7,
            user: None,
            host: None,
            home: None,
            freshness: Freshness::Live,
            finished_commands: 0,
            prompt_zone: PromptZone::Prompt,
            command,
            title_activity: false,
            title_glyph: TitleGlyph::Reported,
            progress: Progress::None,
        }
    }

    fn pane(byte: u8, presentation: Option<Snapshot>) -> Pane {
        Pane {
            id: id(byte),
            source: None,
            side: Side::Right,
            starting_directory: PathBuf::from("/srv/api"),
            current_directory: None,
            repository_directory: None,
            presentation: presentation.map(Box::new),
            observers: PaneObservers::default(),
            confirmed_directory: None,
            creator: None,
        }
    }

    fn workspace(tabs: Vec<Tab>) -> Workspace {
        Workspace {
            id: id(1),
            name: "api".to_owned(),
            name_version: 0,
            pin_version: 0,
            pinned_directory: None,
            root_tab: tabs[0].id,
            tabs,
        }
    }

    fn tab(byte: u8, panes: Vec<Pane>) -> Tab {
        Tab {
            worktree_membership: WorktreeMembership::default(),
            worktree: None,
            worktree_repository: None,
            id: id(byte),
            root_pane: panes[0].id,
            panes,
        }
    }

    fn inventory(workspace: &Workspace, controls: Vec<ConfirmedControl>) -> Inventory {
        let sessions = workspace
            .tabs
            .iter()
            .flat_map(|tab| &tab.panes)
            .map(|pane| ConfirmedPane {
                id: pane.id,
                session: Some(id(pane.id[0] + 50)),
            })
            .collect();
        Inventory {
            repositories: None,
            revision: 1,
            workspaces: vec![workspace.clone()],
            close: Some(CloseInventory {
                boot: id(200),
                sessions,
                controls,
            }),
        }
    }

    fn running_command(line: &str) -> Option<Command> {
        Some(Command {
            line: line.to_owned(),
            state: CommandState::Running,
        })
    }

    #[test]
    fn a_pane_is_named_by_its_title_then_its_running_command_then_its_shell() {
        let set = snapshot(
            "zsh",
            "✳ Claude Code",
            TitleProvenance::TerminalControl,
            None,
        );
        let command = snapshot(
            "zsh",
            "~/srv",
            TitleProvenance::WorkingDirectory,
            running_command("expo start"),
        );
        let idle = snapshot("zsh", "~/srv", TitleProvenance::WorkingDirectory, None);
        let names: Vec<_> = [Some(set), Some(command), Some(idle), None]
            .into_iter()
            .map(|presentation| pane_name(&pane(10, presentation)))
            .collect();
        assert_eq!(names, ["Claude Code", "expo start", "zsh", "Terminal"]);
    }

    #[test]
    fn a_title_keeps_a_first_word_that_names_something() {
        assert_eq!(title_words("vim — notes.md"), "vim — notes.md");
        assert_eq!(title_words("⠋ · building"), "building");
        assert_eq!(title_words("~/srv api"), "~/srv api");
    }

    #[test]
    fn a_tab_takes_its_root_panes_name_and_lists_its_panes_in_order() {
        let idle = snapshot("zsh", "", TitleProvenance::Fallback, None);
        let busy = snapshot(
            "zsh",
            "",
            TitleProvenance::Fallback,
            running_command("git log"),
        );
        let mut second = pane(11, Some(busy));
        second.source = Some(id(10));
        second.side = Side::Down;
        let listed = workspace(vec![tab(100, vec![pane(10, Some(idle)), second])]);
        let tabs = tabs(&inventory(&listed, Vec::new()), &listed, None);
        assert_eq!(tabs.len(), 1);
        assert_eq!(tabs[0].name, "zsh");
        let panes: Vec<_> = tabs[0]
            .panes
            .iter()
            .map(|pane| {
                (
                    pane.name.as_str(),
                    pane.source.clone(),
                    pane.side,
                    pane.running,
                )
            })
            .collect();
        assert_eq!(
            panes,
            [
                ("zsh", None, PaneSide::Right, false),
                ("git log", Some(hex(&id(10))), PaneSide::Down, true)
            ]
        );
    }

    #[test]
    fn a_pane_another_device_controls_says_so_and_this_devices_own_does_not() {
        let listed = workspace(vec![tab(
            100,
            vec![pane(10, None), pane(11, None), pane(12, None)],
        )]);
        let control = |pane: u8, owner: u8| ConfirmedControl {
            pane: id(pane),
            session: Some(id(pane + 50)),
            owner: id(owner),
            epoch: 1,
        };
        let listed_inventory = inventory(&listed, vec![control(10, 7), control(11, 9)]);
        let panes = &tabs(&listed_inventory, &listed, Some(id(9)))[0].panes;
        let elsewhere: Vec<_> = panes.iter().map(|pane| pane.controlled_elsewhere).collect();
        assert_eq!(elsewhere, [true, false, false]);
    }

    #[test]
    fn a_tab_and_each_pane_carry_what_their_close_sends_back() {
        let listed = workspace(vec![tab(100, vec![pane(10, None), pane(11, None)])]);
        let listed_inventory = inventory(&listed, Vec::new());
        let tab = &tabs(&listed_inventory, &listed, None)[0];
        assert_eq!(
            read_confirmation(&tab.seen),
            listed_inventory.close_confirmation(CloseTarget::Tab {
                workspace: id(1),
                tab: id(100)
            })
        );
        assert_eq!(
            read_confirmation(&tab.panes[1].seen),
            listed_inventory.close_confirmation(CloseTarget::Pane {
                workspace: id(1),
                tab: id(100),
                pane: id(11)
            })
        );
        assert!(read_confirmation(&tab.seen).is_some_and(|seen| seen.panes.len() == 2));
    }

    #[test]
    fn a_workspace_outside_a_repository_has_no_worktrees() {
        let listed = workspace(vec![tab(100, vec![pane(10, None)])]);
        assert_eq!(repository(&inventory(&listed, Vec::new()), &listed), None);
    }

    #[test]
    fn a_workspace_in_a_repository_lists_every_worktree_git_lists_except_missing_ones() {
        use spaceterm_protocol::repository::{
            DirectoryFacts, GitToolStatus, PinCheckState, Snapshot as Repositories,
            WorktreeInventory, WorktreeRecord,
        };
        let mut placed = tab(100, vec![pane(10, None)]);
        placed.worktree = Some(PathBuf::from("/srv/api"));
        placed.worktree_repository = Some(PathBuf::from("/srv/api"));
        let listed = workspace(vec![placed]);
        let record = |root: &str, head: WorktreeHead, missing: bool| WorktreeRecord {
            root: PathBuf::from(root),
            head,
            locked: false,
            missing,
        };
        let mut listed_inventory = inventory(&listed, Vec::new());
        listed_inventory.repositories = Some(Repositories {
            boot: id(200),
            revision: 1,
            git: GitToolStatus::Unknown,
            directories: vec![DirectoryFacts {
                directory: PathBuf::from("/srv/api"),
                repository: None,
                worktrees: Some(WorktreeInventory {
                    main_root: PathBuf::from("/srv/api"),
                    current: Some(0),
                    worktrees: vec![
                        record("/srv/api", WorktreeHead::Branch("main".to_owned()), false),
                        record(
                            "/srv/api-pairing",
                            WorktreeHead::Branch("feat/pairing".to_owned()),
                            false,
                        ),
                        record("/srv/api-old", WorktreeHead::Branch("old".to_owned()), true),
                        record(
                            "/srv/api-bisect",
                            WorktreeHead::Detached("eac6ef1".to_owned()),
                            false,
                        ),
                    ],
                }),
                failure: None,
                inside_git_directory: false,
            }],
            pinned_worktrees: Vec::new(),
            pin_check: PinCheckState::Ready,
        });
        let summary = repository(&listed_inventory, &listed).unwrap();
        assert_eq!(summary.root, "/srv/api");
        let names: Vec<_> = summary
            .worktrees
            .iter()
            .map(|worktree| (worktree.path.as_str(), worktree.name.as_str()))
            .collect();
        assert_eq!(
            names,
            [
                ("/srv/api", "main"),
                ("/srv/api-pairing", "feat/pairing"),
                ("/srv/api-bisect", "eac6ef1")
            ]
        );
    }
}
