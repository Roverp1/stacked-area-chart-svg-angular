import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { createChartGeometry, evaluateBoundary } from './chart-geometry';
import { localPoint, nearestPointIndex } from './chart-interaction';
import type { ChartInterpolation, StackedAreaChartPoint } from './chart.types';

const numbers = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const seriesLabels = {
  contributions: 'Einzahlungen',
  governmentSupport: 'Staatliche Förderung',
  investmentGrowth: 'Wertzuwachs',
};
let nextChartId = 0;

@Component({
  selector: 'app-stacked-area-chart',
  templateUrl: './stacked-area-chart.html',
  styleUrl: './stacked-area-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'onDocumentPointerDown($event)' },
})
export class StackedAreaChart {
  readonly data = input.required<readonly StackedAreaChartPoint[]>();
  readonly interpolation = input<ChartInterpolation>('monotone');
  readonly title = input('Kapitalentwicklung nach Alter');

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly width = signal(700);
  private readonly selectedAge = signal<number | null>(null);
  private readonly interaction = signal<'mouse' | 'touch'>('mouse');
  private touchPointerId: number | null = null;
  private readonly pointerY = signal(0.5);
  private readonly tooltipElement = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly graphicElement = viewChild<ElementRef<HTMLElement>>('graphic');
  private readonly tooltipMetrics = signal({
    width: 0,
    height: 0,
    graphicWidth: 700,
    graphicHeight: 350,
  });
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

  protected readonly selection = computed(() => {
    const { points, bands, boundaries } = this.geometry();
    const index = points.findIndex((point) => point.age === this.selectedAge());
    if (index < 0) return null;
    const point = points[index];
    return {
      age: numbers.format(point.age),
      x: boundaries[0].knots[index].x,
      rows: bands.map((band, bandIndex) => ({
        ...band,
        y: boundaries[bandIndex + 1].knots[index].y,
        label: seriesLabels[band.key],
        amount: `${numbers.format(point[band.key])} EUR`,
      })),
      total: `${numbers.format(point.contributions + point.governmentSupport + point.investmentGrowth)} EUR`,
    };
  });

  protected readonly legend = computed(() => {
    const { points, bands } = this.geometry();
    const last = points[points.length - 1];
    if (!last) return null;
    return {
      age: numbers.format(last.age),
      rows: bands.map((band, index) => ({
        key: band.key,
        color: band.color,
        number: index + 1,
        label: seriesLabels[band.key],
        amount: `${numbers.format(last[band.key])} EUR`,
      })),
    };
  });

  protected readonly tooltipPosition = computed(() => {
    const selected = this.selection();
    if (!selected) return { x: 0, y: 0 };
    const { width, height, graphicWidth, graphicHeight } = this.tooltipMetrics();
    const layout = this.layout();
    const x = ((layout.left + selected.x) / layout.width) * graphicWidth;
    const y = ((layout.top + this.pointerY() * layout.plotHeight) / layout.height) * graphicHeight;
    const gap = this.interaction() === 'touch' ? 28 : 12;
    const padding = 8;
    const left = x + gap + width <= graphicWidth - padding ? x + gap : x - gap - width;
    const top = y - gap - height >= padding ? y - gap - height : y + gap;
    return {
      x: Math.max(padding, Math.min(left, graphicWidth - width - padding)),
      y: Math.max(padding, Math.min(top, graphicHeight - height - padding)),
    };
  });

  protected onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' && this.touchPointerId !== event.pointerId) return false;
    const point = localPoint(event.currentTarget as SVGSVGElement, event);
    const { points, boundaries } = this.geometry();
    if (!point || !points.length) return false;
    const { left, top, plotWidth, plotHeight } = this.layout();
    const x = point.x - left;
    const y = point.y - top;
    if (x < 0 || x > plotWidth || y < 0 || y > plotHeight) {
      if (event.pointerType !== 'touch') this.selectedAge.set(null);
      return false;
    }
    this.interaction.set(event.pointerType === 'touch' ? 'touch' : 'mouse');
    this.pointerY.set(y / plotHeight);
    const index = nearestPointIndex(x, boundaries[0].knots);
    this.selectedAge.set(points[index].age);
    return true;
  }

  protected onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    this.touchPointerId = event.pointerId;
    if (!this.onPointerMove(event)) {
      this.touchPointerId = null;
      return;
    }
    // Synthetic events have no browser pointer to capture.
    if (event.isTrusted) (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  }

  protected onPointerUp(event: PointerEvent) {
    if (this.touchPointerId === event.pointerId) this.touchPointerId = null;
  }

  protected onPointerCancel(event: PointerEvent) {
    if (this.touchPointerId !== event.pointerId) return;
    this.touchPointerId = null;
    this.selectedAge.set(null);
  }

  protected onPointerLeave() {
    if (this.interaction() !== 'touch') this.selectedAge.set(null);
  }

  protected onDocumentPointerDown(event: PointerEvent) {
    if (!(event.target instanceof Node) || !this.element.nativeElement.contains(event.target)) {
      this.selectedAge.set(null);
      this.touchPointerId = null;
    }
  }

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
    effect(() => {
      const age = this.selectedAge();
      if (age !== null && !this.geometry().points.some((point) => point.age === age)) {
        this.selectedAge.set(null);
        this.touchPointerId = null;
      }
    });
    afterRenderEffect({
      read: () => {
        const tooltip = this.tooltipElement()?.nativeElement;
        const graphic = this.graphicElement()?.nativeElement;
        const layout = this.layout();
        this.selection();
        if (!tooltip || !graphic) return;
        const metrics = {
          width: tooltip.offsetWidth,
          height: tooltip.offsetHeight,
          graphicWidth: graphic.clientWidth || layout.width,
          graphicHeight: graphic.clientHeight || layout.height,
        };
        const previous = this.tooltipMetrics();
        if (
          metrics.width !== previous.width ||
          metrics.height !== previous.height ||
          metrics.graphicWidth !== previous.graphicWidth ||
          metrics.graphicHeight !== previous.graphicHeight
        ) {
          this.tooltipMetrics.set(metrics);
        }
      },
    });
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
