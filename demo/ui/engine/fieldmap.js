/**
 * @module fieldmap
 * Where you play (2.9): the data behind the 3D field (ui/app/field3d.js), kept on the match record as `me.map`.
 *
 *   me.map = { t: [[x, y, z], ...]   the ball at each of your touches (live play, every game)
 *              g: [[x, y, z], ...]   the ball at your last touch before each goal you scored (live play)
 *              p: { g, l, h }        time on the ground / in low air / in high air per field cell (a saved replay only)
 *              c: [[x, y, z], ...]   where your car was, about once a second (a saved replay only): the cloud on the field
 *              s: [[x, y, z, k], ...] the ball at each of your shots; k: 0 off target, 1 on target, 2 goal (a saved replay only)
 *              v: [[x, y, z], ...]   the ball at each of your saves (a saved replay only)
 *              r: [[x, y, z, k], ...]  your car at each landing; k: 1 clean, 0 not (a saved replay only)
 *              3.1, from a saved replay (codes below; -1 = not known):
 *              tk: [[x, y, z, TOUCH_K, cost], ...] every touch and what it led to; cost 1-5 for a lost ball (their third,
 *                  midfield, your third, led to their shot, led to their goal). Live touches (t) carry [3] / [4] too since 3.1.
 *              s gains [4] SHOT_KIND, [5] power (uu/s), [6] [7] where it crossed their goal line (x, z), [8] 1 at the defender
 *              sv: [[fx, fy, fz, ax, ay, az, SAVE_END, SAVE_KIND, cx, cz], ...] every shot on your goal: from, stopped at, how
 *              f:  [[x, y, z, res, FIFTY_SIT, SURF, SURF took off, PART yours, PART theirs], ...] 50/50s, kickoffs left out
 *              e:  [[x, y, z, POS_EV, on you], ...] positioning mistakes
 *              c gains [3] ROLE and [4] REL }
 *
 * Everything is in your own view: Rocket League units, your goal at -y, their goal at +y. Touches come from the Stats API's
 * BallHit location, so they need no replay; car positions are not in the live feed, so `p` is added by applyReplay
 * (replayrating.js) from the replay's half-second position samples, with s / v / r from the replay metrics (replaymetrics.js spots).
 */
export const FX = 4096;
export const FY = 5120;
export const FZ = 2044;
/** Cells across and along the field; row 0 is your goal end. Twelve rows, so each third is four rows. */
export const GRID = Object.freeze([8, 12]);
/** Car height bands, as in me.pos: on the ground below 25 (a resting car sits at 17), high air above the crossbar. */
export const CAR_Z = Object.freeze({ low: 25, high: 642.775 });
/** Ball height bands for a touch: a ball on the ground sits at 93. */
export const BALL_Z = Object.freeze({ low: 180, high: 642.775 });
export const MAX_TOUCHES = 150;
export const MAX_GOALS = 12;
export const MAX_CLOUD = 300;

const fin = Number.isFinite, CELLS = GRID[0] * GRID[1];
const cell = (x, y) => Math.min(GRID[1] - 1, Math.max(0, Math.floor((y + FY) / (2 * FY) * GRID[1]))) * GRID[0] + Math.min(GRID[0] - 1, Math.max(0, Math.floor((x + FX) / (2 * FX) * GRID[0])));

/**
 * What one of your live touches led to (3.1), from the touches after it and the stat feed (`events`: { t, type, name, team }):
 * [TOUCH_K index, cost]. Same rules as the replay (metrics.rs) where live play can see them: a 50/50 when both teams touched,
 * your shot / save / goal from the stat feed, then who touched next within 3 s (you: kept, a teammate: pass, them: lost);
 * a touch in your third followed by play out of it is a clear. Cost of a lost ball as in the replay.
 */
export function liveOutcome(touches, k, me, myTeam, events = []) {
  const x = touches[k], f = myTeam === 0 ? 1 : -1, ev = (type, a, b, who = me) => events.some(e => (type instanceof RegExp ? type.test(e.type) : e.type === type) && (who == null || e.name === who) && e.t >= x.t + a && e.t <= x.t + b);
  const third = y => y * f < -FY / 3 ? 0 : y * f >= FY / 3 ? 2 : 1;
  if (x.contested) return [TOUCH_K.indexOf('f'), 0];
  let nx = null; for (let j = k + 1; j < touches.length; j++) { const y = touches[j]; if (y.t - x.t < 0.12 && y.players?.includes(me)) continue; nx = y.t - x.t <= 3 ? y : null; break; }
  const goalAfter = ev(/^(Goal|AerialGoal|OvertimeGoal)$/, -0.2, nx ? nx.t - x.t : 6);
  if (goalAfter) return [TOUCH_K.indexOf('g'), 0];
  if (ev(/^(Save|EpicSave)$/, -0.3, 0.5)) return [TOUCH_K.indexOf('v'), 0];
  if (ev('Shot', -0.3, 0.5)) return [TOUCH_K.indexOf('s'), 0];
  if (nx?.players?.includes(me) && nx.players.length === 1) return [TOUCH_K.indexOf('k'), 0];
  if (nx && nx.team === myTeam) return [TOUCH_K.indexOf('p'), 0];
  if (third(x.y) === 0 && (!nx || nx.team !== myTeam) && (nx ? third(nx.y) >= 1 : false)) return [TOUCH_K.indexOf('c'), 0];
  if (nx && nx.team >= 0 && nx.team !== myTeam) {
    const their = (re, a, b) => events.some(e => re.test(e.type) && e.team != null && e.team !== myTeam && e.t >= x.t + a && e.t <= x.t + b);
    return [TOUCH_K.indexOf('l'), their(/^(Goal|AerialGoal|OvertimeGoal)$/, 0, 5) ? 5 : their(/^Shot$/, 0, 5) ? 4 : [3, 2, 1][third(x.y)]];
  }
  return [TOUCH_K.indexOf('o'), 0];
}
/** Your touches and goal touches from the engine's touch list (engine.js ballHit), or null when you had none. 3.1: each touch
 *  also carries what it led to ([3] TOUCH_K, [4] cost; liveOutcome) when the stat feed is given. */
export function liveMap(touches, me, myTeam, events = null) {
  if (!me || !(myTeam === 0 || myTeam === 1) || !Array.isArray(touches)) return null;
  const f = myTeam === 0 ? 1 : -1, pt = t => [Math.round(t.x * f), Math.round(t.y * f), Math.round(t.z)], t = [], g = []; let last = -99;
  touches.forEach((x, k) => {
    if (!x?.players?.includes(me) || !fin(x.x) || !fin(x.y) || !fin(x.z)) return;
    if (x.goal) g.push(pt(x));
    if (x.t - last < 0.12) return;   // one physical touch is often reported on two or three frames
    last = x.t; t.push(events ? [...pt(x), ...liveOutcome(touches, k, me, myTeam, events)] : pt(x));
  });
  return t.length ? { t: t.slice(-MAX_TOUCHES), g: g.slice(-MAX_GOALS) } : null;
}

/** Time per cell and height band from a replay's position samples for one car ([x, y, z] or null each), or null when too few. */
export function posGrid(cars, team) {
  if (!Array.isArray(cars)) return null; const f = team === 1 ? -1 : 1, o = { g: new Array(CELLS).fill(0), l: new Array(CELLS).fill(0), h: new Array(CELLS).fill(0) }; let n = 0;
  for (const c of cars) { if (!Array.isArray(c) || !fin(c[0]) || !fin(c[1]) || !fin(c[2])) continue; o[c[2] < CAR_Z.low ? 'g' : c[2] < CAR_Z.high ? 'l' : 'h'][cell(c[0] * f, c[1] * f)]++; n++; }
  return n >= 20 ? o : null;
}
// ---------- 3.1 codes: the map keeps numbers only (mergeMaps drops points with anything else); -1 = not known ----------
/** What a touch led to (me.map tk [3], and live t [3]): kept, pass to a teammate, clear, shot, goal, save, 50/50, lost, loose. */
export const TOUCH_K = Object.freeze(['k', 'p', 'c', 's', 'g', 'v', 'f', 'l', 'o']);
/** How a shot was hit (me.map s [4]). */
export const SHOT_KIND = Object.freeze(['ground', 'flick', 'aerial', 'wall', 'ceiling']);
/** A shot on your goal (me.map sv [6] end, [7] how you saved it): saved and cleared, saved but they kept it, a teammate saved it, conceded. */
export const SAVE_END = Object.freeze(['c', 'k', 'm', 'x']);
export const SAVE_KIND = Object.freeze(['ground', 'aerial', 'wall', 'dive']);
/** A 50/50 (me.map f): [3] won 1 / neither 0 / lost -1, [4] situation, [5] your surface, [6] where you took off from, [7] your car part, [8] theirs. */
export const FIFTY_SIT = Object.freeze(['a', 'n', 'd']);
export const SURF = Object.freeze(['g', 'w', 'a', 'c']);
export const PART = Object.freeze(['front', 'dodge', 'roof', 'side']);
/** Positioning mistakes (me.map e [3]); [4] is 1 when it was on you. */
export const POS_EV = Object.freeze(['boom', 'dc', 'caught', 'lmc']);
/** Index of a code in its list, or -1. */
export const code = (list, v) => list.indexOf(v);

/** Your role at a position sample (3.1): 1 first man, 2 second man, 3 last back (in 2s the second is the last back). */
export const ROLE = Object.freeze({ first: 1, second: 2, last: 3 });
/** Where you were against the ball (3.1): 0 behind it (between it and your goal), 1 level with it, 2 ahead of it. */
export const REL = Object.freeze({ behind: 0, level: 1, ahead: 2 });
export const LEVEL_Y = 300;
/**
 * Where the car was, as up to MAX_CLOUD points spread evenly over the match (rounded to 10 units), or null when too few.
 * 3.1: each point also carries your role ([3], ROLE, 0 when unknown) and where you were against the ball ([4], REL, -1 when
 * unknown), from the replay's ball samples (`o.ball`, same index as `cars`) and its 1 s rotation timeline (`o.roles`: [t, roles
 * by player], `o.t` the sample times, `o.idx` your player index, `o.perTeam`).
 */
export function posCloud(cars, team, o = {}) {
  if (!Array.isArray(cars)) return null; const f = team === 1 ? -1 : 1;
  const all = cars.map((c, k) => [c, k]).filter(([c]) => Array.isArray(c) && fin(c[0]) && fin(c[1]) && fin(c[2])); if (all.length < 20) return null;
  const step = Math.max(1, all.length / MAX_CLOUD), out = [], q = v => Math.round(v / 10) * 10 || 0, tl = Array.isArray(o.roles) ? o.roles : [];
  let ti = 0;
  const roleAt = t => { if (!fin(t) || !tl.length) return 0; while (ti + 1 < tl.length && tl[ti + 1][0] <= t) ti++; const r = tl[ti]?.[1]?.[o.idx];
    return r === 1 ? ROLE.first : r === 2 ? (o.perTeam === 2 ? ROLE.last : ROLE.second) : r === 3 ? ROLE.last : 0; };
  for (let i = 0; i < all.length && out.length < MAX_CLOUD; i += step) { const [c, k] = all[Math.floor(i)], b = o.ball?.[k];
    const rel = Array.isArray(b) && fin(b[1]) ? (c[1] * f < b[1] * f - LEVEL_Y ? REL.behind : c[1] * f > b[1] * f + LEVEL_Y ? REL.ahead : REL.level) : -1;
    out.push([q(c[0] * f), q(c[1] * f), q(c[2]), o.perTeam > 1 ? roleAt(o.t?.[k]) : 0, rel]); }
  return out;
}
const okGrid = p => p && ['g', 'l', 'h'].every(k => Array.isArray(p[k]) && p[k].length === CELLS);

/** Several games as one map: { p | null, c, t, g, s, v, r, n (games with a map), nPos (games with positions), nRp (games with
 *  shot / save / landing spots) }, or null when none has one. A game without a replay adds its goal touches to the shots, as goals. */
export function mergeMaps(recs) {
  const out = { p: null, c: [], t: [], g: [], s: [], v: [], r: [], sv: [], f: [], e: [], n: 0, nPos: 0, nRp: 0, nTk: 0 };
  for (const r of recs || []) { const m = r?.me?.map; if (!m || typeof m !== 'object') continue; out.n++;
    // 3.1: a replayed game's touches come with what each led to (tk), and replace that game's live touches
    const tk = Array.isArray(m.tk) && m.tk.length ? m.tk : null; if (tk) out.nTk++;
    for (const k of ['t', 'g', 'c', 's', 'v', 'r', 'sv', 'f', 'e']) { const src = k === 't' && tk ? tk : m[k]; if (Array.isArray(src)) for (const p of src) if (Array.isArray(p) && p.length >= 3 && p.every(fin)) out[k].push(p); }
    if (Array.isArray(m.s)) out.nRp++; else if (Array.isArray(m.g)) for (const p of m.g) if (Array.isArray(p) && p.length >= 3 && p.every(fin)) out.s.push([p[0], p[1], p[2], 2]);
    if (okGrid(m.p)) { out.nPos++; out.p ||= { g: new Array(CELLS).fill(0), l: new Array(CELLS).fill(0), h: new Array(CELLS).fill(0) }; for (const k of ['g', 'l', 'h']) for (let i = 0; i < CELLS; i++) out.p[k][i] += +m.p[k][i] || 0; } }
  return out.n && (out.p || out.t.length) ? out : null;
}

const pct = (a, b) => b > 0 ? Math.round(100 * a / b) : 0;
/** Shares of your time from a position grid: back / mid / fwd thirds and ground / low / high, in whole percent. */
export function posShares(p) {
  if (!okGrid(p)) return null; const rows = (a, lo, hi) => { let s = 0; for (let i = lo * GRID[0]; i < hi * GRID[0]; i++) s += a[i]; return s; }, R = GRID[1], T = R / 3;
  const third = (lo, hi) => rows(p.g, lo, hi) + rows(p.l, lo, hi) + rows(p.h, lo, hi), tot = third(0, R); if (!tot) return null;
  return { back: pct(third(0, T), tot), mid: pct(third(T, 2 * T), tot), fwd: pct(third(2 * T, R), tot), ground: pct(rows(p.g, 0, R), tot), low: pct(rows(p.l, 0, R), tot), high: pct(rows(p.h, 0, R), tot) };
}
/** Shares of a list of touch points: thirds, ball height bands and left / center / right (as you face their goal). */
export function touchShares(pts) {
  const n = pts?.length || 0; if (!n) return null; const c = fn => pct(pts.filter(fn).length, n);
  return { n, back: c(p => p[1] < -FY / 3), mid: c(p => p[1] >= -FY / 3 && p[1] < FY / 3), fwd: c(p => p[1] >= FY / 3),
    ground: c(p => p[2] < BALL_Z.low), low: c(p => p[2] >= BALL_Z.low && p[2] < BALL_Z.high), high: c(p => p[2] >= BALL_Z.high),
    left: c(p => p[0] > 600), center: c(p => Math.abs(p[0]) <= 600), right: c(p => p[0] < -600) };   // RL's +x is your left (3.1.1)
}
