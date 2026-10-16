export interface ActivityContext {
  canvas: HTMLCanvasElement;
  audio: ActivityAudio;
  onAudioError(error: unknown): void;
}

export interface ActivityAudio {
  readonly isEnabled: boolean;
  resumeFromGesture(): Promise<void>;
  playParticleTone(noteIndex: number, pointerSpeed: number): Promise<void>;
}

export interface Activity {
  start(): void;
  dispose(): void;
}

export type ActivityModule = (context: ActivityContext) => Activity;
