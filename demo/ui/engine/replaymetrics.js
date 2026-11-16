/**
 * @module replaymetrics
 * Replay metrics v2 (docs/REPLAY_METRICS.md). The deep block (v8, src-tauri/src/metrics.rs via deep.rs; v9 adds where shots, saves and landings happened) has a `v2` object for
 * every player; this module keeps only yours, plus team-level numbers, and turns it into what the screens show.
 *
 * - recordBlock(a, i): the compact block a match record keeps as `rec.rp` (your numbers, your events, your goal moments,
 *   your rotation strip). Null for analyzes older than deep v9.
 * - spots(rp): where your shots, saves and landings happened, for the 3D field (fieldmap.js me.map s / v / r).
 * - groupReplay(recs): the shooting, saves and recoveries numbers of several games added up (the 3D field's side panel).
 * - headline(rp): the numbers trends and "vs your usual" use.
 * - usualOf(records, rec): your usual = median over your earlier replayed games in the same playlist (needs >= 3).
 * - tiles(rp, usual): the five headline tiles (Rotation, Touches, Shots, Recoveries, Mechanics).
 * - moments: for each goal against, the moment that decided it (high-confidence event types only, REPLAY2_CALIBRATION).
 *
 * Everything here needs a saved replay. Games without one show what they always showed (tests/replay_optional.test.mjs).
 * Pure: no I/O.
 */
import { BY_ID } from './mechanics.js';
import { TOUCH_K, SHOT_KIND, SAVE_END, SAVE_KIND, FIFTY_SIT, SURF, PART, POS_EV, code } from './fieldmap.js';
import { MISS_CALIBRATION } from './deepplayers.js';
import { mmss } from './fmt.js';

/** Record block version: re-applies a replay to its record when this rises (replayrating.applyReplay). */
export const RP_V = 10;   // 3.1: every touch with its outcome, 50/50s, booms, the new double commits, shot kind and power, shots on your goal
/** Minimum earlier replayed games for "vs your usual" (same rule as Sessions verdicts). */
export const USUAL_MIN = 3;

/**
 * Hand-audited precision of the v2 event detectors (same gate as mechanics and missed plays: 'high' only at >= 90% precision
 * on >= 5 samples; 'low' types show as approximate counts and never as a coaching moment). Audit: docs/REPLAY_METRICS.md
 * › Calibration. double_commit / missed_save / whiff are the misses.rs detectors (MISS_CALIBRATION, re-audited for v8).
 */
export const REPLAY2_CALIBRATION = Object.freeze({
  // audit 2026-11-06 over local replays (fresh samples after each rule fix; docs/REPLAY_METRICS.md › As built)
  caught_ahead: { precision: 1, n: 6 }, dangerous_giveaway: { precision: 1, n: 8 }, double_commit: { precision: 1, n: 8 },   // double commit: the v8 rule
  last_man_commit: { precision: 0.75, n: 8 },   // after the 0.8 s rule; the last-back gap and end-of-game fixes came after, not re-audited
  rechallenge: { precision: 0.17, n: 6 }, slow_recovery: { precision: 0.33, n: 6 },   // rules rewritten after these; not re-audited, so they stay approximate
  missed_save: MISS_CALIBRATION.missed_save, whiff: MISS_CALIBRATION.whiff,
});
export const confidence = type => { const c = REPLAY2_CALIBRATION[type]; return c && c.n >= 5 && c.precision >= 0.9 ? 'high' : 'low'; };

/** Goal-against causes, most decisive first. */
export const MOMENT_ORDER = Object.freeze(['dangerous_giveaway', 'last_man_commit', 'double_commit', 'rechallenge', 'caught_ahead', 'missed_save', 'slow_recovery', 'whiff']);
export const EVENT_LABEL = Object.freeze({
  dangerous_giveaway: 'Gave it away in your third', last_man_commit: 'Challenged as last back and got beaten',
  double_commit: 'Double commit with your teammate', rechallenge: 'Cut in front of a teammate who was going',
  caught_ahead: 'Caught up-field when they won it', missed_save: 'Near the shot, no touch', slow_recovery: 'Slow recovery after landing',
  whiff: 'Missed the ball', missed_shot: 'Shot on target that didn’t score',
});
/** Mechanics whose success is shown. Measured from replay physics (the analysis graph the live detectors are calibrated
 *  against); flick and double tap are left out because "landed" is not clear-cut for them. */
export const MECH_SHOWN = Object.freeze(['halfflip', 'speedflip', 'wavedash', 'aerial', 'airdribble', 'ceilingshot']);
const MECH_LABEL = { halfflip: 'Half-flips', speedflip: 'Speed flips (kickoffs)', wavedash: 'Wavedashes', aerial: 'Aerial touches', airdribble: 'Air dribbles', ceilingshot: 'Ceiling shots' };

const fin = x => typeof x === 'number' && Number.isFinite(x);
const r1 = x => Math.round(x * 10) / 10;
/** A spot [x, y, z] from the replay block (your own view, your goal at -y), or null. */
const pt = a => Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every(fin) ? a.slice(0, 3).map(Math.round) : null;
export const clockText = c => fin(c) ? mmss(Math.max(0, c)) : '?';

/** Your rotation role over the match from replay.rs rotation_timeline (1 s steps): '1' / '2' / '3' or '-' (off the field). */
function strip(a, i) {
  const tl = Array.isArray(a?.rotation_timeline) ? a.rotation_timeline : []; if (!tl.length) return null;
  const s = tl.map(r => { const v = Array.isArray(r?.[1]) ? r[1][i] : null; return v === 1 || v === 2 || v === 3 ? String(v) : '-'; }).join('');
  return /[123]/.test(s) ? { t0: fin(tl[0]?.[0]) ? tl[0][0] : 0, s: s.slice(0, 900) } : null;
}

/**
 * The record block (`rec.rp`) from a replay analysis and your index in `a.players` (replayrating.findMe).
 * @param {object} a analysis JSON from replay.rs (with `deep`) @param {number} i your index in a.players
 */
export function recordBlock(a, i) {
  const d = a?.deep, me = a?.players?.[i]; if (!d || d.error || !(d.version >= RP_V) || !me) return null;
  const dp = (d.players || []).find(p => p.name === me.name), v = dp?.v2; if (!v || typeof v !== 'object') return null;
  const team = me.team, perTeam = (a.players || []).filter(p => p.team === team).length;
  const t = v.touch || {}, s = v.shots || {}, sv = v.saves || {}, rc = v.recov, rt = v.rot, ph = v.phase || {}, rx = v.react || {};
  const mech = MECH_SHOWN.filter(k => v.mech?.[k]?.tries > 0).map(k => ({ kind: k, label: MECH_LABEL[k] || BY_ID[k]?.name || k, tries: v.mech[k].tries, landed: v.mech[k].landed || 0 }));
  const evs = [...(d.v2_events || []).filter(e => e.p === me.name),
    ...(d.misses || []).filter(m => m.p === me.name || (m.s === 'double_commit' && m.with === me.name)).map(m => ({ s: m.s, t: m.t, clock: m.clock }))]
    .filter(e => fin(e.t)).sort((x, y) => x.t - y.t).slice(0, 60).map(e => ({ s: e.s, t: r1(e.t), clock: fin(e.clock) ? e.clock : null }));
  const moments = (d.goals || []).filter(g => g.team !== team && fin(g.t)).map(g => {
    const near = evs.filter(e => e.t >= g.t - 8 && e.t <= g.t + 0.5 && MOMENT_ORDER.includes(e.s) && confidence(e.s) === 'high');
    near.sort((x, y) => MOMENT_ORDER.indexOf(x.s) - MOMENT_ORDER.indexOf(y.s) || y.t - x.t);
    return near[0] ? { goal: fin(g.clock) ? g.clock : null, s: near[0].s, clock: near[0].clock, t: near[0].t } : null; }).filter(Boolean);
  return {
    v: RP_V, perTeam,
    phase: { def: ph.goal_side_pct?.def ?? null, att: ph.goal_side_pct?.att ?? null, loose: ph.goal_side_pct?.loose ?? null, caught: ph.caught_ahead || 0, backS: ph.back_goal_side_s ?? null },
    rot: rt ? { dc: rt.double_commit || 0, lmc: rt.last_man_commit || 0, rech: rt.rechallenge || 0, bp: rt.back_post_pct ?? null, bpN: rt.back_post_n || 0,
      bunched: rt.bunched_s || 0, caughtFwd: rt.team_caught_forward || 0, youLast: rt.you_last || 0 } : null,
    touch: { judged: t.judged || 0, useful: t.useful || 0, pct: t.useful_pct ?? null, by3: Array.isArray(t.useful_pct_by_third) ? t.useful_pct_by_third : [null, null, null],
      kept: t.kept || 0, toMate: t.to_mate || 0, cleared: t.cleared || 0, sot: t.shot_on_target || 0, goal: t.goal || 0, lost: t.lost || 0, dangerous: t.dangerous || 0,
      contested: t.contested || 0, passes: { tried: t.passes?.tried || 0, completed: t.passes?.completed || 0 }, lostAt: Array.isArray(t.lost_at) ? t.lost_at.slice(0, 40) : [] },
    shots: { n: s.n || 0, onTarget: s.on_target || 0, atKeeper: s.at_keeper || 0, goals: s.goals || 0,
      list: (s.list || []).map(x => ({ x: x.cross?.[0] ?? null, z: x.cross?.[1] ?? null, k: x.goal ? 'g' : x.on_target ? 's' : 'm', keeper: !!x.at_keeper, at: pt(x.at),
        kind: SHOT_KIND.includes(x.kind) ? x.kind : null, power: fin(x.power) ? Math.round(x.power) : null })) },
    // 3.1 (deep v10): lost balls by cost (their third, midfield, your third, led to their shot, led to their goal), booms over
    // your head, double commits by the v10 rule (and how many were on you), 50/50s won / neither / lost (kickoffs left out)
    lostCost: Array.isArray(v.lost_cost) ? v.lost_cost.slice(0, 5) : null, booms: fin(v.booms) ? v.booms : null,
    dc2: Array.isArray(v.dc2) ? { n: v.dc2.length, onYou: v.dc2.filter(d => d.on_you).length } : null,
    fifty: Array.isArray(v.fifty) ? { n: v.fifty.length, won: v.fifty.filter(f => f.res === 1).length, lost: v.fifty.filter(f => f.res === -1).length } : null,
    _map: mapLists(v),
    saves: { n: sv.n || 0, faced: sv.faced || 0, conceded: sv.conceded || 0, list: (sv.list || []).map(x => pt(x.at)).filter(Boolean).slice(0, 40) },
    poss: { team: v.poss?.team_pct ?? null, wonBack: v.poss?.won_back || 0, turn: Array.isArray(v.poss?.turnovers_by_third) ? v.poss.turnovers_by_third : [0, 0, 0] },
    mech, airWhiffs: v.aerial_whiffs || 0,
    recov: rc ? { aerialS: rc.aerial_s ?? null, aerialN: rc.aerial_n || 0, bumpS: rc.bump_s ?? null, bumpN: rc.bump_n || 0, clean: rc.clean_landing_pct ?? null,
      landings: rc.landings || 0, slow: rc.slow || 0, kept: rc.speed_kept_pct ?? null,
      list: (rc.list || []).map(x => { const p = pt(x.at); return p && { at: p, clean: !!x.clean, slow: !!x.slow }; }).filter(Boolean).slice(0, 40) } : null,
    react: { koMs: rx.kickoff_ms ?? null, koN: rx.kickoff_n || 0, koLate: rx.kickoff_late || 0, ttb: rx.kickoff_to_ball_s ?? null },
    strip: strip(a, i), events: evs, moments,
  };
}

/** Shot spots carry how they ended, landing spots how they went (the 4th number of a point on the 3D field). */
export const SHOT_K = Object.freeze({ m: 0, s: 1, g: 2 });
const num = x => fin(x) ? Math.round(x) : -1;
/** 3.1: the deep v10 lists as 3D-field points (fieldmap.js codes). Kept on the record as me.map, not in rec.rp. */
function mapLists(v) {
  const tk = Array.isArray(v.touch_list) ? v.touch_list.map(t => { const p = pt(t); return p && [...p, code(TOUCH_K, t[3]), fin(t[4]) ? t[4] : 0]; }).filter(Boolean) : null;
  const sv = Array.isArray(v.saves?.faced_list) ? v.saves.faced_list.map(x => { const a = pt(x.from); if (!a) return null; const b = pt(x.at) || [-1, -1, -1];
    return [...a, ...b, code(SAVE_END, x.end), code(SAVE_KIND, x.kind), num(x.cross?.[0]), num(x.cross?.[1])]; }).filter(Boolean) : null;
  const f = Array.isArray(v.fifty) ? v.fifty.map(x => { const p = pt(x.at); return p && [...p, fin(x.res) ? x.res : 0, code(FIFTY_SIT, x.sit), code(SURF, x.surf), code(SURF, x.from), code(PART, x.part), code(PART, x.their)]; }).filter(Boolean) : null;
  const e = Array.isArray(v.pos_ev) ? v.pos_ev.map(x => { const p = pt(x); return p && [...p, code(POS_EV, x[3]), x[4] ? 1 : 0]; }).filter(x => x && x[3] >= 0) : null;
  return tk || sv || f || e ? { tk: tk || [], sv: sv || [], f: f || [], e: e || [] } : null;
}
/**
 * Where it happened, for the 3D field (me.map): s = the ball at each of your shots [x, y, z, SHOT_K, SHOT_KIND, power,
 * cross x, cross z, at the defender], v = the ball at each of your saves [x, y, z], r = your car at each landing
 * [x, y, z, 1 clean | 0 not], and from deep v10 tk / sv / f / e (fieldmap.js). Empty lists when the game had none.
 */
export function spots(rp) {
  if (!rp) return null;
  return { s: (rp.shots?.list || []).filter(x => x.at).map(x => [...x.at, SHOT_K[x.k] ?? 0, code(SHOT_KIND, x.kind), num(x.power), fin(x.x) ? Math.round(x.x) : -9999, fin(x.z) ? Math.round(x.z) : -1, x.keeper ? 1 : 0]),
    v: (rp.saves?.list || []).map(p => [...p]), r: (rp.recov?.list || []).map(x => [...x.at, x.clean ? 1 : 0]), ...(rp._map || {}) };
}
/** Shooting, saves and recoveries of several games as one: counts added up, times averaged by how many each game measured. null without a replayed game. */
export function groupReplay(recs) {
  const rs = (recs || []).map(r => r?.rp).filter(rp => rp?.v >= RP_V); if (!rs.length) return null;
  const sum = f => rs.reduce((a, rp) => a + (f(rp) || 0), 0);
  const wavg = (val, w) => { let a = 0, n = 0; for (const rp of rs) { const x = val(rp), k = w(rp) || 0; if (fin(x) && k > 0) { a += x * k; n += k; } } return n ? a / n : null; };
  const landings = sum(rp => rp.recov?.landings), clean = wavg(rp => rp.recov?.clean, rp => rp.recov?.landings);
  return { n: rs.length,
    shots: { n: sum(rp => rp.shots.n), onTarget: sum(rp => rp.shots.onTarget), goals: sum(rp => rp.shots.goals), atKeeper: sum(rp => rp.shots.atKeeper), list: rs.flatMap(rp => rp.shots.list || []) },
    saves: { n: sum(rp => rp.saves?.n), faced: sum(rp => rp.saves?.faced), conceded: sum(rp => rp.saves?.conceded), missed: sum(rp => (rp.events || []).filter(e => e.s === 'missed_save').length) },
    recov: { landings, clean, cleanN: fin(clean) ? Math.round(clean * landings / 100) : 0, slow: sum(rp => rp.recov?.slow),
      aerialS: wavg(rp => rp.recov?.aerialS, rp => rp.recov?.aerialN), bumpS: wavg(rp => rp.recov?.bumpS, rp => rp.recov?.bumpN), bumpN: sum(rp => rp.recov?.bumpN), kept: wavg(rp => rp.recov?.kept, rp => rp.recov?.landings) } };
}

/** Rotation mistakes that count toward the Rotation tile: only event types that passed the audit. */
export const ROT_MISTAKES = Object.freeze([['lmc', 'last_man_commit'], ['dc', 'double_commit'], ['rech', 'rechallenge']]);
const rotCounted = () => ROT_MISTAKES.filter(([, t]) => confidence(t) === 'high');
/** Headline numbers for trends and "vs your usual" (null when that game didn't measure it). */
export function headline(rp) {
  if (!rp) return null; const rc = rotCounted();
  const tries = rp.mech.reduce((s, m) => s + m.tries, 0), landed = rp.mech.reduce((s, m) => s + m.landed, 0);
  return { goalSideDef: rp.phase.def, usefulPct: rp.touch.pct, onTargetPct: rp.shots.n ? Math.round(100 * rp.shots.onTarget / rp.shots.n) : null,
    mistakes: rp.rot && rc.length ? rc.reduce((s, [k]) => s + (rp.rot[k] || 0), 0) : null, lmc: rp.rot ? rp.rot.lmc : null,
    cleanPct: rp.recov?.landings ? rp.recov.clean : null, recovS: rp.recov?.aerialN ? rp.recov.aerialS : null,
    mechPct: tries ? Math.round(100 * landed / tries) : null, giveaways: rp.touch.lost + rp.touch.dangerous };
}
const median = v => { const a = v.filter(fin).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const samePl = (a, b) => (a.plKey || null) === (b.plKey || null) && (a.mode || null) === (b.mode || null);

/** Your earlier replayed games in rec's playlist, newest first. */
export function replayedBefore(records, rec) {
  const at = rec?.playedAt ?? Infinity;
  return (records || []).filter(r => r && r !== rec && r.guid !== rec?.guid && r.rp?.v >= RP_V && samePl(r, rec) && (r.playedAt ?? 0) < at).sort((x, y) => (y.playedAt ?? 0) - (x.playedAt ?? 0));
}
/** Your usual: median headline over up to 20 earlier replayed games; null under USUAL_MIN games. */
export function usualOf(records, rec) {
  const prev = replayedBefore(records, rec).slice(0, 20); if (prev.length < USUAL_MIN) return null;
  const hs = prev.map(r => headline(r.rp)); const out = { n: prev.length };
  for (const k of Object.keys(hs[0] || {})) out[k] = median(hs.map(h => h?.[k]));
  return out;
}

/** Direction of a value against your usual: 'better' | 'worse' | 'same' | null. `lower` = lower is better. */
export function vsUsual(v, u, { lower = false, step = 5 } = {}) {
  if (!fin(v) || !fin(u)) return null; const d = v - u; if (Math.abs(d) < step) return 'same';
  return (d < 0) === lower ? 'better' : 'worse';
}

/** The five tiles: [{ key, label, value, sub, vs: 'better'|'worse'|'same'|null }]. */
export function tiles(rp, usual = null) {
  if (!rp) return [];
  const h = headline(rp), u = usual || {};
  const rot = rp.rot && fin(h.mistakes) ? { key: 'rotation', label: 'Rotation', value: String(h.mistakes), sub: `${h.mistakes === 1 ? 'mistake' : 'mistakes'}: ${rotCounted().map(([, t]) => ({ last_man_commit: 'last-man commits', double_commit: 'double commits', rechallenge: 'cuts' }[t])).join(', ')}`, vs: vsUsual(h.mistakes, u.mistakes, { lower: true, step: 1 }) }
    : { key: 'rotation', label: 'Positioning', value: fin(h.goalSideDef) ? `${Math.round(h.goalSideDef)}%` : '–', sub: 'goal-side when defending', vs: vsUsual(h.goalSideDef, u.goalSideDef) };
  const tc = { key: 'touches', label: 'Touches', value: fin(h.usefulPct) ? `${Math.round(h.usefulPct)}%` : '–', sub: rp.touch.judged ? `useful (${rp.touch.useful} of ${rp.touch.judged})` : 'no judged touches', vs: vsUsual(h.usefulPct, u.usefulPct) };
  const sh = { key: 'shots', label: 'Shots', value: rp.shots.n ? `${rp.shots.onTarget}/${rp.shots.n}` : '–', sub: rp.shots.n ? 'on target' : 'no shots', vs: vsUsual(h.onTargetPct, u.onTargetPct, { step: 10 }) };
  const rc = { key: 'recoveries', label: 'Recoveries', value: fin(h.cleanPct) ? `${Math.round(h.cleanPct)}%` : '–', sub: rp.recov?.landings ? `clean landings (${rp.recov.landings})` : 'no landings measured', vs: vsUsual(h.cleanPct, u.cleanPct, { step: 8 }) };
  const tries = rp.mech.reduce((s, m) => s + m.tries, 0), landed = rp.mech.reduce((s, m) => s + m.landed, 0);
  const mc = { key: 'mechanics', label: 'Mechanics', value: tries ? `${landed}/${tries}` : '–', sub: tries ? 'clean' : 'none measured', vs: vsUsual(h.mechPct, u.mechPct, { step: 10 }) };
  return [rot, tc, sh, rc, mc];
}

/** Approximate-count marker for event types under the gate. */
export const approx = type => confidence(type) === 'high' ? '' : '≈';
/** Your events for "Watch in RL": [{ label, clock, approx }], newest last. */
export function eventRows(rp) {
  return (rp?.events || []).filter(e => EVENT_LABEL[e.s]).map(e => ({ s: e.s, label: EVENT_LABEL[e.s], clock: clockText(e.clock), approx: approx(e.s) }));
}
/** Goal-against moments as text rows: [{ goal: '2:41', clock: '2:44', label }]. */
export function momentRows(rp) {
  return (rp?.moments || []).map(m => ({ goal: clockText(m.goal), clock: clockText(m.clock), label: EVENT_LABEL[m.s] || m.s, s: m.s }));
}
