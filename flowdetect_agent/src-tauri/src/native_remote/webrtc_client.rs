use bytes::Bytes;
use serde::Serialize;
use serde_json::Value;
use std::{sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex}, thread, time::{Duration, Instant}};
use tokio::runtime::{Builder, Runtime};
use webrtc::{
    api::{interceptor_registry::register_default_interceptors, media_engine::{MediaEngine, MIME_TYPE_H264}, APIBuilder},
    data_channel::{data_channel_message::DataChannelMessage, RTCDataChannel},
    interceptor::registry::Registry,
    media::Sample,
    peer_connection::{configuration::RTCConfiguration, sdp::session_description::RTCSessionDescription, RTCPeerConnection},
    rtp_transceiver::rtp_codec::RTCRtpCodecCapability,
    track::track_local::{track_local_static_sample::TrackLocalStaticSample, TrackLocal},
};

#[derive(Clone, Copy, Serialize)]
pub enum ChannelKind { PointerUnreliable, ControlReliable, ClipboardReliable, FileReliable, CommandReliable }

pub struct WebRtcClient {
    pub stun_servers: Vec<String>,
    connected: Arc<AtomicBool>,
    runtime: Arc<Runtime>,
    peer: Arc<Mutex<Option<Arc<RTCPeerConnection>>>>,
    worker_started: AtomicBool,
}

impl WebRtcClient {
    pub fn local() -> Self {
        let runtime = Builder::new_multi_thread().worker_threads(4).enable_all().thread_name("flowdetect-webrtc").build().expect("Falha ao iniciar runtime WebRTC");
        Self { stun_servers: Vec::new(), connected: Arc::new(AtomicBool::new(false)), runtime: Arc::new(runtime), peer: Arc::new(Mutex::new(None)), worker_started: AtomicBool::new(false) }
    }
    pub fn channels() -> [ChannelKind; 5] { [ChannelKind::PointerUnreliable, ChannelKind::ControlReliable, ChannelKind::ClipboardReliable, ChannelKind::FileReliable, ChannelKind::CommandReliable] }
    pub fn set_connected(&self, value: bool) { self.connected.store(value, Ordering::Release); }
    pub fn is_connected(&self) -> bool { self.connected.load(Ordering::Acquire) }

    pub fn start_signaling_worker(&self) {
        if self.worker_started.swap(true, Ordering::AcqRel) { return; }
        let runtime = self.runtime.clone();
        thread::Builder::new().name("flowdetect-webrtc-signal".into()).spawn(move || {
            let mut active_session = String::new();
            loop {
                let signal = crate::studio_runtime::get_webrtc_signal_payload();
                let session_id = signal.get("session_id").and_then(Value::as_str).unwrap_or("").to_owned();
                if !session_id.is_empty() && session_id != active_session && signal.get("offer").is_some_and(|offer| !offer.is_null()) {
                    active_session = session_id.clone();
                    let offer = signal.get("offer").cloned().unwrap_or(Value::Null);
                    if let Err(error) = runtime.block_on(Self::accept_offer(session_id.clone(), offer)) {
                        crate::studio_runtime::update_native_remote_status(serde_json::json!({"stage":"webrtc_error","last_error":error.to_string()}));
                        eprintln!("FlowDetect WebRTC: {error}");
                        active_session.clear();
                    }
                }
                thread::sleep(Duration::from_millis(80));
            }
        }).expect("Falha ao iniciar sinalizacao WebRTC");
    }

    async fn accept_offer(session_id: String, offer_value: Value) -> Result<(), String> {
        let mut media = MediaEngine::default();
        media.register_default_codecs().map_err(|error| error.to_string())?;
        let mut registry = Registry::new();
        registry = register_default_interceptors(registry, &mut media).map_err(|error| error.to_string())?;
        let api = APIBuilder::new().with_media_engine(media).with_interceptor_registry(registry).build();
        let peer = Arc::new(api.new_peer_connection(RTCConfiguration::default()).await.map_err(|error| error.to_string())?);

        let video = Arc::new(TrackLocalStaticSample::new(
            RTCRtpCodecCapability { mime_type: MIME_TYPE_H264.to_owned(), clock_rate: 90_000, channels: 0, sdp_fmtp_line: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f".to_owned(), rtcp_feedback: vec![] },
            "flowdetect-screen".to_owned(), "flowdetect-agent".to_owned(),
        ));
        let sender = peer.add_track(video.clone() as Arc<dyn TrackLocal + Send + Sync>).await.map_err(|error| error.to_string())?;
        tokio::spawn(async move { let mut buffer = vec![0u8; 1500]; while sender.read(&mut buffer).await.is_ok() {} });

        peer.on_data_channel(Box::new(move |channel: Arc<RTCDataChannel>| {
            Box::pin(async move { Self::bind_data_channel(channel); })
        }));

        let offer: RTCSessionDescription = serde_json::from_value(offer_value).map_err(|error| format!("Offer WebRTC invalido: {error}"))?;
        peer.set_remote_description(offer).await.map_err(|error| error.to_string())?;
        let answer = peer.create_answer(None).await.map_err(|error| error.to_string())?;
        let mut gathering = peer.gathering_complete_promise().await;
        peer.set_local_description(answer).await.map_err(|error| error.to_string())?;
        let _ = gathering.recv().await;
        let local = peer.local_description().await.ok_or_else(|| "WebRTC nao gerou answer local.".to_string())?;
        let answer_value = serde_json::to_value(local).map_err(|error| error.to_string())?;
        crate::studio_runtime::set_webrtc_answer(session_id, answer_value);
        crate::studio_runtime::update_native_remote_status(serde_json::json!({"stage":"negotiated","last_error":""}));

        let native = crate::native_remote::agent();
        native.capture.start()?;
        native.webrtc.set_connected(true);
        *native.webrtc.peer.lock().unwrap_or_else(|error| error.into_inner()) = Some(peer);
        tokio::spawn(async move {
            let mut sequence = 0u64;
            let mut sent_frames = 0u64;
            let mut dropped_frames = 0u64;
            let mut last_sent_at: Option<Instant> = None;
            let mut stats_started_at = Instant::now();
            let mut stats_sent_frames = 0u64;
            let mut stats_encode_time = Duration::ZERO;
            loop {
                let native = crate::native_remote::agent();
                if let Some(frame) = native.capture.latest_frame() {
                    if frame.sequence != sequence {
                        if sequence != 0 && frame.sequence > sequence + 1 {
                            dropped_frames += frame.sequence - sequence - 1;
                        }
                        sequence = frame.sequence;
                        let encode_started_at = Instant::now();
                        // OpenH264 is CPU intensive at 1080p. Keep it away from Tokio's
                        // WebRTC/DataChannel workers so mouse and keyboard remain responsive.
                        let encoded = tokio::task::spawn_blocking(move || {
                            crate::native_remote::agent().encoder.encode(&frame)
                        }).await;
                        stats_encode_time += encode_started_at.elapsed();
                        match encoded {
                            Err(error) => {
                                crate::studio_runtime::update_native_remote_status(serde_json::json!({"stage":"encoder_worker_error","last_error":error.to_string()}));
                                break;
                            }
                            Ok(Err(error)) => eprintln!("FlowDetect encoder: {error}"),
                            Ok(Ok(encoded)) if !encoded.annex_b.is_empty() => {
                                let encoded_sequence = encoded.sequence;
                                let now = Instant::now();
                                // RTP timestamps must follow the real encoder cadence. A fixed
                                // 60 FPS timestamp while software encoding runs slower causes an
                                // ever-growing jitter buffer and visible slow motion.
                                let sample_duration = last_sent_at
                                    .map(|previous| now.saturating_duration_since(previous))
                                    .unwrap_or(Duration::from_nanos(16_666_667))
                                    .clamp(Duration::from_millis(5), Duration::from_millis(250));
                                last_sent_at = Some(now);
                                if let Err(error) = video.write_sample(&Sample { data: Bytes::from(encoded.annex_b), duration: sample_duration, ..Default::default() }).await {
                                    crate::studio_runtime::update_native_remote_status(serde_json::json!({"stage":"send_error","last_error":error.to_string()}));
                                    break;
                                }
                                sent_frames += 1;
                                stats_sent_frames += 1;
                                if stats_started_at.elapsed() >= Duration::from_secs(1) {
                                    let elapsed = stats_started_at.elapsed().as_secs_f64();
                                    let fps = stats_sent_frames as f64 / elapsed;
                                    let encode_ms = if stats_sent_frames == 0 { 0.0 } else { stats_encode_time.as_secs_f64() * 1000.0 / stats_sent_frames as f64 };
                                    crate::studio_runtime::update_native_remote_status(serde_json::json!({
                                        "stage":"streaming",
                                        "source_sequence":encoded_sequence,
                                        "encoded_frames":sent_frames,
                                        "sent_frames":sent_frames,
                                        "dropped_frames":dropped_frames,
                                        "stream_fps":fps,
                                        "encode_ms":encode_ms,
                                        "last_error":""
                                    }));
                                    stats_started_at = Instant::now();
                                    stats_sent_frames = 0;
                                    stats_encode_time = Duration::ZERO;
                                }
                            }
                            Ok(Ok(_)) => {}
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(2)).await;
            }
        });
        Ok(())
    }

    fn bind_data_channel(channel: Arc<RTCDataChannel>) {
        let label = channel.label().to_owned();
        if !matches!(label.as_str(), "flowdetect-control" | "flowdetect-pointer") { return; }
        channel.on_message(Box::new(move |message: DataChannelMessage| {
            Box::pin(async move {
                if let Ok(event) = serde_json::from_slice::<Value>(&message.data) {
                    let _ = crate::studio_runtime::handle_agent_remote_control_event(event);
                }
            })
        }));
    }
}
