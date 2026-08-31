#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "../../../tauri_gerador/src-tauri/src/lib.rs"]
mod studio_runtime;
mod native_remote;

#[cfg(windows)]
fn acquire_single_instance() -> bool {
    use windows::{core::w, Win32::{Foundation::{GetLastError, ERROR_ALREADY_EXISTS}, System::Threading::CreateMutexW}};

    unsafe {
        match CreateMutexW(None, false, w!("Local\\FlowDetectAgent.SingleInstance")) {
            Ok(_) => GetLastError() != ERROR_ALREADY_EXISTS,
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
    native_remote::bootstrap();
    studio_runtime::run();
}
