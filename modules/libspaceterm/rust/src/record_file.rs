//! Saved Connections in one private file, published by atomic rename.
use spaceterm_client::DirectRouteId;
use spaceterm_client::direct::DirectError;
use spaceterm_client::records::{Document, Durability, RecordFile, SaveError};
use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;

pub(crate) const FILE: &str = "direct-device-connections.json";
const MAX_BYTES: u64 = 512 * 1024;

#[derive(Default)]
struct WriteAuthority {
    /// The SHA-256 of the file this adapter last read or published; `None` when there was none.
    observed: Option<[u8; 32]>,
    /// A failed read or rename leaves the file unknown. Only a new read may grant write authority
    /// again.
    blocked: bool,
    /// The Saved Connections in the order they were paired, as the last published file lists them.
    order: Vec<DirectRouteId>,
}

pub(crate) struct PrivateRecordFile {
    directory: PathBuf,
    authority: Mutex<WriteAuthority>,
}

impl PrivateRecordFile {
    pub(crate) fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            authority: Mutex::default(),
        }
    }

    pub(crate) fn exists(&self) -> bool {
        self.path().exists()
    }

    /// Saved Connection routes in the order they were paired.
    pub(crate) fn order(&self) -> Vec<DirectRouteId> {
        self.authority
            .lock()
            .map(|authority| authority.order.clone())
            .unwrap_or_default()
    }

    fn path(&self) -> PathBuf {
        self.directory.join(FILE)
    }

    fn current(&self) -> std::io::Result<Option<Vec<u8>>> {
        let file = match File::open(self.path()) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        let mut bytes = Vec::new();
        file.take(MAX_BYTES + 1).read_to_end(&mut bytes)?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err(ErrorKind::FileTooLarge.into());
        }
        Ok(Some(bytes))
    }

    /// Writes beside the file, then renames over it.
    fn publish(&self, bytes: &[u8]) -> Publication {
        match self.stage(bytes) {
            Err(_) => Publication::NotPublished,
            Ok(staged) => {
                if fs::rename(&staged, self.path()).is_err() {
                    let _ = fs::remove_file(&staged);
                    return Publication::Unknown;
                }
                let synchronized = File::open(&self.directory)
                    .and_then(|dir| dir.sync_all())
                    .is_ok();
                Publication::Published { synchronized }
            }
        }
    }

    /// Writes `bytes` to a new private file beside the published one and returns its path.
    /// The directory must exist: the platform creates it with the backup policy records need.
    fn stage(&self, bytes: &[u8]) -> std::io::Result<PathBuf> {
        let mut nonce = [0u8; 8];
        getrandom::fill(&mut nonce).map_err(|_| std::io::Error::other("no randomness"))?;
        let staged = self
            .directory
            .join(format!(".{FILE}.{}", hex(&nonce)));
        let result = (|| {
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
            let mut file = options.open(&staged)?;
            file.write_all(bytes)?;
            file.sync_all()
        })();
        if result.is_err() {
            let _ = fs::remove_file(&staged);
        }
        result.map(|()| staged)
    }
}

enum Publication {
    /// The published file is as it was.
    NotPublished,
    /// The rename failed, and a failed rename can still have replaced the file.
    Unknown,
    Published { synchronized: bool },
}

impl RecordFile for PrivateRecordFile {
    fn read(
        &self,
        accept: &mut dyn FnMut(&[u8]) -> Result<(), DirectError>,
    ) -> Result<(), DirectError> {
        let mut authority = self
            .authority
            .lock()
            .map_err(|_| DirectError::StorageUnavailable)?;
        authority.blocked = true;
        let Some(bytes) = self.current().map_err(|_| DirectError::StorageUnavailable)? else {
            *authority = WriteAuthority::default();
            return Ok(());
        };
        accept(&bytes)?;
        *authority = WriteAuthority {
            observed: Some(digest(&bytes)),
            blocked: false,
            order: order_of(&bytes),
        };
        Ok(())
    }

    fn commit(&self, bytes: &[u8]) -> Result<Durability, SaveError> {
        let mut authority = self.authority.lock().map_err(|_| SaveError::NotPublished)?;
        if authority.blocked {
            return Err(SaveError::PublicationIndeterminate);
        }
        // Publish only over the file this adapter last saw.
        let current = self.current().map_err(|_| SaveError::NotPublished)?;
        if current.as_deref().map(digest) != authority.observed {
            return Err(SaveError::NotPublished);
        }
        match self.publish(bytes) {
            Publication::Published { synchronized } => {
                authority.observed = Some(digest(bytes));
                authority.order = order_of(bytes);
                Ok(if synchronized {
                    Durability::Synchronized
                } else {
                    Durability::Uncertain
                })
            }
            Publication::NotPublished => Err(SaveError::NotPublished),
            Publication::Unknown => {
                authority.blocked = true;
                Err(SaveError::PublicationIndeterminate)
            }
        }
    }
}

fn order_of(bytes: &[u8]) -> Vec<DirectRouteId> {
    serde_json::from_slice::<Document>(bytes)
        .map(|document| document.routes.iter().map(|saved| saved.route.id).collect())
        .unwrap_or_default()
}

fn digest(bytes: &[u8]) -> [u8; 32] {
    let digest = ring::digest::digest(&ring::digest::SHA256, bytes);
    let mut out = [0; 32];
    out.copy_from_slice(digest.as_ref());
    out
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use spaceterm_client::records::{PrivateRecords, Records};
    use std::sync::Arc;

    fn directory() -> PathBuf {
        let mut nonce = [0u8; 8];
        getrandom::fill(&mut nonce).unwrap();
        let dir = std::env::temp_dir().join(format!("spaceterm-mobile-test-{}", hex(&nonce)));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_saved_document_reads_back_after_a_new_start() {
        let dir = directory();
        let records = PrivateRecords::new(Arc::new(PrivateRecordFile::new(dir.clone())));
        records.load().unwrap();
        assert_eq!(records.save(&Document::default()), Ok(Durability::Synchronized));

        let reopened = PrivateRecordFile::new(dir.clone());
        assert!(reopened.exists());
        assert!(PrivateRecords::new(Arc::new(reopened)).load().is_ok());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn a_file_changed_since_the_last_read_is_never_overwritten() {
        let dir = directory();
        let file = Arc::new(PrivateRecordFile::new(dir.clone()));
        let records = PrivateRecords::new(file);
        records.load().unwrap();
        records.save(&Document::default()).unwrap();
        fs::write(dir.join(FILE), b"{\"changed\":true}").unwrap();

        assert_eq!(records.save(&Document::default()), Err(SaveError::NotPublished));
        assert_eq!(fs::read(dir.join(FILE)).unwrap(), b"{\"changed\":true}");
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_save_that_fails_before_publishing_leaves_later_saves_possible() {
        use std::os::unix::fs::PermissionsExt;
        let dir = directory();
        let records = PrivateRecords::new(Arc::new(PrivateRecordFile::new(dir.clone())));
        records.load().unwrap();
        records.save(&Document::default()).unwrap();

        fs::set_permissions(&dir, fs::Permissions::from_mode(0o500)).unwrap();
        assert_eq!(records.save(&Document::default()), Err(SaveError::NotPublished));
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(records.save(&Document::default()), Ok(Durability::Synchronized));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn a_failed_read_grants_no_write_authority() {
        let dir = directory();
        fs::write(dir.join(FILE), b"not saved connections").unwrap();
        let records = PrivateRecords::new(Arc::new(PrivateRecordFile::new(dir.clone())));

        assert!(records.load().is_err());
        assert_eq!(
            records.save(&Document::default()),
            Err(SaveError::PublicationIndeterminate)
        );
        assert_eq!(fs::read(dir.join(FILE)).unwrap(), b"not saved connections");
        let _ = fs::remove_dir_all(dir);
    }
}
