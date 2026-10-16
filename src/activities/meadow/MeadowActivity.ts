import type { Activity, ActivityAudio, ActivityContext } from '../../core/activity';

interface FloatingShape {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  hue: number;
  noteIndex: number;
  renderX: number;
  renderY: number;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  isHovered: boolean;
}

const MAX_POINTER_SPEED = 1.5;

function randomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4294967296;
}

class MeadowActivity implements Activity {
  private readonly context: CanvasRenderingContext2D;
  private readonly shapes: FloatingShape[] = [];
  private readonly reducedMotion = globalThis.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );
  private frameId = 0;
  private width = 0;
  private height = 0;
  private pointerX = -1000;
  private pointerY = -1000;
  private previousPointerX = -1000;
  private previousPointerY = -1000;
  private pointerInside = false;
  private pointerSpeed = 0;
  private previousPointerTime = 0;
  private previousFrameTime = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly audio: ActivityAudio,
    private readonly onAudioError: (error: unknown) => void,
  ) {
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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.frameId = requestAnimationFrame(this.draw);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
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
        noteIndex: Math.floor(randomUnit() * 5),
        renderX: 0,
        renderY: 0,
        offsetX: 0,
        offsetY: 0,
        velocityX: 0,
        velocityY: 0,
        isHovered: false,
      });
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - bounds.left;
    this.pointerY = event.clientY - bounds.top;
    this.pointerInside = true;
    if (this.previousPointerTime > 0) {
      const elapsed = Math.max(event.timeStamp - this.previousPointerTime, 1);
      const distance = Math.hypot(
        this.pointerX - this.previousPointerX,
        this.pointerY - this.previousPointerY,
      );
      this.pointerSpeed = Math.min(distance / elapsed / MAX_POINTER_SPEED, 1);
    }
    this.previousPointerX = this.pointerX;
    this.previousPointerY = this.pointerY;
    this.previousPointerTime = event.timeStamp;
    void this.audio.resumeFromGesture().catch(this.onAudioError);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const shape = this.shapes.find(
      (candidate) =>
        Math.hypot(candidate.renderX - x, candidate.renderY - y) <=
        candidate.radius,
    );
    if (shape) {
      void this.audio
        .playParticleTone(shape.noteIndex, this.pointerSpeed)
        .catch(this.onAudioError);
    }
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.pointerSpeed = 0;
    this.previousPointerTime = 0;
  };

  private readonly draw = (time: number): void => {
    const { context, width, height } = this;
    const deltaTime = this.previousFrameTime
      ? Math.min((time - this.previousFrameTime) / 1000, 0.05)
      : 0;
    this.previousFrameTime = time;
    context.clearRect(0, 0, width, height);

    for (const shape of this.shapes) {
      const drift = this.reducedMotion.matches ? 0 : shape.drift;
      const floatX = Math.sin(time * 0.00022 * drift + shape.phase) * 13;
      const floatY = Math.cos(time * 0.00018 * drift + shape.phase) * 11;
      const baseX = shape.x + floatX;
      const baseY = shape.y + floatY;
      const dx = baseX + shape.offsetX - this.pointerX;
      const dy = baseY + shape.offsetY - this.pointerY;
      const distance = Math.hypot(dx, dy);
      const influence =
        this.pointerInside && !this.reducedMotion.matches
          ? Math.max(0, 1 - distance / 150) * 42
          : 0;

      if (deltaTime > 0) {
        shape.velocityX +=
          ((distance > 0 ? (dx / distance) * influence : 0) -
            shape.offsetX * 2.2 -
            shape.velocityX * 2.5) *
          deltaTime;
        shape.velocityY +=
          ((distance > 0 ? (dy / distance) * influence : 0) -
            shape.offsetY * 2.2 -
            shape.velocityY * 2.5) *
          deltaTime;
        shape.velocityX = Math.max(-24, Math.min(24, shape.velocityX));
        shape.velocityY = Math.max(-24, Math.min(24, shape.velocityY));
        shape.offsetX = Math.max(
          -40,
          Math.min(40, shape.offsetX + shape.velocityX * deltaTime),
        );
        shape.offsetY = Math.max(
          -40,
          Math.min(40, shape.offsetY + shape.velocityY * deltaTime),
        );
      }

      const x = baseX + shape.offsetX;
      const y = baseY + shape.offsetY;
      shape.renderX = x;
      shape.renderY = y;
      const isHovered =
        this.pointerInside &&
        Math.hypot(x - this.pointerX, y - this.pointerY) <= shape.radius;
      if (isHovered && !shape.isHovered) {
        void this.audio
          .playParticleTone(shape.noteIndex, this.pointerSpeed)
          .catch(this.onAudioError);
      }
      shape.isHovered = isHovered;

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

export function createActivity({
  canvas,
  audio,
  onAudioError,
}: ActivityContext): Activity {
  return new MeadowActivity(canvas, audio, onAudioError);
}
