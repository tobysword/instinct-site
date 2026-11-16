/**
 * @module mechanics
 * The mechanics vocabulary (overhaul plan v2 §3) and the confident-only presentation rule.
 *
 * Every detection carries an internal score in [0, 1]. Users only ever see:
 *   - the mechanic's NAME, when the rule may name it live for that player and score >= its name threshold, or
 *   - its CATEGORY, when score >= CAT_MIN, or
 *   - nothing.
 * There is no "likely" tier. Thresholds are provisional until replay calibration (M2/M7): replays are the answer key.
 *
 * Live capability per player relation (docs/archive/M0_FINDINGS.md): self + teammates have car state (ground/wall/boost flags),
 * opponents only have events (BallHit, statfeed). `mate`/`opp`: 'name' | 'cat' | 'none' (replay only).
 */
export const CATEGORIES = Object.freeze({ kickoff: 'Kickoff', movement: 'Movement', air: 'Air control', aerial: 'Aerial', wall: 'Wall play', ceiling: 'Ceiling play',
  flick: 'Flick', dribble: 'Dribble', shot: 'Shot', team: 'Team play', challenge: 'Challenge', defense: 'Defense', physical: 'Physical', boost: 'Boost' });
const M = (id, name, cat, mate, opp, desc) => Object.freeze({ id, name, cat, mate, opp, replay: true, desc });
/** Ordered for the Codex. `id`s that the engine emits live match engine.mech() kinds. */
export const TAXONOMY = Object.freeze([
  M('kickoff', 'Kickoff', 'kickoff', 'cat', 'cat', 'Who went, how fast they reached the ball, and who won it.'),
  M('speedflip', 'Speed flip', 'kickoff', 'none', 'none', 'Diagonal flip cancelled immediately: the fastest kickoff approach.'),
  M('wavedash', 'Wavedash', 'movement', 'name', 'none', 'Dodge just as the wheels land to gain speed without boost.'),
  M('chainwave', 'Chain wavedash', 'movement', 'name', 'none', 'Two or more wavedashes back to back.'),
  M('walldash', 'Wall dash', 'movement', 'name', 'none', 'Repeated dodges along the wall for speed.'),
  M('halfflip', 'Half flip', 'movement', 'none', 'none', 'Backflip, cancel and roll to turn around fast.'),
  M('zapdash', 'Zap dash', 'movement', 'none', 'none', 'Tiny jump then immediate dodge into the ground.'),
  M('powerslide', 'Powerslide', 'movement', 'name', 'none', 'Handbrake turn.'),
  M('airroll', 'Air roll', 'air', 'none', 'none', 'Rolling the car in the air (directional or free).'),
  M('stall', 'Ceiling / tornado stall', 'air', 'none', 'none', 'Hovering in the air using air roll + yaw.'),
  M('aerial', 'Aerial', 'aerial', 'name', 'name', 'Hitting the ball while airborne.'),
  M('fastaerial', 'Fast aerial', 'aerial', 'name', 'none', 'Jump, boost and double-jump straight away to reach the ball early.'),
  M('airdribble', 'Air dribble', 'aerial', 'name', 'name', 'Carrying the ball through the air with repeated touches.'),
  M('wallairdribble', 'Wall air dribble', 'aerial', 'name', 'name', 'Air dribble started off the wall.'),
  M('doubletap', 'Double tap', 'aerial', 'cat', 'cat', 'Shot off the backboard followed by a second airborne touch.'),
  M('redirect', 'Redirect', 'aerial', 'name', 'cat', 'Airborne re-direction of a teammate\'s pass.'),
  M('wall', 'Wall touch', 'wall', 'name', 'name', 'Touch high on a side wall.'),
  M('backboard', 'Backboard touch', 'wall', 'name', 'name', 'Touch on the back wall above the goal.'),
  M('ceiling', 'Ceiling touch', 'ceiling', 'name', 'name', 'Touch near the ceiling.'),
  M('ceilingshot', 'Ceiling shot', 'ceiling', 'none', 'none', 'Drop off the ceiling and use the stored dodge on the ball.'),
  M('dribble', 'Dribble', 'dribble', 'name', 'cat', 'Carrying the ball on the car along the ground.'),
  M('bouncedribble', 'Bounce dribble', 'dribble', 'name', 'cat', 'Dribble with repeated small pops.'),
  M('cushion', 'Catch / cushion', 'dribble', 'cat', 'cat', 'Killing the ball\'s speed to take control.'),
  M('flick', 'Flick', 'flick', 'cat', 'cat', 'Dodge while the ball sits on the car to launch it.'),
  M('mustyflick', 'Musty flick', 'flick', 'none', 'none', 'Backflip flick off the car\'s roof.'),
  M('power', 'Power shot', 'shot', 'name', 'name', 'A hard hit toward goal.'),
  M('pinch', 'Pinch', 'shot', 'cat', 'cat', 'Ball squeezed against a wall or another car at extreme speed.'),
  M('shadow', 'Shadow defense', 'defense', 'none', 'none', 'Retreating goal-side, matching the attacker without committing.'),
  M('fifty', '50/50', 'challenge', 'name', 'name', 'Both teams hit the ball at the same time.'),
  M('bump', 'Bump / demo', 'physical', 'name', 'name', 'Car contact (stat feed + CarTouches).'),
]);
export const BY_ID = Object.freeze(Object.fromEntries(TAXONOMY.map(m => [m.id, m])));
/** Provisional thresholds: name >= NAME_MIN (or the per-rule override), category >= CAT_MIN, else hidden. */
export const NAME_MIN = 0.85, CAT_MIN = 0.6;
export const RULE_NAME_MIN = Object.freeze({ flick: 0.95, doubletap: 0.95, pinch: 0.92, ceiling: 0.7 });   // ceiling: 7/7 correct at 0.72 in M2 calibration
/** Legacy engine conf strings mapped to a score until every rule emits its own. */
export const CONF_SCORE = Object.freeze({ high: 0.9, med: 0.72, low: 0.5 });
/** @param {string} kind @param {'self'|'mate'|'opp'} relation @returns {'name'|'cat'|'none'} */
/**
 * Replay calibration (M2, 2026-10-15): 19 matches where a saved replay matches a logged live session (header MatchGUID),
 * subtr-actor events as the answer key, same player, |clock| <= 2 s. Rule: name only when named precision >= 90% on >= 5
 * samples; category when shown precision >= 60%; otherwise hidden. Reproduce with tools/calibrate.mjs; numbers in
 * docs/archive/M2_CALIBRATION.md, docs/archive/M3_CALIBRATION.md (v0.11 rework) and docs/archive/M4_LIVE_RULES.md (v0.12 carry-duration dribble). Kinds not listed keep the taxonomy capability.
 */
const N = 'name', C = 'cat', X = 'none';
export const CALIBRATION = Object.freeze({
  ceiling: { self: N, mate: N, opp: N }, airdribble: { self: N, mate: C, opp: C },
  aerial: { self: C, mate: C, opp: C }, fastaerial: { self: C, mate: C, opp: C }, wall: { self: C, mate: C, opp: C }, power: { self: C, mate: C, opp: X },
  wallairdribble: { self: C, mate: C, opp: C }, bouncedribble: { self: C, mate: C, opp: C }, walldash: { self: C, mate: C, opp: X },
  dribble: { self: C, mate: N, opp: C }, backboard: { self: X, mate: X, opp: X }, redirect: { self: X, mate: X, opp: X }, flick: { self: X, mate: X, opp: X },
  wavedash: { self: X, mate: X, opp: X }, chainwave: { self: X, mate: X, opp: X }, doubletap: { self: X, mate: X, opp: X }, cushion: { self: X, mate: X, opp: X }, pinch: { self: X, mate: X, opp: X },
});
const RANK = { none: 0, cat: 1, name: 2 };
/** Live capability after calibration: the stricter of the taxonomy capability and the replay-calibrated policy. */
export function liveCap(kind, relation) { const m = BY_ID[kind]; if (!m) return 'none'; const cap = relation === 'opp' ? m.opp : m.mate; const c = CALIBRATION[kind]?.[relation === 'self' ? 'self' : relation]; return c && RANK[c] < RANK[cap] ? c : cap; }
/**
 * The one thing the UI may show for a detection.
 * @param {string} kind @param {number} score 0..1 @param {'self'|'mate'|'opp'} relation
 * @returns {null | { kind:string, level:'name'|'category', label:string, cat:string }}
 */
export function present(kind, score, relation = 'self') {
  const m = BY_ID[kind]; const cap = liveCap(kind, relation); if (!m || cap === 'none' || !(score >= CAT_MIN)) return null;
  if (cap === 'name' && score >= (RULE_NAME_MIN[kind] ?? NAME_MIN)) return { kind, level: 'name', label: m.name, cat: m.cat };
  return { kind, level: 'category', label: CATEGORIES[m.cat], cat: m.cat };
}
