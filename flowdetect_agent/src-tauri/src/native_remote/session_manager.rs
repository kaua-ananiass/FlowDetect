use std::{collections::HashMap, sync::Mutex, time::SystemTime};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SessionState { Negotiating, Active, Closing, Closed }
pub struct RemoteSession { pub id: String, pub device_id: String, pub state: SessionState, pub started_at: SystemTime }
#[derive(Default)] pub struct SessionManager { sessions: Mutex<HashMap<String, RemoteSession>> }

impl SessionManager {
    pub fn open(&self, id: String, device_id: String) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.clear();
            sessions.insert(id.clone(), RemoteSession { id, device_id, state: SessionState::Negotiating, started_at: SystemTime::now() });
        }
    }
    pub fn set_state(&self, id: &str, state: SessionState) { if let Ok(mut map) = self.sessions.lock() { if let Some(s) = map.get_mut(id) { s.state = state; } } }
    pub fn close_all(&self) { if let Ok(mut map) = self.sessions.lock() { map.clear(); } }
}
