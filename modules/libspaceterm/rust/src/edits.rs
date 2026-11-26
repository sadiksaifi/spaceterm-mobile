//! Workspace edits, each pairing's through one journal so a lost answer is never applied twice.
use crate::record_file::{Publication, hex, publish_private, read_private};
use spaceterm_client::hierarchy::{Mutation, Outcome, RetainedOutcome};
use spaceterm_client::workspace::{EditError, JournalStore, WorkspaceEditor};
use spaceterm_client::{CoreError, DirectRouteId, PairedMachine};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// How long an edit waits for the Machine before it counts as failed.
const EDIT_WAIT: Duration = Duration::from_secs(10);
/// How long an edit waits for a list that offers a fresh sequence.
const FRESH_WAIT: Duration = Duration::from_secs(2);

type Slot = Arc<Mutex<Option<(PairedMachine, WorkspaceEditor)>>>;

pub(crate) struct Edits {
    directory: PathBuf,
    editors: Mutex<HashMap<DirectRouteId, Slot>>,
}

impl Edits {
    pub(crate) fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            editors: Mutex::default(),
        }
    }

    /// Sends `mutation` to `machine` and waits for its answer. Returns whether the Machine made
    /// the change. One edit per pairing runs at a time.
    pub(crate) fn submit(
        &self,
        route: DirectRouteId,
        machine: &PairedMachine,
        mutation: Mutation,
    ) -> bool {
        let Some(slot) = self.slot(route) else {
            return false;
        };
        let Ok(mut slot) = slot.lock() else {
            return false;
        };
        let deadline = Instant::now() + EDIT_WAIT;
        let Some(editor) = self.editor(&mut slot, route, machine) else {
            return false;
        };
        if let Some(pending) = editor.journal().pending().cloned() {
            // An edit whose answer was lost goes first, again under its own sequence, so the
            // Machine applies it at most once: it may have run already, be queued there, or never
            // have arrived. Its name version or Kill confirmation keeps it from acting on a
            // Workspace that changed since the person saw it.
            match editor.retry(deadline) {
                Ok(Some(outcome)) => {
                    let _ = editor.presented(outcome.sequence);
                    // Try Again of that same edit: its answer is this one's.
                    if pending.mutation == mutation {
                        return accepted(&outcome);
                    }
                }
                Ok(None) => {}
                // It stays until the Machine answers it. Nothing here drops an edit once sent, so
                // no later edit can take its sequence while it may still run.
                Err(error) => return self.failed(&mut slot, error),
            }
        }
        let Some(editor) = self.editor(&mut slot, route, machine) else {
            return false;
        };
        // The wait takes at most half of what is left, so the edit keeps time to be sent.
        if let Some(last) = editor.journal().last() {
            let left = deadline.saturating_duration_since(Instant::now());
            await_other_sequence(
                machine,
                last.sequence,
                Instant::now() + FRESH_WAIT.min(left / 2),
            );
        }
        match editor.submit(mutation, deadline) {
            Ok(outcome) => {
                // The person sees every answer when it arrives, so none waits to be presented.
                let _ = editor.presented(outcome.sequence);
                accepted(&outcome)
            }
            Err(error) => self.failed(&mut slot, error),
        }
    }

    /// Settles a failed edit, which stays in the journal: a refusal does not show the Machine
    /// left it undone, since Core can refuse after it applied one. The next edit sends it again
    /// first.
    fn failed(
        &self,
        slot: &mut Option<(PairedMachine, WorkspaceEditor)>,
        error: EditError,
    ) -> bool {
        // Storage that failed under the editor gets a fresh editor, which reads the journal anew.
        if let EditError::Core(CoreError::StorageUnavailable) = error {
            *slot = None;
        }
        false
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

    fn journal(&self, route: DirectRouteId) -> JournalFile {
        JournalFile {
            directory: self.directory.clone(),
            name: journal_name(&route),
        }
    }
}

/// Waits until `machine`'s connection offers a sequence other than `settled`, or `until`. A
/// connection made while an edit settled can still offer that edit's sequence, which Core would
/// refuse as stale; a newer list usually follows at once. The edit goes on either way, as Core
/// can offer that sequence again after its Workspaces start over.
fn await_other_sequence(machine: &PairedMachine, settled: u64, until: Instant) {
    let Some(link) = machine.work().live_link() else {
        return;
    };
    let mut seen = 0;
    // A list can arrive on every turn, so the clock ends the wait, not the lists.
    while Instant::now() < until {
        let Ok(Some((revision, inventory))) = link.next_inventory_by(seen, until) else {
            return;
        };
        if inventory.next_sequence != settled {
            return;
        }
        seen = revision;
    }
}

fn accepted(outcome: &RetainedOutcome) -> bool {
    matches!(outcome.outcome, Outcome::Accepted { .. })
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
