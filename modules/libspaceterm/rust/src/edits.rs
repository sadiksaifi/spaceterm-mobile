//! Workspace edits, each pairing's through one journal so a lost answer is never applied twice.
use crate::record_file::{Publication, hex, publish_private, read_private};
use spaceterm_client::connection::link::RequestError;
use spaceterm_client::hierarchy::{Mutation, Outcome, RetainedOutcome};
use spaceterm_client::workspace::{ClientJournal, EditError, JournalStore, WorkspaceEditor};
use spaceterm_client::{CoreError, DirectRouteId, PairedMachine};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// How long an edit waits for the Machine before it counts as failed.
const EDIT_WAIT: Duration = Duration::from_secs(10);

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
            // An earlier edit whose answer was lost goes first, with its own sequence, so the
            // Machine applies it at most once: it may have run already, or still be queued there.
            match editor.retry(deadline) {
                Ok(outcome) => {
                    if let Some(outcome) = outcome {
                        let _ = editor.presented(outcome.sequence);
                        // Try Again of that same edit: its answer is this one's.
                        if pending.mutation == mutation {
                            return accepted(&outcome);
                        }
                    }
                }
                Err(error) => return self.failed(&mut slot, route, machine, error),
            }
        }
        let Some(editor) = self.editor(&mut slot, route, machine) else {
            return false;
        };
        match editor.submit(mutation, deadline) {
            Ok(outcome) => {
                // The person sees every answer when it arrives, so none waits to be presented.
                let _ = editor.presented(outcome.sequence);
                accepted(&outcome)
            }
            Err(error) => self.failed(&mut slot, route, machine, error),
        }
    }

    /// Settles a failed edit. One the Machine refused never runs, so the journal drops it; one
    /// whose answer was lost stays for the next edit to send again.
    fn failed(
        &self,
        slot: &mut Option<(PairedMachine, WorkspaceEditor)>,
        route: DirectRouteId,
        machine: &PairedMachine,
        error: EditError,
    ) -> bool {
        match error {
            EditError::Request(RequestError::Refused(_)) => {
                *slot = None;
                self.abandon(route, machine);
            }
            EditError::Core(CoreError::StorageUnavailable) => *slot = None,
            _ => {}
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

fn accepted(outcome: &RetainedOutcome) -> bool {
    matches!(outcome.outcome, Outcome::Accepted { .. })
}

fn journal_name(route: &DirectRouteId) -> String {
    format!("workspace-edits-{}.json", hex(route))
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
}
