import { THEME_PRESETS, type ThemePreset } from './theme';

export const ROOM_THEMES: readonly ThemePreset[] = THEME_PRESETS;
export const TIMER_DURATIONS = ['5', '10', '20', '30'] as const;
export const AUDIO_LAYERS = [
  'rain',
  'drone',
  'chimes',
  'thunder',
  'binaural',
] as const;
export const BINAURAL_BEATS = ['4', '7'] as const;

export type AudioLayer = (typeof AUDIO_LAYERS)[number];
export type BinauralBeat = (typeof BINAURAL_BEATS)[number];

export interface RoomSettings {
  theme: ThemePreset;
  timer: (typeof TIMER_DURATIONS)[number];
  levels: Record<AudioLayer, number>;
  beat: BinauralBeat;
  autoTheme: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  theme: 'meadow',
  timer: '10',
  levels: {
    rain: 0.32,
    drone: 0.55,
    chimes: 0.7,
    thunder: 0,
    binaural: 0,
  },
  beat: '7',
  autoTheme: false,
};

export function parseRoomSettings(hash: string): RoomSettings {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const requestedTheme = params.get('theme');
  const requestedTimer = params.get('timer');
  const requestedBeat = params.get('beat');
  const theme = ROOM_THEMES.find((preset) => preset === requestedTheme);
  const timer = TIMER_DURATIONS.find((duration) => duration === requestedTimer);
  const beat = BINAURAL_BEATS.find((value) => value === requestedBeat);
  const level = (layer: AudioLayer): number => {
    const value = params.get(layer);
    if (value === null || value.trim() === '') {
      return DEFAULT_ROOM_SETTINGS.levels[layer];
    }
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(1, Math.max(0, parsed))
      : DEFAULT_ROOM_SETTINGS.levels[layer];
  };

  const levels = Object.fromEntries(
    AUDIO_LAYERS.map((layer) => [layer, level(layer)]),
  ) as Record<AudioLayer, number>;

  return {
    theme: theme ?? DEFAULT_ROOM_SETTINGS.theme,
    timer: timer ?? DEFAULT_ROOM_SETTINGS.timer,
    levels,
    beat: beat ?? DEFAULT_ROOM_SETTINGS.beat,
    autoTheme: params.get('auto') === '1',
  };
}

export function serializeRoomSettings(settings: RoomSettings): string {
  const params = new URLSearchParams();
  params.set('theme', settings.theme);
  params.set('timer', settings.timer);
  for (const layer of AUDIO_LAYERS) {
    params.set(layer, settings.levels[layer].toFixed(2));
  }
  params.set('beat', settings.beat);
  params.set('auto', settings.autoTheme ? '1' : '0');
  return `#${params.toString()}`;
}
