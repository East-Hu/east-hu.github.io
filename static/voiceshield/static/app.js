const $ = (id) => document.getElementById(id);

const CONFIG = Object.freeze({
  backendUrl: String(window.VOICESHIELD_CONFIG?.backendUrl || "").trim(),
  deployment: String(window.VOICESHIELD_CONFIG?.deployment || "local").trim(),
});

const BACKEND_BASE = (() => {
  const value = CONFIG.backendUrl || location.origin;
  const url = new URL(value, location.href);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VoiceShield backend must use HTTP or HTTPS.');
  }
  url.pathname = `${url.pathname.replace(/\/?$/, '/')}`;
  url.search = '';
  url.hash = '';
  return url;
})();

const ACCESS_CODE = new URLSearchParams(location.search).get('access') || '';
const REMOTE_BACKEND = BACKEND_BASE.origin !== location.origin || CONFIG.deployment === 'cloud';

function preserveAccessInDemoNavigation() {
  if (!ACCESS_CODE) return;
  document.querySelectorAll(".brand, .page-nav a").forEach((anchor) => {
    const url = new URL(anchor.href, location.href);
    url.searchParams.set("access", ACCESS_CODE);
    anchor.href = url.href;
  });
}

preserveAccessInDemoNavigation();

function backendURL(path) {
  return new URL(String(path).replace(/^\//, ''), BACKEND_BASE);
}

function protectedBackendURL(path) {
  const url = backendURL(path);
  if (ACCESS_CODE) url.searchParams.set('access', ACCESS_CODE);
  return url;
}

function websocketURL(path) {
  const url = protectedBackendURL(path);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}

function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (ACCESS_CODE) headers.set('Authorization', `Bearer ${ACCESS_CODE}`);
  return fetch(backendURL(path), {...options, headers});
}

const UI = {
  connection: $("connectionPill"),
  gpu: $("gpuName"),
  privacy: $("privacyLine"),
  eyebrow: $("deploymentEyebrow"),
  recordButton: $("recordButton"),
  recordAction: $("recordAction"),
  recordHint: $("recordHint"),
  state: $("sessionState"),
  timer: $("timer"),
  inputDevice: $("inputDevice"),
  outputDevice: $("outputDevice"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  modeStatus: $("modeStatus"),
  strengthControl: document.querySelector(".strength-control"),
  strengthButtons: document.querySelectorAll("[data-strength]"),
  strengthValue: $("strengthValue"),
  monitor: $("monitorToggle"),
  monitorStatus: $("monitorStatus"),
  overlay: $("contextOverlay"),
  contextCount: $("contextCount"),
  result: $("resultCard"),
  resultAudio: $("resultAudio"),
  download: $("downloadLink"),
  downloadOriginal: $("downloadOriginal"),
  downloadOutput: $("downloadOutput"),
  resultMeta: $("resultMeta"),
  toast: $("toast"),
};

const SESSION = {
  phase: "idle",
  socket: null,
  stream: null,
  context: null,
  source: null,
  worklet: null,
  streamReady: false,
  serviceAvailable: false,
  reconnectTimer: null,
  reconnecting: false,
  captureEnabled: false,
  recordingStartedAt: 0,
  timerHandle: null,
  countdownHandle: null,
  latestFrame: null,
  strength: 2,
  mode: "original",
  targetMode: "original",
  protectionPhase: "off",
  preparingStartedAt: 0,
  historyPrimedAt: 0,
  contextArchive: [],
  activationHistory: [],
  pendingFrames: [],
  hopSamples: 800,
  hopMS: 50,
  nativeSampleRate: 16000,
  nativeChannels: 1,
  nativeHopSamples: 800,
  packetSamples: 800,
  contextHops: 60,
  archiveHops: 240,
  trailingContextHops: 6,
  maxBatchHops: 200,
  waveHops: 80,
};

const STRENGTH_LABELS = Object.freeze({
  1: "Light",
  2: "Moderate",
  3: "Balanced",
  4: "Strong",
  5: "Maximum",
});

const COLORS = {
  input: "#54d8e8",
  output: "#ff7657",
  delta: "#b8ef5a",
};

class WaveHistory {
  constructor(limit = 64 * 80) {
    this.limit = limit;
    this.low = [];
    this.high = [];
  }

  push(envelope) {
    if (!envelope || envelope.length !== 2) return;
    this.low.push(...envelope[0]);
    this.high.push(...envelope[1]);
    if (this.low.length > this.limit) {
      const trim = this.low.length - this.limit;
      this.low.splice(0, trim);
      this.high.splice(0, trim);
    }
  }

  reset() {
    this.low.length = 0;
    this.high.length = 0;
  }
}

const waves = {
  input: new WaveHistory(),
  output: new WaveHistory(),
  delta: new WaveHistory(),
};

function applyStreamConfig(config = {}) {
  const sampleRate = Number(config.sr) || 16000;
  const hopSamples = Number(config.hop_samples) || 800;
  const hopMS = Number(config.hop_ms) || hopSamples / sampleRate * 1000;
  if (!Number.isInteger(hopSamples) || hopSamples < 1 || !Number.isFinite(hopMS) || hopMS <= 0) {
    throw new Error("The protection service returned an invalid audio configuration.");
  }
  SESSION.hopSamples = hopSamples;
  SESSION.hopMS = hopMS;
  SESSION.contextHops = Math.max(
    1,
    Math.round((Number(config.buffer_s) || 3) * 1000 / hopMS),
  );
  SESSION.archiveHops = Math.max(SESSION.contextHops, Math.round(12000 / hopMS));
  SESSION.trailingContextHops = Math.max(1, Math.round(300 / hopMS));
  SESSION.maxBatchHops = Math.max(1, Math.round(10000 / hopMS));
  SESSION.waveHops = Math.max(1, Math.round(4000 / hopMS));
  Object.values(waves).forEach((history) => {
    history.limit = 64 * SESSION.waveHops;
  });
}

const displayScales = {
  speech: {gain: 1, gate: 0.0007},
  delta: {gain: 8, gate: 0.00004},
};

function setConnection(state, text) {
  UI.connection.className = `connection ${state}`;
  UI.connection.querySelector("span").textContent = text;
}

function setServiceAvailability(available) {
  SESSION.serviceAvailable = available;
  UI.gpu.textContent = available ? "Protection is ready" : "Protection is not ready";
  if (["idle", "complete"].includes(SESSION.phase)) {
    UI.recordButton.disabled = !available;
  }
}

function scheduleReconnect() {
  if (!REMOTE_BACKEND || SESSION.reconnectTimer || SESSION.socket?.readyState === WebSocket.OPEN) return;
  SESSION.reconnectTimer = setTimeout(() => {
    SESSION.reconnectTimer = null;
    reconnectProtectionService();
  }, 3000);
}

async function reconnectProtectionService() {
  if (SESSION.reconnecting || SESSION.socket?.readyState === WebSocket.OPEN) return;
  SESSION.reconnecting = true;
  try {
    const response = await apiFetch("/api/health", {cache: "no-store"});
    if (!response.ok) throw new Error(`health check returned ${response.status}`);
    applyStreamConfig(await response.json());
    await connectSocket();
  } catch (_) {
    setConnection("error", "Unavailable");
    setServiceAvailability(false);
    scheduleReconnect();
  } finally {
    SESSION.reconnecting = false;
  }
}

function toast(message) {
  UI.toast.textContent = message;
  UI.toast.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => UI.toast.classList.add("hidden"), 6500);
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

function archiveContextFrame(buffer) {
  const samples = new Float32Array(buffer);
  let energy = 0;
  let peak = 0;
  for (const sample of samples) {
    energy += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  SESSION.contextArchive.push({
    buffer,
    rms: Math.sqrt(energy / Math.max(samples.length, 1)),
    peak,
  });
  if (SESSION.contextArchive.length > SESSION.archiveHops) {
    SESSION.contextArchive.shift();
  }
}

function selectProtectionContext() {
  const archive = SESSION.contextArchive;
  let lastVoice = -1;
  for (let index = archive.length - 1; index >= 0; index -= 1) {
    const frame = archive[index];
    if (frame.rms >= 0.0018 && frame.peak >= 0.005) {
      lastVoice = index;
      break;
    }
  }

  let frames = [];
  if (lastVoice >= 0) {
    // Keep the most recent continuous speech context plus up to 300 ms of its
    // natural trailing audio. Do not splice unrelated voiced fragments together.
    const end = Math.min(
      archive.length,
      lastVoice + 1 + SESSION.trailingContextHops,
    );
    const start = Math.max(0, end - SESSION.contextHops);
    frames = archive.slice(start, end).map((frame) => frame.buffer);
  }
  while (frames.length < SESSION.contextHops) {
    frames.unshift(new Float32Array(SESSION.packetSamples).buffer);
  }
  return frames.slice(-SESSION.contextHops);
}

function updateMonitorState() {
  const enabled = UI.monitor.checked && SESSION.phase === "recording";
  UI.monitorStatus.textContent = UI.monitor.checked ? "On" : "Off";
  UI.monitor.closest(".monitor-switch")?.classList.toggle("enabled", UI.monitor.checked);
  SESSION.worklet?.port.postMessage({type: "monitor", enabled});
}

function setPhase(phase) {
  SESSION.phase = phase;
  const live = ["recording", "stopping"].includes(phase);
  UI.recordButton.classList.toggle("live", live);
  UI.state.classList.toggle("live", live);

  const copy = {
    idle: ["Start live session", "Allow microphone access when prompted", "STANDBY"],
    opening: ["Opening microphone…", "Preparing audio", "PREPARING"],
    recording: ["Stop & save", "Finish and save this live session", "RECORDING"],
    stopping: ["Finalizing stream…", "Saving both session recordings", "SAVING"],
    complete: ["Record another take", "Your session recordings are ready", "COMPLETE"],
  }[phase];
  if (!copy) return;
  UI.recordAction.textContent = copy[0];
  UI.recordHint.textContent = copy[1];
  UI.state.textContent = copy[2];
  UI.recordButton.disabled = ["opening", "stopping"].includes(phase) ||
    (!SESSION.serviceAvailable && ["idle", "complete"].includes(phase));
  updateControlAvailability();
}

function updateControlAvailability() {
  const recording = SESSION.phase === "recording";
  UI.modeButtons.forEach((button) => {
    button.disabled = !recording;
  });
  const strengthActive = recording &&
    SESSION.mode === "protected" &&
    SESSION.protectionPhase === "on";
  UI.strengthControl?.classList.toggle("inactive", !strengthActive);
  UI.strengthButtons.forEach((button) => {
    button.disabled = !strengthActive;
  });
}

function setListeningMode(mode, status = null) {
  SESSION.mode = mode;
  UI.modeButtons.forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  UI.modeStatus.textContent = status || (mode === "protected" ? "Protected" : "Original");
  SESSION.worklet?.port.postMessage({type: "monitor-mode", mode});
  updateControlAvailability();
}

function updateTimer() {
  if (SESSION.phase !== "recording") return;
  UI.timer.textContent = formatTimer((performance.now() - SESSION.recordingStartedAt) / 1000);
  SESSION.timerHandle = requestAnimationFrame(updateTimer);
}

async function listDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const currentInput = UI.inputDevice.value;
  const currentOutput = UI.outputDevice.value;
  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");

  UI.inputDevice.replaceChildren(new Option("System default", ""));
  inputs.forEach((device, index) => {
    UI.inputDevice.add(new Option(device.label || `Microphone ${index + 1}`, device.deviceId));
  });
  if ([...UI.inputDevice.options].some((option) => option.value === currentInput)) {
    UI.inputDevice.value = currentInput;
  }

  UI.outputDevice.replaceChildren(new Option("System default", ""));
  outputs.forEach((device, index) => {
    UI.outputDevice.add(new Option(device.label || `Output ${index + 1}`, device.deviceId));
  });
  if ([...UI.outputDevice.options].some((option) => option.value === currentOutput)) {
    UI.outputDevice.value = currentOutput;
  }
}

async function chooseOutput() {
  if (!SESSION.context) return;
  if (typeof SESSION.context.setSinkId === "function") {
    try {
      await SESSION.context.setSinkId(UI.outputDevice.value || "");
    } catch (error) {
      console.error("Output selection failed", error);
      toast("Could not select that output.");
    }
  } else if (UI.outputDevice.value) {
    toast("This browser uses the operating system's default output device.");
  }
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    if (SESSION.socket?.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const socket = new WebSocket(websocketURL("/ws"));
    SESSION.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      clearTimeout(SESSION.reconnectTimer);
      SESSION.reconnectTimer = null;
      setServiceAvailability(true);
      setConnection("ready", "Protection ready");
      resolve();
    };
    socket.onerror = () => {
      setConnection("error", REMOTE_BACKEND ? "Unavailable" : "Connection failed");
      setServiceAvailability(false);
      reject(new Error(
        REMOTE_BACKEND
          ? "Could not connect to the protection service."
          : "Could not connect to the local protection service.",
      ));
    };
    socket.onclose = () => {
      const interrupted = SESSION.phase !== "idle" && SESSION.phase !== "complete";
      setConnection("error", REMOTE_BACKEND ? "Unavailable" : "Disconnected");
      setServiceAvailability(false);
      stopAudioGraph();
      setPhase("idle");
      if (interrupted) {
        if (REMOTE_BACKEND) toast("The protection service disconnected.");
        else toast("The local protection service disconnected.");
      }
      scheduleReconnect();
    };
    socket.onmessage = handleSocketMessage;
  });
}

function sendJSON(message) {
  if (SESSION.socket?.readyState === WebSocket.OPEN) {
    SESSION.socket.send(JSON.stringify(message));
  }
}

function handleSocketMessage(event) {
  if (typeof event.data !== "string") {
    if (
      SESSION.worklet &&
      SESSION.phase === "recording" &&
      SESSION.mode === "protected" &&
      SESSION.protectionPhase === "on" &&
      UI.monitor.checked
    ) {
      SESSION.worklet.port.postMessage(
        {
          type: "output",
          samples: event.data,
          channels: SESSION.nativeChannels,
        },
        [event.data],
      );
    }
    return;
  }

  const message = JSON.parse(event.data);
  if (message.type === "hello") {
    applyStreamConfig(message.config);
    UI.gpu.textContent = "Protection is ready";
    return;
  }
  if (message.type === "session_ready") {
    SESSION.captureEnabled = true;
    SESSION.targetMode = "original";
    SESSION.protectionPhase = "off";
    SESSION.preparingStartedAt = 0;
    SESSION.historyPrimedAt = 0;
    SESSION.contextArchive.length = 0;
    SESSION.activationHistory.length = 0;
    SESSION.pendingFrames.length = 0;
    setListeningMode("original");
    setPhase("recording");
    SESSION.recordingStartedAt = performance.now();
    UI.timer.textContent = "00:00.0";
    cancelAnimationFrame(SESSION.timerHandle);
    updateTimer();
    SESSION.worklet?.port.postMessage({type: "clear-output"});
    updateMonitorState();
    if (!UI.monitor.checked) {
      toast("Turn on Hear live output to listen while you speak.");
    }
    return;
  }
  if (message.type === "protection_slot_ready") {
    const confirmedStrength = message.strength;
    const strengthConfirmed = Number.isInteger(confirmedStrength) &&
      confirmedStrength >= 1 &&
      confirmedStrength <= 5 &&
      confirmedStrength === SESSION.strength;
    if (!strengthConfirmed) {
      sendJSON({type: "deactivate_protection"});
      SESSION.targetMode = "original";
      SESSION.protectionPhase = "off";
      setListeningMode("original");
      toast("Protection strength could not be confirmed.");
      return;
    }
    if (SESSION.targetMode !== "protected") return;
    SESSION.protectionPhase = "history";
    setListeningMode("original", "Preparing…");
    const requestedHops = Number(message.history_hops) || SESSION.contextHops;
    const history = SESSION.activationHistory.slice(-requestedHops);
    while (history.length < requestedHops) {
      history.unshift(new Float32Array(SESSION.packetSamples).buffer);
    }
    sendAudioBatch("prime_history", history);
    return;
  }
  if (message.type === "history_primed") {
    SESSION.historyPrimedAt = performance.now();
    if (SESSION.targetMode === "protected") sendPendingCatchup();
    return;
  }
  if (message.type === "protection_ready") {
    if (SESSION.targetMode !== "protected") return;
    if (SESSION.pendingFrames.length) {
      sendPendingCatchup();
      return;
    }
    SESSION.protectionPhase = "on";
    const readyAt = performance.now();
    if (SESSION.preparingStartedAt) {
      console.info("[VoiceShield] protection preparation", {
        total_ms: Math.round(readyAt - SESSION.preparingStartedAt),
        history_ms: SESSION.historyPrimedAt
          ? Math.round(SESSION.historyPrimedAt - SESSION.preparingStartedAt)
          : null,
        catchup_ms: SESSION.historyPrimedAt
          ? Math.round(readyAt - SESSION.historyPrimedAt)
          : null,
      });
    }
    SESSION.preparingStartedAt = 0;
    SESSION.historyPrimedAt = 0;
    SESSION.activationHistory.length = 0;
    SESSION.worklet?.port.postMessage({type: "clear-output"});
    setListeningMode("protected");
    toast("Protected listening is active.");
    return;
  }
  if (message.type === "mode_changed" && message.mode === "original") {
    SESSION.protectionPhase = "off";
    SESSION.preparingStartedAt = 0;
    SESSION.historyPrimedAt = 0;
    SESSION.activationHistory.length = 0;
    SESSION.pendingFrames.length = 0;
    setListeningMode("original");
    return;
  }
  if (message.type === "strength_changed") {
    if (message.strength !== SESSION.strength) {
      toast("Protection strength could not be confirmed.");
    }
    return;
  }
  if (message.type === "frame") {
    SESSION.latestFrame = message;
    updateFrame(message);
    return;
  }
  if (message.type === "recording_ready") {
    showResult(message);
    return;
  }
  if (message.type === "session_recording_ready") {
    showResult(message);
    return;
  }
  if (message.type === "stopped") {
    stopAudioGraph();
    setPhase("complete");
    return;
  }
  if (message.type === "session_stopped") {
    stopAudioGraph();
    SESSION.targetMode = "original";
    SESSION.protectionPhase = "off";
    SESSION.preparingStartedAt = 0;
    SESSION.historyPrimedAt = 0;
    setListeningMode("original");
    setPhase("complete");
    return;
  }
  if (message.type === "error") {
    if (SESSION.phase === "recording" && SESSION.targetMode === "protected") {
      SESSION.targetMode = "original";
      SESSION.protectionPhase = "off";
      SESSION.preparingStartedAt = 0;
      SESSION.historyPrimedAt = 0;
      SESSION.activationHistory.length = 0;
      SESSION.pendingFrames.length = 0;
      setListeningMode("original");
      toast("Protected listening is temporarily unavailable.");
      return;
    }
    stopAudioGraph();
    setPhase("idle");
    toast("The live session stopped unexpectedly.");
  }
}

function sendAudioBatch(type, frames) {
  const safeFrames = frames.slice(0, SESSION.maxBatchHops);
  sendJSON({type, hops: safeFrames.length});
  if (!safeFrames.length || SESSION.socket?.readyState !== WebSocket.OPEN) return;
  const packet = new Float32Array(safeFrames.length * SESSION.packetSamples);
  safeFrames.forEach((buffer, index) => {
    packet.set(new Float32Array(buffer), index * SESSION.packetSamples);
  });
  SESSION.socket.send(packet.buffer);
}

function sendPendingCatchup() {
  if (SESSION.targetMode !== "protected") return;
  SESSION.protectionPhase = "catchup";
  const pending = SESSION.pendingFrames.splice(0, SESSION.maxBatchHops);
  sendAudioBatch("prime_catchup", pending);
}

async function createAudioGraph() {
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    throw new Error("Microphone access requires localhost or HTTPS.");
  }

  const constraints = {
    audio: {
      deviceId: UI.inputDevice.value ? {exact: UI.inputDevice.value} : undefined,
      channelCount: {ideal: 2},
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  };
  SESSION.stream = await navigator.mediaDevices.getUserMedia(constraints);

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  SESSION.context = new AudioContextClass({latencyHint: "interactive"});
  const track = SESSION.stream.getAudioTracks()[0];
  const reportedChannels = Number(track?.getSettings?.().channelCount) || 1;
  SESSION.nativeSampleRate = SESSION.context.sampleRate;
  SESSION.nativeChannels = Math.max(1, Math.min(2, Math.round(reportedChannels)));
  SESSION.nativeHopSamples = Math.round(
    SESSION.nativeSampleRate * SESSION.hopMS / 1000,
  );
  SESSION.packetSamples = SESSION.nativeHopSamples * SESSION.nativeChannels;
  await SESSION.context.audioWorklet.addModule(
    new URL("./static/audio-worklet.js?v=20260801-7", document.baseURI).href,
  );
  SESSION.source = SESSION.context.createMediaStreamSource(SESSION.stream);
  SESSION.worklet = new AudioWorkletNode(SESSION.context, "voiceshield-duplex", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [SESSION.nativeChannels],
    channelCount: SESSION.nativeChannels,
    channelCountMode: "explicit",
    processorOptions: {
      hopSamples: SESSION.nativeHopSamples,
      channels: SESSION.nativeChannels,
      sampleRate: SESSION.nativeSampleRate,
    },
  });
  SESSION.worklet.port.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "input" && SESSION.captureEnabled && SESSION.socket?.readyState === WebSocket.OPEN) {
      const ringCopy = message.samples.slice(0);
      archiveContextFrame(ringCopy);
      if (["reserving", "history", "catchup"].includes(SESSION.protectionPhase)) {
        SESSION.pendingFrames.push(message.samples);
      } else {
        SESSION.socket.send(message.samples);
      }
    } else if (message.type === "underrun" && UI.monitor.checked) {
      $("deadlineText").textContent = `Playback recovered from ${message.count} buffer underrun${message.count === 1 ? "" : "s"}`;
    }
  };
  SESSION.source.connect(SESSION.worklet);
  SESSION.worklet.connect(SESSION.context.destination);
  await SESSION.context.resume();
  SESSION.worklet.port.postMessage({type: "monitor", enabled: false});
  SESSION.worklet.port.postMessage({type: "monitor-mode", mode: "original"});
  await listDevices();
  await chooseOutput();
}

function stopAudioGraph() {
  SESSION.captureEnabled = false;
  SESSION.streamReady = false;
  SESSION.contextArchive.length = 0;
  SESSION.activationHistory.length = 0;
  SESSION.pendingFrames.length = 0;
  clearInterval(SESSION.countdownHandle);
  cancelAnimationFrame(SESSION.timerHandle);
  SESSION.worklet?.port.postMessage({type: "monitor", enabled: false});
  try { SESSION.source?.disconnect(); } catch (_) {}
  try { SESSION.worklet?.disconnect(); } catch (_) {}
  SESSION.stream?.getTracks().forEach((track) => track.stop());
  if (SESSION.context && SESSION.context.state !== "closed") SESSION.context.close();
  SESSION.stream = null;
  SESSION.context = null;
  SESSION.source = null;
  SESSION.worklet = null;
  UI.overlay.classList.add("hidden");
}

async function startSession() {
  UI.result.classList.add("hidden");
  Object.values(waves).forEach((history) => history.reset());
  displayScales.speech = {gain: 1, gate: 0.0007};
  displayScales.delta = {gain: 8, gate: 0.00004};
  setPhase("opening");
  try {
    await connectSocket();
    await createAudioGraph();
    sendJSON({
      type: "session_start",
      sample_rate: SESSION.nativeSampleRate,
      channels: SESSION.nativeChannels,
    });
  } catch (error) {
    console.error("Live protection could not start", error);
    stopAudioGraph();
    setPhase("idle");
    toast("Audio protection stopped unexpectedly");
  }
}

function stopSession() {
  if (SESSION.phase !== "recording") return;
  setPhase("stopping");
  SESSION.captureEnabled = false;
  SESSION.worklet?.port.postMessage({type: "monitor", enabled: false});
  sendJSON({type: "session_stop"});
}

function showResult(message) {
  const outputPath = message.output_url || message.download_url;
  const outputURL = protectedBackendURL(outputPath).href;
  const downloadURL = protectedBackendURL(message.download_url).href;
  UI.resultAudio.src = outputURL;
  UI.download.href = downloadURL;
  UI.download.download = message.archive_filename || message.filename;
  if (message.original_url) {
    UI.downloadOriginal.href = protectedBackendURL(message.original_url).href;
    UI.downloadOriginal.download = message.original_filename;
    UI.downloadOutput.href = outputURL;
    UI.downloadOutput.download = message.output_filename;
    UI.downloadOriginal.parentElement.classList.remove("hidden");
  } else {
    UI.downloadOriginal.parentElement.classList.add("hidden");
  }
  UI.resultMeta.textContent =
    `${message.duration_s.toFixed(1)} s · ` +
    `mean ${message.mean_process_ms.toFixed(1)} ms · p95 ${message.p95_process_ms.toFixed(1)} ms. ` +
    (REMOTE_BACKEND
      ? "Your original and session output are ready to download."
      : "Your original and session output were saved on this computer.");
  UI.result.classList.remove("hidden");
  setTimeout(() => UI.result.scrollIntoView({behavior: "smooth", block: "center"}), 120);
}

function updateFrame(frame) {
  const wave = frame.wave || {};
  waves.input.push(wave.input);
  waves.output.push(wave.output);
  waves.delta.push(wave.delta);
  displayScales.speech = autoDisplayScale([waves.input, waves.output], 0.0007, 64);
  displayScales.delta = autoDisplayScale([waves.delta], 0.00004, 96, 0.52);

  $("inputPeak").textContent = Number(frame.input_peak || 0).toFixed(3);
  $("outputPeak").textContent = Number(frame.output_peak || 0).toFixed(3);
  const protectedFrame = frame.mode === "protected";
  $("processMS").textContent = protectedFrame ? Number(frame.process_ms).toFixed(1) : "—";
  $("rtf").textContent = protectedFrame ? Number(frame.rtf).toFixed(3) : "—";
  $("deltaRMS").textContent = Number(frame.delta_rms).toFixed(4);
  $("deadlineText").textContent = protectedFrame
    ? (frame.deadline_met ? "Live processing target met" : "Processing is taking longer than expected")
    : "Original signal · protection off";
  $("deadlineText").style.color = protectedFrame && !frame.deadline_met ? "var(--danger)" : "var(--lime)";

  const stages = frame.stages || {};
  const values = [
    ["encMS", "encBar", stages.enc_ms],
    ["transMS", "transBar", stages.trans_ms],
    ["decMS", "decBar", stages.dec_ms],
  ];
  const max = Math.max(...values.map((entry) => Number(entry[2]) || 0), 1);
  values.forEach(([textId, barId, raw]) => {
    const value = Number(raw);
    $(textId).textContent = protectedFrame && Number.isFinite(value) ? `${value.toFixed(1)} ms` : "—";
    $(barId).style.width = protectedFrame && Number.isFinite(value) ? `${Math.min(100, value / max * 100)}%` : "0";
  });
}

function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return {context, width: rect.width, height: rect.height};
}

function autoDisplayScale(histories, minimumGate, maxGain, target = 0.68) {
  const amplitudes = [];
  histories.forEach((history) => {
    const start = Math.max(
      0,
      history.low.length - 64 * SESSION.waveHops,
    );
    for (let index = start; index < history.low.length; index += 4) {
      const amplitude = Math.max(
        Math.abs(history.low[index] || 0),
        Math.abs(history.high[index] || 0),
      );
      if (amplitude > minimumGate * 0.25) amplitudes.push(amplitude);
    }
  });
  if (amplitudes.length < 8) return {gain: 1, gate: minimumGate};
  amplitudes.sort((left, right) => left - right);
  const baseline = amplitudes[Math.floor((amplitudes.length - 1) * 0.2)];
  const gate = Math.max(minimumGate, baseline * 2);
  const voiced = amplitudes.filter((amplitude) => amplitude >= gate);
  if (voiced.length < 8) return {gain: 1, gate};
  const voicedPeak = voiced[Math.floor((voiced.length - 1) * 0.9)];
  return {
    gain: Math.max(1, Math.min(maxGain, target / Math.max(voicedPeak, gate))),
    gate,
  };
}

function drawEnvelope(canvas, history, color, gain = 1, noiseGate = 0) {
  const {context, width, height} = fitCanvas(canvas);
  context.clearRect(0, 0, width, height);
  const count = history.low.length;
  if (count < 2) return;
  const visible = Math.min(count, 64 * SESSION.waveHops);
  const start = count - visible;
  const mid = height / 2;
  const x = (index) => (index - start) / Math.max(visible - 1, 1) * width;
  const active = new Uint8Array(visible);
  for (let left = start; left < count; left += 64) {
    const right = Math.min(left + 64, count);
    let aboveGate = 0;
    for (let index = left; index < right; index += 1) {
      const amplitude = Math.max(
        Math.abs(history.low[index] || 0),
        Math.abs(history.high[index] || 0),
      );
      if (amplitude >= noiseGate) aboveGate += 1;
    }
    if (aboveGate >= Math.max(5, Math.floor((right - left) * 0.1))) {
      const activeLeft = Math.max(start, left - 64);
      const activeRight = Math.min(count, right + 64);
      active.fill(1, activeLeft - start, activeRight - start);
    }
  }
  const y = (value, index) => {
    const gated = active[index - start] ? value : 0;
    return mid - Math.max(-1, Math.min(1, gated * gain)) * mid * 0.76;
  };

  context.beginPath();
  context.moveTo(x(start), y(history.high[start], start));
  for (let i = start + 1; i < count; i += 1) context.lineTo(x(i), y(history.high[i], i));
  for (let i = count - 1; i >= start; i -= 1) context.lineTo(x(i), y(history.low[i], i));
  context.closePath();
  context.fillStyle = `${color}22`;
  context.fill();

  context.beginPath();
  context.moveTo(x(start), y(history.high[start], start));
  for (let i = start + 1; i < count; i += 1) context.lineTo(x(i), y(history.high[i], i));
  context.strokeStyle = color;
  context.lineWidth = 1.2;
  context.stroke();

  context.beginPath();
  context.moveTo(x(start), y(history.low[start], start));
  for (let i = start + 1; i < count; i += 1) context.lineTo(x(i), y(history.low[i], i));
  context.stroke();
}

function animationLoop() {
  drawEnvelope(
    $("inputCanvas"), waves.input, COLORS.input,
    displayScales.speech.gain, displayScales.speech.gate,
  );
  drawEnvelope(
    $("outputCanvas"), waves.output, COLORS.output,
    displayScales.speech.gain, displayScales.speech.gate,
  );
  drawEnvelope(
    $("deltaCanvas"), waves.delta, COLORS.delta,
    displayScales.delta.gain, displayScales.delta.gate,
  );
  requestAnimationFrame(animationLoop);
}

UI.recordButton.addEventListener("click", () => {
  if (SESSION.phase === "recording") stopSession();
  else if (SESSION.phase === "idle" || SESSION.phase === "complete") startSession();
});

UI.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (SESSION.phase !== "recording") return;
    const requested = button.dataset.mode;
    if (requested === "protected") {
      if (SESSION.targetMode === "protected") return;
      SESSION.activationHistory = selectProtectionContext();
      SESSION.targetMode = "protected";
      SESSION.protectionPhase = "reserving";
      SESSION.preparingStartedAt = performance.now();
      SESSION.historyPrimedAt = 0;
      SESSION.pendingFrames.length = 0;
      setListeningMode("original", "Preparing…");
      updateControlAvailability();
      sendJSON({type: "activate_protection", strength: SESSION.strength});
      return;
    }
    if (requested === "original" && SESSION.targetMode !== "original") {
      SESSION.targetMode = "original";
      SESSION.protectionPhase = "off";
      SESSION.preparingStartedAt = 0;
      SESSION.historyPrimedAt = 0;
      SESSION.activationHistory.length = 0;
      SESSION.pendingFrames.length = 0;
      SESSION.worklet?.port.postMessage({type: "clear-output"});
      setListeningMode("original");
      sendJSON({type: "deactivate_protection"});
    }
  });
});

UI.strengthButtons.forEach((b) => {
  b.addEventListener("click", () => {
    if (b.disabled) return;
    if (SESSION.phase !== "recording" || SESSION.mode !== "protected") return;
    const strength = Number(b.dataset.strength);
    SESSION.strength = strength;
    UI.strengthButtons.forEach((candidate) => {
      const selected = Number(candidate.dataset.strength) === strength;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    UI.strengthValue.textContent = STRENGTH_LABELS[strength];
    sendJSON({type: "set_strength", strength});
  });
});

UI.monitor.addEventListener("change", () => {
  updateMonitorState();
  if (UI.monitor.checked && SESSION.phase === "recording") {
    toast("Live output is on. Use headphones to prevent feedback.");
  }
});

UI.outputDevice.addEventListener("change", chooseOutput);
UI.inputDevice.addEventListener("change", () => {
  if (SESSION.phase === "recording") {
    toast("Stop the current take before changing microphones.");
    return;
  }
});

window.addEventListener("beforeunload", () => {
  if (SESSION.phase === "recording") sendJSON({type: "session_stop"});
  stopAudioGraph();
});

async function boot() {
  setPhase("idle");
  updateMonitorState();
  requestAnimationFrame(animationLoop);
  if (REMOTE_BACKEND) {
    UI.eyebrow.textContent = "LIVE VOICE PRIVACY · REAL-TIME PROTECTION";
    UI.privacy.textContent = "Audio is encrypted in transit and processed for this live session.";
    const footerItems = document.querySelectorAll("footer span");
    const cloudCopy = [
      "Real-time protection",
      "Encrypted transport",
      "Session-based processing",
      "Controlled access",
    ];
    footerItems.forEach((item, index) => {
      if (cloudCopy[index]) item.textContent = cloudCopy[index];
    });
  }
  try {
    const response = await apiFetch("/api/health", {cache: "no-store"});
    if (!response.ok) throw new Error(`health check returned ${response.status}`);
    applyStreamConfig(await response.json());
    UI.gpu.textContent = "Protection is ready";
    setConnection("ready", "Protection ready");
    await listDevices();
    await connectSocket();
  } catch (error) {
    console.error("Protection service is unavailable", error);
    setConnection("error", REMOTE_BACKEND ? "Unavailable" : "Protection unavailable");
    setServiceAvailability(false);
    toast("Audio protection stopped unexpectedly");
    scheduleReconnect();
  }
}

boot();
