import { randomUnit } from '../core/random';

interface PartialTone {
  ratio: number;
  gain: number;
}

interface RingOptions {
  frequency: number;
  partials: PartialTone[];
  pan: number;
  peak: number;
  attack: number;
  decay: number;
  onDone?: () => void;
}

const SILENCE = 0.0001;
const NOISE_CHUNK_SIZE = 16_384;

export function createNoiseBuffer(
  context: AudioContext,
  seconds: number,
): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.round(context.sampleRate * seconds),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  const randomValues = new Uint32Array(samples.length);
  for (let offset = 0; offset < randomValues.length; offset += NOISE_CHUNK_SIZE) {
    crypto.getRandomValues(
      randomValues.subarray(
        offset,
        Math.min(offset + NOISE_CHUNK_SIZE, randomValues.length),
      ),
    );
  }
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (randomValues[index] / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function ringPartials(
  context: AudioContext,
  destination: AudioNode,
  options: RingOptions,
): void {
  const now = context.currentTime;
  const panner = context.createStereoPanner();
  panner.pan.setValueAtTime(Math.min(1, Math.max(-1, options.pan)), now);
  panner.connect(destination);

  options.partials.forEach((partial, index) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const decay = options.decay / (1 + index * 0.45);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(options.frequency * partial.ratio, now);
    envelope.gain.setValueAtTime(SILENCE, now);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(SILENCE, partial.gain * options.peak),
      now + options.attack,
    );
    envelope.gain.exponentialRampToValueAtTime(
      SILENCE,
      now + options.attack + decay,
    );
    oscillator.connect(envelope);
    envelope.connect(panner);
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        envelope.disconnect();
        if (index === 0) {
          panner.disconnect();
          options.onDone?.();
        }
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + options.attack + decay + 0.1);
  });
}

export function playSingingBowl(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  pan: number,
  onDone?: () => void,
): void {
  ringPartials(context, destination, {
    frequency,
    pan,
    onDone,
    peak: 0.15,
    attack: 0.14,
    decay: 9,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 1.004, gain: 0.55 },
      { ratio: 2.71, gain: 0.36 },
      { ratio: 5.04, gain: 0.14 },
    ],
  });
}

export function playTempleBell(
  context: AudioContext,
  destination: AudioNode,
): void {
  ringPartials(context, destination, {
    frequency: 196,
    pan: 0,
    peak: 0.17,
    attack: 0.012,
    decay: 7,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.5 },
      { ratio: 2.76, gain: 0.34 },
      { ratio: 4.07, gain: 0.2 },
      { ratio: 5.4, gain: 0.1 },
    ],
  });
}

export interface BinauralBeat {
  setBeat(hertz: number): void;
}

export function createBinauralBeat(
  context: AudioContext,
  destination: AudioNode,
  beatHertz: number,
): BinauralBeat {
  const carrier = 196;
  const voices = [-1, 1].map((pan, index) => {
    const oscillator = context.createOscillator();
    const panner = context.createStereoPanner();
    oscillator.type = 'sine';
    oscillator.frequency.value = carrier + (index === 1 ? beatHertz : 0);
    panner.pan.value = pan;
    oscillator.connect(panner);
    panner.connect(destination);
    oscillator.start();
    return oscillator;
  });

  return {
    setBeat(hertz: number): void {
      voices[1].frequency.setTargetAtTime(
        carrier + hertz,
        context.currentTime,
        0.3,
      );
    },
  };
}

export function playThunder(
  context: AudioContext,
  destination: AudioNode,
  noise: AudioBuffer,
): void {
  const now = context.currentTime;
  [0, 0.9, 2.2].forEach((offset, index) => {
    const start = now + offset;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, start);
    filter.frequency.exponentialRampToValueAtTime(60, start + 6);
    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.exponentialRampToValueAtTime(1 / (1 + index * 0.7), start + 1.4);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, start + 7);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.addEventListener(
      'ended',
      () => {
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );
    source.start(start, randomUnit() * (noise.duration - 0.1));
    source.stop(start + 7.2);
  });
}
