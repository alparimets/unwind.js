import type { Activity } from '../core/activity';
import { msUntilNextHour } from '../core/softHour';

interface MindfulnessOptions {
  activity: Activity;
  ringBell(): boolean;
  setStatus(message: string): void;
}

function setupReleaseForm({
  activity,
  setStatus,
}: MindfulnessOptions): void {
  const form = document.querySelector<HTMLFormElement>('#release-form');
  const input = document.querySelector<HTMLInputElement>('#release-text');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input?.value.trim() ?? '';
    if (!input || text === '') {
      setStatus('Write a thought you want to let go of.');
      return;
    }
    activity.releaseThought(text);
    input.value = '';
    setStatus('Your thought is drifting away.');
  });
}

function setupTwinkle({ activity, setStatus }: MindfulnessOptions): void {
  const button = document.querySelector<HTMLButtonElement>('#twinkle-toggle');
  button?.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled));
    activity.setTwinkle(enabled);
    setStatus(enabled ? 'Fireflies are flickering.' : 'Fireflies are resting.');
  });
}

function setupSoftHour({ ringBell, setStatus }: MindfulnessOptions): void {
  const button = document.querySelector<HTMLButtonElement>('#soft-hour-toggle');
  let timer: number | undefined;

  const schedule = (): void => {
    timer = globalThis.setTimeout(() => {
      const rang = ringBell();
      setStatus(
        rang
          ? 'A soft bell. Take one slow breath.'
          : 'A soft hour has arrived. Take one slow breath.',
      );
      schedule();
    }, msUntilNextHour(new Date()) + 1000);
  };

  button?.addEventListener('click', () => {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled));
    if (timer !== undefined) {
      globalThis.clearTimeout(timer);
      timer = undefined;
    }
    if (enabled) {
      schedule();
    }
    setStatus(enabled ? 'A gentle bell will ring each hour.' : 'Hourly bell is off.');
  });
}

export function setupMindfulness(options: MindfulnessOptions): void {
  setupReleaseForm(options);
  setupTwinkle(options);
  setupSoftHour(options);
}
