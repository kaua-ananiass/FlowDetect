#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "../../../tauri_gerador/src-tauri/src/lib.rs"]
mod studio_runtime;

#[cfg(windows)]
fn acquire_single_instance() -> bool {
    use windows::{core::w, Win32::{Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS}, System::Threading::{CreateMutexW, CreateEventW, SetEvent}}};

    unsafe {
        match CreateMutexW(None, false, w!("Local\\FlowDetectAgent.SingleInstance")) {
            Ok(handle) => {
                if GetLastError() == ERROR_ALREADY_EXISTS {
                    // Reopening the shortcut must restore the existing panel,
                    // including when it was hidden during automation.
                    if let Ok(event) = CreateEventW(None, false, false, w!("Local\\FlowDetectAgent.OpenPanel")) {
                        let _ = SetEvent(event);
                        let _ = CloseHandle(event);
                    }
                    let _ = CloseHandle(handle);
                    false
                } else {
                    // Keep the mutex handle alive for the lifetime of this process.
                    true
                }
            },
            Err(_) => true,
        }
    }
}

#[cfg(not(windows))]
fn acquire_single_instance() -> bool { true }

fn main() {
    if !acquire_single_instance() {
        return;
    }
    studio_runtime::run();
}
