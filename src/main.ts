import { loadActivity, type ActivityId } from './core/activityRegistry';
import type { ThemePreset } from './core/theme';
import {
  AUDIO_LAYERS,
  parseRoomSettings,
  serializeRoomSettings,
  type AudioLayer,
} from './core/roomSettings';
import { AmbientAudioEngine } from './audio/AmbientAudioEngine';
import './styles.css';

const canvasElement = document.querySelector<HTMLCanvasElement>('#activity-canvas');
const soundButtonElement = document.querySelector<HTMLButtonElement>('#sound-toggle');
const fullscreenButtonElement =
  document.querySelector<HTMLButtonElement>('#fullscreen-toggle');
const experienceElement = document.querySelector<HTMLElement>('.page-shell');
const statusElement = document.querySelector<HTMLElement>('#activity-status');
const controlsToggleElement =
  document.querySelector<HTMLButtonElement>('#controls-toggle');
const controlDockElement = document.querySelector<HTMLElement>('#control-dock');
const timerDurationElement =
  document.querySelector<HTMLSelectElement>('#timer-duration');
const shareButtonElement =
  document.querySelector<HTMLButtonElement>('#share-settings');
const layerSliders =
  document.querySelectorAll<HTMLInputElement>('input[data-layer]');

if (
  !canvasElement ||
  !soundButtonElement ||
  !fullscreenButtonElement ||
  !experienceElement ||
  !statusElement ||
  !controlsToggleElement ||
  !controlDockElement ||
  !timerDurationElement ||
  !shareButtonElement
) {
  throw new Error('The activity page is missing a required interface element.');
}

const canvas: HTMLCanvasElement = canvasElement;
const soundButton: HTMLButtonElement = soundButtonElement;
const fullscreenButton: HTMLButtonElement = fullscreenButtonElement;
const experience: HTMLElement = experienceElement;
const status: HTMLElement = statusElement;
const controlsToggle: HTMLButtonElement = controlsToggleElement;
const controlDock: HTMLElement = controlDockElement;
const timerDuration: HTMLSelectElement = timerDurationElement;
const shareButton: HTMLButtonElement = shareButtonElement;

const ambientAudio = new AmbientAudioEngine();
const validThemes: ThemePreset[] = ['meadow', 'dusk', 'mist', 'nightfall'];

function syncRoomHash(): void {
  const theme = document.documentElement.dataset.theme;
  const levels: Record<AudioLayer, number> = {
    rain: 0.32,
    drone: 0.55,
    chimes: 0.7,
  };
  layerSliders.forEach((slider) => {
    const layer = slider.dataset.layer;
    if (layer && AUDIO_LAYERS.includes(layer as AudioLayer)) {
      levels[layer as AudioLayer] = Number(slider.value);
    }
  });
  const hash = serializeRoomSettings({
    theme: validThemes.find((preset) => preset === theme) ?? 'meadow',
    timer: timerDuration.value as '5' | '10' | '20' | '30',
    levels,
  });
  globalThis.history.replaceState(
    null,
    '',
    `${globalThis.location.pathname}${globalThis.location.search}${hash}`,
  );
}

function setStatus(message: string): void {
  status.textContent = message;
}

function updateSoundButton(enabled: boolean): void {
  soundButton.setAttribute('aria-pressed', String(enabled));
  const state = soundButton.querySelector<HTMLElement>('.toggle-state');
  if (state) {
    state.textContent = enabled ? 'On' : 'Off';
  }
}

async function toggleSound(): Promise<void> {
  try {
    const enabled = await ambientAudio.toggle();
    updateSoundButton(enabled);
    setStatus(enabled ? 'Ambient sound is gently playing.' : 'Ambient sound is off.');
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Ambient sound could not be started.',
    );
  }
}

function updateControlsVisibility(visible: boolean): void {
  controlDock.classList.toggle('is-hidden', !visible);
  controlDock.inert = !visible;
  controlDock.setAttribute('aria-hidden', String(!visible));
  controlsToggle.setAttribute('aria-expanded', String(visible));
  controlsToggle.textContent = visible ? 'Hide controls' : 'Show controls';
}

let autoHideTimer: number | undefined;

function scheduleControlsHide(): void {
  if (globalThis.matchMedia('(hover: none)').matches || controlDock.inert) {
    return;
  }
  if (autoHideTimer !== undefined) {
    globalThis.clearTimeout(autoHideTimer);
  }
  autoHideTimer = globalThis.setTimeout(() => {
    if (!controlDock.contains(document.activeElement)) {
      updateControlsVisibility(false);
    }
  }, 5000);
}

function showControlsFromMouse(): void {
  if (globalThis.matchMedia('(hover: none)').matches) {
    return;
  }
  updateControlsVisibility(true);
  scheduleControlsHide();
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await experience.requestFullscreen();
    }
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Full screen could not be changed.',
    );
  }
}

soundButton.addEventListener('click', () => void toggleSound());
fullscreenButton.addEventListener('click', () => void toggleFullscreen());
controlsToggle.addEventListener('click', () => {
  const shouldShow = controlDock.inert;
  updateControlsVisibility(shouldShow);
  if (shouldShow) {
    scheduleControlsHide();
  }
});
document.addEventListener('pointermove', (event: PointerEvent) => {
  if (event.pointerType === 'mouse') {
    showControlsFromMouse();
  }
});
controlDock.addEventListener('focusin', () => updateControlsVisibility(true));
controlDock.addEventListener('focusout', () => {
  globalThis.setTimeout(scheduleControlsHide, 0);
});
timerDuration.addEventListener('change', syncRoomHash);

layerSliders.forEach((slider) => {
  const layer = slider.dataset.layer;
  if (!layer || !AUDIO_LAYERS.includes(layer as AudioLayer)) {
    return;
  }
  const audioLayer = layer as AudioLayer;
  slider.addEventListener('input', () => {
    ambientAudio.setLevel(audioLayer, Number(slider.value));
    syncRoomHash();
  });
});

document.addEventListener('unwind:themechange', syncRoomHash);
shareButton.addEventListener('click', () => {
  if (!navigator.clipboard) {
    setStatus('Copying room links is not available in this browser context.');
    return;
  }
  void navigator.clipboard.writeText(globalThis.location.href).then(
    () => setStatus('Room link copied.'),
    (error: unknown) => {
      setStatus(
        error instanceof Error ? error.message : 'Room link could not be copied.',
      );
    },
  );
});

document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement === experience;
  fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
});

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable ||
      event.target instanceof HTMLButtonElement ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
  ) {
    return;
  }
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    void toggleSound();
  } else if (event.key.toLowerCase() === 'f') {
    void toggleFullscreen();
  }
});

const activityId: ActivityId = 'meadow';
const roomState = parseRoomSettings(globalThis.location.hash);
document.documentElement.dataset.theme = roomState.theme;
timerDuration.value = roomState.timer;
layerSliders.forEach((slider) => {
  const layer = slider.dataset.layer;
  if (layer && AUDIO_LAYERS.includes(layer as AudioLayer)) {
    const audioLayer = layer as AudioLayer;
    slider.value = String(roomState.levels[audioLayer]);
    ambientAudio.setLevel(audioLayer, roomState.levels[audioLayer]);
  }
});
ambientAudio.setPreset(roomState.theme);
const activity = await loadActivity(activityId, {
  canvas,
  audio: ambientAudio,
  onAudioError: (error) => {
    setStatus(
      error instanceof Error
        ? error.message
        : 'Particle sound could not be played.',
    );
  },
});
activity.setPreset(roomState.theme);
activity.start();
window.addEventListener('pagehide', () => activity.dispose(), { once: true });

const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
if (import.meta.env.PROD && 'serviceWorker' in navigator && manifestLink) {
  try {
    await navigator.serviceWorker.register(new URL('sw.js', manifestLink.href));
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Offline support could not be enabled.',
    );
  }
}

syncRoomHash();
scheduleControlsHide();

globalThis.addEventListener('hashchange', () => {
  const settings = parseRoomSettings(globalThis.location.hash);
  timerDuration.value = settings.timer;
  timerDuration.dispatchEvent(new Event('change', { bubbles: true }));
  layerSliders.forEach((slider) => {
    const layer = slider.dataset.layer;
    if (layer && AUDIO_LAYERS.includes(layer as AudioLayer)) {
      const audioLayer = layer as AudioLayer;
      slider.value = String(settings.levels[audioLayer]);
      ambientAudio.setLevel(audioLayer, settings.levels[audioLayer]);
    }
  });
  activity.setPreset(settings.theme);
});
