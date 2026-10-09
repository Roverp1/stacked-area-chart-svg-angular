export interface StackedAreaChartPoint {
  readonly age: number;
  readonly contributions: number;
  readonly governmentSupport: number;
  readonly investmentGrowth: number;
}

export type ChartInterpolation = 'monotone' | 'linear';
export type ChartState = 'empty' | 'single' | 'zero' | 'ready' | 'invalid';

export interface ChartCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface BoundarySegment {
  readonly start: ChartCoordinate;
  readonly control1: ChartCoordinate;
  readonly control2: ChartCoordinate;
  readonly end: ChartCoordinate;
}

export interface ChartBoundary {
  readonly path: string;
  readonly segments: readonly BoundarySegment[];
  readonly knots: readonly ChartCoordinate[];
}

export interface ChartBand {
  readonly key: 'contributions' | 'governmentSupport' | 'investmentGrowth';
  readonly color: string;
  readonly path: string;
}

export interface ChartGeometry {
  readonly state: ChartState;
  readonly error?: string;
  readonly points: readonly StackedAreaChartPoint[];
  readonly width: number;
  readonly height: number;
  readonly maxTotal: number;
  readonly yMaximum: number;
  readonly ticks: readonly number[];
  /** Baseline, contributions, contributions + support, total, in that order. */
  readonly boundaries: readonly ChartBoundary[];
  readonly bands: readonly ChartBand[];
  readonly topBoundaryPath: string;
}
