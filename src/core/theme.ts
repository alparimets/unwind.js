export const THEME_PRESETS = [
  'dawn',
  'meadow',
  'dusk',
  'mist',
  'nightfall',
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];

export function isThemePreset(value: unknown): value is ThemePreset {
  return (THEME_PRESETS as readonly unknown[]).includes(value);
}
