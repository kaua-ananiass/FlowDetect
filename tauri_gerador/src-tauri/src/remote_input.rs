//! Local owner policy for remote mouse AND keyboard. Never remotely writable.
use std::path::Path;
pub fn allows(enabled:bool,event:&serde_json::Value)->bool {
    enabled || event.get("event").and_then(serde_json::Value::as_str)==Some("up")
}
pub fn load(root:&Path,unattended:bool)->bool {
    match std::fs::read(root.join("remote_input_v1.json")) {
        Ok(bytes)=>serde_json::from_slice::<bool>(&bytes).unwrap_or(false),
        Err(error) if error.kind()==std::io::ErrorKind::NotFound=>unattended,
        Err(_)=>false,
    }
}
pub fn save(root:&Path,enabled:bool)->Result<(),String>{
    std::fs::create_dir_all(root).map_err(|e|e.to_string())?;
    std::fs::write(root.join("remote_input_v1.json"),if enabled {b"true".as_slice()}else{b"false".as_slice()}).map_err(|e|e.to_string())
}
#[cfg(test)] mod tests {
    #[test] fn local_block_applies_to_mouse_and_keyboard_but_allows_releases(){
        for kind in ["mouse","key"] {
            for action in ["down","move","wheel"] {
                let event=serde_json::json!({"kind":kind,"event":action});
                assert!(!super::allows(false,&event));assert!(super::allows(true,&event));
            }
            assert!(super::allows(false,&serde_json::json!({"kind":kind,"event":"up"})));
        }
    }
    #[test] fn restores_local_decision_and_migrates_unattended_installations(){
        let root=std::env::temp_dir().join(format!("flowdetect-input-policy-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        assert!(!super::load(&root,false));assert!(super::load(&root,true));
        super::save(&root,false).unwrap();assert!(!super::load(&root,true));
        super::save(&root,true).unwrap();assert!(super::load(&root,false));
        std::fs::write(root.join("remote_input_v1.json"),b"invalid").unwrap();assert!(!super::load(&root,true));
        std::fs::remove_file(root.join("remote_input_v1.json")).unwrap();std::fs::remove_dir(root).unwrap();
    }
}
