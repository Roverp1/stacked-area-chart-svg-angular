import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { createGeometry, type StackedAreaChartPoint } from './geometry';

@Component({
  selector: 'app-minimal-stacked-area-chart-linear',
  standalone: true,
  templateUrl: './minimal-stacked-area-chart-linear.html',
  styleUrl: './minimal-stacked-area-chart-linear.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinimalStackedAreaChartLinear {
  readonly data = input.required<readonly StackedAreaChartPoint[]>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly width = signal(700);
  private readonly numbers = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  protected readonly layout = computed(() => {
    const width = this.width();
    const height = Math.max(260, Math.min(350, Math.round(width / 2)));
    const left = width < 420 ? 78 : 92;
    return { width, height, left, plotWidth: width - left - 14, plotHeight: height - 46 };
  });

  protected readonly chart = computed(() => {
    const { plotWidth, plotHeight } = this.layout();
    return createGeometry(this.data(), plotWidth, plotHeight);
  });

  protected readonly ages = computed(() => {
    const points = this.chart().points;
    if (!points.length) return [];
    const { plotWidth, width } = this.layout();
    const first = points[0].age;
    const last = points[points.length - 1].age;
    if (points.length === 1) return [{ age: first, x: plotWidth / 2, anchor: 'middle' }];
    const spacing = width < 420 ? 46 : 34;
    let previous = -Infinity;
    return points
      .map((point) => ({ age: point.age, x: ((point.age - first) / (last - first)) * plotWidth }))
      .filter((point) => {
        if (point.age === last) return true;
        if (point.x - previous < spacing || (point.age !== first && plotWidth - point.x < spacing))
          return false;
        previous = point.x;
        return true;
      })
      .map((point) => ({
        ...point,
        anchor: point.age === first ? 'start' : point.age === last ? 'end' : 'middle',
      }));
  });

  protected currency(value: number): string {
    if (value === 0) return '0';
    return this.width() < 420 && this.chart().maximum >= 1000
      ? `${this.numbers.format(value / 1000)} Tsd. €`
      : `${this.numbers.format(value)} EUR`;
  }

  protected boundaryPath(points: readonly { x: number; y: number }[]): string {
    return points.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join('');
  }

  constructor() {
    afterNextRender({
      read: () => {
        const resize = (width: number) => {
          if (width > 0) this.width.set(Math.max(290, Math.min(700, Math.round(width))));
        };
        resize(this.element.nativeElement.getBoundingClientRect().width);
        const observer = new ResizeObserver(([entry]) => resize(entry.contentRect.width));
        observer.observe(this.element.nativeElement);
        this.destroyRef.onDestroy(() => observer.disconnect());
      },
    });
  }
}
