// Colour contrast as the page paints it (WCAG 2 ratios), for component tests
// that assert a colour pair is readable. Translucent colours are composited
// over what is behind them: an element's own background over its ancestors'
// (the first opaque one, else white), and a text colour over that surface.

export type Rgba = [r: number, g: number, b: number, a: number];

/** Any CSS colour (oklch, color-mix, …) to sRGB 0–255 and alpha 0–1, through a canvas. */
export const rgba = (color: string): Rgba => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!, a! / 255];
};

/** `top` painted over an opaque `bottom`. */
export const over = (top: Rgba, bottom: Rgba): Rgba => {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)).concat(1) as Rgba;
};

const luminance = ([r, g, b]: Rgba) =>
  [r, g, b]
    .map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);

/** The contrast ratio of two opaque colours (1 to 21). */
export const ratio = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** The opaque colour an element's box is painted in: its background over its ancestors'. */
export const surfaceOf = (el: Element): Rgba => {
  const layers: Rgba[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const layer = rgba(getComputedStyle(node).backgroundColor);
    if (layer[3] === 0) continue;
    layers.push(layer);
    if (layer[3] === 1) break;
  }
  return layers.reduceRight<Rgba>((under, layer) => over(layer, under), [255, 255, 255, 1]);
};

/** An element's text (or `currentColor` icon) colour as painted on its surface. */
export const textOf = (el: Element): Rgba => over(rgba(getComputedStyle(el).color), surfaceOf(el));

/** The contrast of an element's text against its own surface. */
export const textContrast = (el: Element) => ratio(textOf(el), surfaceOf(el));

/** The contrast between two elements' surfaces (a bar against the page behind it). */
export const surfaceContrast = (a: Element, b: Element) => ratio(surfaceOf(a), surfaceOf(b));
