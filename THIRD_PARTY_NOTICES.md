# Third-party notices

In `src/app/stacked-area-chart/chart-geometry.ts`, curve tangents and
Hermite-to-Bezier calculations adapt d3-shape 3.2.0's `src/curve/monotone.js`.
Stack accumulation and area traversal follow `src/stack.js`, `src/offset/none.js`,
and `src/area.js`. The minimal chart reuses these calculations. d3-shape is not a
runtime dependency.

## d3-shape (ISC)

Copyright 2010-2022 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

## visx and Recharts (MIT)

In `src/app/stacked-area-chart/chart-interaction.ts`, SVG pointer conversion
adapts visx's `packages/visx-event/src/localPointGeneric.ts`, revision
`485c0359664ee8e612992defb16e1f035ed40b23`. Nearest-observation selection adapts
the Cartesian midpoint selection in Recharts' `src/util/getActiveCoordinate.ts`,
revision `d9562fc605c811a9596fdf2582b82cc954a3f061`.
Neither library is a runtime dependency.

Copyright (c) 2017-2018 Harrison Shoff

Copyright (c) 2015-present recharts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
