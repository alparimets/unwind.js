import { randomUnit } from '../../core/random';

interface Mote {
  x: number;
  y: number;
  bornAt: number;
  delay: number;
  vx: number;
  vy: number;
  sway: number;
  size: number;
}

const MAX_POINTS = 700;
const HOLD = 1600;
const FADE_IN = 500;
const DRIFT = 6800;

export function sampleTextPoints(
  text: string,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return [];
  }

  const maxWidth = Math.min(width * 0.8, 720);
  let fontSize = Math.min(64, Math.max(22, width / 14));
  context.font = `600 ${fontSize}px Georgia, serif`;
  while (fontSize > 14 && context.measureText(text).width > maxWidth) {
    fontSize -= 2;
    context.font = `600 ${fontSize}px Georgia, serif`;
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#fff';
  context.fillText(text, width / 2, height * 0.45);

  const step = 3;
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      if (data[(y * canvas.width + x) * 4 + 3] > 128) {
        points.push({ x, y });
      }
    }
  }

  const stride = Math.max(1, Math.ceil(points.length / MAX_POINTS));
  return points.filter((_, index) => index % stride === 0);
}

export class ThoughtCloud {
  private motes: Mote[] = [];

  get size(): number {
    return this.motes.length;
  }

  release(
    points: readonly { x: number; y: number }[],
    time: number,
    animated: boolean,
  ): void {
    for (const point of points) {
      this.motes.push({
        x: point.x,
        y: point.y,
        bornAt: time,
        delay: animated ? randomUnit() * 1400 : 0,
        vx: animated ? 4 + randomUnit() * 14 : 0,
        vy: animated ? -(6 + randomUnit() * 16) : 0,
        sway: randomUnit() * Math.PI * 2,
        size: 1 + randomUnit() * 1.6,
      });
    }
  }

  draw(
    context: CanvasRenderingContext2D,
    time: number,
    isDark: boolean,
  ): void {
    this.motes = this.motes.filter(
      (mote) => time - mote.bornAt - mote.delay < HOLD + DRIFT,
    );
    const color = isDark ? '255, 244, 220' : '120, 96, 88';
    for (const mote of this.motes) {
      const age = time - mote.bornAt - mote.delay;
      if (age < 0) {
        continue;
      }
      const drift = Math.max(0, age - HOLD) / 1000;
      const alpha =
        Math.min(1, age / FADE_IN) * (1 - Math.max(0, age - HOLD) / DRIFT);
      const sway =
        mote.vx === 0 ? 0 : Math.sin(drift * 1.2 + mote.sway) * 6 * drift;
      const x = mote.x + mote.vx * drift + sway;
      const y = mote.y + mote.vy * drift;
      context.globalAlpha = Math.max(0, alpha) * 0.85;
      context.fillStyle = `rgb(${color})`;
      context.beginPath();
      context.arc(x, y, mote.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }
}
