import { describe, expect, it } from 'vitest';
import { linkAlpha, MAX_LINK_DISTANCE } from './constellations';
import { WindTrail } from './windTrail';

describe('WindTrail', () => {
  it('skips points that are too close together', () => {
    const trail = new WindTrail();
    trail.add(0, 0, 100, 0, 0);
    trail.add(2, 0, 100, 0, 10);
    trail.add(20, 0, 100, 0, 20);
    expect(trail.size).toBe(2);
  });

  it('caps the number of points', () => {
    const trail = new WindTrail();
    for (let index = 0; index < 200; index += 1) {
      trail.add(index * 10, 0, 100, 0, index);
    }
    expect(trail.size).toBe(96);
  });

  it('prunes expired points', () => {
    const trail = new WindTrail();
    trail.add(0, 0, 100, 0, 0);
    trail.prune(10_000);
    expect(trail.size).toBe(0);
  });

  it('pushes nearby positions along the flow direction', () => {
    const trail = new WindTrail();
    trail.add(100, 100, 500, 0, 0);
    const near = trail.flowAt(105, 100, 10);
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBe(0);
    expect(trail.flowAt(500, 500, 10)).toEqual({ x: 0, y: 0 });
  });

  it('clears all points', () => {
    const trail = new WindTrail();
    trail.add(0, 0, 1, 1, 0);
    trail.clear();
    expect(trail.size).toBe(0);
  });
});

describe('linkAlpha', () => {
  const options = { time: 0, isDark: true, isStatic: true };

  it('is zero beyond the maximum distance', () => {
    expect(linkAlpha(MAX_LINK_DISTANCE, 0, options)).toBe(0);
  });

  it('fades with distance', () => {
    expect(linkAlpha(20, 0, options)).toBeGreaterThan(linkAlpha(120, 0, options));
  });

  it('pulses over time when motion is allowed', () => {
    const animated = { time: 0, isDark: false, isStatic: false };
    expect(linkAlpha(50, 0, animated)).not.toBe(
      linkAlpha(50, 0, { ...animated, time: 2600 }),
    );
  });
});
