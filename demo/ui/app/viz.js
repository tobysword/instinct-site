// Shared visuals for the control window (2.3, Direction 2). Pure string builders, no DOM, styles in main.css ("visuals").
// - ladder: tiers as segments tinted by rank family, your level as a pin, the target as a flag, labeled markers above
// - vsRows: a stat against a rank's average as a bar growing left or right from the center (rows from engine/compare.js)
// - spark, form, scoreboard, calendar, miniLadder, ring
import { esc, rankImg } from './render.js';
import { SHORT, TIERS, shortName } from '../engine/rating.js';
import { verdictWord } from '../engine/compare.js';

const fam = k => k >= 21 ? 'ssl' : k >= 18 ? 'gc' : k >= 15 ? 'ch' : k >= 12 ? 'di' : k >= 9 ? 'pl' : 'lo';
const clampT = k => Math.max(0, Math.min(21, k));
const pct = v => (Math.round(v * 1000) / 10).toFixed(1);

/** The tier range a ladder shows: every value with a tier of margin, at least `min` tiers. */
export function ladderRange(values, { min = 7 } = {}) {
  const xs = values.filter(v => v != null && Number.isFinite(v)); if (!xs.length) return { from: 12, to: 19 };
  let from = clampT(Math.floor(Math.min(...xs)) - 1), to = clampT(Math.floor(Math.max(...xs)) + 1);
  while (to - from + 1 < min) { if (from > 0) from--; if (to - from + 1 < min && to < 21) to++; if (from === 0 && to === 21) break; }
  return { from, to };
}

/**
 * marks: [{ name, t (tier value; tier k covers [k, k+1)), sub?, tone?: 'hot' | 'ok' }]; you: tier value or null; target: tier index or null.
 * Marks are staggered into `rows` lines so close ones never overlap.
 */
export function ladder({ marks = [], you = null, youLabel = 'You', target = null, rows = 2, label = '' } = {}) {
  const { from, to } = ladderRange([...marks.map(m => m.t), you, target != null ? target + 0.5 : null]);
  const n = to - from + 1, x = v => Math.max(0, Math.min(1, (v - from) / n));
  const sorted = marks.filter(m => m.t != null).map(m => ({ ...m })).sort((a, b) => a.t - b.t), last = Array(rows).fill(-1);
  for (const m of sorted) { const p = x(m.t); let r = last.findIndex(v => p - v > 0.12); if (r < 0) r = last.indexOf(Math.min(...last)); m.row = r; last[r] = p; }
  const rowH = 40, top = rows * rowH + 10;
  const seg = Array.from({ length: n }, (_, i) => `<span class="lseg ${fam(from + i)}"></span>`).join('');
  // the target tier is also named in the tier row, so it reads even when your pin sits on top of the flag
  const tiers = Array.from({ length: n }, (_, i) => { const k = from + i; return `<span class="ltl${target === k ? ' on' : ''}">${rankImg(SHORT[k], 16)}${esc(shortName(SHORT[k]))}${target === k ? '<small>target</small>' : ''}</span>`; }).join('');
  const near = you != null && target != null && Math.abs(x(you) - x(target + 0.5)) < 0.06;
  const mk = sorted.map(m => `<div class="lmk" style="left:${pct(x(m.t))}%;top:${m.row * rowH}px"><span class="lchip ${m.tone || ''}"><b>${esc(m.name)}</b>${m.sub ? `<em>${esc(m.sub)}</em>` : ''}</span><i class="lstem" style="height:${top - m.row * rowH - 26}px"></i></div>`).join('');
  const aria = [you != null ? `${youLabel} ${TIERS[clampT(Math.floor(you))]}` : '', target != null ? `target ${TIERS[target]}` : '', ...sorted.map(m => `${m.name} ${TIERS[clampT(Math.floor(m.t))]}`)].filter(Boolean).join(', ');
  return `<div class="lad" role="img" aria-label="${esc(label || 'Rank ladder')}: ${esc(aria)}" style="padding-top:${sorted.length ? top : 24}px">${mk}
<div class="ltrack">${seg}</div>
${target != null ? `<div class="ltgt" style="left:${pct(x(target + 0.5))}%"><i></i>${near ? '' : '<span>Target</span>'}</div>` : ''}
${you != null ? `<div class="lyou" style="left:${pct(x(you))}%"><i></i><span>${esc(youLabel)}</span></div>` : ''}
<div class="ltiers">${tiers}</div></div>`;
}

/** A small one-line ladder for table rows: your dot, the target tick, family tints. */
export function miniLadder(t, target = null, { from = null, to = null } = {}) {
  if (t == null) return '<span class="mlad empty" aria-hidden="true"></span>';
  const r = from != null ? { from, to } : ladderRange([t, target != null ? target + 0.5 : null], { min: 8 }), n = r.to - r.from + 1, x = v => Math.max(0, Math.min(1, (v - r.from) / n));
  const seg = Array.from({ length: n }, (_, i) => `<i class="${fam(r.from + i)}"></i>`).join('');
  return `<span class="mlad" aria-hidden="true"><span class="mseg">${seg}</span>${target != null ? `<b class="mtgt" style="left:${pct(x(target + 0.5))}%"></b>` : ''}<b class="mdot" style="left:${pct(x(t))}%"></b></span>`;
}

/** Comparison rows (engine/compare.js compareRow) as center-out bars. ref: the tier short the average belongs to.
 *  cols / aria: other column names and label, when the reference is not a rank average (Sessions: your usual). */
export function vsRows(rows, { ref = '', head = true, cols = null, aria = null, usual = false } = {}) {
  const [c1, c2, c3, c4, c5] = cols || ['Stat', 'You', `vs ${shortName(ref) || ref} average`, 'Average', 'Verdict'];
  if (!rows?.length) return '';
  return `<div class="vs" role="table" aria-label="${esc(aria || `Your stats against an average ${ref} game`)}">${head ? `<div class="vsr vsh" role="row"><span role="columnheader">${esc(c1)}</span><span role="columnheader" class="n">${esc(c2)}</span><span role="columnheader" class="c">${esc(c3)}</span><span role="columnheader">${esc(c4)}</span><span role="columnheader" class="n">${esc(c5)}</span></div>` : ''}`
    + rows.map(r => { const z = r.vsRank.z, w = Math.min(48, Math.abs(z) * 16), tone = r.verdict ? r.vsRank.tone : Math.abs(z) < 0.5 ? 'na' : r.vsRank.tone;
      return `<div class="vsr" role="row"><span role="cell"><b class="vsl">${esc(r.label)}</b>${r.def ? `<small>${esc(r.def)}</small>` : ''}</span><b role="cell" class="n num">${esc(r.value)}</b>`
        + `<span role="cell" class="vsb" aria-label="${esc(r.vsRank.words)}"><i class="vmid"></i><i class="fill ${tone}" style="${z < 0 ? 'right' : 'left'}:50%;width:${w.toFixed(1)}%"></i>${usual && r.vsUsual ? `<i class="vus" style="left:${(50 + Math.max(-48, Math.min(48, (z - r.vsUsual.z) * 16))).toFixed(1)}%"></i>` : ''}</span>`
        + `<span role="cell" class="num dim">${esc(r.vsRank.avg)}</span><span role="cell" class="n vsw ${tone}">${esc(r.verdict || verdictWord(z, tone))}</span></div>`; }).join('') + `</div>`;
}
export const vsLegend = ({ usual = false } = {}) => `<span class="lgd"><span><i class="sw hi"></i>Better: like higher ranks</span><span><i class="sw lo"></i>Worse: like lower ranks</span>${usual ? '<span><i class="sw vus-k"></i>Your usual</span>' : ''}</span>`;

/** A sparkline. target: a dashed line at that value. */
export function spark(vals, { w = 96, h = 28, color = 'var(--ds-or2)', target = null, lo = null, hi = null, label = '' } = {}) {
  const xs = (vals || []).filter(v => v != null && Number.isFinite(v)); if (xs.length < 2) return '';
  const a = lo ?? Math.min(...xs, target ?? Infinity) - 0.3, b = hi ?? Math.max(...xs, target ?? -Infinity) + 0.3, X = i => (2 + i * (w - 6) / (xs.length - 1)).toFixed(1), Y = v => (h - 3 - (v - a) / ((b - a) || 1) * (h - 6)).toFixed(1);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${target != null ? `<line x1="0" x2="${w}" y1="${Y(target)}" y2="${Y(target)}" class="sp-t"/>` : ''}<path d="${xs.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(xs.length - 1)}" cy="${Y(xs[xs.length - 1])}" r="2.6" fill="${color}"/></svg>`;
}

/** Results oldest → newest as squares ('md' with letters) or slim bars ('xs'). */
export const form = (rs, size = 'md') => { const xs = (rs || []).filter(r => r === 'W' || r === 'L'); if (!xs.length) return '';
  return `<span class="form ${size}" role="img" aria-label="Results, oldest to newest: ${xs.join(' ')}">${xs.map(r => `<i class="${r === 'W' ? 'w' : 'l'}">${size === 'md' ? r : ''}</i>`).join('')}</span>`; };

/** Goals across a 5 minute game: yours above the line, theirs below; overtime goals sit past the 0:00 mark. now: seconds left (live).
 *  marks: [{ s: seconds left, label }] small markers on the line (the replay moment behind a goal against). */
/** The end-of-game scoreboard for a saved match (2.7, in the "How it went" spot): your team first with your row marked, then
 *  the other team. Other players appear only as that game's scoreboard line (names hidden with Hide player names). The Score
 *  column shows only when the record has it. */
/** 3.1.1: your shots in a match: a saved replay's own count (xg.rs: every touch heading on goal, so it catches shots RL
 *  misses) when there is one, else Rocket League's. Display only: the rating and the stat-vs-rank bars keep RL's count,
 *  because the rank averages are measured with it. */
export const myShots = rec => Number.isFinite(rec?.rp?.shots?.n) ? rec.rp.shots.n : rec?.me?.stats?.shots;
export function scoreboard(rec, { hideNames = false, meName = 'You' } = {}) {   // 3.1 meName: a teammate's game on the Team page
  let me = rec?.me?.stats; if (!me) return '';
  if (Number.isFinite(rec.rp?.shots?.n)) me = { ...me, shots: rec.rp.shots.n };
  const others = rec.players || [], mates = others.filter(p => p.rel === 'mate'), opps = others.filter(p => p.rel !== 'mate');
  const rows = [{ name: meName, s: me, me: true, us: true, mvp: !!rec.me.mvp }, ...mates.map((p, i) => ({ name: hideNames ? `Teammate${mates.length > 1 ? ' ' + (i + 1) : ''}` : p.name, s: p.stats, us: true })),
    ...opps.map((p, i) => ({ name: hideNames ? `Opponent ${i + 1}` : p.name, s: p.stats, us: false, first: i === 0 }))];
  const cols = [['score', 'Score'], ['goals', 'Goals'], ['assists', 'Assists'], ['saves', 'Saves'], ['shots', 'Shots']].filter(([k]) => k !== 'score' || rows.some(r => Number.isFinite(r.s?.score)));
  const cell = v => Number.isFinite(v) ? v : '–';
  return `<table class="tbl sbd"><thead><tr><th scope="col"><span class="sr">Player</span></th>${cols.map(([, l]) => `<th scope="col" class="n">${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r =>
    `<tr class="${r.me ? 'you' : ''}${r.first ? ' sep' : ''}"><th scope="row"><i class="sd ${r.us ? 'us' : 'them'}" aria-hidden="true"></i>${esc(r.name)}${r.mvp ? ' <span class="chip sm">MVP</span>' : ''}<span class="sr">, ${r.us ? 'your team' : 'other team'}</span></th>${cols.map(([k]) => `<td class="n num">${cell(r.s?.[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/** Days played over the last `weeks` weeks (Monday rows first). days: Map 'YYYY-MM-DD' → minutes. */
export function calendar(days, { weeks = 12, now = Date.now() } = {}) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0); const dow = (d0.getDay() + 6) % 7, start = new Date(d0); start.setDate(d0.getDate() - dow - (weeks - 1) * 7);
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lvl = m => !m ? 0 : m < 20 ? 1 : m < 45 ? 2 : m < 90 ? 3 : 4;
  const cells = [], months = [];
  for (let w = 0; w < weeks; w++) { const d = new Date(start); d.setDate(start.getDate() + w * 7); months.push(d.getDate() <= 7 || w === 0 ? d.toLocaleDateString([], { month: 'short' }) : ''); }
  for (let r = 0; r < 7; r++) { cells.push(`<span class="cl-d">${['Mon', '', 'Wed', '', 'Fri', '', 'Sun'][r]}</span>`);
    for (let w = 0; w < weeks; w++) { const d = new Date(start); d.setDate(start.getDate() + w * 7 + r);
      if (d > d0) { cells.push('<span></span>'); continue; }
      const m = days.get(key(d)) || 0; cells.push(`<span class="cl c${lvl(m)}${+d === +d0 ? ' today' : ''}" title="${esc(d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}: ${m ? Math.round(m) + ' min' : 'no play'}"></span>`); } }
  return `<div class="cal" style="grid-template-columns:32px repeat(${weeks},minmax(0,1fr))" role="img" aria-label="Time played per day over the last ${weeks} weeks"><span></span>${months.map(m => `<span class="cl-m">${esc(m)}</span>`).join('')}${cells.join('')}</div>`;
}
export const calLegend = () => `<span class="lgd">less${[0, 1, 2, 3, 4].map(i => `<i class="cl c${i}"></i>`).join('')}more</span>`;

/** Win share ring. */
export function ring(p, { size = 88, label = null } = {}) {
  if (p == null) return ''; const r = size / 2 - 10, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || `${p}% won`)}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="r-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="r-fg" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle">${p}%</text></svg>`;
}

// ---------- replay metrics v2 (docs/REPLAY_METRICS.md) ----------
const GOAL_HW = 893, GOAL_H = 642;
/** Where your shots crossed the goal line, seen from the field: goal frame, goals (filled), on target (ring), misses (cross).
 *  shots: [{ x, z, k: 'g'|'s'|'m' }] in uu, x from the attacker's side (left = negative). */
export function goalMouth(shots, { w = 300 } = {}) {
  const pts = (shots || []).filter(s => Number.isFinite(s.x) && Number.isFinite(s.z)); if (!pts.length) return '';
  const XW = 1700, ZH = 1000, h = Math.round(w * ZH / (2 * XW)), X = x => ((Math.max(-XW, Math.min(XW, x)) + XW) / (2 * XW) * w).toFixed(1), Y = z => (h - Math.max(0, Math.min(ZH, z)) / ZH * h).toFixed(1);
  const frame = `<path class="gm-f" d="M${X(-GOAL_HW)} ${h} V${Y(GOAL_H)} H${X(GOAL_HW)} V${h}"/><line class="gm-g" x1="0" x2="${w}" y1="${h - 0.5}" y2="${h - 0.5}"/>`;
  const dot = s => s.k === 'g' ? `<circle class="gm-goal" cx="${X(s.x)}" cy="${Y(s.z)}" r="5"/>` : s.k === 's' ? `<circle class="gm-on" cx="${X(s.x)}" cy="${Y(s.z)}" r="4.5"/>`
    : `<path class="gm-miss" d="M${(+X(s.x) - 4).toFixed(1)} ${(+Y(s.z) - 4).toFixed(1)} l8 8 m0 -8 l-8 8"/>`;
  const n = k => pts.filter(s => s.k === k).length;
  return `<svg class="gm" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`Your shots at the goal: ${n('g')} goals, ${n('s')} on target not scored, ${n('m')} off target`)}">${frame}${pts.map(dot).join('')}</svg>`;
}
/** A small field, your goal at the bottom, with points [x, y, flag] in team-relative uu (flag true = drawn hot). */
export function fieldDots(points, { w = 120, label = '' } = {}) {
  const pts = (points || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])); const h = Math.round(w * 10240 / 8192);
  const X = x => ((x + 4096) / 8192 * w).toFixed(1), Y = y => ((5120 - y) / 10240 * h).toFixed(1);
  return `<svg class="fd" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || `${pts.length} points on the field`)}"><rect class="fd-f" x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="8"/>`
    + `<line class="fd-l" x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}"/><line class="fd-t" x1="0" x2="${w}" y1="${Y(5120 / 3)}" y2="${Y(5120 / 3)}"/><line class="fd-t" x1="0" x2="${w}" y1="${Y(-5120 / 3)}" y2="${Y(-5120 / 3)}"/>`
    + `<rect class="fd-g" x="${X(-893)}" y="${h - 3}" width="${(1786 / 8192 * w).toFixed(1)}" height="3"/>`
    + pts.map(p => `<circle class="${p[2] ? 'fd-hot' : 'fd-p'}" cx="${X(p[0])}" cy="${Y(p[1])}" r="3.2"/>`).join('') + '</svg>';
}
/** Your rotation role across the match (strip.s: one character per second, '1'/'2'/'3'/'-') with markers at events [{ t, label }]. */
export function roleStrip(strip, events = []) {
  if (!strip?.s) return ''; const s = strip.s, n = s.length; const runs = []; let i = 0;
  while (i < n) { let j = i; while (j < n && s[j] === s[i]) j++; runs.push([s[i], i, j - i]); i = j; }
  const share = r => Math.round(100 * [...s].filter(c => c === r).length / Math.max(1, [...s].filter(c => c !== '-').length));
  const mk = (events || []).filter(e => Number.isFinite(e.t)).map(e => { const x = (e.t - (strip.t0 || 0)) / n; return x >= 0 && x <= 1 ? `<span class="rs-m" style="left:${pct(x)}%" title="${esc(e.label)}"></span>` : ''; }).join('');
  return `<div class="rs" role="img" aria-label="${esc(`Your role over the match: first man ${share('1')}%, second ${share('2')}%, third ${share('3')}% of the time`)}">`
    + runs.map(([r, a, l]) => `<i class="rs-${r === '-' ? 'x' : r}" style="left:${pct(a / n)}%;width:${pct(l / n)}%"></i>`).join('') + mk + '</div>';
}
/** Stacked outcome bars: rows [{ label, parts: [{ key, n }] }]; keys map to classes ob-<key>. */
export function outcomeBars(rows) {
  return `<div class="obs">${(rows || []).map(r => { const tot = r.parts.reduce((a, p) => a + p.n, 0);
    return `<div class="ob-row"><span class="ob-l">${esc(r.label)}</span><span class="ob" role="img" aria-label="${esc(`${r.label}: ${r.parts.filter(p => p.n).map(p => `${p.n} ${p.name || p.key}`).join(', ') || 'no touches'}`)}">${tot ? r.parts.filter(p => p.n).map(p => `<i class="ob-${p.key}" style="width:${pct(p.n / tot)}%"></i>`).join('') : ''}</span><span class="num dim ob-n">${tot}</span></div>`; }).join('')}</div>`;
}
