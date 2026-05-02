/**
 * Pure data helper for sparkline series. No React imports — safe to call from
 * server components. Lives in its own module so the "use client" directive
 * on sparkline.tsx doesn't pull this onto the wrong side of the boundary.
 */

export function syntheticSeries(
  seed: number,
  trend = 0.2,
  points = 7,
  noise = 0.15,
): number[] {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < points; i++) {
    v = Math.max(0, Math.min(1, v + trend / points + (rand() - 0.5) * noise));
    out.push(v);
  }
  return out;
}
