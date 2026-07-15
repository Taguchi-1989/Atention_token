export const TALK_BALANCER_PCM_SAMPLE_RATE = 16_000;

/** Downsample browser Float32 audio to mono little-endian PCM16 for Local Server. */
export function downsampleToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = TALK_BALANCER_PCM_SAMPLE_RATE,
): ArrayBuffer {
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    throw new Error('inputSampleRate must be positive');
  }
  if (outputSampleRate <= 0 || outputSampleRate > inputSampleRate) {
    throw new Error('outputSampleRate must be positive and no greater than inputSampleRate');
  }
  if (input.length === 0) return new ArrayBuffer(0);

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const pcm = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex++) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex++) sum += input[inputIndex];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    pcm[outputIndex] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }
  return pcm.buffer;
}
