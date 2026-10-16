import { describe, expect, it } from 'vitest';
import { themeForHour } from './atmosphere';
import { msUntilNextHour } from './softHour';
import { isThemePreset } from './theme';

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
