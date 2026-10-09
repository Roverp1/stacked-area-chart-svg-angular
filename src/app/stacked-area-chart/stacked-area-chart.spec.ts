import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StackedAreaChart } from './stacked-area-chart';

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
});
