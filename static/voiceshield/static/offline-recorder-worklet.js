class VoiceShieldOfflineRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = (event) => {
      const type = event.data?.type;
      if (type === "start") this.recording = true;
      if (type === "stop") this.recording = false;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (output) output.fill(0);
    if (this.recording && input) {
      const copy = new Float32Array(input);
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor("voiceshield-offline-recorder", VoiceShieldOfflineRecorder);
