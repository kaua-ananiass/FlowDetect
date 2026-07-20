#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "../../../tauri_gerador/src-tauri/src/lib.rs"]
mod studio_runtime;

fn main() {
    studio_runtime::run();
}
