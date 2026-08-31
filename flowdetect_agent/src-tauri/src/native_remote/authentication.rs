use std::{fs, path::PathBuf};

pub struct Authentication { token: String }

impl Authentication {
    pub fn load_or_create() -> Self {
        let path = token_path();
        if let Ok(token) = fs::read_to_string(&path) {
            if token.trim().len() >= 32 { return Self { token: token.trim().to_owned() }; }
        }
        let token = rand::random::<[u8; 32]>().iter().map(|byte| format!("{byte:02x}")).collect::<String>();
        if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }
        let _ = fs::write(&path, &token);
        Self { token }
    }

    pub fn pairing_token(&self) -> &str { &self.token }
    pub fn authorize(&self, candidate: &str) -> bool {
        if candidate.len() != self.token.len() { return false; }
        candidate.bytes().zip(self.token.bytes()).fold(0u8, |diff, (a, b)| diff | (a ^ b)) == 0
    }
}

fn token_path() -> PathBuf {
    PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap_or_default()).join("FlowDetect").join("Agent").join("pairing.token")
}
