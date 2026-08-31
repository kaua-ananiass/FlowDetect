use serde::Serialize;
use std::process::Command;

#[derive(Clone, Serialize)]
pub struct DeviceManager { pub id: String, pub hostname: String, pub user: String, pub platform: String }

impl DeviceManager {
    pub fn discover() -> Self {
        let hostname = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "windows-agent".into());
        let user = std::env::var("USERNAME").unwrap_or_else(|_| "usuario".into());
        Self { id: format!("{}-{}", hostname.to_lowercase(), user.to_lowercase()), hostname, user, platform: "windows".into() }
    }

    pub fn ensure_user_autostart(&self) {
        let Ok(exe) = std::env::current_exe() else { return; };
        let value = format!("\"{}\"", exe.display());
        let _ = Command::new("reg.exe").args([
            "add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v", "FlowDetectAgent", "/t", "REG_SZ", "/d", &value, "/f",
        ]).creation_flags(0x08000000).status();
    }
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;
