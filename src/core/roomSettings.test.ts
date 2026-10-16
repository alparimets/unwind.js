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

  it('parses valid theme, timer, and audio levels', () => {
    expect(parseRoomSettings('#theme=nightfall&timer=20&rain=0.2&drone=0.4&chimes=0.8')).toEqual({
      theme: 'nightfall',
      timer: '20',
      levels: { rain: 0.2, drone: 0.4, chimes: 0.8 },
    });
  });

  it('falls back for unsupported themes and timer durations', () => {
    expect(parseRoomSettings('#theme=unknown&timer=7')).toEqual(
      DEFAULT_ROOM_SETTINGS,
    );
  });

  it('clamps finite levels and defaults malformed or missing levels', () => {
    expect(parseRoomSettings('#rain=-2&drone=4&chimes=nope')).toEqual({
      ...DEFAULT_ROOM_SETTINGS,
      levels: { rain: 0, drone: 1, chimes: 0.7 },
    });
  });

  it('treats empty mixer values as defaults', () => {
    expect(parseRoomSettings('#rain=&drone=%20&chimes=0.25').levels).toEqual({
      rain: 0.32,
      drone: 0.55,
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
        levels: { rain: 0, drone: 0.555, chimes: 1 },
      }),
    ).toBe('#theme=dusk&timer=10&rain=0.00&drone=0.56&chimes=1.00');
  });

  it('round-trips supported settings through a URL hash', () => {
    const settings = {
      theme: 'mist' as const,
      timer: '30' as const,
      levels: { rain: 0.15, drone: 0.65, chimes: 0.95 },
    };
    expect(parseRoomSettings(serializeRoomSettings(settings))).toEqual(settings);
  });
});
