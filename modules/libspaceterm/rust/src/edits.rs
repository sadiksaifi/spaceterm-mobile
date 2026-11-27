//! Workspace edits, each pairing's through one journal so a lost answer is never applied twice.
use crate::record_file::{Publication, hex, publish_private, read_private};
use spaceterm_client::connection::link::RequestError;
use spaceterm_client::hierarchy::{Mutation, Outcome};
use spaceterm_client::protocol::Refusal;
use spaceterm_client::workspace::{ClientJournal, EditError, JournalStore, WorkspaceEditor};
use spaceterm_client::{CoreError, DirectRouteId, PairedMachine};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// How long an edit waits for the Machine before it counts as failed.
const EDIT_WAIT: Duration = Duration::from_secs(10);
/// How long the answer to a lost edit, recovered while another edit went out, waits for Try Again
/// of the lost one. Only Try Again takes it, so it only bounds what is kept.
const RECOVERED_FOR: Duration = Duration::from_secs(30 * 60);
/// The most recovered answers kept for one pairing; past it the oldest goes.
const RECOVERED_KEPT: usize = 16;

/// What an edit identical to one whose answer was lost asks for.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Repeat {
    /// That same edit again, as Try Again does: the lost one's answer is its answer.
    Same,
    /// One more of it, such as a second New Tab: it goes out after the lost one.
    New,
}

type Slot = Arc<Mutex<Option<(PairedMachine, WorkspaceEditor)>>>;

pub(crate) struct Edits {
    directory: PathBuf,
    editors: Mutex<HashMap<DirectRouteId, Slot>>,
    recovered: Mutex<Recovered>,
}

impl Edits {
    pub(crate) fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            editors: Mutex::default(),
            recovered: Mutex::default(),
        }
    }

    /// Sends `mutation` to `machine` and waits for its answer: the Machine's outcome, or `None`
    /// when no answer arrived. `repeat` says whether an identical edit whose answer was lost is
    /// this one. One edit per pairing runs at a time.
    pub(crate) fn submit(
        &self,
        route: DirectRouteId,
        machine: &PairedMachine,
        mutation: Mutation,
        repeat: Repeat,
    ) -> Option<Outcome> {
        let slot = self.slot(route)?;
        let mut slot = slot.lock().ok()?;
        let deadline = Instant::now() + EDIT_WAIT;
        let editor = self.editor(&mut slot, route, machine)?;
        let pending = editor.journal().pending().cloned();
        // Try Again of an edit whose answer came back while another edit went out. An identical
        // edit still waiting in the journal is the later one, the one Try Again is for.
        if repeat == Repeat::Same
            && pending
                .as_ref()
                .is_none_or(|pending| pending.mutation != mutation)
            && let Some(outcome) = self.take_recovered(route, |recovered| *recovered == mutation)
        {
            return Some(outcome);
        }
        if let Some(pending) = pending {
            // An edit whose answer was lost goes first, again under its own sequence, so the
            // Machine applies it at most once: it may have run already, be queued there, or never
            // have arrived. Its name version or Kill confirmation keeps it from acting on a
            // Workspace that changed since the person saw it.
            match editor.retry(deadline) {
                Ok(Some(outcome)) => {
                    let _ = editor.presented(outcome.sequence);
                    // Try Again of that same edit: its answer is this one's.
                    if repeat == Repeat::Same && pending.mutation == mutation {
                        return Some(outcome.outcome);
                    }
                    // Its own Try Again may still come, and must not apply it twice.
                    if let Ok(mut recovered) = self.recovered.lock() {
                        recovered.keep(route, pending.mutation, outcome.outcome, Instant::now());
                    }
                }
                Ok(None) => {}
                // Core answers Stale only when the sequence can no longer run this edit: another
                // edit holds it, or Core's Workspaces started over. A queued edit is answered
                // Pending, never Stale. So the journal lets this one go and nothing is sent again.
                Err(EditError::Request(RequestError::Refused(Refusal::Stale))) => {
                    *slot = None;
                    if !self.abandon(route, machine) {
                        return None;
                    }
                }
                // Anything else leaves it to be sent again, as it may still run.
                Err(error) => return self.failed(&mut slot, error),
            }
        }
        let editor = self.editor(&mut slot, route, machine)?;
        match editor.submit(mutation, deadline) {
            Ok(outcome) => {
                // The person sees every answer when it arrives, so none waits to be presented.
                let _ = editor.presented(outcome.sequence);
                Some(outcome.outcome)
            }
            Err(error) => self.failed(&mut slot, error),
        }
    }

    /// Sends again the edit whose answer was lost, when `matches` takes it for the one the person
    /// asks for now, and answers with its outcome. `None` when no such edit waits, and nothing is
    /// sent.
    pub(crate) fn resume(
        &self,
        route: DirectRouteId,
        machine: &PairedMachine,
        matches: impl Fn(&Mutation) -> bool,
    ) -> Option<Option<Outcome>> {
        let slot = self.slot(route)?;
        let mut slot = slot.lock().ok()?;
        let editor = self.editor(&mut slot, route, machine)?;
        // A matching edit still waiting in the journal is the later one, the one asked for now.
        if !editor
            .journal()
            .pending()
            .is_some_and(|pending| matches(&pending.mutation))
        {
            return self
                .take_recovered(route, |recovered| matches(recovered))
                .map(Some);
        }
        Some(match editor.retry(Instant::now() + EDIT_WAIT) {
            Ok(Some(outcome)) => {
                let _ = editor.presented(outcome.sequence);
                Some(outcome.outcome)
            }
            Ok(None) => None,
            // The sequence can no longer run it, so it never ran; see `submit`.
            Err(EditError::Request(RequestError::Refused(Refusal::Stale))) => {
                *slot = None;
                self.abandon(route, machine);
                None
            }
            Err(error) => self.failed(&mut slot, error),
        })
    }

    /// Settles a failed edit, which stays in the journal: a refusal does not show the Machine
    /// left it undone, since Core can refuse after it applied one. The next edit sends it again
    /// first.
    fn failed(
        &self,
        slot: &mut Option<(PairedMachine, WorkspaceEditor)>,
        error: EditError,
    ) -> Option<Outcome> {
        // Storage that failed under the editor gets a fresh editor, which reads the journal anew.
        if let EditError::Core(CoreError::StorageUnavailable) = error {
            *slot = None;
        }
        None
    }

    /// Forgets a pairing's edits once its Saved Connection is gone, after any edit under way.
    pub(crate) fn forget(&self, route: &DirectRouteId) {
        let slot = self
            .editors
            .lock()
            .ok()
            .and_then(|mut editors| editors.remove(route));
        let _held = slot.as_ref().map(|slot| slot.lock());
        let _ = fs::remove_file(self.directory.join(journal_name(route)));
    }

    /// Deletes the journals of pairings `removed` says are gone. A removal whose save failed
    /// keeps its journal, and a later save of it calls no one, so each start sweeps.
    pub(crate) fn sweep(&self, removed: impl Fn(&DirectRouteId) -> bool) {
        let Ok(entries) = fs::read_dir(&self.directory) else {
            return;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(route) = name.to_str().and_then(journal_route) else {
                continue;
            };
            if removed(&route) {
                self.forget(&route);
            }
        }
    }

    fn take_recovered(
        &self,
        route: DirectRouteId,
        matches: impl Fn(&Mutation) -> bool,
    ) -> Option<Outcome> {
        self.recovered
            .lock()
            .ok()?
            .take(route, matches, Instant::now())
    }

    fn slot(&self, route: DirectRouteId) -> Option<Slot> {
        let mut editors = self.editors.lock().ok()?;
        Some(Arc::clone(editors.entry(route).or_default()))
    }

    /// The pairing's editor for `machine`'s connection. A new connection gets a new editor; the
    /// old one lets go of the journal first.
    fn editor<'a>(
        &self,
        slot: &'a mut Option<(PairedMachine, WorkspaceEditor)>,
        route: DirectRouteId,
        machine: &PairedMachine,
    ) -> Option<&'a mut WorkspaceEditor> {
        if slot
            .as_ref()
            .is_none_or(|(held, _)| !held.same_handle(machine))
        {
            *slot = None;
            let editor = machine
                .workspace_edits(Box::new(self.journal(route)))
                .ok()?;
            *slot = Some((machine.clone(), editor));
        }
        slot.as_mut().map(|(_, editor)| editor)
    }

    /// Drops the pending edit from the journal, which no editor holds now.
    fn abandon(&self, route: DirectRouteId, machine: &PairedMachine) -> bool {
        // This app acts as no agent, so its Client Identity is the pairing's own.
        let paired = machine.paired();
        ClientJournal::open(
            Box::new(self.journal(route)),
            paired.pin.core,
            paired.client,
        )
        .and_then(|mut journal| journal.abandon())
        .is_ok()
    }

    fn journal(&self, route: DirectRouteId) -> JournalFile {
        JournalFile {
            directory: self.directory.clone(),
            name: journal_name(&route),
        }
    }
}

/// Each pairing's answers to lost edits that other edits recovered, kept for those edits' own
/// Try Again. Each answers once, and only within `RECOVERED_FOR`.
#[derive(Default)]
struct Recovered(HashMap<DirectRouteId, Vec<(Mutation, Outcome, Instant)>>);

impl Recovered {
    fn keep(&mut self, route: DirectRouteId, mutation: Mutation, outcome: Outcome, at: Instant) {
        let kept = self.0.entry(route).or_default();
        kept.retain(|(_, _, since)| at.saturating_duration_since(*since) <= RECOVERED_FOR);
        if kept.len() == RECOVERED_KEPT {
            kept.remove(0);
        }
        kept.push((mutation, outcome, at));
    }

    fn take(
        &mut self,
        route: DirectRouteId,
        matches: impl Fn(&Mutation) -> bool,
        now: Instant,
    ) -> Option<Outcome> {
        let kept = self.0.get_mut(&route)?;
        kept.retain(|(_, _, since)| now.saturating_duration_since(*since) <= RECOVERED_FOR);
        // Of identical edits, the latest is the one whose failure shows, so Try Again is for it.
        let at = kept
            .iter()
            .rposition(|(mutation, _, _)| matches(mutation))?;
        Some(kept.remove(at).1)
    }
}

fn journal_name(route: &DirectRouteId) -> String {
    format!("workspace-edits-{}.json", hex(route))
}

/// The pairing a journal file belongs to, read back from its name.
fn journal_route(name: &str) -> Option<DirectRouteId> {
    let hex = name
        .strip_prefix("workspace-edits-")?
        .strip_suffix(".json")?;
    let mut route = DirectRouteId::default();
    if hex.len() != route.len() * 2 {
        return None;
    }
    for (byte, pair) in route.iter_mut().zip(hex.as_bytes().chunks(2)) {
        *byte = u8::from_str_radix(std::str::from_utf8(pair).ok()?, 16).ok()?;
    }
    Some(route)
}

/// One pairing's journal in a private file beside the Saved Connections. Only one editor per
/// pairing exists in the process, which holds the writer lease the journal asks for.
struct JournalFile {
    directory: PathBuf,
    name: String,
}

impl JournalStore for JournalFile {
    fn read(&self) -> Result<Option<Vec<u8>>, CoreError> {
        let path = self.directory.join(&self.name);
        let bytes = read_private(&path).map_err(|_| CoreError::StorageUnavailable)?;
        // A read after a failed write reports only what is on disk: the file, and the directory
        // entry that names it or no longer does.
        if bytes.is_some() {
            File::open(&path)
                .and_then(|file| file.sync_all())
                .map_err(|_| CoreError::StorageUnavailable)?;
        }
        File::open(&self.directory)
            .and_then(|directory| directory.sync_all())
            .map_err(|_| CoreError::StorageUnavailable)?;
        Ok(bytes)
    }

    fn replace(&self, bytes: &[u8]) -> Result<(), CoreError> {
        match publish_private(&self.directory, &self.name, bytes) {
            Publication::Published { synchronized: true } => Ok(()),
            _ => Err(CoreError::StorageUnavailable),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_journal_reads_back_what_it_replaced() {
        let mut nonce = [0u8; 8];
        getrandom::fill(&mut nonce).unwrap();
        let directory = std::env::temp_dir().join(format!("spaceterm-edits-{}", hex(&nonce)));
        fs::create_dir_all(&directory).unwrap();
        let journal = JournalFile {
            directory: directory.clone(),
            name: journal_name(&[3; 32]),
        };

        assert_eq!(journal.read(), Ok(None));
        journal.replace(b"first").unwrap();
        journal.replace(b"second").unwrap();
        assert_eq!(journal.read(), Ok(Some(b"second".to_vec())));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn a_recovered_answer_answers_its_own_edit_once_and_only_for_a_while() {
        use spaceterm_client::hierarchy::CreateControl;
        let new_tab = |workspace: u8| Mutation::CreateTab {
            workspace: [workspace; 32],
            source: None,
            control: CreateControl::Unclaimed,
        };
        let created = Outcome::Accepted { target: [7; 32] };
        let (route, start) = ([1; 32], Instant::now());
        let mut recovered = Recovered::default();

        recovered.keep(route, new_tab(1), created.clone(), start);
        assert_eq!(recovered.take([2; 32], |m| *m == new_tab(1), start), None);
        assert_eq!(recovered.take(route, |m| *m == new_tab(2), start), None);
        assert_eq!(
            recovered.take(route, |m| *m == new_tab(1), start),
            Some(created.clone())
        );
        assert_eq!(recovered.take(route, |m| *m == new_tab(1), start), None);

        recovered.keep(route, new_tab(1), created, start);
        let later = start + RECOVERED_FOR + Duration::from_secs(1);
        assert_eq!(recovered.take(route, |m| *m == new_tab(1), later), None);
    }

    #[test]
    fn a_recovered_answer_waits_while_others_are_recovered() {
        use spaceterm_client::hierarchy::CreateControl;
        let new_tab = |workspace: u8| Mutation::CreateTab {
            workspace: [workspace; 32],
            source: None,
            control: CreateControl::Unclaimed,
        };
        let created = |tab: u8| Outcome::Accepted { target: [tab; 32] };
        let (route, start) = ([1; 32], Instant::now());
        let mut recovered = Recovered::default();

        recovered.keep(route, new_tab(1), created(1), start);
        recovered.keep(route, new_tab(2), created(2), start);
        assert_eq!(
            recovered.take(route, |m| *m == new_tab(1), start),
            Some(created(1))
        );
        assert_eq!(
            recovered.take(route, |m| *m == new_tab(2), start),
            Some(created(2))
        );

        for workspace in 0..=RECOVERED_KEPT as u8 {
            recovered.keep(route, new_tab(workspace), created(workspace), start);
        }
        assert_eq!(recovered.take(route, |m| *m == new_tab(0), start), None);
        assert_eq!(
            recovered.take(route, |m| *m == new_tab(1), start),
            Some(created(1))
        );
    }

    #[test]
    fn a_recovered_answer_of_identical_edits_is_the_latest_one() {
        use spaceterm_client::hierarchy::CreateControl;
        let new_tab = Mutation::CreateTab {
            workspace: [1; 32],
            source: None,
            control: CreateControl::Unclaimed,
        };
        let created = |tab: u8| Outcome::Accepted { target: [tab; 32] };
        let (route, start) = ([1; 32], Instant::now());
        let mut recovered = Recovered::default();

        // Try Again is for the failure shown, which is the later of two identical edits.
        recovered.keep(route, new_tab.clone(), created(1), start);
        recovered.keep(route, new_tab.clone(), created(2), start);
        assert_eq!(
            recovered.take(route, |m| *m == new_tab, start),
            Some(created(2))
        );
    }

    #[test]
    fn a_sweep_deletes_only_the_journals_of_removed_pairings() {
        let mut nonce = [0u8; 8];
        getrandom::fill(&mut nonce).unwrap();
        let directory = std::env::temp_dir().join(format!("spaceterm-sweep-{}", hex(&nonce)));
        fs::create_dir_all(&directory).unwrap();
        let (kept, removed) = ([1; 32], [2; 32]);
        for route in [kept, removed] {
            fs::write(directory.join(journal_name(&route)), b"{}").unwrap();
        }
        fs::write(directory.join("saved-connections.json"), b"{}").unwrap();

        Edits::new(directory.clone()).sweep(|route| *route == removed);

        assert!(directory.join(journal_name(&kept)).exists());
        assert!(!directory.join(journal_name(&removed)).exists());
        assert!(directory.join("saved-connections.json").exists());
        let _ = fs::remove_dir_all(directory);
    }
}
