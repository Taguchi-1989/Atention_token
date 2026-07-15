import { downsampleToPcm16 } from '@/lib/talkbalancer-audio';

describe('TalkBalancer PCM streaming', () => {
  test('downsamples 48kHz Float32 to 16kHz PCM16', () => {
    const source = new Float32Array([1, 1, 1, 0, 0, 0, -1, -1, -1]);
    const result = new Int16Array(downsampleToPcm16(source, 48_000, 16_000));
    expect(Array.from(result)).toEqual([32767, 0, -32768]);
  });

  test('clips samples to the PCM16 range', () => {
    const result = new Int16Array(downsampleToPcm16(new Float32Array([2, -2]), 16_000));
    expect(Array.from(result)).toEqual([32767, -32768]);
  });
});
