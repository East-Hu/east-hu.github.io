const offlineElement = (id) => document.getElementById(id);

const OFFLINE_CONFIG = Object.freeze({
  backendUrl: String(window.VOICESHIELD_CONFIG?.backendUrl || "").trim(),
});

const OFFLINE_BACKEND = (() => {
  const url = new URL(OFFLINE_CONFIG.backendUrl || location.origin, location.href);
  url.pathname = `${url.pathname.replace(/\/?$/, "/")}`;
  url.search = "";
  url.hash = "";
  return url;
})();

const OFFLINE_ACCESS = new URLSearchParams(location.search).get("access") || "";
const OFFLINE_LABELS = Object.freeze({
  1: "Light",
  2: "Moderate",
  3: "Balanced",
  4: "Strong",
  5: "Maximum",
});

const offlineState = {
  audio: null,
  audioURL: "",
  strength: 2,
  recording: false,
  stream: null,
  context: null,
  source: null,
  worklet: null,
  chunks: [],
  timer: null,
  startedAt: 0,
};

function offlineURL(path, protectedRoute = false) {
  const url = new URL(String(path).replace(/^\//, ""), OFFLINE_BACKEND);
  if (protectedRoute && OFFLINE_ACCESS) url.searchParams.set("access", OFFLINE_ACCESS);
  return url;
}

function offlineFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (OFFLINE_ACCESS) headers.set("Authorization", `Bearer ${OFFLINE_ACCESS}`);
  return fetch(offlineURL(path), {...options, headers});
}

function setOfflineConnection(kind, text) {
  const pill = offlineElement("offlineConnection");
  pill.className = `connection ${kind}`;
  pill.querySelector("span").textContent = text;
}

function offlineToast(message) {
  const toast = offlineElement("offlineToast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(offlineToast.timer);
  offlineToast.timer = setTimeout(() => toast.classList.add("hidden"), 6000);
}

function setSource(blob, label) {
  if (offlineState.audioURL) URL.revokeObjectURL(offlineState.audioURL);
  offlineState.audio = blob;
  offlineState.audioURL = URL.createObjectURL(blob);
  const player = offlineElement("offlineSourceAudio");
  player.src = offlineState.audioURL;
  player.classList.remove("hidden");
  offlineElement("offlineFileLabel").textContent = label;
  offlineElement("offlineProcess").disabled = false;
  offlineElement("offlineStatus").textContent = "Ready for full-context protection.";
  offlineElement("offlineResult").classList.add("hidden");
}

function encodeMonoWav(chunks, sampleRate) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  chunks.forEach((chunk) => {
    for (const sample of chunk) {
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clipped < 0 ? clipped * 32768 : clipped * 32767, true);
      offset += 2;
    }
  });
  return new Blob([buffer], {type: "audio/wav"});
}

async function startOfflineRecording() {
  const constraints = {
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  };
  offlineState.stream = await navigator.mediaDevices.getUserMedia(constraints);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  offlineState.context = new AudioContextClass({latencyHint: "interactive"});
  await offlineState.context.audioWorklet.addModule(
    new URL("./static/offline-recorder-worklet.js?v=20260801-1", document.baseURI).href,
  );
  offlineState.source = offlineState.context.createMediaStreamSource(offlineState.stream);
  offlineState.worklet = new AudioWorkletNode(
    offlineState.context,
    "voiceshield-offline-recorder",
    {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]},
  );
  offlineState.chunks = [];
  offlineState.worklet.port.onmessage = (event) => {
    offlineState.chunks.push(new Float32Array(event.data));
  };
  offlineState.source.connect(offlineState.worklet);
  offlineState.worklet.connect(offlineState.context.destination);
  await offlineState.context.resume();
  offlineState.worklet.port.postMessage({type: "start"});
  offlineState.recording = true;
  offlineState.startedAt = performance.now();
  const tick = () => {
    if (!offlineState.recording) return;
    const seconds = (performance.now() - offlineState.startedAt) / 1000;
    offlineElement("offlineRecordLabel").textContent = `Stop recording · ${seconds.toFixed(1)} s`;
    if (seconds >= 30) stopOfflineRecording();
    else offlineState.timer = requestAnimationFrame(tick);
  };
  tick();
  offlineElement("offlineRecord").classList.add("live");
  offlineElement("offlineRecordHint").textContent = "Recording locally · click to stop";
}

async function stopOfflineRecording() {
  if (!offlineState.recording) return;
  offlineState.recording = false;
  cancelAnimationFrame(offlineState.timer);
  offlineState.worklet?.port.postMessage({type: "stop"});
  await new Promise((resolve) => setTimeout(resolve, 60));
  const sampleRate = offlineState.context?.sampleRate || 48000;
  try { offlineState.source?.disconnect(); } catch (_) {}
  try { offlineState.worklet?.disconnect(); } catch (_) {}
  offlineState.stream?.getTracks().forEach((track) => track.stop());
  if (offlineState.context?.state !== "closed") await offlineState.context?.close();
  const wav = encodeMonoWav(offlineState.chunks, sampleRate);
  offlineState.stream = null;
  offlineState.context = null;
  offlineState.source = null;
  offlineState.worklet = null;
  offlineState.chunks = [];
  offlineElement("offlineRecord").classList.remove("live");
  offlineElement("offlineRecordLabel").textContent = "Record another sample";
  offlineElement("offlineRecordHint").textContent = "Use your selected microphone";
  setSource(wav, "Browser recording.wav");
}

async function toggleOfflineRecording() {
  try {
    if (offlineState.recording) await stopOfflineRecording();
    else await startOfflineRecording();
  } catch (error) {
    console.error("Offline recording failed", error);
    offlineState.recording = false;
    offlineToast("The microphone could not be opened.");
  }
}

async function processOfflineAudio() {
  if (!offlineState.audio) return;
  const button = offlineElement("offlineProcess");
  button.disabled = true;
  button.classList.add("busy");
  offlineElement("offlineStatus").textContent = "Processing the complete utterance…";
  const form = new FormData();
  form.append("strength", String(offlineState.strength));
  form.append("audio", offlineState.audio, offlineState.audio.name || "recording.wav");
  try {
    const response = await offlineFetch("/api/offline", {method: "POST", body: form});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Offline protection failed.");
    const originalURL = offlineURL(result.original_url, true).href;
    const protectedURL = offlineURL(result.protected_url, true).href;
    offlineElement("offlineOriginal").src = originalURL;
    offlineElement("offlineProtected").src = protectedURL;
    offlineElement("offlineOriginalDownload").href = originalURL;
    offlineElement("offlineOriginalDownload").download = result.original_filename;
    offlineElement("offlineProtectedDownload").href = protectedURL;
    offlineElement("offlineProtectedDownload").download = result.protected_filename;
    offlineElement("offlineResultMeta").textContent =
      `${result.duration_s.toFixed(1)} s audio · strength ${result.strength}/5 · processed in ${(result.process_ms / 1000).toFixed(2)} s`;
    offlineElement("offlineResult").classList.remove("hidden");
    offlineElement("offlineStatus").textContent = "Original and protected audio are ready.";
    offlineElement("offlineResult").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    offlineElement("offlineStatus").textContent = error.message;
    offlineToast(error.message);
  } finally {
    button.disabled = !offlineState.audio;
    button.classList.remove("busy");
  }
}

offlineElement("offlineRecord").addEventListener("click", toggleOfflineRecording);
offlineElement("offlineFile").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) setSource(file, file.name);
});
document.querySelectorAll("[data-offline-strength]").forEach((button) => {
  button.addEventListener("click", () => {
    offlineState.strength = Number(button.dataset.offlineStrength);
    document.querySelectorAll("[data-offline-strength]").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    offlineElement("offlineStrengthValue").textContent = OFFLINE_LABELS[offlineState.strength];
  });
});
offlineElement("offlineProcess").addEventListener("click", processOfflineAudio);

window.addEventListener("beforeunload", () => {
  offlineState.stream?.getTracks().forEach((track) => track.stop());
  if (offlineState.audioURL) URL.revokeObjectURL(offlineState.audioURL);
});

(async () => {
  try {
    const response = await offlineFetch("/api/health", {cache: "no-store"});
    if (!response.ok) throw new Error();
    setOfflineConnection("ready", "Protection ready");
  } catch (_) {
    setOfflineConnection("error", "Unavailable");
    offlineElement("offlineStatus").textContent = "The local protection service is unavailable.";
  }
})();
