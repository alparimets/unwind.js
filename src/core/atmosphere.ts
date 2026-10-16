import type { ThemePreset } from './theme';

export function initialTheme(
  requested: ThemePreset | undefined,
  prefersDark: boolean,
  hour: number,
): ThemePreset {
  if (requested) {
    return requested;
  }
  if (prefersDark) {
    return 'nightfall';
  }
  const timeTheme = themeForHour(hour);
  return timeTheme === 'nightfall' ? timeTheme : 'meadow';
}

export function themeForHour(hour: number): ThemePreset {
  if (hour >= 5 && hour < 9) {
    return 'dawn';
  }
  if (hour >= 9 && hour < 17) {
    return 'meadow';
  }
  if (hour >= 17 && hour < 21) {
    return 'dusk';
  }
  return 'nightfall';
}
