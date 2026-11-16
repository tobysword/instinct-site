// Positioning from a saved replay (record me.pos, ui/engine/replayrating.js measuredPos). Shown only for a match whose replay
// was saved; every caller gets '' otherwise, so no screen has a blank or "save a replay" slot.
// One visual everywhere (Match, a Progress breakdown, a session on Sessions): where you were as a top-down field (your goal on
// the left, each third shaded by its share), how high as a side view, the shares (behind the ball, closest, last back) in plain
// words ("about 2 in 3") with ten pips, and the distances as two figures. With `usual`, each part names your usual too; with
// `team`, closest and last back name the even split for that team size.
import { esc } from './render.js';
import { fmtDist } from '../engine/units.js';

const pc = x => `${Math.round(x)}%`;
const fin = Number.isFinite;

/** Rows [label, value, hint] for the measures this match has (Duel has no teammate rows). */
export function posRows(p, { units = 'meters' } = {}) {
  if (!p) return [];
  const r = [], has = k => fin(p[k]);
  if (has('behind')) r.push(['Behind the ball', pc(p.behind), 'Goal-side of the ball']);
  if (has('closest')) r.push(['Closest to the ball', pc(p.closest), 'Of your team']);
  if (has('back')) r.push(['Last back', pc(p.back), 'Furthest back of your team']);
  if (has('def') && has('mid') && has('off')) r.push(['Defense · middle · attack', `${pc(p.def)} · ${pc(p.mid)} · ${pc(p.off)}`, 'Thirds of the field']);
  if (has('distBall')) r.push(['Distance to the ball', fmtDist(p.distBall, { units }), 'On average']);
  if (has('distMates')) r.push(['Distance to teammates', fmtDist(p.distMates, { units }), 'On average']);
  if (has('ground') && has('low') && has('high')) r.push(['Ground · low air · high air', `${pc(p.ground)} · ${pc(p.low)} · ${pc(p.high)}`, 'High: above the crossbar']);
  return r;
}

const THIRDS = [['def', 'Defense'], ['mid', 'Middle'], ['off', 'Attack']];
const HEIGHT = [['high', 'High air', 'Above the crossbar'], ['low', 'Low air', ''], ['ground', 'Ground', '']];   // top to bottom
const SHARES = [['behind', 'Behind the ball', 'Goal-side of the ball'], ['closest', 'Closest to the ball', 'Of your team'], ['back', 'Last back', 'Furthest back of your team']];
const DISTS = [['distBall', 'To the ball'], ['distMates', 'To teammates']];
const FRACS = [[1 / 10, '1 in 10'], [1 / 5, '1 in 5'], [1 / 4, '1 in 4'], [1 / 3, '1 in 3'], [2 / 5, '2 in 5'], [1 / 2, 'half'], [3 / 5, '3 in 5'],
  [2 / 3, '2 in 3'], [3 / 4, '3 in 4'], [4 / 5, '4 in 5'], [9 / 10, '9 in 10']];

/** A share in plain words: "about 2 in 3", "about half", "almost never". */
export function shareWords(pct) {
  const x = pct / 100; if (x < 0.05) return 'almost never'; if (x > 0.95) return 'almost always';
  const [, w] = FRACS.reduce((a, f) => Math.abs(f[0] - x) < Math.abs(a[0] - x) ? f : a);
  return `about ${w}`;
}
const cap = s => s[0].toUpperCase() + s.slice(1);
/** "▲ 6" / "▼ 6" against your usual, '' when within 5 points. */
const delta = (a, b) => fin(b) && Math.abs(a - b) >= 5 ? `<span class="pv-dl">${a > b ? '▲' : '▼'} ${Math.round(Math.abs(a - b))}</span>` : '';
const shade = (v, tot) => (Math.max(0, v) / (tot || 1)).toFixed(3);

/** Top-down field: your goal on the left, each third shaded by the share of time you spent there. */
function field(p, u) {
  if (!THIRDS.every(([k]) => fin(p[k]))) return '';
  const tot = THIRDS.reduce((a, [k]) => a + p[k], 0), top = THIRDS.reduce((a, b) => p[b[0]] > p[a[0]] ? b : a)[0];
  const words = THIRDS.map(([k, l]) => `${l} ${pc(p[k])}${u && fin(u[k]) ? ` (usual ${pc(u[k])})` : ''}`).join(', ');
  return `<div class="pv-blk pv-fwrap"><div class="pv-h"><b>Where you were</b><small>Seen from above</small></div>
    <div class="pv-field" role="img" aria-label="${esc(`Where you were, your goal on the left: ${words}`)}">${THIRDS.map(([k, l]) => `<div class="pv-z${k === top ? ' top' : ''}" style="--a:${shade(p[k], tot)}"><b class="num">${pc(p[k])}</b><small>${esc(l)}</small>${u && fin(u[k]) ? `<em>usual ${pc(u[k])}${delta(p[k], u[k])}</em>` : ''}</div>`).join('')}</div>
    <div class="pv-fx"><span>◂ Your goal</span><span>Their goal ▸</span></div></div>`;
}
/** Side view: high air on top, ground at the bottom, each band shaded by its share. */
function side(p, u) {
  if (!HEIGHT.every(([k]) => fin(p[k]))) return '';
  const tot = HEIGHT.reduce((a, [k]) => a + p[k], 0);
  const words = HEIGHT.map(([k, l]) => `${l} ${pc(p[k])}${u && fin(u[k]) ? ` (usual ${pc(u[k])})` : ''}`).join(', ');
  return `<div class="pv-blk pv-swrap"><div class="pv-h"><b>How high</b><small>Seen from the side</small></div>
    <div class="pv-side" role="img" aria-label="${esc(`How high: ${words}. High air is above the crossbar.`)}">${HEIGHT.map(([k, l, h]) => `<div class="pv-band" style="--a:${shade(p[k], tot)}"${h ? ` title="${esc(h)}"` : ''}><span>${esc(l)}</span><b class="num">${pc(p[k])}</b>${u && fin(u[k]) ? `<em>usual ${pc(u[k])}</em>` : ''}</div>`).join('')}</div></div>`;
}
/** Ten pips, n filled. */
const pips = pct => { const n = Math.round(pct / 10); return `<span class="pv-pips" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`; };

/**
 * The positioning visual, or '' when p has nothing to show.
 * @param p me.pos (or a session's mean of them)
 * @param o { usual: the same shape for your usual, units, team: players a side (names the even split for closest and last back),
 *            maps: false leaves the two flat maps out (where the 3D field, field3d.js, shows them as its filter) }
 */
export function posViz(p, { usual = null, units = 'meters', team = null, maps: withMaps = true } = {}) {
  if (!p || !posRows(p).length) return '';
  const u = usual && typeof usual === 'object' ? usual : null;
  const even = team >= 2 ? (`1 in ${team}`) : null;
  const shares = SHARES.filter(([k]) => fin(p[k])).map(([k, l, h]) => {
    const ref = [u && fin(u[k]) ? `usual ${shareWords(u[k]).replace('about ', '').replace('half', '1 in 2')}` : '', even && k !== 'behind' ? `even split ${even}` : ''].filter(Boolean).join(' · ');
    const refH = [u && fin(u[k]) ? `usual ${esc(shareWords(u[k]).replace('about ', '').replace('half', '1 in 2'))}${delta(p[k], u[k])}` : '', even && k !== 'behind' ? `even split ${esc(even)}` : ''].filter(Boolean).join(' · ');
    return `<div class="pv-m" role="img" aria-label="${esc(`${l}: ${shareWords(p[k])} of the time (${pc(p[k])})${ref ? `; ${ref}` : ''}`)}"><div><b>${esc(l)}</b><small>${esc(h)}</small></div>${pips(p[k])}
    <div class="pv-w"><b>${esc(cap(shareWords(p[k])))}</b><small><span class="num">${pc(p[k])}</span> of the time${refH ? `<br>${refH}` : ''}</small></div></div>`; }).join('');
  const dists = DISTS.filter(([k]) => fin(p[k])).map(([k, l]) => `<div><div class="eyb">${esc(l)}</div><div class="v num">${esc(fmtDist(p[k], { units }))}</div>${u && fin(u[k]) ? `<small class="dim">usual ${esc(fmtDist(u[k], { units }))}</small>` : '<small class="dim">on average</small>'}</div>`).join('');
  const maps = withMaps ? field(p, u) + side(p, u) : ''; if (!maps && !shares && !dists) return '';
  return `<div class="posv">${maps ? `<div class="pv-maps">${maps}</div>` : ''}${shares ? `<div class="pv-ms">${shares}</div>` : ''}${dists ? `<div class="pv-d">${dists}</div>` : ''}</div>`;
}

/** The panel, or '' when the match has no saved replay. cls: extra section classes (grid span). */
export function posPanelHTML(p, { units = 'meters', cls = '', id = 'pos', team = null, maps = true } = {}) {
  const viz = posViz(p, { units, team, maps }); if (!viz) return '';
  return `<section class="pn p ${cls}" aria-labelledby="${id}-h"><div class="sh"><div><h2 id="${id}-h">Positioning</h2><p>From your saved replay, which is more exact than live play.</p></div></div>${viz}</section>`;
}

/** Small tag for a Playing like that comes from the saved replay ('' otherwise). */
export const replayTag = r => r?.src === 'replay' ? '<span class="chip" title="Read from the whole replay, positioning included">From your saved replay</span>' : '';
