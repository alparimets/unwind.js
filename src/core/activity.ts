import type { AudioLayer } from './roomSettings';
import type { ThemePreset } from './theme';

export interface ActivityContext {
  canvas: HTMLCanvasElement;
  audio: ActivityAudio;
  onAudioError(error: unknown): void;
}

export interface ActivityAudio {
  readonly isEnabled: boolean;
  setPreset(preset: ThemePreset): void;
  setLevel(layer: AudioLayer, level: number): void;
  resumeFromGesture(): Promise<void>;
  playSingingBowl(
    noteIndex: number,
    horizontalPosition?: number,
  ): Promise<void>;
  playParticleTone(
    noteIndex: number,
    pointerSpeed: number,
    horizontalPosition?: number,
  ): Promise<void>;
}

export interface Activity {
  start(): void;
  setPreset(preset: ThemePreset): void;
  releaseThought(text: string): void;
  setTwinkle(enabled: boolean): void;
  dispose(): void;
}

export type ActivityModule = (context: ActivityContext) => Activity;
