# Angular SVG stacked area chart

A standalone Angular component for three financial series. It renders smooth shared boundaries, EUR axes, and numbered badges in native SVG. The full component includes mouse/touch inspection and a numbered amount legend. Chart geometry and interactions have no runtime chart-library dependencies.

![700px chart preview](chart-700.png)

## Run with Docker

```sh
export LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)"
docker compose run --rm tooling npm ci --ignore-scripts
docker compose up -d dev preview
```

Open [localhost:4200](http://localhost:4200) to try smooth and straight modes, resize the chart, and view the reference, sparse, zero, single-point, and empty datasets.

```sh
docker compose run --rm check npm test -- --watch=false
docker compose run --rm check npm run build
docker compose run --rm check npm run format:check
docker compose down
```

Build output goes to `dist/stacked-area-chart-svg-angular/browser`. `LOCAL_UID` and `LOCAL_GID` keep generated files owned by your user. Docker is the only required host tool.

Optional Make shortcuts: `make install`, `make dev`, `make check`, and `make stop`. `make check` runs all three checks. On Nix, run `nix-shell -p gnumake` to use Make temporarily.

Containers use a digest-pinned Node image, run as unprivileged users, and have read-only roots, dropped capabilities, resource limits, and restricted mounts. Dependency scripts are disabled; builds and tests have no network access. The Angular server stays on an internal network. A small Node proxy, mounted read-only, exposes it at `127.0.0.1:4200`.

## Use the component

### Minimal component

Copy `src/app/minimal-stacked-area-chart/` and `THIRD_PARTY_NOTICES.md` into an Angular 20+ project. The component depends only on `@angular/core` and always draws smooth curves.

Import it into the parent's `imports` array:

```ts
import { Component } from '@angular/core';
import { MinimalStackedAreaChart } from './minimal-stacked-area-chart/minimal-stacked-area-chart';
import type { StackedAreaChartPoint } from './minimal-stacked-area-chart/geometry';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [MinimalStackedAreaChart],
  template: '<app-minimal-stacked-area-chart [data]="projection" />',
})
export class Example {
  readonly projection: readonly StackedAreaChartPoint[] = [
    { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
    { age: 51, contributions: 6510, governmentSupport: 16240, investmentGrowth: 12000 },
    { age: 67, contributions: 15500, governmentSupport: 30000, investmentGrowth: 51500 },
  ];
}
```

Pass finite, nonnegative amounts at distinct ages. One age renders as a narrow stacked marker; two or more form a smooth area. The chart follows its container from 290px to 700px wide and is at most 350px tall.

### Minimal straight-line component

`src/app/minimal-stacked-area-chart-linear/` is a standalone alternative that
connects samples with plain SVG line segments, without curve or spline logic.
Copy the folder into your Angular project, then import it into the parent component:

```ts
import { Component } from '@angular/core';
import { MinimalStackedAreaChartLinear } from './minimal-stacked-area-chart-linear/minimal-stacked-area-chart-linear';
import type { StackedAreaChartPoint } from './minimal-stacked-area-chart-linear/geometry';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [MinimalStackedAreaChartLinear],
  template: '<app-minimal-stacked-area-chart-linear [data]="projection" />',
})
export class Example {
  readonly projection: readonly StackedAreaChartPoint[] = [
    { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
    { age: 51, contributions: 6510, governmentSupport: 16240, investmentGrowth: 12000 },
    { age: 67, contributions: 15500, governmentSupport: 30000, investmentGrowth: 51500 },
  ];
}
```

It uses the same input shape, responsive sizing, axes, separators, and badges.

### Full component

Import `StackedAreaChart` into the parent component's `imports` array:

```ts
import { StackedAreaChart, type StackedAreaChartPoint } from './stacked-area-chart';

const projection: readonly StackedAreaChartPoint[] = [
  { age: 35, contributions: 0, governmentSupport: 0, investmentGrowth: 0 },
  { age: 51, contributions: 6510, governmentSupport: 16240, investmentGrowth: 12000 },
  { age: 67, contributions: 15500, governmentSupport: 30000, investmentGrowth: 51500 },
];
```

```html
<app-stacked-area-chart
  [data]="projection"
  interpolation="monotone"
  title="Kapitalentwicklung nach Alter"
/>
```

| Input           | Type                               | Default                         |
| --------------- | ---------------------------------- | ------------------------------- |
| `data`          | `readonly StackedAreaChartPoint[]` | Required                        |
| `interpolation` | `'monotone' \| 'linear'`           | `'monotone'`                    |
| `title`         | `string`                           | `Kapitalentwicklung nach Alter` |

Each amount is a series value at that age. The upper boundary is the sum of all three series. Bands run from contributions (blue) to government support (navy) to investment growth (orange). Pass a new array to update the data.

The SVG graphic scales from 290px to 700px wide and from 260px to 350px tall (`clamp(260px, width / 2, 350px)`). The wrapping legend below it adds its own height. Labels remain readable, age ticks thin out on small screens, and tight currency ticks use explicit thousands or millions. For containers under 290px, use `overflow-x: auto`.

Hover inside the plot to inspect the nearest supplied age. A shared tooltip shows the individual amounts and total in EUR, with up to two decimal places. The vertical guide and colored markers identify that observation; values between observations are not invented from the smooth curve. The tooltip disappears when the mouse leaves the plot.

On touch devices, tap to select and drag horizontally to inspect other ages. The card stays visible after release; tap outside the component to dismiss it. Vertical page scrolling and pinch zoom remain available. When data or width changes, inspection follows the same age if it still exists and closes if it disappears.

The legend shows each series' amount at the final observed age, using colored numbered circles that match the band badges. Inspecting another age changes the tooltip, not the legend.

## Data behavior

- Ages must be finite and unique. The chart sorts a copy and leaves input records unchanged.
- Amounts must be finite and nonnegative. Invalid or numerically unrepresentable data shows an invalid-data state.
- Empty input shows an empty state. All-zero data keeps the zero baseline and hides positive currency ticks.
- One age shows a narrow stacked marker; two ages use straight boundaries.
- Single-point and all-zero data support inspection. Empty or invalid data has no tooltip or amount legend.
- Badges appear only when the full circle fits inside a band.
- The SVG title and description include the age range, series, and final amounts. Each chart instance gets unique accessibility and clipping IDs.

## Implementation

- `src/app/stacked-area-chart/stacked-area-chart.ts`, `.html`, `.scss`: inputs, resize handling, SVG rendering, inspection, and legend.
- `src/app/stacked-area-chart/chart-geometry.ts`: stacked values, y-axis ticks, Bézier boundaries, and area paths.
- `src/app/stacked-area-chart/chart-interaction.ts`: SVG pointer coordinates and nearest-observation selection.
- `src/app/demo-data.ts`: data used by the demo.

The curve and area calculations adapt d3-shape 3.2.0. Damped tangents keep the bands ordered and smooth, and adjacent fills share geometry. Pointer conversion and observation selection adapt visx and Recharts. These libraries are not runtime dependencies. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) retains their ISC and MIT licenses and is included in production assets.
