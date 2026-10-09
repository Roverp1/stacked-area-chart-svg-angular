export interface StackedAreaChartPoint {
  readonly age: number;
  readonly contributions: number;
  readonly governmentSupport: number;
  readonly investmentGrowth: number;
}

type Point = readonly [number, number];
type Segment = readonly [Point, Point, Point, Point];

const series = [
  { key: 'contributions', color: '#0769ad' },
  { key: 'governmentSupport', color: '#052e64' },
  { key: 'investmentGrowth', color: '#fa6000' },
] as const;

function slopes(x: readonly number[], y: readonly number[]): number[] {
  const secants = x.slice(1).map((value, i) => (y[i + 1] - y[i]) / (value - x[i]));
  if (x.length === 2) return [secants[0], secants[0]];
  const tangents = Array<number>(x.length).fill(0);
  for (let i = 1; i < x.length - 1; i++) {
    const h0 = x[i] - x[i - 1];
    const h1 = x[i + 1] - x[i];
    const s0 = secants[i - 1];
    const s1 = secants[i];
    const p = s0 * (h1 / (h0 + h1)) + s1 * (h0 / (h0 + h1));
    tangents[i] =
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), Math.abs(p) / 2);
  }
  tangents[0] = (3 * secants[0] - tangents[1]) / 2;
  tangents[x.length - 1] = (3 * secants[x.length - 2] - tangents[x.length - 2]) / 2;
  return tangents;
}

function path(segments: readonly Segment[], reverse = false): string {
  const ordered = reverse
    ? [...segments].reverse().map(([a, b, c, d]) => [d, c, b, a] as const)
    : segments;
  const coordinate = (point: Point) => point.map((value) => Number(value.toFixed(4))).join(',');
  return (
    `M${coordinate(ordered[0][0])}` +
    ordered.map((segment) => `C${segment.slice(1).map(coordinate).join(' ')}`).join('')
  );
}

function boundaryY(curve: readonly Segment[], x: number): number {
  const [a, b, c, d] = curve.find((segment) => x <= segment[3][0])!;
  const t = (x - a[0]) / (d[0] - a[0]);
  const u = 1 - t;
  return u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1];
}

export function createGeometry(
  data: readonly StackedAreaChartPoint[],
  width: number,
  height: number,
) {
  const empty = {
    points: [] as StackedAreaChartPoint[],
    bands: [] as { key: string; color: string; path: string }[],
    markers: [] as { key: string; color: string; y: number; height: number }[],
    badges: [] as { number: number; x: number; y: number }[],
    separators: [] as string[],
    ticks: [0],
    maximum: 1,
  };
  if (
    data.length === 0 ||
    data.some(
      (point) =>
        !Number.isFinite(point.age) ||
        series.some(({ key }) => !Number.isFinite(point[key]) || point[key] < 0),
    )
  )
    return empty;
  const points = [...data].sort((a, b) => a.age - b.age);
  const span = points[points.length - 1].age - points[0].age;
  const x = points.map((point) => (points.length === 1 ? 0.5 : (point.age - points[0].age) / span));
  if (x.some((value, i) => !Number.isFinite(value) || (i > 0 && value <= x[i - 1]))) return empty;

  const cumulative = points.map((point) => [
    0,
    point.contributions,
    point.contributions + point.governmentSupport,
    point.contributions + point.governmentSupport + point.investmentGrowth,
  ]);
  const peak = cumulative.reduce((maximum, values) => Math.max(maximum, values[3]), 0);
  if (!Number.isFinite(peak)) return empty;
  const power = peak === 0 ? 1 : 10 ** Math.floor(Math.log10(peak / 5));
  const ratio = peak / 5 / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  const count = Math.ceil(peak / step);
  const maximum = peak === 0 ? 1 : count * step;
  if (!Number.isFinite(maximum) || step <= 0) return empty;

  const ticks = Array.from({ length: count + 1 }, (_, i) => i * step);
  if (points.length === 1) {
    let lower = 0;
    const markers = series.map((band) => {
      const upper = points[0][band.key] + lower;
      const marker = {
        key: band.key,
        color: band.color,
        y: height * (1 - upper / maximum),
        height: ((upper - lower) / maximum) * height,
      };
      lower = upper;
      return marker;
    });
    return { ...empty, points, maximum, ticks, markers };
  }

  const values = [0, 1, 2, 3].map((boundary) =>
    cumulative.map((point) => point[boundary] / maximum),
  );
  const tangents = values.map((y) => slopes(x, y));
  if (tangents.some((boundary) => boundary.some((value) => !Number.isFinite(value)))) return empty;
  for (let i = 0; i < points.length; i++) {
    let scale = 1;
    for (let j = 1; j <= 3; j++) {
      const gap = values[j][i] - values[j - 1][i];
      const difference = tangents[j][i] - tangents[j - 1][i];
      if (difference < 0 && i + 1 < x.length) {
        scale = Math.min(scale, gap / (((x[i + 1] - x[i]) * -difference) / 3));
      }
      if (difference > 0 && i > 0) {
        scale = Math.min(scale, gap / (((x[i] - x[i - 1]) * difference) / 3));
      }
    }
    scale = Math.max(0, scale < 1 ? scale * (1 - 16 * Number.EPSILON) : 1);
    for (const boundary of tangents) boundary[i] *= scale;
  }

  const y = (value: number) => height * (1 - value);
  const curves = values.map((boundary, j) =>
    x.slice(1).map((end, i): Segment => {
      const third = (end - x[i]) / 3;
      return [
        [x[i] * width, y(boundary[i])],
        [(x[i] + third) * width, y(boundary[i] + third * tangents[j][i])],
        [(end - third) * width, y(boundary[i + 1] - third * tangents[j][i + 1])],
        [end * width, y(boundary[i + 1])],
      ];
    }),
  );
  const badgeX = width - 16;
  const samples = [
    badgeX - 10,
    badgeX + 10,
    ...curves[0].map((segment) => segment[0][0]).filter((x) => x > badgeX - 10 && x < badgeX + 10),
  ];
  const badges = series.flatMap((_, i) => {
    const top = Math.max(...samples.map((x) => boundaryY(curves[i + 1], x)));
    const bottom = Math.min(...samples.map((x) => boundaryY(curves[i], x)));
    return bottom - top >= 20 ? [{ number: i + 1, x: badgeX, y: (top + bottom) / 2 }] : [];
  });
  return {
    points,
    maximum,
    badges,
    ticks,
    bands: series.map((band, i) => ({
      ...band,
      path: path(curves[i + 1]) + path(curves[i], true).replace(/^M/, 'L') + 'Z',
    })),
    markers: [],
    separators: curves.slice(1, 3).map((curve) => path(curve)),
  };
}
