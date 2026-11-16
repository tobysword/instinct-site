// Where you play (2.9; redrawn in 3.1): one 3D field, drag to turn, used on Progress (your last games), a match breakdown and a
// session. Six views, always in this order:
//   Touches      every touch as a dot, colored by what it led to; a lost ball shaded by how costly it was (every game: live
//                touches carry their outcome since 3.1, a saved replay makes them exact)
//   Positioning  where your car was, about once a second, colored by your role (first man, second man, last back), with your
//                positioning mistakes drawn as shapes on top (booms over your head, double commits, caught up-field, last-man commits)
//   Shooting     where each shot came from, by how it ended, a dashed line to where it crossed their goal line; their goal's
//                face, kind of shot, power and angle
//   Saves        each shot on your goal as a line from where they shot to where it was stopped (a ring) or went in (an X)
//   50/50s       a ring at each 50/50 (kickoffs left out): won, neither or lost; by situation, surface and part of your car
//   Recoveries   where you landed, clean or not
// Dots everywhere, never a cloud. Everything beside the field is a filter: a click on a row, a bar, a part of the goal or a legend
// chip shows only that on the field; a second click clears it; filters from different groups combine. Data: record me.map
// (ui/engine/fieldmap.js, codes there) and the replay blocks (replaymetrics.js groupReplay). A view without data says what it
// needs. The page HTML is a string, so the canvas is wired up when it appears in the document (watchField3d); the angle, the
// view and the filters survive a re-render.
import { esc } from './render.js';
import { mergeMaps, FX, FY, FZ, BALL_Z, TOUCH_K, SHOT_KIND, SAVE_END, FIFTY_SIT, SURF, PART, POS_EV } from '../engine/fieldmap.js';
import { groupReplay, approx } from '../engine/replaymetrics.js';
import { ring } from './viz.js';
import { posViz } from './positioning.js';
import { plural } from '../engine/fmt.js';

const DATA = new Map(), STATE = new Map();
const YAW0 = -0.5, PITCH0 = Math.PI / 4;   // start: from above at 45°, turned a little, your goal nearest
const GX = 893, GZ = 643;   // goal mouth; the crossbar height is also where high air starts
const fin = Number.isFinite, pc = x => fin(x) ? `${Math.round(x)}%` : '–', pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const kv = rows => `<dl class="kvl f3d-kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(String(v))}</dd>`).join('')}</dl>`;

// ---------- colors (r,g,b) ----------
const C = { kept: '161,161,170', pass: '34,197,94', clear: '45,212,191', shot: '59,130,246', goal: '255,138,61', save: '167,139,250', fifty: '244,241,236', loose: '113,113,122',
  l1: '253,224,71', l2: '250,204,21', l3: '245,158,11', l4: '249,115,22', l5: '239,68,68', plain: '255,92,0',
  first: '255,92,0', second: '250,204,21', last: '59,130,246', nobody: '161,161,170',
  boom: '232,121,249', dc: '239,68,68', caught: '245,158,11', lmc: '255,92,0',
  won: '34,197,94', neither: '161,161,170', lost: '239,68,68', saved: '232,234,238', off: '110,116,128', clean: '34,197,94', rough: '255,77,94',
  behind: '120,180,255', level: '200,200,210', ahead: '255,140,90', from: '150,150,160' };

// ---------- the groups each view filters by: [value, label, color] ----------
const OUT = [['k', 'Kept it', C.kept], ['p', 'Pass to a teammate', C.pass], ['c', 'Clear', C.clear], ['s', 'Shot', C.shot], ['g', 'Goal', C.goal], ['v', 'Save', C.save],
  ['f', '50/50', C.fifty], ['l', 'Lost the ball', C.l3], ['o', 'Loose ball', C.loose]];
const COST = [['1', 'Lost in their third', C.l1], ['2', 'Lost in midfield', C.l2], ['3', 'Lost in your third', C.l3], ['4', 'Led to their shot', C.l4], ['5', 'Led to their goal', C.l5]];
const ROLES = [['1', 'First man', C.first], ['2', 'Second man', C.second], ['3', 'Last back', C.last]];
const RELS = [['0', 'Behind', C.behind], ['1', 'Level', C.level], ['2', 'Ahead', C.ahead]];
const MISTAKES = [['boom', 'Boom over your head', C.boom, 'ring'], ['dc', 'Double commit', C.dc, 'x'], ['caught', 'Caught up-field', C.caught, 'tri'], ['lmc', 'Last-man commit', C.lmc, 'sq']];
const SHOT_END = [['2', 'Goal', C.goal], ['1', 'On target, saved', C.saved], ['0', 'Off target', C.off]];
const SHOT_KINDS = [['ground', 'From the ground'], ['flick', 'Flick'], ['aerial', 'Aerial'], ['wall', 'Off the wall'], ['ceiling', 'Ceiling']];
const POWER = [['soft', 'Soft'], ['med', 'Medium'], ['hard', 'Hard']], ANGLE = [['lS', 'Left, sharp'], ['l', 'Left'], ['c', 'Center'], ['r', 'Right'], ['rS', 'Right, sharp']];
const SV_END = [['c', 'Saved and cleared', C.won], ['k', 'Saved, they kept the pressure', C.l3], ['m', 'Saved by a teammate', C.neither], ['x', 'Conceded', C.lost]];
const SV_KIND = [['ground', 'On the ground'], ['aerial', 'In the air'], ['wall', 'Off the wall'], ['dive', 'Dive (flip)']];
const F_RES = [['1', 'Won', C.won], ['0', 'Neither', C.neither], ['-1', 'Lost', C.lost]];
const F_SIT = [['a', 'Attacking'], ['n', 'Neutral'], ['d', 'Defending']], F_SURF = [['g', 'Ground'], ['w', 'Wall'], ['a', 'Air'], ['c', 'Ceiling']];
const F_PART = [['front', 'Front'], ['dodge', 'Nose (flip)'], ['roof', 'Roof'], ['side', 'Side or back']];
const LAND = [['1', 'Clean', C.clean], ['0', 'Not clean', C.rough]];
const THIRDS = [['back', 'Your third'], ['mid', 'Middle'], ['fwd', 'Their third']], HEIGHTS = [['ground', 'Ground'], ['low', 'Low air'], ['high', 'High air']];
const VIEWS = [['touch', 'Touches'], ['pos', 'Positioning'], ['shot', 'Shooting'], ['save', 'Saves'], ['fifty', '50/50s'], ['recov', 'Recoveries']];
const EMPTY = { touch: 'No touches recorded in these games.', pos: 'Positioning comes from a saved replay.', shot: 'Shots come from a saved replay; goals show from every game.',
  save: 'Saves come from a saved replay.', fifty: '50/50s come from a saved replay.', recov: 'Landings come from a saved replay.' };
const SAVE_HINT = 'In Rocket League: Match History › Replays, save the game, and the app reads it on its own.';

// ---------- what each point is, by group ----------
const thirdOf = y => y < -FY / 3 ? 'back' : y >= FY / 3 ? 'fwd' : 'mid';
const heightOf = (z, Z = BALL_Z) => z < Z.low ? 'ground' : z < Z.high ? 'low' : 'high';
const touchOut = p => p.length > 3 && p[3] >= 0 ? TOUCH_K[p[3]] : null;   // null: an older live touch without its outcome
const powerOf = uu => !fin(uu) || uu < 0 ? null : uu < 2000 ? 'soft' : uu < 3000 ? 'med' : 'hard';   // ball speed after the shot: < 72, 72-108, > 108 km/h
// 3.1.1: Rocket League's +x is on your LEFT as you face their goal (the data is in that frame, team-normalized). Everything
// drawn or labeled left / right here therefore uses -x: proj mirrors the screen, the goal faces and zones take -x.
const angleOf = p => { const a = Math.atan2(-p[0], FY - p[1]); return a < -0.7 ? 'lS' : a < -0.2 ? 'l' : a > 0.7 ? 'rS' : a > 0.2 ? 'r' : 'c'; };
const zoneOf = (x, z) => !fin(x) || x <= -9999 || !fin(z) || z < 0 || Math.abs(x) > GX || z > GZ ? null : `${z > GZ * 0.62 ? 'u' : 'l'}${x < -GX * 0.4 ? 'l' : x > GX * 0.4 ? 'r' : 'm'}`;
const ZONE_NAMES = { ul: 'Top left', um: 'Top middle', ur: 'Top right', ll: 'Low left', lm: 'Low middle', lr: 'Low right' };
/** Each view's points with their group values: [{ p, g: { group: value } }]. */
function items(d, view) {
  if (view === 'touch') return d.t.map(p => { const o = touchOut(p); return { p, g: { out: o, cost: o === 'l' ? String(p[4] || 0) : null, third: thirdOf(p[1]), h: heightOf(p[2]) } }; });
  if (view === 'pos') return d.c.map(p => ({ p, g: { role: p.length > 3 && p[3] > 0 ? String(p[3]) : null, rel: p.length > 4 && p[4] >= 0 ? String(p[4]) : null, third: thirdOf(p[1]) } }));
  if (view === 'shot') return d.s.map(p => ({ p, g: { end: String(p[3] ?? 2), kind: p.length > 4 && p[4] >= 0 ? SHOT_KIND[p[4]] : null, power: powerOf(p[5]), ang: angleOf(p), zone: zoneOf(-p[6], p[7]) } }));
  if (view === 'save') return [...d.sv.map(p => ({ p, sv: true, g: { end: SAVE_END[p[6]] || null, kind: p[7] >= 0 ? SV_KIND[p[7]][0] : null, zone: zoneOf(p[8], p[9]) } })),
    ...(d.legacyV || []).map(p => ({ p, g: { end: null, kind: null, zone: null } }))];
  if (view === 'fifty') return d.f.map(p => ({ p, g: { res: String(p[3]), sit: FIFTY_SIT[p[4]] || null, surf: SURF[p[5]] || null, part: PART[p[7]] || null } }));
  if (view === 'recov') return d.r.map(p => ({ p, g: { land: String(p[3] ?? 1) } }));
  return [];
}
const marks = (d, st) => st.view !== 'pos' ? [] : d.e.map(p => ({ p, k: POS_EV[p[3]], on: p[4] === 1 })).filter(m => m.k && (st.f.ev == null || st.f.ev === m.k) && (!st.f.onyou || m.k !== 'dc' || m.on) && (st.f.third == null || thirdOf(m.p[1]) === st.f.third));
const passes = (it, f, skip = null) => Object.entries(f).every(([g, v]) => v == null || g === skip || g === 'ev' || g === 'onyou' || it.g[g] === undefined || it.g[g] === v);
const shown = (d, st) => items(d, st.view).filter(it => passes(it, st.f));
const has = (d, v) => v === 'pos' ? d.c.length > 0 : items(d, v).length > 0;

/**
 * The field for these match records, or '' when none of them has a map (older games, modes without touches).
 * @param recs match records @param o { key: stable id for this spot on the page (keeps the angle, view and filters), units,
 *   team: players a side, posUsual: your usual positioning measures (me.pos shape) }
 */
export function field3dHTML(recs, { key = 'f3d', units = 'meters', team = null, posUsual = null } = {}) {
  const d = mergeMaps(recs); if (!d) return '';
  d.rp = groupReplay(recs); d.team = team; d.posUsual = posUsual;
  // saves from replays read before 3.1 have only where you saved it
  d.legacyV = (recs || []).filter(r => r?.me?.map && !Array.isArray(r.me.map.sv)).flatMap(r => (r.me.map.v || []).filter(p => Array.isArray(p) && p.length >= 3 && p.every(fin)));
  // Positioning also shows the measured shares (behind the ball, closest, last back) and distances under the field: the mean of the replayed games
  const ps = (recs || []).map(r => r?.me?.pos).filter(p => p && typeof p === 'object'), pm = {};
  for (const k of new Set(ps.flatMap(Object.keys))) { const xs = ps.map(p => p[k]).filter(fin); if (xs.length) pm[k] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length); }
  d.below = ps.length ? posViz(pm, { usual: posUsual, units, team, maps: false }) : '';
  DATA.set(key, d); const st = STATE.get(key), cur = st?.view && VIEWS.some(([v]) => v === st.view) ? st.view : (VIEWS.find(([v]) => has(d, v)) || VIEWS[0])[0];
  return `<div class="f3d" data-f3d="${esc(key)}"><div class="seg" role="radiogroup" aria-label="What the field shows">${VIEWS.map(([v, l]) => `<button type="button" role="radio" data-f3v="${v}" aria-checked="${v === cur}">${l}</button>`).join('')}</div>
    <div class="f3d-grid"><div><canvas tabindex="0" role="img" aria-label="The field in 3D. Drag or use the arrow keys to turn it."></canvas><div class="f3d-key" role="group" aria-label="Legend: click to show only one kind"></div><p class="f3d-hint">Drag to turn · double-click to reset the view</p></div><div class="f3d-side"></div></div><div class="f3d-below"${cur === 'pos' ? '' : ' hidden'}>${d.below}</div></div>`;
}

// ---------- the panel beside the field ----------
const sw = (c, shape = '') => `<i class="f3d-sw${shape ? ' ' + shape : ''}" style="--c:${c}"></i>`;
const cls = (st, g, v) => st.f[g] == null ? '' : st.f[g] === v ? ' on' : ' off';
const btn = (st, g, v, inner, extra = '') => `<button type="button" class="f3d-p${cls(st, g, v)}" data-f3f="${g}:${esc(v)}" aria-pressed="${st.f[g] === v}"${extra}>${inner}</button>`;
const eyb = (t, sub = '') => `<div class="f3d-eyb"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
/** Counts per value of one group, over the view's points with every other filter applied (so the numbers follow the field). */
const countBy = (its, st, g) => { const o = {}; for (const it of its) if (passes(it, st.f, g) && it.g[g] != null) o[it.g[g]] = (o[it.g[g]] || 0) + 1; return o; };
const rows = (st, g, list, n, sub = () => '', shape = () => '') => `<div class="f3d-rows">${list.filter(([v]) => n[v] || st.f[g] === v).map(([v, l, c]) => btn(st, g, v, `${c ? sw(c, shape(v)) : ''}<span>${esc(l)}${sub(v)}</span><b class="num">${n[v] || 0}</b>`)).join('')}</div>`;
const stack = (st, g, list, n) => { const tot = list.reduce((s, [v]) => s + (n[v] || 0), 0); if (!tot) return '';
  return `<div class="f3d-stack">${list.map(([v, l, c]) => btn(st, g, v, `<b class="num">${pct(n[v] || 0, tot)}%</b><span>${esc(l)}</span>`, ` style="flex:${Math.max(n[v] || 0, tot * 0.14)};--c:${c}"`)).join('')}</div>`; };
const chips = (st, g, list, n, unit = '') => `<div class="f3d-chips">${list.map(([v, l]) => btn(st, g, v, `${esc(l)} <b class="num">${n[v] || 0}${unit}</b>`)).join('')}</div>`;
const share = n => { const tot = Object.values(n).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, pct(v, tot)])); };
/** Rows with a won / neither / lost bar (50/50s) or goal / saved / off bar (shots) under each. */
function barRows(st, g, list, its, rate, parts) {
  return `<div class="f3d-rows">${list.map(([v, l]) => { const xs = its.filter(it => it.g[g] === v && passes(it, st.f, g)); if (!xs.length && st.f[g] !== v) return '';
    const bar = parts.map(([k, c, test]) => `<i style="width:${100 * xs.filter(test).length / (xs.length || 1)}%;background:rgb(${c})"></i>`).join('');
    return btn(st, g, v, `<span>${esc(l)} <small>· ${xs.length}</small></span><b class="num">${rate(xs)}</b><span class="f3d-bar">${bar}</span>`, ' data-bars="1"'); }).join('')}</div>`;
}
/** A goal seen from the front, split in six parts you can click; dots where shots crossed the line. mine = your goal, as you defend it. */
function netSVG(st, pts, mine) {
  const W = 280, H = 112, x0 = 14, y0 = 10, w = W - 28, h = H - 22, zw = [0.3, 0.4, 0.3], zh = [0.38, 0.62], sum = (a, i) => a.slice(0, i).reduce((s, x) => s + x, 0);
  const zones = [['ul', 0, 0], ['um', 1, 0], ['ur', 2, 0], ['ll', 0, 1], ['lm', 1, 1], ['lr', 2, 1]];
  return `<svg class="f3d-net" viewBox="0 0 ${W} ${H}" role="group" aria-label="${mine ? 'Your goal, seen from in front' : 'Their goal, seen from your side'}">
    <rect x="${x0 - 4}" y="${y0 - 4}" width="${w + 8}" height="${h + 6}" fill="none" stroke="rgba(${mine ? '255,140,70' : '127,178,255'},.9)" stroke-width="3"/>
    ${zones.map(([k, i, j]) => `<rect class="z${st.f.zone === k ? ' on' : ''}" data-f3f="zone:${k}" tabindex="0" role="button" aria-pressed="${st.f.zone === k}" aria-label="${ZONE_NAMES[k]}" x="${x0 + w * sum(zw, i)}" y="${y0 + h * sum(zh, j)}" width="${w * zw[i]}" height="${h * zh[j]}"><title>${ZONE_NAMES[k]}</title></rect>`).join('')}
    ${pts.map(([x, z, c, ring]) => `<circle cx="${(x0 + (x / GX + 1) / 2 * w).toFixed(1)}" cy="${(y0 + (1 - z / GZ) * h).toFixed(1)}" r="4" fill="rgb(${c})"${ring ? ' stroke="#fff" stroke-width="1.5"' : ''} pointer-events="none"/>`).join('')}
    <line x1="${x0 - 6}" x2="${x0 + w + 6}" y1="${y0 + h + 2}" y2="${y0 + h + 2}" stroke="rgba(255,255,255,.3)"/></svg>`;
}
const clearBtn = st => Object.values(st.f).some(v => v != null) ? '<button type="button" class="f3d-clear" data-f3f="clear">Show everything</button>' : '';
const noteP = t => `<p class="f3d-note">${t}</p>`;

/** The panel and the legend for the current view: [side html, legend html]. */
function sideHTML(d, st) {
  const view = st.view, its = items(d, view);
  if (!has(d, view)) return [`<div class="f3d-empty"><b>${esc(EMPTY[view])}</b>${view === 'touch' ? '' : `<p>${esc(SAVE_HINT)}</p>`}</div>`, ''];
  const key = (g, list, shape = () => '') => list.map(([v, l, c]) => c ? btn(st, g, v, `${sw(c, shape(v))}${esc(l)}`) : '').join('');
  const from = n => n ? `From ${plural(n, 'saved replay')}.` : '';
  if (view === 'touch') {
    const out = countBy(its, st, 'out'), cost = countBy(its, st, 'cost'), old = its.filter(it => it.g.out == null).length;
    return [`${eyb('What each touch led to')}${rows(st, 'out', OUT, out)}
      ${out.l || st.f.cost ? `${eyb('Lost the ball: how costly')}${rows(st, 'cost', COST, cost)}` : ''}
      ${eyb('Where')}${chips(st, 'third', THIRDS, countBy(its, st, 'third'))}${eyb('Height of the ball')}${chips(st, 'h', HEIGHTS, countBy(its, st, 'h'))}${clearBtn(st)}
      ${noteP(`${plural(its.length, 'touch')}${d.n > 1 ? ` in ${d.n} games` : ''}. ${d.nTk ? (d.nTk === d.n ? 'All from saved replays, which are exact.' : `${plural(d.nTk, 'game')} from saved replays, which are exact; the rest are read from live play.`) : 'These are read from live play.'}${old ? ` ${plural(old, 'touch')} from older games show without what they led to.` : ''}`)}`,
      key('out', OUT.filter(([v]) => v !== 'l')) + key('cost', COST) + (old ? `<span class="f3d-k0">${sw(C.plain)}Older games</span>` : '')];
  }
  if (view === 'pos') {
    const solo = d.team === 1 || !its.some(it => it.g.role), role = countBy(its, st, 'role'), rel = countBy(its, st, 'rel'), u = d.posUsual;
    const roles = d.team === 2 ? ROLES.filter(([v]) => v !== '2') : ROLES;
    const usual = u && fin(u.closest) && fin(u.farthest) ? `<p class="f3d-sub">Your usual: first man ${pc(u.closest)}${d.team === 2 ? '' : ` · second ${pc(100 - u.closest - u.farthest)}`} · last back ${pc(u.farthest)}</p>` : '';
    const ev = {}; for (const m of d.e) { const k = POS_EV[m[3]]; if (k) ev[k] = (ev[k] || 0) + 1; } const dcYou = d.e.filter(m => POS_EV[m[3]] === 'dc' && m[4] === 1).length;
    return [`${solo ? '' : `${eyb('Your role', 'time spent')}${stack(st, 'role', roles, role)}${usual}`}
      ${eyb('Where you were against the ball')}${stack(st, 'rel', RELS, rel)}<p class="f3d-sub">Behind = between the ball and your own goal.</p>
      ${d.e.length || d.nRp ? `${eyb('Positioning mistakes')}<div class="f3d-rows">${MISTAKES.filter(([k]) => d.team !== 1 || k === 'boom').map(([k, l, c, shape]) => btn(st, 'ev', k, `${sw(c, shape)}<span>${esc(l)}${k === 'dc' && ev.dc ? ` <small>· on you: ${dcYou}</small>` : ''}</span><b class="num">${k === 'lmc' ? approx('last_man_commit') : ''}${ev[k] || 0}</b>`)).join('')}</div>
        ${st.f.ev === 'dc' && ev.dc ? `<div class="f3d-chips" style="margin-top:6px">${btn(st, 'onyou', '1', 'Only the ones on you')}</div>` : ''}` : ''}
      ${eyb('Field third', 'share of your time')}${chips(st, 'third', THIRDS, share(countBy(its, st, 'third')), '%')}${clearBtn(st)}
      ${noteP(`${from(d.nPos)} Each dot is where your car was, about once a second.${solo ? '' : ' First man is the one closest to the ball.'} A double commit is on you when your teammate was closer to the ball when you both went.`)}`,
      (solo ? '' : key('role', roles)) + MISTAKES.map(([k, l, c, shape]) => btn(st, 'ev', k, `${sw(c, shape)}${esc(l)}`)).join('')];
  }
  if (view === 'shot') {
    const end = countBy(its, st, 'end'), zoneN = shown(d, { ...st, f: { ...st.f, zone: null } }).filter(it => it.p[3] >= 1 && zoneOf(-it.p[6], it.p[7]));
    const live = its.filter(it => it.p.length <= 4).length, rp = d.rp?.shots;
    const goalRate = xs => xs.length ? `${pct(xs.filter(it => it.p[3] === 2).length, xs.length)}% goals` : '–';
    const parts = SHOT_END.map(([v, , c]) => [v, c, it => String(it.p[3]) === v]);
    return [`${eyb('How they ended')}<div class="f3d-cards">${SHOT_END.map(([v, l, c]) => btn(st, 'end', v, `${sw(c)}<b class="num">${end[v] || 0}</b><small>${esc(l)}</small>`)).join('')}</div>
      ${zoneN.length || st.f.zone ? `${eyb('Where on their goal')}${netSVG(st, zoneN.map(it => [-it.p[6], it.p[7], it.p[3] === 2 ? C.goal : C.saved, it.p[8] === 1]), false)}<p class="f3d-sub">A white ring: straight at a defender. Click a part of the goal to see where those shots came from.</p>` : ''}
      ${its.some(it => it.g.kind) ? `${eyb('Kind of shot')}${barRows(st, 'kind', SHOT_KINDS, its, goalRate, parts)}` : ''}
      ${its.some(it => it.g.power) ? `${eyb('Power')}${chips(st, 'power', POWER, countBy(its, st, 'power'))}` : ''}
      ${eyb('Angle')}${chips(st, 'ang', ANGLE, countBy(its, st, 'ang'))}${clearBtn(st)}
      ${rp?.n ? kv([['On target', `${rp.onTarget} of ${rp.n}`], ['Goals', rp.goals], ['Straight at a defender', rp.atKeeper]]) : ''}
      ${noteP(`${from(d.nRp)} Each dot is the ball when you shot.${live ? ` ${plural(live, 'goal')} from games without a replay: save the replay to add every shot.` : ''} Power: soft under 72 km/h, hard over 108.`)}`,
      key('end', SHOT_END)];
  }
  if (view === 'save') {
    const end = countBy(its, st, 'end'), sv = d.rp?.saves, zoneN = shown(d, { ...st, f: { ...st.f, zone: null } }).filter(it => it.sv && zoneOf(it.p[8], it.p[9]));
    const mineKinds = countBy(its.filter(it => it.g.end === 'c' || it.g.end === 'k'), st, 'kind'), legacy = its.filter(it => !it.sv).length;
    return [`${d.sv.length ? `${eyb('Shots on your goal')}${rows(st, 'end', SV_END, end)}` : ''}
      ${zoneN.length || st.f.zone ? `${eyb('Where they came at your goal')}${netSVG(st, zoneN.map(it => [it.p[8], it.p[9], (SV_END.find(x => x[0] === it.g.end) || [])[2] || C.saved]), true)}<p class="f3d-sub">Seen from in front of your goal, as you defend it.</p>` : ''}
      ${Object.keys(mineKinds).length ? `${eyb('How you saved it')}${chips(st, 'kind', SV_KIND, mineKinds)}` : ''}${clearBtn(st)}
      ${sv ? kv([['Your saves', sv.n], ['Their shots on target', sv.faced], ['Goals against', sv.conceded], ['Near the shot, no touch', `${approx('missed_save')}${sv.missed}`]]) : ''}
      ${noteP(`${from(d.nRp)} Each line runs from where they shot to where the ball was stopped (a ring) or went in (an X).${legacy ? ` ${plural(legacy, 'save')} from replays read before 3.1 show as rings only.` : ''}`)}`,
      key('end', SV_END) + `<span class="f3d-k0">${sw(C.from)}Where the shot was taken</span>`];
  }
  if (view === 'fifty') {
    const res = countBy(its, st, 'res'), wr = xs => xs.length ? `${pct(xs.filter(it => it.g.res === '1').length, xs.length)}% won` : '–';
    const parts = F_RES.map(([v, , c]) => [v, c, it => it.g.res === v]);
    return [`${eyb('Result')}${stack(st, 'res', F_RES, res)}<p class="f3d-sub">${plural(its.length, '50/50')}, not counting kickoffs.</p>
      ${eyb('Situation')}${barRows(st, 'sit', F_SIT, its, wr, parts)}
      ${eyb('Where')}${barRows(st, 'surf', F_SURF, its, wr, parts)}
      ${its.some(it => it.g.part) ? `${eyb('Part of your car')}${barRows(st, 'part', F_PART, its, wr, parts)}` : ''}${clearBtn(st)}
      ${noteP(`${from(d.nRp)} A 50/50 is you and an opponent on the ball at the same moment. Won: your team touched it next, or it went toward their goal.`)}`,
      key('res', F_RES, () => 'ring')];
  }
  const rc = d.rp?.recov;
  return [`${eyb('How you landed')}<div class="f3d-cards">${LAND.map(([v, l, c]) => btn(st, 'land', v, `${sw(c)}<b class="num">${countBy(its, st, 'land')[v] || 0}</b><small>${esc(l)}</small>`)).join('')}</div>
    ${rc?.landings ? `<div class="cellx" style="gap:16px;align-items:center;margin-top:16px">${ring(fin(rc.clean) ? Math.round(rc.clean) : null, { size: 76, label: `${pc(rc.clean)} clean landings` })}<div><b style="font:700 15px var(--ds-display)">${pc(rc.clean)} clean</b><div class="dim" style="font-size:12px">of ${plural(rc.landings, 'landing')}</div></div></div>
    ${kv([['Landing to control (aerials)', fin(rc.aerialS) ? `${rc.aerialS.toFixed(2)} s` : '–'], ['Bump to control', fin(rc.bumpS) ? `${rc.bumpS.toFixed(2)} s (${rc.bumpN})` : '–'], ['Slow recoveries', `${approx('slow_recovery')}${rc.slow}`], ['Speed kept on landing', pc(rc.kept)]])}` : ''}${clearBtn(st)}
    ${noteP(`${from(d.nRp)} Each dot is where your car came down after an aerial or a bump. Clean means wheels first.`)}`,
    key('land', LAND)];
}

// ---------- drawing ----------
function draw(cv, d, st) {
  const g = cv.getContext('2d'), dpr = globalThis.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.lineJoin = 'round';
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch), sc = Math.min(W / 17000, H / 10400);
  // turn around the up axis, look down from `pitch` above the ground (90° = straight down), light perspective
  // -x: RL's +x is your left (see angleOf)
  const proj = (x, y, z) => { x = -x; const x1 = x * cy - y * sy, y1 = x * sy + y * cy, zc = z - FZ * 0.3, y2 = y1 * cp - zc * sp, z2 = y1 * sp + zc * cp, k = 19000 / (19000 + y2) * sc; return [W / 2 + x1 * k, H * 0.47 - z2 * k, y2]; };
  const path = (pts, close = true) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = proj(...p); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); if (close) g.closePath(); };
  const rect = (z, y0 = -FY, y1 = FY) => [[-FX, y0, z], [FX, y0, z], [FX, y1, z], [-FX, y1, z]];
  path(rect(0)); g.fillStyle = '#1b1b20'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.4; g.stroke();
  const th = st.f.third; if (th) { const y0 = th === 'mid' ? -FY / 3 : th === 'fwd' ? FY / 3 : -FY, y1 = th === 'back' ? -FY / 3 : th === 'mid' ? FY / 3 : FY; path(rect(0, y0, y1)); g.fillStyle = 'rgba(255,255,255,.05)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.2; g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.setLineDash([4, 5]); for (const y of [-FY / 3, FY / 3]) { path([[-FX, y, 0], [FX, y, 0]], false); g.stroke(); } g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,.22)'; path([[-FX, 0, 0], [FX, 0, 0]], false); g.stroke();
  path(Array.from({ length: 40 }, (_, i) => [Math.cos(i / 40 * 6.283) * 900, Math.sin(i / 40 * 6.283) * 900, 0])); g.stroke();
  for (const [s, col] of [[-1, '255,92,0'], [1, '127,178,255']]) { path([[-GX, s * FY, 0], [GX, s * FY, 0], [GX, s * FY, GZ], [-GX, s * FY, GZ]]); g.fillStyle = `rgba(${col},.22)`; g.fill(); g.strokeStyle = `rgba(${col},.95)`; g.lineWidth = 2; g.stroke(); }
  g.lineWidth = 1; for (const [z, a] of [[GZ, .16], [FZ, .1]]) { path(rect(z)); g.strokeStyle = `rgba(255,255,255,${a})`; g.setLineDash(z === FZ ? [] : [3, 5]); g.stroke(); } g.setLineDash([]);
  for (const [x, y] of [[-FX, -FY], [FX, -FY], [FX, FY], [-FX, FY]]) { path([[x, y, 0], [x, y, FZ]], false); g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke(); }
  const dot = (s, c, r, a) => { g.beginPath(); g.arc(s[0], s[1], r, 0, 6.3); g.fillStyle = `rgba(${c},${a})`; g.fill(); };
  const stem = (p, c, a) => { const s = proj(p[0], p[1], p[2]), f = proj(p[0], p[1], 0); g.beginPath(); g.moveTo(f[0], f[1]); g.lineTo(s[0], s[1]); g.strokeStyle = `rgba(${c},${a})`; g.lineWidth = 1; g.stroke(); return s; };
  const mark = (s, c, shape) => { const [x, y] = s, r = 6.5; g.lineWidth = 2.2; g.strokeStyle = g.fillStyle = `rgb(${c})`; g.beginPath();
    if (shape === 'ring') { g.arc(x, y, r, 0, 6.3); g.stroke(); } else if (shape === 'x') { g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }
    else if (shape === 'tri') { g.moveTo(x, y - r); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); g.fill(); } else { g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); g.fill(); } };
  const its = shown(d, st).map(it => ({ ...it, depth: proj(it.p[0], it.p[1], it.p[2])[2] })).sort((a, b) => b.depth - a.depth);
  const n = its.length, a = Math.max(0.45, Math.min(0.95, 120 / Math.max(1, n)));   // many dots: each a little lighter
  const view = st.view;
  if (view === 'touch') for (const { p, g: gr } of its) { const c = gr.out == null ? C.plain : gr.out === 'l' ? (COST.find(x => x[0] === gr.cost) || COST[2])[2] : OUT.find(x => x[0] === gr.out)[2];
    dot(stem(p, c, 0.25 * a), c, gr.out === 'g' ? 5 : 3.4, Math.max(a, 0.6)); }
  if (view === 'pos') { const ms = marks(d, st), fade = st.f.ev != null;
    for (const { p, g: gr } of its) dot(proj(p[0], p[1], p[2]), gr.role ? ROLES.find(x => x[0] === gr.role)[2] : C.nobody, 2.4, fade ? 0.12 : Math.max(0.35, a * 0.8));
    for (const m of ms) { const k = MISTAKES.find(x => x[0] === m.k); mark(proj(m.p[0], m.p[1], 0), k[2], k[3]); } }
  if (view === 'shot') for (const { p, g: gr } of its) { const c = (SHOT_END.find(x => x[0] === gr.end) || SHOT_END[0])[2], s = stem(p, c, 0.35), goal = gr.end === '2';
    if (gr.end !== '0' && fin(p[6]) && p[6] > -9999) { const t = proj(p[6], FY, Math.max(0, p[7])); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(t[0], t[1]); g.strokeStyle = `rgba(${c},.35)`; g.setLineDash([2, 4]); g.stroke(); g.setLineDash([]); }
    else if (goal) { const t = proj(0, FY, GZ * 0.45); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(t[0], t[1]); g.strokeStyle = `rgba(${c},.3)`; g.setLineDash([2, 4]); g.stroke(); g.setLineDash([]); }
    dot(s, c, goal ? 5.5 : 4.2, gr.end === '0' ? 0.7 : 0.95); if (goal) { g.strokeStyle = '#0E0E0F'; g.lineWidth = 1.5; g.stroke(); } }
  if (view === 'save') for (const it of its) { const c = (SV_END.find(x => x[0] === it.g.end) || [, , C.save])[2], p = it.p;
    if (!it.sv) { const b = proj(p[0], p[1], p[2]); g.beginPath(); g.arc(b[0], b[1], 6, 0, 6.3); g.strokeStyle = `rgb(${C.save})`; g.lineWidth = 2.4; g.stroke(); continue; }
    const s0 = proj(p[0], p[1], p[2]), conceded = it.g.end === 'x', b = conceded ? proj(fin(p[8]) && p[8] > -9999 ? p[8] : 0, -FY, Math.max(0, p[9])) : proj(p[3], p[4], p[5]);
    g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(b[0], b[1]); g.strokeStyle = `rgba(${c},.45)`; g.lineWidth = 1.3; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
    dot(s0, C.from, 2.4, 0.7); if (conceded) mark(b, c, 'x'); else { g.beginPath(); g.arc(b[0], b[1], 6, 0, 6.3); g.strokeStyle = `rgb(${c})`; g.lineWidth = 2.4; g.stroke(); dot(b, c, 2.4, 1); } }
  if (view === 'fifty') for (const { p, g: gr } of its) { const c = (F_RES.find(x => x[0] === gr.res) || F_RES[1])[2], s = stem(p, c, 0.3);
    g.beginPath(); g.arc(s[0], s[1], 5.5, 0, 6.3); g.fillStyle = `rgba(${c},.25)`; g.fill(); g.strokeStyle = `rgb(${c})`; g.lineWidth = 2; g.stroke(); }
  if (view === 'recov') for (const { p, g: gr } of its) dot(proj(p[0], p[1], p[2]), gr.land === '1' ? C.clean : C.rough, 3.6, Math.max(a, 0.7));
  const lab = (t, p, c) => { const [x, y] = proj(...p); g.font = '600 11px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = c; g.fillText(t, x, y); };
  lab('YOUR GOAL', [0, -FY - 520, 0], 'rgba(255,140,70,.95)'); lab('THEIR GOAL', [0, FY + 520, 0], 'rgba(127,178,255,.95)');
}

function mount(el) {
  el.dataset.on = '1'; const key = el.dataset.f3d, d = DATA.get(key), cv = el.querySelector('canvas'); if (!d || !cv) return;
  const st = STATE.get(key) || { yaw: YAW0, pitch: PITCH0, view: null, f: {} }; STATE.set(key, st); st.f ||= {};
  st.view = el.querySelector('[data-f3v][aria-checked=true]')?.dataset.f3v || 'touch';
  const paint = () => draw(cv, d, st), side = () => { const [h, k] = sideHTML(d, st); el.querySelector('.f3d-side').innerHTML = h; el.querySelector('.f3d-key').innerHTML = k; el.querySelector('.f3d-below').hidden = st.view !== 'pos'; };
  const pick = t => {
    const b = t.closest('[data-f3v]'), f = t.closest('[data-f3f]'); if (!b && !f) return false;
    if (b) { st.view = b.dataset.f3v; st.f = {}; for (const x of el.querySelectorAll('[data-f3v]')) x.setAttribute('aria-checked', x === b); }
    else if (f.dataset.f3f === 'clear') st.f = {};
    else { const i = f.dataset.f3f.indexOf(':'), g = f.dataset.f3f.slice(0, i), v = f.dataset.f3f.slice(i + 1); st.f[g] = st.f[g] === v ? null : v; if (g === 'ev' && st.f.ev !== 'dc') st.f.onyou = null; }   // a second click clears it
    side(); paint(); if (f) el.querySelector(`[data-f3f="${CSS.escape(f.dataset.f3f)}"]`)?.focus(); return true;
  };
  el.addEventListener('click', e => { if (pick(e.target)) e.stopPropagation(); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('rect[data-f3f]')) { e.preventDefault(); pick(e.target); } });
  let drag = null; const lim = p => Math.max(0.2, Math.min(1.5, p));
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, st.yaw, st.pitch]; try { cv.setPointerCapture(e.pointerId); } catch {} });
  let raf = 0; const paintSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };   // QC D5: at most one paint per frame while dragging
  cv.addEventListener('pointermove', e => { if (!drag) return; st.yaw = drag[2] + (e.clientX - drag[0]) * 0.008; st.pitch = lim(drag[3] + (e.clientY - drag[1]) * 0.006); paintSoon(); });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, () => { drag = null; });
  cv.addEventListener('dblclick', () => { st.yaw = YAW0; st.pitch = PITCH0; paint(); });
  cv.addEventListener('keydown', e => { const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[e.key]; if (!k) return; e.preventDefault(); e.stopPropagation(); st.yaw += k[0]; st.pitch = lim(st.pitch + k[1]); paint(); });
  // one observer per canvas, dropped once the canvas leaves the page (a re-render makes a new one)
  if (globalThis.ResizeObserver) { const ro = new ResizeObserver(() => { if (!cv.isConnected) { ro.disconnect(); const k = el.dataset.f3d; if (k && !document.querySelector(`.f3d[data-f3d="${CSS.escape(k)}"]`)) DATA.delete(k); return; } paint(); }); ro.observe(cv); }   // QC D5: a field that left the page frees its data
  side(); paint();
}

/** Wire up every field that appears in the document, now and after each page render. Call once. */
export function watchField3d(root = document.body) {
  const scan = () => { for (const el of root.querySelectorAll('.f3d:not([data-on])')) mount(el); };
  new MutationObserver(scan).observe(root, { childList: true, subtree: true }); scan();
}

