use openh264::{
    encoder::{BitRate, Complexity, Encoder, EncoderConfig, FrameRate, FrameType, IntraFramePeriod, Level, Profile, RateControlMode, UsageType, VuiConfig},
    formats::{BgraSliceU8, YUVBuffer}, OpenH264API,
};
use serde::Serialize;
use std::sync::Mutex;

use super::CapturedFrame;

#[derive(Clone, Copy, Debug, Serialize)]
pub enum EncoderBackend { NvidiaNvenc, IntelQuickSync, AmdAmf, OpenH264 }

#[derive(Clone)]
pub struct EncodedH264Frame {
    pub sequence: u64,
    pub annex_b: Vec<u8>,
    pub keyframe: bool,
}

pub struct VideoEncoder {
    backend: EncoderBackend,
    target_width: u32,
    target_height: u32,
    software: Mutex<Encoder>,
}

impl VideoEncoder {
    pub fn new(bitrate: u32, fps: u32) -> Result<Self, String> {
        // Media Foundation hardware MFT selection is the preferred path. Until a compatible
        // hardware transform is exposed inside the VM, OpenH264 is the deterministic fallback.
        let config = EncoderConfig::new()
            .bitrate(BitRate::from_bps(bitrate))
            .max_frame_rate(FrameRate::from_hz(fps as f32))
            .rate_control_mode(RateControlMode::Bitrate)
            .usage_type(UsageType::ScreenContentRealTime)
            .profile(Profile::Baseline)
            .level(Level::Level_4_1)
            .complexity(Complexity::Low)
            .num_threads(0)
            .skip_frames(true)
            .intra_frame_period(IntraFramePeriod::from_num_frames(fps.max(1) * 2))
            .vui(VuiConfig::bt709());
        let software = Encoder::with_api_config(OpenH264API::from_source(), config)
            .map_err(|error| format!("Falha ao iniciar encoder H.264: {error}"))?;
        Ok(Self { backend: EncoderBackend::OpenH264, target_width: 960, target_height: 540, software: Mutex::new(software) })
    }

    pub fn backend(&self) -> EncoderBackend { self.backend }

    pub fn encode(&self, frame: &CapturedFrame) -> Result<EncodedH264Frame, String> {
        let expected = frame.width as usize * frame.height as usize * 4;
        if frame.bgra.len() != expected {
            return Err(format!("Frame BGRA invalido: {} bytes; esperado {expected}.", frame.bgra.len()));
        }
        let (pixels, width, height) = if frame.width > self.target_width || frame.height > self.target_height {
            let scale = (self.target_width as f64 / frame.width as f64)
                .min(self.target_height as f64 / frame.height as f64);
            let width = ((frame.width as f64 * scale).round() as u32).max(2) & !1;
            let height = ((frame.height as f64 * scale).round() as u32).max(2) & !1;
            (resize_bgra_nearest(&frame.bgra, frame.width, frame.height, width, height), width, height)
        } else {
            (frame.bgra.to_vec(), frame.width, frame.height)
        };
        let bgra = BgraSliceU8::new(&pixels, (width as usize, height as usize));
        let yuv = YUVBuffer::from_rgb_source(bgra);
        let mut encoder = self.software.lock().unwrap_or_else(|error| error.into_inner());
        let bitstream = encoder.encode(&yuv).map_err(|error| format!("Falha ao codificar H.264: {error}"))?;
        let keyframe = matches!(bitstream.frame_type(), FrameType::IDR | FrameType::I);
        Ok(EncodedH264Frame { sequence: frame.sequence, annex_b: bitstream.to_vec(), keyframe })
    }
}

/// Fast scaling is intentional here: for desktop control, newest-frame latency
/// matters more than photographic interpolation, and OpenH264 receives far fewer pixels.
fn resize_bgra_nearest(source: &[u8], source_width: u32, source_height: u32, width: u32, height: u32) -> Vec<u8> {
    let mut output = vec![0u8; width as usize * height as usize * 4];
    for y in 0..height as usize {
        let source_y = y * source_height as usize / height as usize;
        for x in 0..width as usize {
            let source_x = x * source_width as usize / width as usize;
            let source_offset = (source_y * source_width as usize + source_x) * 4;
            let output_offset = (y * width as usize + x) * 4;
            output[output_offset..output_offset + 4].copy_from_slice(&source[source_offset..source_offset + 4]);
        }
    }
    output
}
