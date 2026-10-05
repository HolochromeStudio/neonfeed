/**
 * Canvas zoom for the fixed logical resolution (D2: integer-scale only, letterboxed). Pure.
 * The largest integer zoom whose canvas fits the viewport; the page behind it shows the plank letterbox
 * (UiTheme LETTERBOX_CSS). Viewports smaller than the logical size cannot fit even 1x: they get the exact
 * fractional fit instead of a cropped canvas (the only non-integer case).
 */
export function fitZoom(viewW: number, viewH: number, logicalW = 360, logicalH = 640): number {
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) return 1;
  const fit = Math.min(viewW / logicalW, viewH / logicalH);
  return fit >= 1 ? Math.floor(fit) : fit;
}
