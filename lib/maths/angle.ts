export const TAU = Math.PI * 2;

/**
 * The angle of a value around the circle: value mod 2π, in [0, 2π).
 * Going through sin and cos keeps it accurate even for very large values.
 */
export function angleOf(value: number): number {
  const a = Math.atan2(Math.sin(value), Math.cos(value));
  const t = a < 0 ? a + TAU : a;
  return t >= TAU ? 0 : t;
}
