import { randomUnit } from '../../core/random';

interface TrailPoint {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  bornAt: number;
  seed: number;
}

export const TRAIL_LIFE = 2400;
const MAX_POINTS = 96;
const MIN_SPACING = 5;
const INFLUENCE_RADIUS = 110;
const MAX_FLOW = 900;
const FLOW_STRENGTH = 140;
const MAX_SEGMENT_GAP = 160;

export class WindTrail {
  private points: TrailPoint[] = [];

  get size(): number {
    return this.points.length;
  }

  add(x: number, y: number, flowX: number, flowY: number, time: number): void {
    const last = this.points.at(-1);
    if (last && Math.hypot(x - last.x, y - last.y) < MIN_SPACING) {
      return;
    }
    const speed = Math.hypot(flowX, flowY);
    const scale = speed > MAX_FLOW ? MAX_FLOW / speed : 1;
    this.points.push({
      x,
      y,
      flowX: flowX * scale,
      flowY: flowY * scale,
      bornAt: time,
      seed: randomUnit(),
    });
    if (this.points.length > MAX_POINTS) {
      this.points.shift();
    }
  }

  prune(time: number): void {
    this.points = this.points.filter((point) => time - point.bornAt < TRAIL_LIFE);
  }

  clear(): void {
    this.points = [];
  }

  flowAt(x: number, y: number, time: number): { x: number; y: number } {
    let weightSum = 0;
    let flowX = 0;
    let flowY = 0;
    for (const point of this.points) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance >= INFLUENCE_RADIUS) {
        continue;
      }
      const age = (time - point.bornAt) / TRAIL_LIFE;
      const weight = (1 - distance / INFLUENCE_RADIUS) * Math.max(0, 1 - age);
      weightSum += weight;
      flowX += point.flowX * weight;
      flowY += point.flowY * weight;
    }
    if (weightSum <= 0) {
      return { x: 0, y: 0 };
    }
    const strength = (Math.min(weightSum, 1) * FLOW_STRENGTH) / (weightSum * MAX_FLOW);
    return { x: flowX * strength, y: flowY * strength };
  }

  draw(
    context: CanvasRenderingContext2D,
    time: number,
    isDark: boolean,
  ): void {
    this.prune(time);
    const lightness = isDark ? 86 : 96;
    context.lineCap = 'round';
    for (let index = 1; index < this.points.length; index += 1) {
      const from = this.points[index - 1];
      const to = this.points[index];
      if (to.bornAt - from.bornAt > MAX_SEGMENT_GAP) {
        continue;
      }
      const fade = Math.max(0, 1 - (time - to.bornAt) / TRAIL_LIFE);
      this.strokeSegment(context, from, to, `hsla(40, 80%, ${lightness}%, ${0.12 * fade})`, 9);
      this.strokeSegment(context, from, to, `hsla(40, 90%, ${lightness}%, ${0.4 * fade})`, 2);
    }
    this.drawDust(context, time, lightness);
  }

  private strokeSegment(
    context: CanvasRenderingContext2D,
    from: TrailPoint,
    to: TrailPoint,
    style: string,
    width: number,
  ): void {
    context.strokeStyle = style;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  private drawDust(
    context: CanvasRenderingContext2D,
    time: number,
    lightness: number,
  ): void {
    for (const point of this.points) {
      const age = (time - point.bornAt) / TRAIL_LIFE;
      const spread = age * 22 * (0.4 + point.seed);
      const angle = point.seed * Math.PI * 2;
      context.fillStyle = `hsla(42, 90%, ${lightness}%, ${0.35 * (1 - age)})`;
      context.beginPath();
      context.arc(
        point.x + Math.cos(angle) * spread,
        point.y + Math.sin(angle) * spread - age * 10,
        1 + point.seed * 1.4,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
}
