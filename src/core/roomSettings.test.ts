import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_SETTINGS,
  parseRoomSettings,
  serializeRoomSettings,
} from './roomSettings';

describe('parseRoomSettings', () => {
  it('uses defaults when the hash is empty', () => {
    expect(parseRoomSettings('')).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(parseRoomSettings('#')).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('parses theme, timer, audio levels, beat and auto theme', () => {
    expect(
      parseRoomSettings(
        '#theme=nightfall&timer=20&rain=0.2&drone=0.4&chimes=0.8&thunder=0.3&binaural=0.1&beat=4&auto=1',
      ),
    ).toEqual({
      theme: 'nightfall',
      timer: '20',
      levels: { rain: 0.2, drone: 0.4, chimes: 0.8, thunder: 0.3, binaural: 0.1 },
      beat: '4',
      autoTheme: true,
    });
  });

  it('accepts the dawn theme', () => {
    expect(parseRoomSettings('#theme=dawn').theme).toBe('dawn');
  });

  it('falls back for unsupported themes, timers and beats', () => {
    expect(parseRoomSettings('#theme=unknown&timer=7&beat=9')).toEqual(
      DEFAULT_ROOM_SETTINGS,
    );
  });

  it('clamps finite levels and defaults malformed or missing levels', () => {
    expect(parseRoomSettings('#rain=-2&drone=4&chimes=nope').levels).toEqual({
      ...DEFAULT_ROOM_SETTINGS.levels,
      rain: 0,
      drone: 1,
    });
  });

  it('treats empty mixer values as defaults', () => {
    expect(parseRoomSettings('#rain=&drone=%20&chimes=0.25').levels).toEqual({
      ...DEFAULT_ROOM_SETTINGS.levels,
      chimes: 0.25,
    });
  });
});

describe('serializeRoomSettings', () => {
  it('serializes a complete shareable room hash', () => {
    expect(
      serializeRoomSettings({
        theme: 'dusk',
        timer: '10',
        levels: { rain: 0, drone: 0.555, chimes: 1, thunder: 0.2, binaural: 0 },
        beat: '7',
        autoTheme: false,
      }),
    ).toBe(
      '#theme=dusk&timer=10&rain=0.00&drone=0.56&chimes=1.00&thunder=0.20&binaural=0.00&beat=7&auto=0',
    );
  });

  it('round-trips supported settings through a URL hash', () => {
    const settings = {
      theme: 'mist' as const,
      timer: '30' as const,
      levels: { rain: 0.15, drone: 0.65, chimes: 0.95, thunder: 0.4, binaural: 0.05 },
      beat: '4' as const,
      autoTheme: true,
    };
    expect(parseRoomSettings(serializeRoomSettings(settings))).toEqual(settings);
  });
});
