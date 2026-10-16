import type { Activity, ActivityContext } from '../../core/activity';

interface FloatingShape {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  hue: number;
}

function randomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

class MeadowActivity implements Activity {
  private readonly context: CanvasRenderingContext2D;
  private readonly shapes: FloatingShape[] = [];
  private readonly reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  private frameId = 0;
  private width = 0;
  private height = 0;
  private pointerX = -1000;
  private pointerY = -1000;
  private pointerInside = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('This browser could not create a canvas rendering context.');
    }
    this.context = context;
  }

  start(): void {
    this.resize();
    this.createShapes();
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.frameId = requestAnimationFrame(this.draw);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private readonly resize = (): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = bounds.width;
    this.height = bounds.height;
    this.canvas.width = Math.round(this.width * pixelRatio);
    this.canvas.height = Math.round(this.height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (this.shapes.length > 0) {
      this.createShapes();
    }
  };

  private createShapes(): void {
    this.shapes.length = 0;
    const count = Math.max(18, Math.min(34, Math.round(this.width / 32)));
    for (let index = 0; index < count; index += 1) {
      this.shapes.push({
        x: randomUnit() * this.width,
        y: randomUnit() * this.height,
        radius: 12 + randomUnit() * 38,
        phase: randomUnit() * Math.PI * 2,
        drift: 0.16 + randomUnit() * 0.4,
        hue: 80 + randomUnit() * 70,
      });
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - bounds.left;
    this.pointerY = event.clientY - bounds.top;
    this.pointerInside = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
  };

  private readonly draw = (time: number): void => {
    const { context, width, height } = this;
    context.clearRect(0, 0, width, height);

    for (const shape of this.shapes) {
      const drift = this.reducedMotion.matches ? 0 : shape.drift;
      const floatX = Math.sin(time * 0.00022 * drift + shape.phase) * 13;
      const floatY = Math.cos(time * 0.00018 * drift + shape.phase) * 11;
      let x = shape.x + floatX;
      let y = shape.y + floatY;

      if (this.pointerInside && !this.reducedMotion.matches) {
        const dx = x - this.pointerX;
        const dy = y - this.pointerY;
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / 170) * 14;
        if (distance > 0) {
          x += (dx / distance) * influence;
          y += (dy / distance) * influence;
        }
      }

      const gradient = context.createRadialGradient(
        x - shape.radius * 0.25,
        y - shape.radius * 0.3,
        1,
        x,
        y,
        shape.radius,
      );
      gradient.addColorStop(0, `hsla(${shape.hue}, 42%, 78%, 0.42)`);
      gradient.addColorStop(1, `hsla(${shape.hue}, 35%, 72%, 0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, shape.radius, 0, Math.PI * 2);
      context.fill();
    }

    this.frameId = requestAnimationFrame(this.draw);
  };
}

export function createActivity({ canvas }: ActivityContext): Activity {
  return new MeadowActivity(canvas);
}
