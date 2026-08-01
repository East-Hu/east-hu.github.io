class VoiceShieldDuplex extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options?.processorOptions || {};
    this.hop = Number(processorOptions.hopSamples) || 800;
    this.channels = Math.max(1, Math.min(2, Number(processorOptions.channels) || 1));
    this.contextSampleRate = Number(processorOptions.sampleRate) || sampleRate;
    this.capture = new Float32Array(this.hop * this.channels);
    this.captureOffset = 0;
    this.outputQueue = [];
    this.outputOffset = 0;
    this.outputFrames = 0;
    this.monitor = false;
    this.monitorMode = "original";
    this.primed = false;
    // Keep at least 100 ms queued while also supporting a 100 ms model hop.
    this.startThreshold = Math.max(
      Math.round(this.contextSampleRate * 0.1),
      this.hop,
    );
    this.underruns = 0;

    this.port.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === "output" && message.samples) {
        const samples = new Float32Array(message.samples);
        const channels = Math.max(
          1,
          Math.min(2, Number(message.channels) || this.channels),
        );
        const frames = Math.floor(samples.length / channels);
        if (frames > 0) {
          this.outputQueue.push({samples, channels, frames});
          this.outputFrames += frames;
        }
      } else if (message.type === "monitor") {
        this.monitor = Boolean(message.enabled);
        if (!this.monitor) this.clearOutput();
      } else if (message.type === "monitor-mode") {
        this.monitorMode = message.mode === "protected" ? "protected" : "original";
        this.clearOutput();
      } else if (message.type === "clear-output") {
        this.clearOutput();
      }
    };
  }

  clearOutput() {
    this.outputQueue.length = 0;
    this.outputOffset = 0;
    this.outputFrames = 0;
    this.primed = false;
  }

  captureInput(inputChannels) {
    const frames = inputChannels[0]?.length || 0;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < this.channels; channel += 1) {
        const input = inputChannels[channel] || inputChannels[0];
        this.capture[this.captureOffset * this.channels + channel] = input?.[frame] || 0;
      }
      this.captureOffset += 1;
      if (this.captureOffset === this.hop) {
        const packet = this.capture;
        this.port.postMessage({type: "input", samples: packet.buffer}, [packet.buffer]);
        this.capture = new Float32Array(this.hop * this.channels);
        this.captureOffset = 0;
      }
    }
  }

  renderOriginal(inputChannels, outputChannels) {
    for (let channel = 0; channel < outputChannels.length; channel += 1) {
      const input = inputChannels[channel] || inputChannels[0];
      if (this.monitor && input) outputChannels[channel].set(input);
      else outputChannels[channel].fill(0);
    }
  }

  renderOutput(outputChannels) {
    for (const channel of outputChannels) channel.fill(0);
    if (!this.monitor || !outputChannels.length) return;
    if (!this.primed && this.outputFrames >= this.startThreshold) this.primed = true;
    if (!this.primed) return;

    let write = 0;
    const quantumFrames = outputChannels[0].length;
    while (write < quantumFrames && this.outputQueue.length) {
      const head = this.outputQueue[0];
      const available = head.frames - this.outputOffset;
      const count = Math.min(quantumFrames - write, available);
      for (let channel = 0; channel < outputChannels.length; channel += 1) {
        const sourceChannel = Math.min(channel, head.channels - 1);
        for (let frame = 0; frame < count; frame += 1) {
          outputChannels[channel][write + frame] = head.samples[
            (this.outputOffset + frame) * head.channels + sourceChannel
          ];
        }
      }
      write += count;
      this.outputOffset += count;
      this.outputFrames -= count;
      if (this.outputOffset === head.frames) {
        this.outputQueue.shift();
        this.outputOffset = 0;
      }
    }
    if (write < quantumFrames) {
      this.underruns += 1;
      if (this.underruns % 25 === 1) {
        this.port.postMessage({type: "underrun", count: this.underruns});
      }
      this.primed = false;
    }
  }

  process(inputs, outputs) {
    const inputChannels = inputs[0] || [];
    const outputChannels = outputs[0] || [];
    if (inputChannels.length) this.captureInput(inputChannels);
    if (this.monitorMode === "original") {
      this.renderOriginal(inputChannels, outputChannels);
    } else {
      this.renderOutput(outputChannels);
    }
    return true;
  }
}

registerProcessor("voiceshield-duplex", VoiceShieldDuplex);
