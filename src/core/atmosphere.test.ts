import { describe, expect, it } from 'vitest';
import { initialTheme, themeForHour } from './atmosphere';
import { msUntilNextHour } from './softHour';
import { isDarkTheme, isThemePreset } from './theme';

describe('initialTheme', () => {
  it('honors an explicitly requested theme', () => {
    expect(initialTheme('mist', true, 23)).toBe('mist');
  });

  it('defaults to a dark theme when the OS prefers dark', () => {
    expect(initialTheme(undefined, true, 12)).toBe('nightfall');
  });

  it('defaults to a dark theme at night and meadow by day', () => {
    expect(initialTheme(undefined, false, 23)).toBe('nightfall');
    expect(initialTheme(undefined, false, 12)).toBe('meadow');
    expect(initialTheme(undefined, false, 18)).toBe('meadow');
  });
});

describe('isDarkTheme', () => {
  it('classifies themes', () => {
    expect(isDarkTheme('obsidian')).toBe(true);
    expect(isDarkTheme('forest')).toBe(true);
    expect(isDarkTheme('cosmos')).toBe(true);
    expect(isDarkTheme('meadow')).toBe(false);
    expect(isDarkTheme('dawn')).toBe(false);
  });
});

describe('themeForHour', () => {
  it.each([
    [4, 'nightfall'],
    [5, 'dawn'],
    [8, 'dawn'],
    [9, 'meadow'],
    [16, 'meadow'],
    [17, 'dusk'],
    [20, 'dusk'],
    [21, 'nightfall'],
    [0, 'nightfall'],
  ])('maps hour %i to %s', (hour, theme) => {
    expect(themeForHour(hour)).toBe(theme);
  });
});

describe('msUntilNextHour', () => {
  it('returns the time remaining in the hour', () => {
    expect(msUntilNextHour(new Date(2026, 0, 1, 10, 59, 30, 0))).toBe(30_000);
    expect(msUntilNextHour(new Date(2026, 0, 1, 23, 0, 0, 0))).toBe(3_600_000);
  });
});

describe('isThemePreset', () => {
  it('accepts known presets only', () => {
    expect(isThemePreset('dawn')).toBe(true);
    expect(isThemePreset('neon')).toBe(false);
    expect(isThemePreset(undefined)).toBe(false);
  });
});
