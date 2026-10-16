export interface ActivityContext {
  canvas: HTMLCanvasElement;
}

export interface Activity {
  start(): void;
  dispose(): void;
}

export type ActivityModule = (context: ActivityContext) => Activity;
