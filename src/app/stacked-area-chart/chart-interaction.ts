import type { ChartCoordinate } from './chart.types';

// Adapted from visx localPointGeneric; its MIT notice is in THIRD_PARTY_NOTICES.md.
export function localPoint(svg: SVGSVGElement, event: PointerEvent): ChartCoordinate | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

// Recharts selects observations at the midpoints between their actual x coordinates.
export function nearestPointIndex(x: number, knots: readonly ChartCoordinate[]): number {
  return knots.findIndex(
    (knot, index) => index === knots.length - 1 || x <= knot.x / 2 + knots[index + 1].x / 2,
  );
}
