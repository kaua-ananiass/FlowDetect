use std::path::{Component, Path, PathBuf};

#[derive(Default)] pub struct FileTransfer;
impl FileTransfer {
    pub const CHUNK_SIZE: usize = 256 * 1024;
    pub fn safe_destination(&self, root: &Path, relative: &Path) -> Option<PathBuf> {
        if relative.is_absolute() || relative.components().any(|c| matches!(c, Component::ParentDir | Component::Prefix(_))) { return None; }
        Some(root.join(relative))
    }
}
