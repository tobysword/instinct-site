// Small formatters shared by the engine, the overlay and the window (QC F: each was copied into several files).
/** "3 games", "1 touch", "2 matches". */
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(s|sh|ch|x)$/.test(w) ? 'es' : 's'}`;
/** m:ss, rounding down (a time that has not finished yet). */
export const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** m:ss of a match clock, to the nearest second. */
export const fmtClock = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** The average, or null for an empty list. */
export const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
