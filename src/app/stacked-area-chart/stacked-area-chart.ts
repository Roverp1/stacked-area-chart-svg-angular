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
import { createChartGeometry, evaluateBoundary } from './chart-geometry';
import type { ChartInterpolation, StackedAreaChartPoint } from './chart.types';

const numbers = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
let nextChartId = 0;

@Component({
  selector: 'app-stacked-area-chart',
  templateUrl: './stacked-area-chart.html',
  styleUrl: './stacked-area-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StackedAreaChart {
  readonly data = input.required<readonly StackedAreaChartPoint[]>();
  readonly interpolation = input<ChartInterpolation>('monotone');
  readonly title = input('Kapitalentwicklung nach Alter');

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly width = signal(700);
  private readonly id = `stacked-area-${nextChartId++}`;
  protected readonly titleId = `${this.id}-title`;
  protected readonly descriptionId = `${this.id}-description`;
  protected readonly clipId = `${this.id}-plot`;

  protected readonly layout = computed(() => {
    const width = this.width();
    const height = Math.min(350, Math.max(260, Math.round(width / 2)));
    const compact = width < 420;
    const left = compact ? 78 : 92;
    return {
      width,
      height,
      compact,
      left,
      top: 16,
      plotWidth: width - left - 14,
      plotHeight: height - 46,
    };
  });

  protected readonly geometry = computed(() => {
    const { plotWidth, plotHeight } = this.layout();
    return createChartGeometry(this.data(), plotWidth, plotHeight, this.interpolation(), 6);
  });

  protected readonly yTicks = computed(() => {
    const { ticks, yMaximum, height } = this.geometry();
    const compact = this.layout().compact || numbers.format(yMaximum).length > 12;
    const divisor =
      !compact || yMaximum < 1000 ? 1 : yMaximum >= 1e9 ? 1e9 : yMaximum >= 1e6 ? 1e6 : 1000;
    const suffix = divisor === 1e9 ? 'Mrd. €' : divisor === 1e6 ? 'Mio. €' : 'Tsd. €';
    return ticks.map((value) => ({
      value,
      y: height * (1 - value / yMaximum),
      label:
        value === 0
          ? '0'
          : divisor === 1
            ? `${numbers.format(value)} EUR`
            : `${numbers.format(value / divisor)} ${suffix}`,
    }));
  });

  protected readonly xTicks = computed(() => {
    const { points } = this.geometry();
    const { plotWidth, compact } = this.layout();
    if (!points.length) return [];
    if (points.length === 1)
      return [
        {
          age: points[0].age,
          x: plotWidth / 2,
          label: numbers.format(points[0].age),
          anchor: 'middle',
        },
      ];
    const first = points[0].age;
    const span = points[points.length - 1].age - first;
    const spacing = compact ? 46 : 34;
    const maximum = Math.max(2, Math.floor(plotWidth / spacing) + 1);
    const step = Math.ceil((points.length - 1) / (maximum - 1));
    const candidates = points.filter(
      (_, index) => index % step === 0 || index === points.length - 1,
    );
    let previous = -Infinity;
    return candidates
      .filter((point, index) => {
        const x = plotWidth * ((point.age - first) / span);
        if (index === candidates.length - 1) return true;
        if (x - previous < spacing || (index > 0 && plotWidth - x < spacing)) return false;
        previous = x;
        return true;
      })
      .map((point) => ({
        age: point.age,
        x: plotWidth * ((point.age - first) / span),
        label: numbers.format(point.age),
        anchor:
          point === points[0] ? 'start' : point === points[points.length - 1] ? 'end' : 'middle',
      }));
  });

  protected readonly description = computed(() => {
    const { state, points } = this.geometry();
    if (state === 'empty') return 'Keine Daten vorhanden.';
    if (state === 'invalid')
      return 'Daten können nicht dargestellt werden. Alter muss eindeutig sein; Beträge müssen endlich und nicht negativ sein.';
    const last = points[points.length - 1];
    const ages =
      points.length === 1
        ? `${numbers.format(last.age)}`
        : `${numbers.format(points[0].age)} bis ${numbers.format(last.age)}`;
    const total = last.contributions + last.governmentSupport + last.investmentGrowth;
    return (
      `Gestapeltes Flächendiagramm, Alter ${ages}. Werte am letzten Alter: ` +
      `1 Einzahlungen ${numbers.format(last.contributions)} EUR; ` +
      `2 Staatliche Förderung ${numbers.format(last.governmentSupport)} EUR; ` +
      `3 Wertzuwachs ${numbers.format(last.investmentGrowth)} EUR. Gesamt ${numbers.format(total)} EUR.`
    );
  });

  protected readonly badges = computed(() => {
    const { state, boundaries, width } = this.geometry();
    if (state !== 'ready') return [];
    const x = width - 16;
    const radius = 8;
    const left = (x - radius - 2) / width;
    const right = (x + radius + 2) / width;
    const samples = [
      left,
      right,
      ...boundaries[0].knots
        .map((knot) => knot.x / width)
        .filter((position) => position > left && position < right),
    ];

    return [1, 2, 3].flatMap((number) => {
      // The whole circle must clear a steep boundary, not just its center.
      const top = Math.max(
        ...samples.map((position) => evaluateBoundary(boundaries[number], position)!.y),
      );
      const bottom = Math.min(
        ...samples.map((position) => evaluateBoundary(boundaries[number - 1], position)!.y),
      );
      return bottom - top >= 2 * (radius + 2) ? [{ number, x, y: (top + bottom) / 2, radius }] : [];
    });
  });

  protected readonly singleMarkers = computed(() => {
    const { state, boundaries, bands } = this.geometry();
    if (state !== 'single') return [];
    return bands.flatMap((band, index) => {
      const upper = boundaries[index + 1].knots[0];
      const height = boundaries[index].knots[0].y - upper.y;
      return height > 0 ? [{ ...band, x: upper.x - 2, y: upper.y, height }] : [];
    });
  });

  protected readonly message = computed(() => {
    switch (this.geometry().state) {
      case 'empty':
        return 'Keine Daten vorhanden';
      case 'invalid':
        return 'Ungültige Daten';
      case 'zero':
        return 'Alle Werte sind 0 EUR';
      default:
        return '';
    }
  });

  constructor() {
    afterNextRender({
      read: () => {
        const element = this.element.nativeElement;
        const update = (width: number) => {
          if (width > 0 && Number.isFinite(width)) {
            this.width.set(Math.max(290, Math.min(700, Math.round(width))));
          }
        };
        update(element.getBoundingClientRect().width);
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver((entries) => update(entries[0].contentRect.width));
        observer.observe(element);
        this.destroyRef.onDestroy(() => observer.disconnect());
      },
    });
  }
}
