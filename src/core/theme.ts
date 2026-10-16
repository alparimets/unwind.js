export const THEME_PRESETS = [
  'dawn',
  'meadow',
  'mist',
  'dusk',
  'nightfall',
  'forest',
  'cosmos',
  'obsidian',
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];

const DARK_THEMES: readonly ThemePreset[] = [
  'dusk',
  'nightfall',
  'forest',
  'cosmos',
  'obsidian',
];

export function isDarkTheme(theme: ThemePreset): boolean {
  return DARK_THEMES.includes(theme);
}

export function isThemePreset(value: unknown): value is ThemePreset {
  return (THEME_PRESETS as readonly unknown[]).includes(value);
}
