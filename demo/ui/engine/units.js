/**
 * @module units
 * Friendly distance formatting for coaching evidence (Stats API / Unreal units).
 * Convention: 100 uu = 1 m. Car length ~118 uu (approx Octane length).
 * Internal math stays in uu; only user-facing strings go through fmtDist / fmtDistShort.
 */
export const UU_PER_M = 100;
export const UU_PER_CAR = 118;

/** Meters with 1 decimal if under 10 m, else whole meters. */
export function fmtMeters(uu) {
  const m = Math.abs(+uu || 0) / UU_PER_M;
  if (m < 10) return `${m.toFixed(1)} m`;
  return `${Math.round(m)} m`;
}

/**
 * @param {number} uu distance in Unreal units
 * @param {{ units?: 'meters'|'cars', preferCars?: boolean }} [opts]
 *   units='cars' -> car lengths; units='meters' (default) -> meters, but under ~2.5 m
 *   car-length phrasing is used when it reads better for short gaps (unless preferCars is false).
 */
export function fmtDist(uu, opts = {}) {
  const abs = Math.abs(+uu || 0);
  const units = opts.units === 'cars' ? 'cars' : 'meters';
  const useCars = units === 'cars' || (opts.preferCars !== false && abs > 0 && abs < 2.5 * UU_PER_M);
  if (useCars && abs >= 40) {
    const cars = abs / UU_PER_CAR;
    if (cars < 0.35) return fmtMeters(abs);
    const n = cars < 1.6 ? +cars.toFixed(1) : Math.round(cars);
    return n === 1 ? '1 car length' : `${n} car lengths`;
  }
  return fmtMeters(abs);
}

/** Compact form for evidence lines (same rules, shorter labels). */
export function fmtDistShort(uu, opts = {}) {
  const abs = Math.abs(+uu || 0);
  const units = opts.units === 'cars' ? 'cars' : 'meters';
  const useCars = units === 'cars' || (opts.preferCars !== false && abs > 0 && abs < 2.5 * UU_PER_M);
  if (useCars && abs >= 40) {
    const cars = abs / UU_PER_CAR;
    if (cars < 0.35) return fmtMeters(abs);
    const n = cars < 1.6 ? +cars.toFixed(1) : Math.round(cars);
    return n === 1 ? '1 car' : `${n} cars`;
  }
  return fmtMeters(abs);
}
