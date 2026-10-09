import { StackedAreaChartPoint } from './stacked-area-chart/chart.types';

export type DemoDatasetId = 'reference' | 'sparse' | 'zero' | 'single' | 'double' | 'empty';

interface DemoDataset {
  readonly id: DemoDatasetId;
  readonly label: string;
  readonly data: readonly StackedAreaChartPoint[];
}

const roundAmount = (value: number): number => Math.round(value * 100) / 100;

const referenceData: readonly StackedAreaChartPoint[] = Array.from({ length: 33 }, (_, index) => {
  const t = index / 32;
  const contributions = 15500 * (0.68 * t + 0.32 * t * t);
  return {
    age: 35 + index,
    contributions: roundAmount(contributions),
    governmentSupport: roundAmount(45500 * t - contributions),
    investmentGrowth: roundAmount(51500 * (0.3 * t + (0.7 * Math.expm1(4 * t)) / Math.expm1(4))),
  };
});

const sparseAges = new Set([35, 39, 45, 53, 61, 67]);

export const DEMO_DATASETS: readonly DemoDataset[] = [
  { id: 'reference', label: 'Reference · 33 points', data: referenceData },
  {
    id: 'sparse',
    label: 'Sparse · 6 points',
    data: referenceData.filter((point) => sparseAges.has(point.age)),
  },
  {
    id: 'zero',
    label: 'All zero',
    data: referenceData.map((point) => ({
      age: point.age,
      contributions: 0,
      governmentSupport: 0,
      investmentGrowth: 0,
    })),
  },
  { id: 'single', label: 'Single point', data: referenceData.slice(-1) },
  {
    id: 'double',
    label: 'Two points',
    data: [referenceData.slice(0, 1)[0], referenceData.slice(-1)[0]],
  },
  { id: 'empty', label: 'Empty', data: [] },
];
