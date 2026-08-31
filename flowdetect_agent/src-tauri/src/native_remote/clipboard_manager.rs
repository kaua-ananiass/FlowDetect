use std::sync::Mutex;

#[derive(Default)] pub struct ClipboardManager { revision: Mutex<u64> }
impl ClipboardManager {
    pub fn next_revision(&self) -> u64 { let mut guard = self.revision.lock().unwrap_or_else(|e| e.into_inner()); *guard += 1; *guard }
    pub fn accepts(&self, size: usize) -> bool { size <= 4 * 1024 * 1024 }
}
