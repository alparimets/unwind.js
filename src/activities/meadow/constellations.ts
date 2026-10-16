export interface ConstellationNode {
  x: number;
  y: number;
  seed: number;
}

export interface ConstellationOptions {
  time: number;
  hue: number;
  isDark: boolean;
  isStatic: boolean;
}

export const MAX_LINK_DISTANCE = 150;

export function linkAlpha(
  distance: number,
  pairPhase: number,
  options: Pick<ConstellationOptions, 'time' | 'isDark' | 'isStatic'>,
): number {
  if (distance >= MAX_LINK_DISTANCE) {
    return 0;
  }
  const pulse = options.isStatic
    ? 0.6
    : 0.5 + 0.5 * Math.sin(options.time * 0.0006 + pairPhase);
  const maxAlpha = options.isDark ? 0.22 : 0.26;
  return maxAlpha * (1 - distance / MAX_LINK_DISTANCE) * pulse;
}

export function drawConstellations(
  context: CanvasRenderingContext2D,
  nodes: readonly ConstellationNode[],
  options: ConstellationOptions,
): void {
  const lightness = options.isDark ? 85 : 58;
  context.lineWidth = 0.8;
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      const a = nodes[first];
      const b = nodes[second];
      const alpha = linkAlpha(
        Math.hypot(a.x - b.x, a.y - b.y),
        (a.seed + b.seed) * Math.PI * 2,
        options,
      );
      if (alpha <= 0.004) {
        continue;
      }
      context.strokeStyle = `hsla(${options.hue}, 40%, ${lightness}%, ${alpha})`;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }
}
