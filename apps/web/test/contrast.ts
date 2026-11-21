/**
 * WCAG contrast helpers for component tests. Canvas turns any CSS colour into
 * RGB, and a translucent colour is composited over its surface first.
 */

const ctx = (() => {
  let c: CanvasRenderingContext2D | null = null;
  return () => {
    if (!c) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      c = cv.getContext("2d", { willReadFrequently: true })!;
    }
    return c;
  };
})();

/** The RGB a CSS colour paints over an opaque surface colour. */
export function rgbOver(color: string, surface = "#fff"): number[] {
  const x = ctx();
  x.clearRect(0, 0, 1, 1);
  x.fillStyle = "#fff";
  x.fillRect(0, 0, 1, 1);
  x.fillStyle = surface;
  x.fillRect(0, 0, 1, 1);
  x.fillStyle = color;
  x.fillRect(0, 0, 1, 1);
  return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

const luminance = (c: number[]) =>
  c
    .map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);

/** The contrast ratio of two RGB colours. */
export function ratio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The contrast of an element's text over a surface colour (the element's own, or a given one). */
export function textContrast(el: Element, surface?: string): number {
  const cs = getComputedStyle(el);
  const bg = surface ?? cs.backgroundColor;
  const back = rgbOver(bg);
  return ratio(rgbOver(cs.color, bg), back);
}
