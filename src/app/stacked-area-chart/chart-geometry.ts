/*! @license
 * Adapted from d3-shape. Copyright 2010-2022 Mike Bostock.
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 * TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
 * THIS SOFTWARE.
 */
import type {
  BoundarySegment,
  ChartBand,
  ChartBoundary,
  ChartCoordinate,
  ChartGeometry,
  ChartInterpolation,
  StackedAreaChartPoint,
} from './chart.types';

// Steffen tangents and Hermite-to-Bezier conversion adapted from d3-shape.
// Its ISC license is retained in THIRD_PARTY_NOTICES.md.
const SERIES = [
  { key: 'contributions', color: '#0769ad' },
  { key: 'governmentSupport', color: '#052e64' },
  { key: 'investmentGrowth', color: '#fa6000' },
] as const;

function slopes(x: readonly number[], y: readonly number[]): number[] {
  const n = x.length;
  const secants = x.slice(1).map((v, i) => (y[i + 1] - y[i]) / (v - x[i]));
  if (n < 2) return Array(n).fill(0);
  if (n === 2) return [secants[0], secants[0]];
  const tangents = Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = x[i] - x[i - 1],
      h1 = x[i + 1] - x[i];
    const s0 = secants[i - 1],
      s1 = secants[i];
    const p = s0 * (h1 / (h0 + h1)) + s1 * (h0 / (h0 + h1));
    tangents[i] =
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), Math.abs(p) / 2);
  }
  tangents[0] = (3 * secants[0] - tangents[1]) / 2;
  tangents[n - 1] = (3 * secants[n - 2] - tangents[n - 2]) / 2;
  return tangents;
}

function niceDomain(maximum: number, target: number): { maximum: number; ticks: number[] } {
  if (maximum === 0) return { maximum: 1, ticks: [0] };
  const raw = maximum / (target - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  const count = Math.ceil(maximum / step);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(count) || count > 100) {
    return { maximum: NaN, ticks: [] };
  }
  return { maximum: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

const format = (value: number): string => String(Number(value.toFixed(4)));
const coordinate = (p: ChartCoordinate): string => `${format(p.x)},${format(p.y)}`;
const forward = (s: BoundarySegment): string =>
  `C${coordinate(s.control1)} ${coordinate(s.control2)} ${coordinate(s.end)}`;
const backward = (s: BoundarySegment): string =>
  `C${coordinate(s.control2)} ${coordinate(s.control1)} ${coordinate(s.start)}`;

/** Returned coordinates are local to the inner plot; input records are never mutated. */
export function createChartGeometry(
  points: readonly StackedAreaChartPoint[],
  width: number,
  height: number,
  interpolation: ChartInterpolation = 'monotone',
  targetTickCount = 5,
): ChartGeometry {
  const base: ChartGeometry = {
    state: 'empty',
    points: [],
    width,
    height,
    maxTotal: 0,
    yMaximum: 1,
    ticks: [0],
    boundaries: [],
    bands: SERIES.map((s) => ({ ...s, path: '' })),
    topBoundaryPath: '',
  };
  const invalid = (error: string): ChartGeometry => ({ ...base, state: 'invalid', error });
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isInteger(targetTickCount) ||
    targetTickCount < 2 ||
    targetTickCount > 20 ||
    (interpolation !== 'monotone' && interpolation !== 'linear')
  )
    return invalid('Invalid geometry options.');
  for (const point of points) {
    if (
      !point ||
      !Number.isFinite(point.age) ||
      SERIES.some((s) => !Number.isFinite(point[s.key]) || point[s.key] < 0)
    )
      return invalid('Values must be finite and bands nonnegative.');
  }
  const sorted = [...points].sort((a, b) => a.age - b.age);
  if (!sorted.length) return base;
  if (sorted.some((p, i) => i > 0 && p.age === sorted[i - 1].age))
    return invalid('Ages must be unique.');
  const cumulative = sorted.map((p) => [
    0,
    p.contributions,
    p.contributions + p.governmentSupport,
    p.contributions + p.governmentSupport + p.investmentGrowth,
  ]);
  const maxTotal = cumulative.reduce((maximum, p) => Math.max(maximum, p[3]), 0);
  if (!Number.isFinite(maxTotal)) return invalid('Cumulative values overflow.');
  const domain = niceDomain(maxTotal, targetTickCount);
  if (
    !Number.isFinite(domain.maximum) ||
    domain.maximum <= 0 ||
    domain.ticks.some((t) => !Number.isFinite(t))
  ) {
    return invalid('Cannot represent a finite y domain.');
  }
  const span = sorted[sorted.length - 1].age - sorted[0].age;
  if (!Number.isFinite(span)) return invalid('Age range overflows.');
  const x = sorted.map((p) => (sorted.length === 1 ? 0.5 : (p.age - sorted[0].age) / span));
  if (x.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= x[i - 1])))
    return invalid('Age spacing loses numeric precision.');
  const values = [0, 1, 2, 3].map((j) =>
    cumulative.map((p) => (maxTotal === 0 ? 0 : p[j] / maxTotal)),
  );
  const tangents = values.map((y) => slopes(x, y));
  if (tangents.some((m) => m.some((v) => !Number.isFinite(v))))
    return invalid('Tangents exceed numeric range.');

  // One tangent per knot keeps both neighboring intervals C1 after damping.
  for (let i = 0; i < sorted.length; i++) {
    let lambda = 1;
    for (let j = 1; j <= 3; j++) {
      const gap = values[j][i] - values[j - 1][i];
      const difference = tangents[j][i] - tangents[j - 1][i];
      if (difference < 0 && i + 1 < x.length) {
        lambda = Math.min(lambda, gap / (((x[i + 1] - x[i]) * -difference) / 3));
      }
      if (difference > 0 && i > 0) {
        lambda = Math.min(lambda, gap / (((x[i] - x[i - 1]) * difference) / 3));
      }
    }
    lambda = Math.max(0, lambda < 1 ? lambda * (1 - 16 * Number.EPSILON) : 1);
    for (const m of tangents) m[i] *= lambda;
  }
  const screenY = (value: number): number => height * (1 - value * (maxTotal / domain.maximum));
  const boundaries: ChartBoundary[] = values.map((y, j) => {
    const knots = x.map((v, i) => ({ x: v * width, y: screenY(y[i]) }));
    const segments: BoundarySegment[] = x.slice(1).map((v, i) => {
      const h = v - x[i];
      const linear = interpolation === 'linear' || sorted.length === 2;
      const delta = y[i + 1] - y[i];
      return {
        start: knots[i],
        end: knots[i + 1],
        control1: {
          x: (x[i] + h / 3) * width,
          y: screenY(y[i] + (linear ? delta / 3 : (h * tangents[j][i]) / 3)),
        },
        control2: {
          x: (v - h / 3) * width,
          y: screenY(y[i + 1] - (linear ? delta / 3 : (h * tangents[j][i + 1]) / 3)),
        },
      };
    });
    return {
      knots,
      segments,
      path: segments.length ? `M${coordinate(knots[0])}${segments.map(forward).join('')}` : '',
    };
  });
  if (
    boundaries.some((b) =>
      b.segments.some((s) =>
        [s.start, s.control1, s.control2, s.end].some(
          (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
        ),
      ),
    )
  )
    return invalid('Geometry exceeds numeric range.');
  const state = maxTotal === 0 ? 'zero' : sorted.length === 1 ? 'single' : 'ready';
  const bands: ChartBand[] = SERIES.map((s, j) => {
    const upper = boundaries[j + 1],
      lower = boundaries[j];
    const path =
      state === 'ready'
        ? `${upper.path}L${coordinate(lower.knots[lower.knots.length - 1])}` +
          [...lower.segments].reverse().map(backward).join('') +
          'Z'
        : '';
    return { ...s, path };
  });
  return {
    ...base,
    state,
    points: sorted,
    maxTotal,
    yMaximum: domain.maximum,
    ticks: domain.ticks,
    boundaries,
    bands,
    topBoundaryPath: boundaries[3].path,
  };
}

/** Evaluate the unrounded boundary at a clamped fraction of the plot width. */
export function evaluateBoundary(
  boundary: ChartBoundary,
  normalizedX: number,
): ChartCoordinate | null {
  if (!Number.isFinite(normalizedX) || !boundary.knots.length) return null;
  if (!boundary.segments.length) return boundary.knots[0];
  const first = boundary.knots[0],
    last = boundary.knots[boundary.knots.length - 1];
  const x = first.x + Math.max(0, Math.min(1, normalizedX)) * (last.x - first.x);
  const s =
    boundary.segments.find((segment) => x <= segment.end.x) ??
    boundary.segments[boundary.segments.length - 1];
  const t = (x - s.start.x) / (s.end.x - s.start.x),
    u = 1 - t;
  return {
    x,
    y:
      u ** 3 * s.start.y +
      3 * u * u * t * s.control1.y +
      3 * u * t * t * s.control2.y +
      t ** 3 * s.end.y,
  };
}
