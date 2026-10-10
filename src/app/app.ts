import { Component, computed, signal } from '@angular/core';
import { StackedAreaChart } from './stacked-area-chart/stacked-area-chart';
import { MinimalStackedAreaChart } from './minimal-stacked-area-chart/minimal-stacked-area-chart';
import { MinimalStackedAreaChartLinear } from './minimal-stacked-area-chart-linear/minimal-stacked-area-chart-linear';
import { ChartInterpolation } from './stacked-area-chart/chart.types';
import { DEMO_DATASETS, DemoDatasetId } from './demo-data';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StackedAreaChart, MinimalStackedAreaChart, MinimalStackedAreaChartLinear],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly datasets = DEMO_DATASETS;
  readonly datasetId = signal<DemoDatasetId>('reference');
  readonly interpolation = signal<ChartInterpolation>('monotone');
  readonly chartWidth = signal(700);
  readonly dataset = computed(
    () => this.datasets.find((dataset) => dataset.id === this.datasetId()) ?? this.datasets[0],
  );

  selectDataset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const dataset = this.datasets.find((candidate) => candidate.id === value);
    if (dataset) this.datasetId.set(dataset.id);
  }

  resizeChart(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(value)) this.chartWidth.set(Math.min(700, Math.max(290, value)));
  }
}
