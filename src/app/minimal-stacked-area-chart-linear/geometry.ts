export interface StackedAreaChartPoint {
  readonly age: number;
  readonly contributions: number;
  readonly governmentSupport: number;
  readonly investmentGrowth: number;
}

interface Coordinate {
  readonly x: number;
  readonly y: number;
}

const series = [
  { key: 'contributions', color: '#0769ad' },
  { key: 'governmentSupport', color: '#052e64' },
  { key: 'investmentGrowth', color: '#fa6000' },
] as const;

function path(points: readonly Coordinate[]): string {
  const format = ({ x, y }: Coordinate) => `${Number(x.toFixed(4))},${Number(y.toFixed(4))}`;
  return points.map((point, i) => `${i ? 'L' : 'M'}${format(point)}`).join('');
}

function valueAt(boundary: readonly Coordinate[], x: number): number {
  const index = boundary.findIndex((point) => point.x >= x);
  const right = boundary[Math.max(1, index)];
  const left = boundary[Math.max(0, index - 1)];
  const t = (x - left.x) / (right.x - left.x);
  return left.y + (right.y - left.y) * t;
}

export function createGeometry(
  data: readonly StackedAreaChartPoint[],
  width: number,
  height: number,
) {
  const empty = {
    points: [] as StackedAreaChartPoint[],
    maximum: 1,
    ticks: [0],
    boundaries: [] as Coordinate[][],
    bands: [] as { key: string; color: string; path: string }[],
    markers: [] as { key: string; color: string; y: number; height: number }[],
    badges: [] as { number: number; x: number; y: number }[],
  };

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    data.some(
      (point) =>
        !Number.isFinite(point.age) ||
        series.some(({ key }) => !Number.isFinite(point[key]) || point[key] < 0),
    )
  )
    return empty;

  const points = [...data].sort((a, b) => a.age - b.age);
  if (points.some((point, i) => i > 0 && point.age === points[i - 1].age)) return empty;

  const cumulative = points.map((point) => [
    0,
    point.contributions,
    point.contributions + point.governmentSupport,
    point.contributions + point.governmentSupport + point.investmentGrowth,
  ]);
  const peak = cumulative.reduce((maximum, point) => Math.max(maximum, point[3]), 0);
  if (!Number.isFinite(peak)) return empty;

  const rawStep = peak === 0 ? 1 : peak / 5;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const ratio = rawStep / power;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  const count = peak === 0 ? 0 : Math.ceil(peak / step);
  const maximum = peak === 0 ? 1 : count * step;
  if (!Number.isFinite(maximum) || !Number.isFinite(step) || step <= 0) return empty;
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

  if (points.length < 2) return { ...empty, points, maximum, ticks };
  const ageSpan = points[points.length - 1].age - points[0].age;
  if (!Number.isFinite(ageSpan) || ageSpan <= 0) return empty;

  const boundaries = [0, 1, 2, 3].map((index) =>
    points.map((point, i) => ({
      x: ((point.age - points[0].age) / ageSpan) * width,
      y: height * (1 - cumulative[i][index] / maximum),
    })),
  );
  const bands = series.map((band, i) => ({
    ...band,
    path: `${path(boundaries[i + 1])}${path([...boundaries[i]].reverse()).replace(/^M/, 'L')}Z`,
  }));

  const badgeX = width - 16;
  const left = badgeX - 10;
  const right = badgeX + 10;
  const samples = [
    left,
    right,
    ...boundaries[0].map(({ x }) => x).filter((x) => x > left && x < right),
  ];
  const badges = series.flatMap((_, i) => {
    const upper = Math.max(...samples.map((x) => valueAt(boundaries[i + 1], x)));
    const lower = Math.min(...samples.map((x) => valueAt(boundaries[i], x)));
    return lower - upper >= 20 ? [{ number: i + 1, x: badgeX, y: (upper + lower) / 2 }] : [];
  });

  return { ...empty, points, maximum, ticks, boundaries, bands, badges };
}
