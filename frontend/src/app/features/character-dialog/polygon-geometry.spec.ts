import {
  getCenter,
  pointInPolygon,
  rotatePoints,
  scalePoints,
  toAbsolute,
  toRelative,
  translatePoints,
} from './polygon-geometry';
import { Point } from '../../models';

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

function expectPointsClose(actual: Point[], expected: Point[]) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((p, i) => {
    expect(p.x).toBeCloseTo(expected[i].x, 6);
    expect(p.y).toBeCloseTo(expected[i].y, 6);
  });
}

describe('getCenter', () => {
  it('returns the centroid of a square', () => {
    expect(getCenter(square)).toEqual({ x: 5, y: 5 });
  });
});

describe('rotatePoints', () => {
  const center = getCenter(square);

  it('rotates 90° around the center', () => {
    const rotated = rotatePoints(square, center, Math.PI / 2);
    expectPointsClose(rotated, [
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ]);
  });

  it('keeps the center fixed', () => {
    const rotated = rotatePoints(square, center, 0.7);
    const newCenter = getCenter(rotated);
    expect(newCenter.x).toBeCloseTo(center.x, 6);
    expect(newCenter.y).toBeCloseTo(center.y, 6);
  });

  it('preserves distances from the center (rigid rotation)', () => {
    const rotated = rotatePoints(square, center, 1.234);
    square.forEach((p, i) => {
      const before = Math.hypot(p.x - center.x, p.y - center.y);
      const after = Math.hypot(rotated[i].x - center.x, rotated[i].y - center.y);
      expect(after).toBeCloseTo(before, 6);
    });
  });

  it('full turn returns the original points', () => {
    const rotated = rotatePoints(square, center, Math.PI * 2);
    expectPointsClose(rotated, square);
  });

  it('rotation by opposite angles cancels out', () => {
    const there = rotatePoints(square, center, 0.5);
    const back = rotatePoints(there, center, -0.5);
    expectPointsClose(back, square);
  });
});

describe('translatePoints', () => {
  it('shifts every point by the delta', () => {
    expectPointsClose(translatePoints(square, 3, -2), [
      { x: 3, y: -2 },
      { x: 13, y: -2 },
      { x: 13, y: 8 },
      { x: 3, y: 8 },
    ]);
  });
});

describe('pointInPolygon', () => {
  it('detects a point inside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('detects a point outside', () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: -1 }, square)).toBe(false);
  });

  it('works for a concave polygon', () => {
    const concave: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5, y: 5 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 2 }, concave)).toBe(true);
    // The notch above the inner vertex is outside.
    expect(pointInPolygon({ x: 5, y: 8 }, concave)).toBe(false);
  });
});

describe('relative/absolute conversion', () => {
  it('round-trips through a resize keeping the ratio', () => {
    const relative = toRelative(square, 100, 50);
    expect(relative[2]).toEqual({ x: 0.1, y: 0.2 });

    const onBiggerCanvas = toAbsolute(relative, 200, 100);
    expectPointsClose(onBiggerCanvas, scalePoints(square, 2, 2));
  });

  it('does not divide by zero on a zero-sized canvas', () => {
    const relative = toRelative(square, 0, 0);
    relative.forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });
});
