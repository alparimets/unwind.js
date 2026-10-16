import { loadActivity, type ActivityId } from './core/activityRegistry';
import { AmbientAudioController } from './audio/AmbientAudioController';
import './styles.css';

const canvasElement = document.querySelector<HTMLCanvasElement>('#activity-canvas');
const soundButtonElement = document.querySelector<HTMLButtonElement>('#sound-toggle');
const fullscreenButtonElement =
  document.querySelector<HTMLButtonElement>('#fullscreen-toggle');
const experienceElement = document.querySelector<HTMLElement>('.experience');
const statusElement = document.querySelector<HTMLElement>('#activity-status');

if (
  !canvasElement ||
  !soundButtonElement ||
  !fullscreenButtonElement ||
  !experienceElement ||
  !statusElement
) {
  throw new Error('The activity page is missing a required interface element.');
}

const canvas: HTMLCanvasElement = canvasElement;
const soundButton: HTMLButtonElement = soundButtonElement;
const fullscreenButton: HTMLButtonElement = fullscreenButtonElement;
const experience: HTMLElement = experienceElement;
const status: HTMLElement = statusElement;

const ambientAudio = new AmbientAudioController();

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

document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement === experience;
  fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
});

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
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
activity.start();
window.addEventListener('pagehide', () => activity.dispose(), { once: true });
