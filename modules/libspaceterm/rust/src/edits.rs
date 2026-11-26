//! Workspace edits, each pairing's through one journal so a lost answer is never applied twice.
use crate::record_file::{Publication, hex, publish_private, read_private};
use spaceterm_client::hierarchy::{Mutation, Outcome};
use spaceterm_client::workspace::{EditError, JournalStore, WorkspaceEditor};
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
        let Ok(mut editors) = self.editors.lock() else {
            return false;
        };
        let slot = Arc::clone(editors.entry(route).or_default());
        drop(editors);
        let Ok(mut slot) = slot.lock() else {
            return false;
        };
        // A new connection gets a new editor; the old one lets go of the journal first.
        if slot
            .as_ref()
            .is_none_or(|(held, _)| !held.same_handle(machine))
        {
            *slot = None;
            let journal = JournalFile {
                directory: self.directory.clone(),
                name: journal_name(&route),
            };
            let Ok(editor) = machine.workspace_edits(Box::new(journal)) else {
                return false;
            };
            *slot = Some((machine.clone(), editor));
        }
        let Some((_, editor)) = slot.as_mut() else {
            return false;
        };
        let deadline = Instant::now() + EDIT_WAIT;
        // An earlier edit whose answer was lost goes first. The Machine applies it at most once.
        if editor.journal().pending().is_some() {
            match editor.retry(deadline) {
                Ok(outcome) => {
                    if let Some(outcome) = outcome {
                        let _ = editor.presented(outcome.sequence);
                    }
                }
                Err(error) => {
                    if lost_storage(error) {
                        *slot = None;
                    }
                    return false;
                }
            }
        }
        match editor.submit(mutation, deadline) {
            Ok(outcome) => {
                // The person sees every answer when it arrives, so none waits to be presented.
                let _ = editor.presented(outcome.sequence);
                matches!(outcome.outcome, Outcome::Accepted { .. })
            }
            Err(error) => {
                if lost_storage(error) {
                    *slot = None;
                }
                false
            }
        }
    }

    /// Forgets a pairing's edits once its Saved Connection is gone.
    pub(crate) fn forget(&self, route: &DirectRouteId) {
        if let Ok(mut editors) = self.editors.lock() {
            editors.remove(route);
        }
        let _ = fs::remove_file(self.directory.join(journal_name(route)));
    }
}

/// A journal whose storage may have failed must be opened again before its next edit.
fn lost_storage(error: EditError) -> bool {
    matches!(error, EditError::Core(CoreError::StorageUnavailable))
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
        // A read after a failed write reports only bytes that are on disk.
        if bytes.is_some() {
            File::open(&path)
                .and_then(|file| file.sync_all())
                .map_err(|_| CoreError::StorageUnavailable)?;
        }
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
