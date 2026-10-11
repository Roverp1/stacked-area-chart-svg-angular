import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StackedAreaChart } from './stacked-area-chart';

function setSvgCoordinates(svg: SVGSVGElement) {
  // jsdom lacks SVG transforms; this models a half-size SVG at screen position (20, 30).
  Object.defineProperties(svg, {
    getScreenCTM: {
      value: () => ({ inverse: () => ({ a: 2, d: 2, e: -40, f: -60 }) }),
    },
    createSVGPoint: {
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform(matrix: { a: number; d: number; e: number; f: number }) {
          return { x: this.x * matrix.a + matrix.e, y: this.y * matrix.d + matrix.f };
        },
      }),
    },
  });
}

function pointer(
  target: Element,
  type: string,
  clientX = 101,
  clientY = 100,
  pointerType = 'mouse',
) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: 1 },
    isPrimary: { value: true },
  });
  target.dispatchEvent(event);
}

describe('StackedAreaChart', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redraws its three bands when the parent supplies new data', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();

    const bands = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('svg path[data-series]'),
      ) as SVGPathElement[];
    expect(bands()).toHaveLength(3);
    const original = bands().map((path) => path.getAttribute('d'));

    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 10_000 },
    ]);
    await fixture.whenStable();

    expect(bands()).toHaveLength(3);
    expect(bands().map((path) => path.getAttribute('d'))).not.toEqual(original);
  });

  it('redraws at container width, respects its size limits, and releases the resize observer', async () => {
    let resize: ((width: number) => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = (width) =>
            callback(
              [{ contentRect: { width } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            );
        }
        observe() {}
        disconnect = disconnect;
      },
    );

    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    const original = svg.querySelector('path')!.getAttribute('d');

    resize?.(290);
    await fixture.whenStable();
    expect(svg.getAttribute('viewBox')).toBe('0 0 290 260');
    expect(svg.querySelector('path')!.getAttribute('d')).not.toBe(original);

    resize?.(850);
    await fixture.whenStable();
    expect(svg.getAttribute('viewBox')).toBe('0 0 700 350');

    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('exposes the age range, currency scale and series meanings in its SVG', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;

    expect(svg.getAttribute('role')).toBe('img');
    const title = svg.querySelector('title')!;
    const description = svg.querySelector('desc')!;
    expect(svg.getAttribute('aria-labelledby')?.split(' ')).toEqual([title.id, description.id]);
    expect(title.textContent).toContain('Kapitalentwicklung');
    expect(description.textContent).toContain('35 bis 67');
    expect(description.textContent).toContain('97.000 EUR');
    for (const series of ['Einzahlungen', 'Staatliche Förderung', 'Wertzuwachs']) {
      expect(description.textContent).toContain(series);
    }
    const labels = Array.from(svg.querySelectorAll('text')).map((text) => text.textContent?.trim());
    expect(labels).toContain('100.000 EUR');
    expect(labels).toContain('35');
    expect(labels).toContain('67');
  });

  it('shows numbered badges only for bands thick enough to contain them', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const badges = () =>
      Array.from(fixture.nativeElement.querySelectorAll('svg g[data-badge]')) as SVGGElement[];
    expect(badges().map((badge) => badge.textContent?.trim())).toEqual(['1', '2', '3']);

    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 1, governmentSupport: 0, investmentGrowth: 99_999 },
    ]);
    await fixture.whenStable();
    expect(badges().map((badge) => badge.textContent?.trim())).toEqual(['3']);
  });

  it('marks a single observed age without inventing an area and clears it for empty input', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 42, contributions: 10_000, governmentSupport: 5_000, investmentGrowth: 20_000 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.querySelectorAll('path[data-series]')).toHaveLength(0);
    expect(svg.querySelectorAll('rect[data-series]')).toHaveLength(3);
    expect(
      Array.from(svg.querySelectorAll('text')).map((text) => text.textContent?.trim()),
    ).toContain('42');

    fixture.componentRef.setInput('data', []);
    await fixture.whenStable();
    expect(svg.querySelectorAll('[data-series]')).toHaveLength(0);
    expect(
      Array.from(svg.querySelectorAll('text')).map((text) => text.textContent?.trim()),
    ).toContain('Keine Daten vorhanden');
  });

  it('inspects the nearest supplied age and shows individual amounts and their total in a scaled SVG', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 36, contributions: 1_250.5, governmentSupport: 125, investmentGrowth: 250.25 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);

    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
    pointer(svg, 'pointermove');
    await fixture.whenStable();

    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('Alter 36');
    expect(
      Array.from(tooltip.querySelectorAll('dt')).map((row) => row.textContent?.trim()),
    ).toEqual(['Einzahlungen', 'Staatliche Förderung', 'Wertzuwachs', 'Gesamt']);
    expect(
      Array.from(tooltip.querySelectorAll('dd')).map((row) => row.textContent?.trim()),
    ).toEqual(['1.250,5 EUR', '125 EUR', '250,25 EUR', '1.625,75 EUR']);
  });

  it('anchors the guide to the observation and its colored markers to cumulative stack boundaries', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();

    const guide = svg.querySelector('.selection-guide');
    expect(guide).not.toBeNull();
    expect(Number(guide!.getAttribute('x1'))).toBe(594);
    expect(Number(guide!.getAttribute('x2'))).toBe(594);
    const markers = Array.from(svg.querySelectorAll('.selection-marker'));
    expect(markers.map((marker) => marker.getAttribute('fill'))).toEqual([
      '#0769ad',
      '#052e64',
      '#fa6000',
    ]);
    expect(markers.map((marker) => Number(marker.getAttribute('cx')))).toEqual([594, 594, 594]);
    expect(Number(markers[0].getAttribute('cy'))).toBeCloseTo(256.88);
    expect(Number(markers[1].getAttribute('cy'))).toBeCloseTo(165.68);
    expect(Number(markers[2].getAttribute('cy'))).toBeCloseTo(9.12);
  });

  it('limits mouse inspection to the plot and dismisses it immediately on leaving', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    const tooltip = () => fixture.nativeElement.querySelector('[role="tooltip"]');

    pointer(svg, 'pointermove', 60);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();

    pointer(svg, 'pointermove');
    await fixture.whenStable();
    expect(tooltip()).not.toBeNull();
    pointer(svg, 'pointermove', 101, 200);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();

    pointer(svg, 'pointermove');
    await fixture.whenStable();
    pointer(svg, 'pointerleave');
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
    expect(svg.querySelector('.selection-guide')).toBeNull();
  });

  it('supports touch selection and scrubbing, keeps the card after release, and dismisses on an outside tap', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    const tooltip = () => fixture.nativeElement.querySelector('[role="tooltip"]');

    pointer(svg, 'pointerdown', 101, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 35');

    pointer(svg, 'pointermove', 355, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 67');

    pointer(svg, 'pointerup', 355, 100, 'touch');
    pointer(svg, 'pointerleave', 355, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 67');

    pointer(document.body, 'pointerdown', 0, 0, 'touch');
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
  });

  it('cancels touch inspection when the browser takes over a scrolling gesture', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 42, contributions: 10_000, governmentSupport: 5_000, investmentGrowth: 20_000 },
    ]);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    const tooltip = () => fixture.nativeElement.querySelector('[role="tooltip"]');

    pointer(svg, 'pointerdown', 101, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 42');
    pointer(svg, 'pointercancel', 101, 100, 'touch');
    pointer(svg, 'pointermove', 105, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()).toBeNull();

    pointer(svg, 'pointerdown', 101, 100, 'touch');
    pointer(svg, 'pointerup', 101, 100, 'touch');
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 42');
  });

  it('refreshes the inspected age through data changes and resize, and closes it permanently when removed', async () => {
    let resize: ((width: number) => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = (width) => callback([{ contentRect: { width } } as ResizeObserverEntry], this);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const fixture = TestBed.createComponent(StackedAreaChart);
    const points = [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 15_500, governmentSupport: 30_000, investmentGrowth: 51_500 },
    ];
    fixture.componentRef.setInput('data', points);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();

    fixture.componentRef.setInput('data', [
      points[0],
      { age: 67, contributions: 20_000, governmentSupport: 40_000, investmentGrowth: 10_000 },
    ]);
    await fixture.whenStable();
    const tooltip = () =>
      fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement | null;
    expect(tooltip()?.textContent).toContain('Alter 67');
    expect(
      Array.from(tooltip()!.querySelectorAll('dd')).map((row) => row.textContent?.trim()),
    ).toEqual(['20.000 EUR', '40.000 EUR', '10.000 EUR', '70.000 EUR']);

    resize?.(290);
    await fixture.whenStable();
    expect(tooltip()?.textContent).toContain('Alter 67');
    expect(Number(svg.querySelector('.selection-guide')?.getAttribute('x1'))).toBe(198);

    fixture.componentRef.setInput('data', [points[0]]);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
    fixture.componentRef.setInput('data', points);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
  });

  it('includes zero amounts in inspection and removes it for empty or invalid data', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    const zero = [
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 67, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
    ];
    fixture.componentRef.setInput('data', zero);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();
    const tooltip = () =>
      fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement | null;
    expect(tooltip()?.textContent).toContain('Alter 67');
    expect(
      Array.from(tooltip()!.querySelectorAll('dd')).map((row) => row.textContent?.trim()),
    ).toEqual(['0 EUR', '0 EUR', '0 EUR', '0 EUR']);

    fixture.componentRef.setInput('data', []);
    await fixture.whenStable();
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
    expect(svg.querySelector('.selection-guide')).toBeNull();

    fixture.componentRef.setInput('data', zero);
    await fixture.whenStable();
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();
    expect(tooltip()).not.toBeNull();
    fixture.componentRef.setInput('data', [{ ...zero[1], contributions: -1 }]);
    await fixture.whenStable();
    pointer(svg, 'pointermove', 355);
    await fixture.whenStable();
    expect(tooltip()).toBeNull();
    expect(svg.querySelector('.selection-guide')).toBeNull();
  });

  it('shows numbered final-age amounts in the legend independently of inspection and refreshes them with data', async () => {
    const fixture = TestBed.createComponent(StackedAreaChart);
    fixture.componentRef.setInput('data', [
      { age: 67, contributions: 59_520, governmentSupport: 25_474, investmentGrowth: 78_814 },
      { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
      { age: 45, contributions: 10_000, governmentSupport: 5_000, investmentGrowth: 20_000 },
    ]);
    await fixture.whenStable();
    const legend = () => fixture.nativeElement.querySelector('.chart-legend') as HTMLElement | null;
    const items = () => Array.from(legend()!.querySelectorAll('li'));
    const amounts = () => items().map((item) => item.querySelector('strong')?.textContent?.trim());

    expect(legend()).not.toBeNull();
    expect(
      items().map((item) => item.querySelector('.legend-number')?.textContent?.trim()),
    ).toEqual(['1', '2', '3']);
    expect(amounts()).toEqual(['59.520 EUR', '25.474 EUR', '78.814 EUR']);
    expect(items()[0].textContent).toContain('Einzahlungen');
    expect(items()[1].textContent).toContain('Staatliche Förderung');
    expect(items()[2].textContent).toContain('Wertzuwachs');

    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    setSvgCoordinates(svg);
    pointer(svg, 'pointermove');
    await fixture.whenStable();
    expect(amounts()).toEqual(['59.520 EUR', '25.474 EUR', '78.814 EUR']);

    fixture.componentRef.setInput('data', [
      { age: 42, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
    ]);
    await fixture.whenStable();
    expect(amounts()).toEqual(['0 EUR', '0 EUR', '0 EUR']);
    fixture.componentRef.setInput('data', []);
    await fixture.whenStable();
    expect(legend()).toBeNull();
  });
});
