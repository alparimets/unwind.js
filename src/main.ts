import { loadActivity, type ActivityId } from './core/activityRegistry';
import type { Activity } from './core/activity';
import { themeForHour } from './core/atmosphere';
import { isThemePreset, type ThemePreset } from './core/theme';
import {
  AUDIO_LAYERS,
  DEFAULT_ROOM_SETTINGS,
  parseRoomSettings,
  serializeRoomSettings,
  type AudioLayer,
  type BinauralBeat,
  type RoomSettings,
} from './core/roomSettings';
import { AmbientAudioEngine } from './audio/AmbientAudioEngine';
import { setupMindfulness } from './ui/mindfulness';
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
const beatSelectElement = document.querySelector<HTMLSelectElement>('#binaural-beat');
const autoThemeElement = document.querySelector<HTMLButtonElement>('#auto-theme');

if (
  !beatSelectElement ||
  !autoThemeElement ||
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
const beatSelect: HTMLSelectElement = beatSelectElement;
const autoThemeButton: HTMLButtonElement = autoThemeElement;

const ambientAudio = new AmbientAudioEngine();
let isApplyingSettings = false;
let autoThemeInterval: number | undefined;
let applyingAutoTheme = false;
let activity: Activity | undefined;

function currentTheme(): ThemePreset {
  const theme = document.documentElement.dataset.theme;
  return isThemePreset(theme) ? theme : DEFAULT_ROOM_SETTINGS.theme;
}

function readLevels(): Record<AudioLayer, number> {
  const levels = { ...DEFAULT_ROOM_SETTINGS.levels };
  layerSliders.forEach((slider) => {
    const layer = slider.dataset.layer;
    if (layer && AUDIO_LAYERS.includes(layer as AudioLayer)) {
      levels[layer as AudioLayer] = Number(slider.value);
    }
  });
  return levels;
}

function syncRoomHash(): void {
  if (isApplyingSettings) {
    return;
  }
  const hash = serializeRoomSettings({
    theme: currentTheme(),
    timer: timerDuration.value as RoomSettings['timer'],
    levels: readLevels(),
    beat: beatSelect.value as BinauralBeat,
    autoTheme: autoThemeButton.getAttribute('aria-pressed') === 'true',
  });
  globalThis.history.replaceState(
    null,
    '',
    `${globalThis.location.pathname}${globalThis.location.search}${hash}`,
  );
}

function applyTimeOfDayTheme(): void {
  const theme = themeForHour(new Date().getHours());
  if (theme === currentTheme()) {
    return;
  }
  applyingAutoTheme = true;
  activity?.setPreset(theme);
  applyingAutoTheme = false;
}

function setAutoTheme(enabled: boolean): void {
  autoThemeButton.setAttribute('aria-pressed', String(enabled));
  if (autoThemeInterval !== undefined) {
    globalThis.clearInterval(autoThemeInterval);
    autoThemeInterval = undefined;
  }
  if (enabled) {
    applyTimeOfDayTheme();
    autoThemeInterval = globalThis.setInterval(applyTimeOfDayTheme, 60_000);
  }
}

function applySettings(settings: RoomSettings): void {
  isApplyingSettings = true;
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
  beatSelect.value = settings.beat;
  ambientAudio.setBinauralBeat(Number(settings.beat));
  if (settings.autoTheme) {
    setAutoTheme(true);
  } else {
    setAutoTheme(false);
    activity?.setPreset(settings.theme);
  }
  isApplyingSettings = false;
  syncRoomHash();
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

document.addEventListener('unwind:themechange', () => {
  if (!applyingAutoTheme && !isApplyingSettings) {
    setAutoTheme(false);
  }
  syncRoomHash();
});
autoThemeButton.addEventListener('click', () => {
  const enabled = autoThemeButton.getAttribute('aria-pressed') !== 'true';
  setAutoTheme(enabled);
  setStatus(enabled ? 'Matching the time of day.' : 'Time-of-day matching is off.');
  syncRoomHash();
});
beatSelect.addEventListener('change', () => {
  ambientAudio.setBinauralBeat(Number(beatSelect.value));
  syncRoomHash();
});
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
const startupTheme = roomState.autoTheme
  ? themeForHour(new Date().getHours())
  : roomState.theme;
document.documentElement.dataset.theme = startupTheme;
timerDuration.value = roomState.timer;
layerSliders.forEach((slider) => {
  const layer = slider.dataset.layer;
  if (layer && AUDIO_LAYERS.includes(layer as AudioLayer)) {
    const audioLayer = layer as AudioLayer;
    slider.value = String(roomState.levels[audioLayer]);
    ambientAudio.setLevel(audioLayer, roomState.levels[audioLayer]);
  }
});
beatSelect.value = roomState.beat;
ambientAudio.setBinauralBeat(Number(roomState.beat));
ambientAudio.setPreset(startupTheme);
const loadedActivity = await loadActivity(activityId, {
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
activity = loadedActivity;
isApplyingSettings = true;
loadedActivity.setPreset(startupTheme);
setAutoTheme(roomState.autoTheme);
isApplyingSettings = false;
loadedActivity.start();
setupMindfulness({
  activity: loadedActivity,
  ringBell: () => ambientAudio.playTempleBell(),
  setStatus,
});
window.addEventListener('pagehide', () => loadedActivity.dispose(), { once: true });

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
  applySettings(parseRoomSettings(globalThis.location.hash));
});
