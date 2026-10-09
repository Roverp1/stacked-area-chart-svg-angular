import { describe, expect, it } from 'vitest';
import { createChartGeometry, evaluateBoundary } from './chart-geometry';
import type { ChartGeometry, StackedAreaChartPoint } from './chart.types';

const point = (
  age: number,
  contributions: number,
  governmentSupport: number,
  investmentGrowth: number,
): StackedAreaChartPoint => ({ age, contributions, governmentSupport, investmentGrowth });

function expectSafeGeometry(geometry: ChartGeometry): void {
  expect(geometry.state).toBe('ready');
  const boundaries = geometry.boundaries;
  for (let i = 0; i < boundaries[0].segments.length; i++) {
    for (let j = 0; j < boundaries.length; j++) {
      const segment = boundaries[j].segments[i];
      const lo = Math.min(segment.start.y, segment.end.y);
      const hi = Math.max(segment.start.y, segment.end.y);
      for (const control of [segment.control1, segment.control2]) {
        expect(control.y).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(control.y).toBeLessThanOrEqual(hi + 1e-9);
      }
      if (j > 0) {
        const lower = boundaries[j - 1].segments[i];
        expect(segment.control1.y).toBeLessThanOrEqual(lower.control1.y + 1e-9);
        expect(segment.control2.y).toBeLessThanOrEqual(lower.control2.y + 1e-9);
      }
      if (i > 0) {
        const previous = boundaries[j].segments[i - 1];
        const incoming =
          (previous.end.y - previous.control2.y) / (previous.end.x - previous.control2.x);
        const outgoing =
          (segment.control1.y - segment.start.y) / (segment.control1.x - segment.start.x);
        expect(outgoing).toBeCloseTo(incoming, 7);
      }
    }
    const start = boundaries[0].segments[i].start.x / geometry.width;
    const end = boundaries[0].segments[i].end.x / geometry.width;
    for (let k = 0; k <= 40; k++) {
      const x = start + ((end - start) * k) / 40;
      const ys = boundaries.map((b) => evaluateBoundary(b, x)!.y);
      for (let j = 1; j < ys.length; j++) expect(ys[j]).toBeLessThanOrEqual(ys[j - 1] + 1e-9);
      const top = boundaries[3].segments[i];
      expect(ys[3]).toBeGreaterThanOrEqual(Math.min(top.start.y, top.end.y) - 1e-9);
      expect(ys[3]).toBeLessThanOrEqual(Math.max(top.start.y, top.end.y) + 1e-9);
    }
  }
}

describe('stacked area geometry', () => {
  it('stacks financial amounts in fixed order and uses actual ages without mutating input', () => {
    const points = Object.freeze([
      Object.freeze(point(50, 30, 20, 10)),
      Object.freeze(point(20, 10, 5, 5)),
      Object.freeze(point(25, 20, 10, 10)),
    ]);
    const g = createChartGeometry(points, 300, 200);
    expect(g.state).toBe('ready');
    expect(g.points.map((p) => p.age)).toEqual([20, 25, 50]);
    expect(points.map((p) => p.age)).toEqual([50, 20, 25]);
    expect(g.maxTotal).toBe(60);
    expect(g.yMaximum).toBe(60);
    expect(g.ticks).toEqual([0, 20, 40, 60]);
    expect(g.bands.map((b) => b.key)).toEqual([
      'contributions',
      'governmentSupport',
      'investmentGrowth',
    ]);
    expect(g.boundaries[1].knots[1].x).toBeCloseTo(50);
    for (const [j, value] of [0, 10, 15, 20].entries()) {
      expect(g.boundaries[j].knots[0].y).toBeCloseTo(200 * (1 - value / 60));
    }
  });

  it('reuses the same curves for fills and borders, reversing controls on lower edges', () => {
    const g = createChartGeometry(
      [point(0, 1, 2, 3), point(1, 3, 2, 1), point(3, 4, 5, 2)],
      300,
      200,
    );
    const fmt = (p: { x: number; y: number }) =>
      `${Number(p.x.toFixed(4))},${Number(p.y.toFixed(4))}`;
    g.bands.forEach((band, j) => {
      expect(band.path.startsWith(g.boundaries[j + 1].path)).toBe(true);
      const lower = g.boundaries[j];
      expect(band.path).toContain(`L${fmt(lower.knots[lower.knots.length - 1])}`);
      for (const s of lower.segments) {
        expect(band.path).toContain(`C${fmt(s.control2)} ${fmt(s.control1)} ${fmt(s.start)}`);
      }
      expect(band.path.endsWith('Z')).toBe(true);
    });
    expect(g.topBoundaryPath).toBe(g.boundaries[3].path);
  });

  it('uses straight lines for linear interpolation and for two points', () => {
    const points = [point(0, 1, 2, 3), point(1, 8, 1, 0), point(10, 3, 2, 8)];
    for (const g of [
      createChartGeometry(points, 300, 200, 'linear'),
      createChartGeometry([points[0], points[2]], 300, 200),
    ]) {
      for (const b of g.boundaries) {
        for (const s of b.segments) {
          const mid = evaluateBoundary(b, (s.start.x + s.end.x) / (2 * g.width))!;
          expect(mid.y).toBeCloseTo((s.start.y + s.end.y) / 2, 10);
          expect(s.control1.y).toBeCloseTo(s.start.y + (s.end.y - s.start.y) / 3, 10);
          expect(s.control2.y).toBeCloseTo(s.end.y - (s.end.y - s.start.y) / 3, 10);
        }
      }
    }
  });

  it('damps a pinched band whose independent cumulative tangents would cross', () => {
    // At age 1 the support thickness is zero, but its undamped derivative is positive.
    const g = createChartGeometry(
      [point(0, 0, 0, 1), point(1, 1, 0, 0), point(2, 2, 1, 0)],
      200,
      200,
    );
    expectSafeGeometry(g);
    const lower = g.boundaries[1],
      upper = g.boundaries[2];
    expect(lower.knots[1].y).toBe(upper.knots[1].y);
    expect(lower.segments[0].control2.y).toBeCloseTo(lower.knots[1].y, 10);
    expect(upper.segments[0].control2.y).toBeCloseTo(upper.knots[1].y, 10);
    expect(lower.segments[1].control1.y).toBeCloseTo(lower.knots[1].y, 10);
  });

  it('preserves C1, ordered bands and bounded totals with opposing trends and uneven ages', () => {
    expectSafeGeometry(
      createChartGeometry(
        [
          point(10, 100, 0, 0),
          point(10.001, 1, 99, 0),
          point(11, 80, 0, 20),
          point(40, 0, 30, 70),
          point(100, 60, 40, 0),
        ],
        600,
        250,
      ),
    );
    expectSafeGeometry(
      createChartGeometry(
        [point(0, 1, 0, 10), point(0.1, 4, 0, 2), point(0.5, 2, 0, 30), point(30, 9, 0, 1)],
        300,
        200,
      ),
    );
  });

  it('provides explicit empty, single and all-zero states with no filled areas', () => {
    const empty = createChartGeometry([], 300, 200);
    expect(empty.state).toBe('empty');
    expect(empty.boundaries).toEqual([]);
    const single = createChartGeometry([point(42, 1, 2, 3)], 300, 200);
    expect(single.state).toBe('single');
    expect(single.boundaries[3].knots[0].x).toBe(150);
    const zero = createChartGeometry([point(0, 0, 0, 0), point(1, 0, 0, 0)], 300, 200);
    expect(zero.state).toBe('zero');
    expect(zero.yMaximum).toBe(1);
    expect(zero.ticks).toEqual([0]);
    for (const g of [empty, single, zero]) expect(g.bands.every((b) => b.path === '')).toBe(true);
  });

  it('rejects malformed records, duplicates, overflow and unusable dimensions', () => {
    const bad = [
      [point(NaN, 1, 2, 3)],
      [point(1, -1, 2, 3)],
      [point(1, 1, Infinity, 3)],
      [point(1, 1, 2, 3), point(1, 4, 5, 6)],
      [point(1, Number.MAX_VALUE, Number.MAX_VALUE, 0)],
      [point(-Number.MAX_VALUE, 1, 1, 1), point(Number.MAX_VALUE, 1, 1, 1)],
      [point(1, Number.MIN_VALUE, 0, 0)],
    ];
    for (const points of bad) {
      const g = createChartGeometry(points, 300, 200);
      expect(g.state).toBe('invalid');
      expect(g.error).toBeTruthy();
      expect(g.bands.every((b) => b.path === '')).toBe(true);
    }
    expect(createChartGeometry([], 0, 200).state).toBe('invalid');
    expect(createChartGeometry([], 300, Infinity).state).toBe('invalid');
  });

  it('evaluates knots exactly and clamps badge positions to the plot', () => {
    const g = createChartGeometry(
      [point(10, 1, 2, 3), point(15, 3, 4, 5), point(30, 4, 6, 8)],
      300,
      200,
    );
    const top = g.boundaries[3];
    for (const knot of top.knots)
      expect(evaluateBoundary(top, knot.x / g.width)!.y).toBeCloseTo(knot.y, 10);
    expect(evaluateBoundary(top, -1)).toEqual(top.knots[0]);
    expect(evaluateBoundary(top, 2)).toEqual(top.knots[2]);
    expect(evaluateBoundary(top, NaN)).toBeNull();
  });
});
