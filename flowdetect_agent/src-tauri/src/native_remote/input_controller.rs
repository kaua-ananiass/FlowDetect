use serde::Deserialize;

#[derive(Default)] pub struct InputController;
#[derive(Deserialize)] pub struct PointerEvent { pub x: f64, pub y: f64, pub button: Option<u8>, pub action: String }
#[derive(Deserialize)] pub struct KeyEvent { pub key: String, pub code: String, pub pressed: bool }

impl InputController {
    pub fn validate_pointer(&self, event: &PointerEvent) -> bool { (0.0..=1.0).contains(&event.x) && (0.0..=1.0).contains(&event.y) }
    pub fn validate_key(&self, event: &KeyEvent) -> bool { !event.key.is_empty() && event.key.len() <= 32 && event.code.len() <= 32 }
}
