/**
 * AudioWorklet processor — runs in the audio rendering thread.
 * Converts float32 samples to PCM16 and posts them to the main thread
 * in 20ms batches (~320 samples at 16 kHz).
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(0);
    this._accumulated = [];
    this._chunkSamples = Math.round(sampleRate * 0.02); // 20 ms
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this._accumulated.push(s < 0 ? s * 32768 : s * 32767);
    }

    while (this._accumulated.length >= this._chunkSamples) {
      const chunk = this._accumulated.splice(0, this._chunkSamples);
      const pcm = new Int16Array(chunk);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
