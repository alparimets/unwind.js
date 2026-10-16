import type { Activity, ActivityAudio, ActivityContext } from '../../core/activity';
import { randomUnit } from '../../core/random';
import { isThemePreset, type ThemePreset } from '../../core/theme';
import { drawConstellations } from './constellations';
import { sampleTextPoints, ThoughtCloud } from './thoughtCloud';
import { WindTrail } from './windTrail';

interface FloatingShape {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  noteIndex: number;
  renderX: number;
  renderY: number;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  isHovered: boolean;
  rippleStartedAt: number | undefined;
  hueVariant: number;
  depth: number;
}

const MAX_POINTER_SPEED = 1.5;
const DEPTH_SCALE = [0.55, 0.78, 1];
const DEPTH_MOTION = [0.35, 0.65, 1];
const RIPPLE_DURATION = 1.1;
const THEME_COLORS: Record<
  ThemePreset,
  {
    hueMin: number;
    hueMax: number;
    saturation: number;
    lightness: number;
    isDark: boolean;
  }
> = {
  dawn: { hueMin: 342, hueMax: 395, saturation: 62, lightness: 80, isDark: false },
  meadow: { hueMin: 80, hueMax: 150, saturation: 42, lightness: 78, isDark: false },
  dusk: { hueMin: 32, hueMax: 48, saturation: 58, lightness: 78, isDark: true },
  mist: { hueMin: 188, hueMax: 208, saturation: 22, lightness: 78, isDark: false },
  nightfall: { hueMin: 158, hueMax: 205, saturation: 76, lightness: 69, isDark: true },
};

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
  private resizeObserver: ResizeObserver | undefined;
  private readonly windTrail = new WindTrail();
  private readonly thoughtCloud = new ThoughtCloud();
  private isDragging = false;
  private twinkle = false;
  private preset: ThemePreset = 'meadow';
  private breathPhases = [
    { label: 'Breathe in', duration: 4000, scale: 1.14 },
    { label: 'Hold gently', duration: 7000, scale: 1.14 },
    { label: 'Breathe out', duration: 8000, scale: 0.76 },
  ];
  private breathStart: number | undefined;
  private breathFrame = 0;
  private breathPhaseIndex = -1;
  private readonly breathToggle =
    document.querySelector<HTMLButtonElement>('#breath-toggle');
  private readonly breathOrb =
    document.querySelector<HTMLElement>('#breath-orb');
  private readonly breathPhase =
    document.querySelector<HTMLElement>('#breath-phase');
  private readonly breathPattern =
    document.querySelector<HTMLSelectElement>('#breath-pattern');
  private readonly timerToggle =
    document.querySelector<HTMLButtonElement>('#timer-toggle');
  private readonly timerReset =
    document.querySelector<HTMLButtonElement>('#timer-reset');
  private readonly sessionTime =
    document.querySelector<HTMLOutputElement>('#session-time');
  private readonly themeButtons =
    document.querySelectorAll<HTMLButtonElement>('.theme-button[data-theme]');
  private timerStartedAt: number | undefined;
  private remainingBeforeStart = 600_000;
  private timerInterval: number | undefined;

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
    this.remainingBeforeStart = this.getTimerDuration();
    this.breathToggle?.addEventListener('click', this.toggleBreathing);
    this.breathPattern?.addEventListener('change', this.onBreathPatternChange);
    this.timerDuration?.addEventListener('change', this.onTimerDurationChange);
    this.timerToggle?.addEventListener('click', this.toggleTimer);
    this.timerReset?.addEventListener('click', this.resetTimer);
    this.themeButtons.forEach((button) => {
      button.addEventListener('click', this.onThemeSelection);
    });
    this.updateSessionTime();
    globalThis.addEventListener('resize', this.resize);
    globalThis.visualViewport?.addEventListener('resize', this.resize);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.canvas);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerEnd);
    this.canvas.addEventListener('pointercancel', this.onPointerEnd);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.frameId = requestAnimationFrame(this.draw);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    cancelAnimationFrame(this.breathFrame);
    if (this.timerInterval !== undefined) {
      globalThis.clearInterval(this.timerInterval);
    }
    this.breathToggle?.removeEventListener('click', this.toggleBreathing);
    this.breathPattern?.removeEventListener('change', this.onBreathPatternChange);
    this.timerDuration?.removeEventListener('change', this.onTimerDurationChange);
    this.timerToggle?.removeEventListener('click', this.toggleTimer);
    this.timerReset?.removeEventListener('click', this.resetTimer);
    this.themeButtons.forEach((button) => {
      button.removeEventListener('click', this.onThemeSelection);
    });
    globalThis.removeEventListener('resize', this.resize);
    globalThis.visualViewport?.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerEnd);
    this.canvas.removeEventListener('pointercancel', this.onPointerEnd);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
  }

  setPreset(preset: ThemePreset): void {
    this.preset = preset;
    this.audio.setPreset(preset);
    document.documentElement.dataset.theme = preset;
    this.themeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.theme === preset));
    });
    document.dispatchEvent(new CustomEvent('unwind:themechange', { detail: preset }));
  }

  private readonly onThemeSelection = (event: MouseEvent): void => {
    const preset = (event.currentTarget as HTMLButtonElement).dataset.theme;
    if (isThemePreset(preset)) {
      this.setPreset(preset);
    }
  };

  releaseThought(text: string): void {
    const points = sampleTextPoints(text, this.width, this.height);
    this.thoughtCloud.release(points, performance.now(), !this.reducedMotion.matches);
  }

  setTwinkle(enabled: boolean): void {
    this.twinkle = enabled;
  }

  private readonly onBreathPatternChange = (): void => {
    this.breathPhases = this.getBreathPhases();
    if (this.breathStart !== undefined) {
      this.breathStart = performance.now();
      this.breathPhaseIndex = -1;
    }
  };

  private getBreathPhases(): typeof this.breathPhases {
    switch (this.breathPattern?.value) {
      case 'box':
        return [
          { label: 'Breathe in', duration: 4000, scale: 1.14 },
          { label: 'Hold gently', duration: 4000, scale: 1.14 },
          { label: 'Breathe out', duration: 4000, scale: 0.76 },
          { label: 'Rest softly', duration: 4000, scale: 0.76 },
        ];
      case 'calm':
        return [
          { label: 'Breathe in', duration: 2000, scale: 1.14 },
          { label: 'Pause gently', duration: 1000, scale: 1.14 },
          { label: 'Breathe out', duration: 4000, scale: 0.76 },
        ];
      default:
        return [
          { label: 'Breathe in', duration: 4000, scale: 1.14 },
          { label: 'Hold gently', duration: 7000, scale: 1.14 },
          { label: 'Breathe out', duration: 8000, scale: 0.76 },
        ];
    }
  }

  private readonly toggleBreathing = (): void => {
    if (this.breathStart === undefined) {
      this.breathStart = performance.now();
      this.breathPhaseIndex = -1;
      if (this.breathToggle) {
        this.breathToggle.textContent = 'Stop breathing guide';
        this.breathToggle.setAttribute('aria-pressed', 'true');
      }
      this.breathFrame = requestAnimationFrame(this.updateBreathing);
      return;
    }

    this.breathStart = undefined;
    cancelAnimationFrame(this.breathFrame);
    this.breathPhaseIndex = -1;
    if (this.breathToggle) {
      this.breathToggle.textContent = 'Start breathing';
      this.breathToggle.setAttribute('aria-pressed', 'false');
    }
    if (this.breathPhase) {
      this.breathPhase.textContent = 'Ready when you are.';
    }
    if (this.breathOrb) {
      this.breathOrb.style.transitionDuration = '700ms';
      this.breathOrb.style.transform = 'scale(0.76)';
    }
  };

  private readonly updateBreathing = (time: number): void => {
    if (this.breathStart === undefined) {
      return;
    }

    const cycleDuration = this.breathPhases.reduce(
      (total, phase) => total + phase.duration,
      0,
    );
    const elapsedInCycle = (time - this.breathStart) % cycleDuration;
    let phaseStart = 0;
    const phaseIndex = this.breathPhases.findIndex((phase) => {
      const phaseEnd = phaseStart + phase.duration;
      const isCurrentPhase = elapsedInCycle < phaseEnd;
      phaseStart = phaseEnd;
      return isCurrentPhase;
    });
    const phase = this.breathPhases[phaseIndex];

    if (phaseIndex !== this.breathPhaseIndex) {
      this.breathPhaseIndex = phaseIndex;
      if (this.breathPhase) {
        this.breathPhase.textContent = phase.label;
      }
      if (this.breathOrb) {
        this.breathOrb.style.transitionDuration = `${phase.duration}ms`;
        this.breathOrb.style.transform = `scale(${phase.scale})`;
      }
    }

    this.breathFrame = requestAnimationFrame(this.updateBreathing);
  };

  private readonly toggleTimer = (): void => {
    if (this.timerStartedAt === undefined) {
      if (this.remainingBeforeStart <= 0) {
        this.remainingBeforeStart = this.getTimerDuration();
      }
      this.timerStartedAt = performance.now();
      this.timerInterval = globalThis.setInterval(this.updateSessionTime, 1000);
      if (this.timerToggle) {
        this.timerToggle.textContent = 'Pause timer';
      }
      this.updateSessionTime();
      return;
    }

    this.remainingBeforeStart = Math.max(
      0,
      this.remainingBeforeStart - (performance.now() - this.timerStartedAt),
    );
    this.timerStartedAt = undefined;
    if (this.timerInterval !== undefined) {
      globalThis.clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    if (this.timerToggle) {
      this.timerToggle.textContent = 'Resume timer';
    }
    this.updateSessionTime();
  };

  private readonly resetTimer = (): void => {
    this.remainingBeforeStart = this.getTimerDuration();
    this.timerStartedAt = undefined;
    if (this.timerInterval !== undefined) {
      globalThis.clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    if (this.timerToggle) {
      this.timerToggle.textContent = 'Start timer';
    }
    this.updateSessionTime();
  };

  private readonly timerDuration =
    document.querySelector<HTMLSelectElement>('#timer-duration');

  private getTimerDuration(): number {
    return Number(this.timerDuration?.value ?? 10) * 60_000;
  }

  private readonly onTimerDurationChange = (): void => {
    if (this.timerInterval !== undefined) {
      globalThis.clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.timerStartedAt = undefined;
    if (this.timerToggle) {
      this.timerToggle.textContent = 'Start timer';
    }
    this.remainingBeforeStart = this.getTimerDuration();
    this.updateSessionTime();
  };

  private readonly updateSessionTime = (): void => {
    if (!this.sessionTime) {
      return;
    }
    const remaining =
      this.timerStartedAt === undefined
        ? this.remainingBeforeStart
        : Math.max(
            0,
            this.remainingBeforeStart - (performance.now() - this.timerStartedAt),
          );
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    this.sessionTime.textContent = `${minutes}:${seconds}`;
    if (remaining <= 0 && this.timerStartedAt !== undefined) {
      this.timerStartedAt = undefined;
      this.remainingBeforeStart = 0;
      if (this.timerInterval !== undefined) {
        globalThis.clearInterval(this.timerInterval);
        this.timerInterval = undefined;
      }
      if (this.timerToggle) {
        this.timerToggle.textContent = 'Start timer';
      }
    }
  };

  private readonly resize = (): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const previousWidth = this.width;
    const previousHeight = this.height;
    const sizeChanged = bounds.width !== previousWidth || bounds.height !== previousHeight;
    this.width = bounds.width;
    this.height = bounds.height;
    const canvasWidth = Math.round(this.width * pixelRatio);
    const canvasHeight = Math.round(this.height * pixelRatio);
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
    }
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (this.shapes.length > 0) {
      if (sizeChanged && previousWidth > 0 && previousHeight > 0) {
        this.shapes.forEach((shape) => {
          shape.x *= this.width / previousWidth;
          shape.y *= this.height / previousHeight;
        });
      }
      this.resizeShapes();
    }
  };

  private createShapes(): void {
    this.shapes.length = 0;
    this.resizeShapes();
  }

  private resizeShapes(): void {
    const maxCount = globalThis.matchMedia('(max-width: 767px)').matches ? 28 : 34;
    const count = Math.max(18, Math.min(maxCount, Math.round(this.width / 32)));
    while (this.shapes.length > count) {
      this.shapes.pop();
    }
    while (this.shapes.length < count) {
      this.shapes.push({
        x: randomUnit() * this.width,
        y: randomUnit() * this.height,
        radius: 12 + randomUnit() * 38,
        phase: randomUnit() * Math.PI * 2,
        drift: 0.16 + randomUnit() * 0.4,
        noteIndex: Math.floor(randomUnit() * 5),
        renderX: 0,
        renderY: 0,
        offsetX: 0,
        offsetY: 0,
        velocityX: 0,
        velocityY: 0,
        isHovered: false,
        rippleStartedAt: undefined,
        hueVariant: randomUnit(),
        depth: Math.floor(randomUnit() * DEPTH_SCALE.length),
      });
    }
    this.shapes.sort((left, right) => left.depth - right.depth);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - bounds.left;
    this.pointerY = event.clientY - bounds.top;
    this.pointerInside =
      this.pointerX >= 0 &&
      this.pointerY >= 0 &&
      this.pointerX <= bounds.width &&
      this.pointerY <= bounds.height;
    if (this.previousPointerTime > 0) {
      const elapsed = Math.max(event.timeStamp - this.previousPointerTime, 1);
      const deltaX = this.pointerX - this.previousPointerX;
      const deltaY = this.pointerY - this.previousPointerY;
      const distance = Math.hypot(deltaX, deltaY);
      this.pointerSpeed = Math.min(distance / elapsed / MAX_POINTER_SPEED, 1);
      this.extendTrail(deltaX, deltaY, elapsed, event.timeStamp);
    }
    this.previousPointerX = this.pointerX;
    this.previousPointerY = this.pointerY;
    this.previousPointerTime = event.timeStamp;
  };

  private extendTrail(
    deltaX: number,
    deltaY: number,
    elapsed: number,
    time: number,
  ): void {
    if (!this.isDragging || !this.pointerInside) {
      return;
    }
    this.windTrail.add(
      this.pointerX,
      this.pointerY,
      (deltaX / elapsed) * 1000,
      (deltaY / elapsed) * 1000,
      time,
    );
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    this.pointerX = x;
    this.pointerY = y;
    this.pointerInside = x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height;
    this.isDragging = true;
    this.previousPointerX = x;
    this.previousPointerY = y;
    this.previousPointerTime = event.timeStamp;
    void this.audio.resumeFromGesture().catch(this.onAudioError);
    const shape = [...this.shapes].reverse().find((candidate) => {
      const radius = candidate.radius * DEPTH_SCALE[candidate.depth];
      return Math.hypot(candidate.renderX - x, candidate.renderY - y) <= radius;
    });
    if (shape) {
      shape.isHovered = true;
      shape.rippleStartedAt = this.reducedMotion.matches
        ? undefined
        : event.timeStamp;
      void this.audio
        .playSingingBowl(shape.noteIndex, shape.renderX / Math.max(this.width, 1))
        .catch(this.onAudioError);
    }
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    this.isDragging = false;
    if (event.type !== 'pointercancel' && event.pointerType !== 'touch') {
      return;
    }

    this.pointerInside = false;
    this.pointerSpeed = 0;
    this.previousPointerTime = 0;
    this.shapes.forEach((shape) => {
      shape.isHovered = false;
    });
  };

  private readonly onPointerLeave = (): void => {
    this.isDragging = false;
    this.pointerInside = false;
    this.pointerSpeed = 0;
    this.previousPointerTime = 0;
  };

  private readonly draw = (time: number): void => {
    const deltaTime = this.previousFrameTime
      ? Math.min((time - this.previousFrameTime) / 1000, 0.05)
      : 0;
    this.previousFrameTime = time;
    this.pointerSpeed *= Math.exp(-deltaTime * 2);
    this.context.clearRect(0, 0, this.width, this.height);
    this.shapes.forEach((shape) => this.drawShape(shape, time, deltaTime));
    this.drawOverlays(time);
    this.frameId = requestAnimationFrame(this.draw);
  };

  private drawOverlays(time: number): void {
    const themeColors = THEME_COLORS[this.preset];
    const hue = (themeColors.hueMin + themeColors.hueMax) / 2;
    drawConstellations(
      this.context,
      this.shapes.map((shape) => ({
        x: shape.renderX,
        y: shape.renderY,
        seed: shape.hueVariant,
      })),
      {
        time,
        hue,
        isDark: themeColors.isDark,
        isStatic: this.reducedMotion.matches,
      },
    );
    if (this.reducedMotion.matches) {
      this.windTrail.clear();
    } else {
      this.windTrail.draw(this.context, time, themeColors.isDark);
    }
    this.thoughtCloud.draw(this.context, time, themeColors.isDark);
  }

  private getForce(
    dx: number,
    dy: number,
    distance: number,
    depthMotion: number,
    flow: { x: number; y: number },
  ): { x: number; y: number } {
    const animated = !this.reducedMotion.matches;
    const influence =
      this.pointerInside && animated
        ? Math.max(0, 1 - distance / 150) * 42 * depthMotion
        : 0;
    const directionX = distance > 0 ? dx / distance : 0;
    const directionY = distance > 0 ? dy / distance : 0;
    const windScale = animated ? depthMotion : 0;
    return {
      x: directionX * influence + flow.x * windScale,
      y: directionY * influence + flow.y * windScale,
    };
  }

  private drawShape(
    shape: FloatingShape,
    time: number,
    deltaTime: number,
  ): void {
    const depthMotion = DEPTH_MOTION[shape.depth];
    const radius = shape.radius * DEPTH_SCALE[shape.depth];
    const drift = this.reducedMotion.matches ? 0 : shape.drift;
    const baseX =
      shape.x + Math.sin(time * 0.00022 * drift + shape.phase) * 13 * depthMotion;
    const baseY =
      shape.y + Math.cos(time * 0.00018 * drift + shape.phase) * 11 * depthMotion;
    const dx = baseX + shape.offsetX - this.pointerX;
    const dy = baseY + shape.offsetY - this.pointerY;
    const distance = Math.hypot(dx, dy);
    const flow = this.windTrail.flowAt(
      baseX + shape.offsetX,
      baseY + shape.offsetY,
      time,
    );
    const force = this.getForce(dx, dy, distance, depthMotion, flow);
    this.updatePhysics(shape, force.x, force.y, deltaTime);

    const x = baseX + shape.offsetX;
    const y = baseY + shape.offsetY;
    shape.renderX = x;
    shape.renderY = y;
    this.updateHover(shape, x, y, radius, time);

    const themeColors = THEME_COLORS[this.preset];
    const hue =
      themeColors.hueMin +
      shape.hueVariant * (themeColors.hueMax - themeColors.hueMin);
    const depthOpacity = [0.48, 0.68, 0.9][shape.depth] * this.getFlicker(shape, time);
    this.drawParticle(x, y, radius, hue, themeColors.saturation, depthOpacity);
    this.drawRipple(
      shape,
      x,
      y,
      radius,
      hue,
      themeColors.saturation,
      time,
    );
  }

  private getFlicker(shape: FloatingShape, time: number): number {
    if (
      !this.twinkle ||
      this.preset !== 'nightfall' ||
      this.reducedMotion.matches
    ) {
      return 1;
    }
    const wave =
      0.5 + 0.5 * Math.sin(time * 0.0011 * (0.6 + shape.drift) + shape.phase * 5);
    return 0.25 + 0.75 * wave ** 3;
  }

  private updatePhysics(
    shape: FloatingShape,
    forceX: number,
    forceY: number,
    deltaTime: number,
  ): void {
    if (deltaTime <= 0) {
      return;
    }

    shape.velocityX +=
      (forceX - shape.offsetX * 2.2 - shape.velocityX * 2.5) * deltaTime;
    shape.velocityY +=
      (forceY - shape.offsetY * 2.2 - shape.velocityY * 2.5) * deltaTime;
    shape.velocityX = Math.max(-36, Math.min(36, shape.velocityX));
    shape.velocityY = Math.max(-36, Math.min(36, shape.velocityY));
    shape.offsetX = Math.max(
      -60,
      Math.min(60, shape.offsetX + shape.velocityX * deltaTime),
    );
    shape.offsetY = Math.max(
      -60,
      Math.min(60, shape.offsetY + shape.velocityY * deltaTime),
    );
  }

  private updateHover(
    shape: FloatingShape,
    x: number,
    y: number,
    radius: number,
    time: number,
  ): void {
    const isHovered =
      this.pointerInside &&
      Math.hypot(x - this.pointerX, y - this.pointerY) <= radius;
    if (isHovered && !shape.isHovered) {
      shape.rippleStartedAt = this.reducedMotion.matches ? undefined : time;
      void this.audio
        .playParticleTone(
          shape.noteIndex,
          this.pointerSpeed,
          shape.renderX / Math.max(this.width, 1),
        )
        .catch(this.onAudioError);
    }
    shape.isHovered = isHovered;
  }

  private drawParticle(
    x: number,
    y: number,
    radius: number,
    hue: number,
    saturation: number,
    depthOpacity: number,
  ): void {
    const gradient = this.context.createRadialGradient(
      x - radius * 0.25,
      y - radius * 0.3,
      1,
      x,
      y,
      radius,
    );
    gradient.addColorStop(
      0,
      `hsla(${hue}, ${saturation}%, 78%, ${0.42 * depthOpacity})`,
    );
    gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, 72%, 0)`);
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.fill();

    if (this.preset === 'nightfall') {
      this.context.beginPath();
      this.context.arc(x, y, Math.max(1, radius * 0.08), 0, Math.PI * 2);
      this.context.fillStyle = `hsla(${hue}, 92%, 88%, ${0.72 * depthOpacity})`;
      this.context.fill();
    }
  }

  private drawRipple(
    shape: FloatingShape,
    x: number,
    y: number,
    radius: number,
    hue: number,
    saturation: number,
    time: number,
  ): void {
    if (shape.rippleStartedAt === undefined) {
      return;
    }

    const age = (time - shape.rippleStartedAt) / 1000;
    if (age >= RIPPLE_DURATION) {
      shape.rippleStartedAt = undefined;
      return;
    }
    if (age < 0) {
      return;
    }

    this.context.beginPath();
    this.context.arc(x, y, radius * (0.72 + age * 1.2), 0, Math.PI * 2);
    this.context.strokeStyle = `hsla(${hue}, ${saturation}%, 76%, ${
      0.34 * (1 - age / RIPPLE_DURATION)
    })`;
    this.context.lineWidth = 1.5;
    this.context.stroke();
  }
};

export function createActivity({
  canvas,
  audio,
  onAudioError,
}: ActivityContext): Activity {
  return new MeadowActivity(canvas, audio, onAudioError);
}
