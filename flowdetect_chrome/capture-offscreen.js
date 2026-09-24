const captureSessions = new Map();

function stopCaptureSession(runId) {
  const session = captureSessions.get(runId);
  if (!session) return;
  captureSessions.delete(runId);
  session.video.pause();
  session.video.srcObject = null;
  session.stream.getTracks().forEach((track) => track.stop());
}

async function startCaptureSession(runId, streamId) {
  stopCaptureSession(runId);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  const session = { stream, video, canvas: document.createElement("canvas") };
  captureSessions.set(runId, session);
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (captureSessions.get(runId) === session) stopCaptureSession(runId);
  }, { once: true });
  try {
    await Promise.race([
      video.play(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("A aba nao forneceu video para a captura.")), 5000))
    ]);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await Promise.race([
        new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true })),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("A imagem da aba ainda nao esta disponivel.")), 5000))
      ]);
    }
    if (!video.videoWidth || !video.videoHeight) throw new Error("A captura da aba nao possui dimensoes validas.");
    return { ok: true };
  } catch (error) {
    stopCaptureSession(runId);
    throw error;
  }
}

function captureSessionFrame(runId) {
  const session = captureSessions.get(runId);
  if (!session || session.stream.getVideoTracks()[0]?.readyState !== "live") {
    throw new Error("O video da aba foi encerrado.");
  }
  const { video, canvas } = session;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    throw new Error("A imagem da aba ainda nao esta disponivel.");
  }
  const width = video.videoWidth;
  const height = video.videoHeight;
  const scale = Math.min(1, 980 / Math.max(width, height));
  canvas.width = Math.max(2, Math.round(width * scale));
  canvas.height = Math.max(2, Math.round(height * scale));
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return { ok: true, dataUrl: canvas.toDataURL("image/png"), width, height };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "flowdetect-offscreen") return false;
  const task = async () => {
    if (message.type === "flowdetect-capture-start") return startCaptureSession(message.runId, message.streamId);
    if (message.type === "flowdetect-capture-frame") return captureSessionFrame(message.runId);
    if (message.type === "flowdetect-capture-stop") {
      stopCaptureSession(message.runId);
      return { ok: true };
    }
    return { ok: false, error: "Comando de captura desconhecido." };
  };
  task().then(sendResponse).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});
