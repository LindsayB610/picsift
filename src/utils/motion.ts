/**
 * Respect user preference for reduced motion (accessibility).
 * Use to skip or reduce confetti, animations, etc.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
