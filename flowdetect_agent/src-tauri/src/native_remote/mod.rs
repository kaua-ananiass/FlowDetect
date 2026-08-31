mod authentication;
mod clipboard_manager;
mod device_manager;
mod file_transfer;
mod input_controller;
mod screen_capture;
mod session_manager;
mod video_encoder;
mod webrtc_client;

use std::sync::{Arc, OnceLock};

pub use authentication::Authentication;
pub use clipboard_manager::ClipboardManager;
pub use device_manager::DeviceManager;
pub use file_transfer::FileTransfer;
pub use input_controller::InputController;
pub use screen_capture::{CaptureBackend, CaptureProfile, CapturedFrame, ScreenCapture};
pub use session_manager::{SessionManager, SessionState};
pub use video_encoder::{EncodedH264Frame, EncoderBackend, VideoEncoder};
pub use webrtc_client::{ChannelKind, WebRtcClient};

static NATIVE_AGENT: OnceLock<Arc<NativeRemoteAgent>> = OnceLock::new();

pub struct NativeRemoteAgent {
    pub authentication: Authentication,
    pub clipboard: ClipboardManager,
    pub device: DeviceManager,
    pub files: FileTransfer,
    pub input: InputController,
    pub capture: ScreenCapture,
    pub encoder: VideoEncoder,
    pub sessions: SessionManager,
    pub webrtc: WebRtcClient,
}

impl NativeRemoteAgent {
    fn new() -> Self {
        Self {
            authentication: Authentication::load_or_create(),
            clipboard: ClipboardManager::default(),
            device: DeviceManager::discover(),
            files: FileTransfer::default(),
            input: InputController::default(),
            capture: ScreenCapture::new(CaptureProfile::default()),
            encoder: VideoEncoder::new(2_500_000, 30).expect("Nao foi possivel inicializar o encoder H.264"),
            sessions: SessionManager::default(),
            webrtc: WebRtcClient::local(),
        }
    }
}

pub fn bootstrap() {
    let agent = NATIVE_AGENT.get_or_init(|| Arc::new(NativeRemoteAgent::new())).clone();
    agent.device.ensure_user_autostart();
    // The Studio now uses the Hyper-V enhanced-session transport directly.
    // Do not start the legacy WebRTC signaling worker here: an offer left in
    // the Agent state could restart Windows Graphics Capture at boot, leaving
    // the yellow capture border visible even though the Studio no longer uses
    // that stream.
}

pub fn agent() -> &'static Arc<NativeRemoteAgent> {
    NATIVE_AGENT.get_or_init(|| Arc::new(NativeRemoteAgent::new()))
}
