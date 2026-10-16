import type { ThemePreset } from '../core/theme';
import type { ActivityAudio } from '../core/activity';
import { randomUnit } from '../core/random';
import {
  AUDIO_LAYERS,
  DEFAULT_ROOM_SETTINGS,
  type AudioLayer,
} from '../core/roomSettings';
import {
  createBinauralBeat,
  createNoiseBuffer,
  playSingingBowl,
  playTempleBell,
  playThunder,
  type BinauralBeat,
} from './voices';

interface AudioPreset {
  notes: number[];
  drone: number[];
}

const AUDIO_PRESETS: Record<ThemePreset, AudioPreset> = {
  dawn: {
    notes: [440, 493.88, 554.37, 659.25, 739.99],
    drone: [51.91, 77.78, 103.83],
  },
  meadow: {
    notes: [523.25, 587.33, 659.25, 783.99, 880],
    drone: [55, 82.41, 110],
  },
  dusk: {
    notes: [196, 220, 261.63, 293.66, 329.63],
    drone: [49, 73.42, 98],
  },
  mist: {
    notes: [659.25, 739.99, 880, 987.77, 1174.66],
    drone: [61.74, 92.5, 123.47],
  },
  nightfall: {
    notes: [587.33, 659.25, 783.99, 880, 1046.5],
    drone: [41.2, 61.74, 82.41],
  },
};

const LAYER_GAINS: Record<AudioLayer, number> = {
  rain: 0.085,
  drone: 0.11,
  chimes: 0.12,
  thunder: 0.3,
  binaural: 0.045,
};

const MAX_CONCURRENT_BOWLS = 6;

function toPan(horizontalPosition: number): number {
  return Math.min(1, Math.max(-1, horizontalPosition * 2 - 1));
}

export class AmbientAudioEngine implements ActivityAudio {
  private audioContext: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private bellGain: GainNode | undefined;
  private noiseBuffer: AudioBuffer | undefined;
  private binaural: BinauralBeat | undefined;
  private readonly layerGains = new Map<AudioLayer, GainNode>();
  private readonly droneOscillators: OscillatorNode[] = [];
  private enabled = false;
  private activeBowls = 0;
  private beatHertz = Number(DEFAULT_ROOM_SETTINGS.beat);
  private levels: Record<AudioLayer, number> = {
    ...DEFAULT_ROOM_SETTINGS.levels,
  };
  private preset: ThemePreset = 'meadow';

  get isEnabled(): boolean {
    return this.enabled;
  }

  setPreset(preset: ThemePreset): void {
    this.preset = preset;
    const selected = AUDIO_PRESETS[preset];
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    this.droneOscillators.forEach((oscillator, index) => {
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);
      oscillator.frequency.linearRampToValueAtTime(
        selected.drone[index],
        now + 0.8,
      );
    });
  }

  setLevel(layer: AudioLayer, level: number): void {
    this.levels[layer] = Math.min(1, Math.max(0, level));
    this.updateLayerGain(layer);
  }

  setBinauralBeat(hertz: number): void {
    this.beatHertz = hertz;
    this.binaural?.setBeat(hertz);
  }

  async toggle(): Promise<boolean> {
    if (!this.audioContext) {
      this.createAudioGraph();
    }

    const audioContext = this.audioContext;
    const masterGain = this.masterGain;
    if (!audioContext || !masterGain) {
      throw new Error('Ambient audio could not be initialized.');
    }

    await audioContext.resume();
    this.enabled = !this.enabled;
    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(this.enabled ? 1 : 0, now + 1.1);
    return this.enabled;
  }

  async resumeFromGesture(): Promise<void> {
    if (this.enabled && this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playParticleTone(
    noteIndex: number,
    pointerSpeed: number,
    horizontalPosition = 0.5,
  ): Promise<void> {
    const voice = await this.prepareVoice('chimes');
    if (!voice) {
      return;
    }

    const { audioContext, destination } = voice;
    const speed = Math.min(Math.max(pointerSpeed, 0), 1);
    const notes = AUDIO_PRESETS[this.preset].notes;
    const frequency = notes[noteIndex % notes.length] * (1 + speed * 0.1);
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const panner = audioContext.createStereoPanner();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    panner.pan.setValueAtTime(toPan(horizontalPosition), now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16 + speed * 0.1, now + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    oscillator.connect(envelope);
    envelope.connect(panner);
    panner.connect(destination);
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        envelope.disconnect();
        panner.disconnect();
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  async playSingingBowl(
    noteIndex: number,
    horizontalPosition = 0.5,
  ): Promise<void> {
    if (this.activeBowls >= MAX_CONCURRENT_BOWLS) {
      return;
    }
    const voice = await this.prepareVoice('chimes');
    if (!voice) {
      return;
    }

    const notes = AUDIO_PRESETS[this.preset].notes;
    this.activeBowls += 1;
    playSingingBowl(
      voice.audioContext,
      voice.destination,
      notes[noteIndex % notes.length] / 2,
      toPan(horizontalPosition),
      () => {
        this.activeBowls = Math.max(0, this.activeBowls - 1);
      },
    );
  }

  playTempleBell(): boolean {
    const audioContext = this.audioContext;
    if (
      !this.enabled ||
      !audioContext ||
      !this.bellGain ||
      audioContext.state !== 'running'
    ) {
      return false;
    }

    playTempleBell(audioContext, this.bellGain);
    return true;
  }

  private async prepareVoice(
    layer: AudioLayer,
  ): Promise<{ audioContext: AudioContext; destination: GainNode } | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const audioContext = this.audioContext;
    const destination = this.layerGains.get(layer);
    if (!audioContext || !destination || this.levels[layer] <= 0) {
      return undefined;
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if (!this.enabled || audioContext.state !== 'running') {
      return undefined;
    }
    return { audioContext, destination };
  }

  private updateLayerGain(layer: AudioLayer): void {
    const gain = this.layerGains.get(layer);
    const audioContext = this.audioContext;
    if (!gain || !audioContext) {
      return;
    }
    const now = audioContext.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(this.levels[layer] * LAYER_GAINS[layer], now, 0.08);
  }

  private createAudioGraph(): void {
    const AudioContextConstructor = globalThis.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Ambient audio is not supported in this browser.');
    }

    const audioContext = new AudioContextConstructor();
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.noiseBuffer = createNoiseBuffer(audioContext, 2);

    for (const layer of AUDIO_LAYERS) {
      const gain = audioContext.createGain();
      gain.gain.value = this.levels[layer] * LAYER_GAINS[layer];
      gain.connect(masterGain);
      this.layerGains.set(layer, gain);
    }

    this.bellGain = audioContext.createGain();
    this.bellGain.connect(masterGain);
    this.createRainAndWind(audioContext);
    this.createDrone(audioContext);
    const binauralGain = this.layerGains.get('binaural');
    if (binauralGain) {
      this.binaural = createBinauralBeat(
        audioContext,
        binauralGain,
        this.beatHertz,
      );
    }
    this.scheduleThunder();
  }

  private createRainAndWind(audioContext: AudioContext): void {
    const rainGain = this.layerGains.get('rain');
    if (!rainGain || !this.noiseBuffer) {
      return;
    }

    const rain = audioContext.createBufferSource();
    const rainFilter = audioContext.createBiquadFilter();
    rain.buffer = this.noiseBuffer;
    rain.loop = true;
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1250;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rain.start();

    const wind = audioContext.createOscillator();
    const windGain = audioContext.createGain();
    wind.type = 'sine';
    wind.frequency.value = 174.61;
    windGain.gain.value = 0.12;
    wind.connect(windGain);
    windGain.connect(rainGain);
    wind.start();
  }

  private createDrone(audioContext: AudioContext): void {
    const droneGain = this.layerGains.get('drone');
    if (!droneGain) {
      return;
    }

    AUDIO_PRESETS[this.preset].drone.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      const modulationOscillator = audioContext.createOscillator();
      const modulationGain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = [0.34, 0.2, 0.12][index];
      oscillator.connect(voiceGain);
      voiceGain.connect(droneGain);
      modulationOscillator.type = 'sine';
      modulationOscillator.frequency.value = 0.035 + index * 0.012;
      modulationGain.gain.value = 0.35;
      modulationOscillator.connect(modulationGain);
      modulationGain.connect(oscillator.frequency);
      oscillator.start();
      modulationOscillator.start();
      this.droneOscillators.push(oscillator);
    });
  }

  private scheduleThunder(): void {
    const delay = (18 + randomUnit() * 27) * 1000;
    globalThis.setTimeout(() => {
      this.rollThunder();
      this.scheduleThunder();
    }, delay);
  }

  private rollThunder(): void {
    const audioContext = this.audioContext;
    const destination = this.layerGains.get('thunder');
    if (
      !this.enabled ||
      !audioContext ||
      !destination ||
      !this.noiseBuffer ||
      this.levels.thunder <= 0 ||
      audioContext.state !== 'running'
    ) {
      return;
    }

    playThunder(audioContext, destination, this.noiseBuffer);
  }
}
