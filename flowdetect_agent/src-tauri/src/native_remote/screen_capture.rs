use serde::Serialize;
use std::{sync::{atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering}, Arc, Mutex}, thread, time::Duration};
use windows_capture::{
    capture::{Context, GraphicsCaptureApiHandler}, frame::Frame,
    graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl}, monitor::Monitor,
    settings::{ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings, MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings},
};

#[derive(Clone, Copy, Debug, Serialize)]
pub enum CaptureBackend { WindowsGraphicsCapture, DxgiDesktopDuplication }

#[derive(Clone, Copy, Debug, Serialize)]
pub struct CaptureProfile { pub width: u32, pub height: u32, pub fps: u32, pub bitrate: u32, pub backend: CaptureBackend }

impl Default for CaptureProfile {
    // Interactive software profile. The desktop is still captured at its native
    // resolution; VideoEncoder scales it before OpenH264. Hardware encoders will
    // be allowed to use the full 1080p60 profile.
    fn default() -> Self { Self { width: 960, height: 540, fps: 30, bitrate: 2_500_000, backend: CaptureBackend::WindowsGraphicsCapture } }
}

#[derive(Clone)]
pub struct CapturedFrame { pub sequence: u64, pub width: u32, pub height: u32, pub bgra: Arc<[u8]> }

struct CaptureFlags { running: Arc<AtomicBool>, latest: Arc<Mutex<Option<CapturedFrame>>>, sequence: Arc<AtomicU64> }
struct WgcHandler { flags: CaptureFlags, unpadded: Vec<u8> }

impl GraphicsCaptureApiHandler for WgcHandler {
    type Flags = CaptureFlags;
    type Error = String;
    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> { Ok(Self { flags: ctx.flags, unpadded: Vec::new() }) }
    fn on_frame_arrived(&mut self, frame: &mut Frame, capture_control: InternalCaptureControl) -> Result<(), Self::Error> {
        if !self.flags.running.load(Ordering::Acquire) { capture_control.stop(); return Ok(()); }
        let buffer = frame.buffer().map_err(|error| error.to_string())?;
        let (width, height) = (buffer.width(), buffer.height());
        let pixels = buffer.as_nopadding_buffer(&mut self.unpadded);
        let sequence = self.flags.sequence.fetch_add(1, Ordering::AcqRel) + 1;
        let captured = CapturedFrame { sequence, width, height, bgra: Arc::from(pixels.to_vec()) };
        *self.flags.latest.lock().unwrap_or_else(|error| error.into_inner()) = Some(captured);
        if sequence == 1 || sequence % 60 == 0 {
            crate::studio_runtime::update_native_remote_status(serde_json::json!({
                "stage": "capturing", "capture_frames": sequence,
                "capture_resolution": format!("{width}x{height}"), "last_error": ""
            }));
        }
        Ok(())
    }
}

pub struct ScreenCapture {
    profile: CaptureProfile, running: Arc<AtomicBool>, network_score: AtomicU32,
    latest: Arc<Mutex<Option<CapturedFrame>>>, sequence: Arc<AtomicU64>,
}

impl ScreenCapture {
    pub fn new(mut profile: CaptureProfile) -> Self {
        if !GraphicsCaptureApi::is_supported().unwrap_or(false) { profile.backend = CaptureBackend::DxgiDesktopDuplication; }
        if let Ok(monitor) = Monitor::primary() {
            profile.width = profile.width.min(monitor.width().unwrap_or(profile.width));
            profile.height = profile.height.min(monitor.height().unwrap_or(profile.height));
        }
        Self { profile, running: Arc::new(AtomicBool::new(false)), network_score: AtomicU32::new(100), latest: Arc::new(Mutex::new(None)), sequence: Arc::new(AtomicU64::new(0)) }
    }
    pub fn profile(&self) -> CaptureProfile { self.profile }
    pub fn start(&self) -> Result<(), String> {
        if self.running.swap(true, Ordering::AcqRel) { return Ok(()); }
        if matches!(self.profile.backend, CaptureBackend::DxgiDesktopDuplication) {
            self.running.store(false, Ordering::Release);
            return Err("Windows Graphics Capture indisponivel; fallback DXGI ainda nao iniciado.".into());
        }
        let monitor = Monitor::primary().map_err(|error| error.to_string())?;
        let flags = CaptureFlags { running: self.running.clone(), latest: self.latest.clone(), sequence: self.sequence.clone() };
        let _interval = Duration::from_nanos(1_000_000_000 / self.profile.fps.max(1) as u64);
        // Windows 10 22H2 supports WGC, but some optional session properties were added later.
        // Defaults avoid aborting capture on VMs running build 19045.
        // The Studio draws the local PC cursor and sends its normalized position.
        // Excluding the guest cursor removes the distracting delayed second cursor.
        let settings = Settings::new(monitor, CursorCaptureSettings::WithoutCursor, DrawBorderSettings::Default, SecondaryWindowSettings::Default, MinimumUpdateIntervalSettings::Default, DirtyRegionSettings::Default, ColorFormat::Bgra8, flags);
        thread::Builder::new().name("flowdetect-wgc-capture".into()).spawn(move || {
            if let Err(error) = WgcHandler::start(settings) {
                crate::studio_runtime::update_native_remote_status(serde_json::json!({"stage":"capture_error","last_error":error.to_string()}));
                eprintln!("FlowDetect WGC finalizado: {error}");
            }
        }).map_err(|error| format!("Falha ao iniciar captura WGC: {error}"))?;
        Ok(())
    }
    pub fn stop(&self) { self.running.store(false, Ordering::Release); }
    pub fn is_running(&self) -> bool { self.running.load(Ordering::Acquire) }
    pub fn latest_frame(&self) -> Option<CapturedFrame> { self.latest.lock().unwrap_or_else(|error| error.into_inner()).clone() }
    pub fn update_network_score(&self, score: u32) { self.network_score.store(score.min(100), Ordering::Release); }
    pub fn target_bitrate(&self) -> u32 { let score = self.network_score.load(Ordering::Acquire).max(20); (self.profile.bitrate as u64 * score as u64 / 100) as u32 }
}
