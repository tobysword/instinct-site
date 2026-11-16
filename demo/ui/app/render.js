import { ARENAS, dropshotTiles } from '../engine/modes.js';
// Shared view helpers for the overlay and the control window.
/** Cue shown under the playlist name (overlay). Rank tables and baselines are per mode (Ranked and Casual
 *  Doubles share them) and per-playlist coaching isn't confirmed, so keep the wording honest. One place to change it. */
import { esc } from './esc.js';
export { esc };
const GROUPS = [['Bronze', '#B0713F', '#6b3f1d', '#E7A774'], ['Silver', '#B9C3CF', '#6c7684', '#EEF2F7'], ['Gold', '#F2C14E', '#a57a14', '#FFE39A'], ['Platinum', '#3FB8AF', '#1d6f69', '#9BEDE6'],
  ['Diamond', '#4FA3FF', '#1d4fa6', '#B4D8FF'], ['Champion', '#B26BFF', '#6a2ad6', '#E2C4FF'], ['Grand Champion', '#FF4D6D', '#a3122f', '#FFB3C1'], ['Supersonic Legend', '#FF8AD8', '#6EF3FF', '#ffffff']];
export function tierColor(skill) { const t = Math.max(0, Math.min(21, Math.floor(skill ?? 0))); const g = t >= 21 ? 7 : t >= 18 ? 6 : Math.floor(t / 3); return GROUPS[g]; }
export function shortColor(short) { if (!short) return '#5E6679'; const k = { B: 0, S: 1, G: 2, P: 3, D: 4, C: 5 }; if (short === 'SSL') return GROUPS[7][0]; if (short.startsWith('GC')) return GROUPS[6][1]; return GROUPS[k[short[0]]]?.[1] || '#9AA3B5'; }
// Official Rocket League rank icons (bundled in ui/ranks, see docs/ENGINE.md "Rank icons"): 0..21 = Bronze I..Supersonic Legend.
const SHORTS = ['B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'G1', 'G2', 'G3', 'P1', 'P2', 'P3', 'D1', 'D2', 'D3', 'C1', 'C2', 'C3', 'GC1', 'GC2', 'GC3', 'SSL'];
export const tierIdx = skill => skill == null ? -1 : Math.max(0, Math.min(21, Math.floor(skill)));
export const shortIdx = sh => SHORTS.indexOf(sh);
export const iconSrc = i => i < 0 ? 'ranks/unranked.png' : `ranks/${i}.png`;
const preloaded = new Set();
export function preloadIcons() { if (typeof Image === 'undefined') return; for (let i = -1; i < 22; i++) { const src = iconSrc(i); if (preloaded.has(src)) continue; preloaded.add(src); const im = new Image(); im.decoding = 'async'; im.src = src; } }
const halo = i => i < 0 ? '#5E6679' : i >= 21 ? '#FF8AD8' : tierColor(i)[1];
export function badge(skill, size = 64, idx) {
  const i = idx ?? tierIdx(skill);
  return `<div class="badge rkb${i < 0 ? ' none' : ''}" data-i="${i}" style="--sz:${size}px;--hc:${halo(i)}"><i class="halo"></i><img src="${iconSrc(i)}" alt="" draggable="false"></div>`;
}
// small inline icon for a short tier ("D2", "GC1"): sub-ranks, scout, history
// Swap the badge inside `slot` to tier `i`. Animates (quick 3D turn + halo pulse) only when the tier actually changes.

// ---------- 3D field mini-map of ball touches (mode-aware since v0.7.1) ----------
// Camera sits behind/above YOUR goal; field is rotated so you always defend the bottom. Geometry per arena comes from
// ARENAS (soccar: Duel/Doubles/Standard/Chaos/Rumble/Snow Day; hoops: Dunk House/The Block; dropshot: hexagonal floor).
const WHO = { me: '#FFD36E', mate: '#6FD3FF', opp: '#FF6B8B', both: '#E8ECF5' };
function camera(W, H, A) {
  const th = 0.5, cy0 = -A.FY * 4.32, cz = A.FY * 2.25, c = Math.cos(th), sn = Math.sin(th);
  const raw = (x, y, z) => { const dy = y - cy0, dz = z - cz; const depth = dy * c - dz * sn, up = dy * sn + dz * c; return [x / depth, -up / depth, depth]; };
  const gd = A.goal ? A.goal.d : 0, gh = A.goal ? A.goal.h : A.ring ? A.ring.z : 0;
  const pts = [[-A.FX, -A.FY - gd, 0], [A.FX, -A.FY - gd, 0], [-A.FX, A.FY + gd, gh], [A.FX, A.FY + gd, gh], [-A.FX, A.FY, 0], [-A.FX, -A.FY, 0]].map(p => raw(...p));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((W - 8) / (x1 - x0), (H - 8) / (y1 - y0)), ox = W / 2 - k * (x0 + x1) / 2, oy = H / 2 - k * (y0 + y1) / 2;
  return (x, y, z = 0) => { const [a, b, d] = raw(x, y, z); return [ox + k * a, oy + k * b, d]; };
}
const camCache = new Map();
const f1 = v => v.toFixed(1);
/**
 * @param {Array} tm touch map rows [x, y, z, who, age, kind]
 * @param {number} myTeam 0 blue / 1 orange
 * @param {{W?:number,H?:number,id?:string,legend?:boolean,arena?:string,puck?:boolean,dmg?:{us:number,them:number}}} [o]
 */
export function fieldMap(tm, myTeam, { W = 300, H = 150, id = 'fm', legend = true, arena = 'soccar', puck = false, dmg = null, vis = null, marks = null } = {}) {
  const A = ARENAS[arena] || ARENAS.soccar, FX = A.FX, FY = A.FY;
  const key = W + 'x' + H + A.kind; const P = camCache.get(key) || camCache.set(key, camera(W, H, A)).get(key);
  const flip = myTeam === 1 ? -1 : 1;                                   // blue defends -Y; orange view is rotated 180°
  const pp = (x, y, z) => P(x * flip, y * flip, z);
  const poly = pts => pts.map(p => { const [a, b] = P(...p); return `${f1(a)},${f1(b)}`; }).join(' ');
  const S = FY / 5120;                                                  // scale of decorations vs. a standard field
  let outline;
  if (A.kind === 'dropshot') { const R = A.toCorner, Wl = A.toWall; outline = [[-R, 0, 0], [-R / 2, -Wl, 0], [R / 2, -Wl, 0], [R, 0, 0], [R / 2, Wl, 0], [-R / 2, Wl, 0]]; }
  else { const C = A.corner; outline = [[-FX + C, -FY, 0], [FX - C, -FY, 0], [FX, -FY + C, 0], [FX, FY - C, 0], [FX - C, FY, 0], [-FX + C, FY, 0], [-FX, FY - C, 0], [-FX, -FY + C, 0]]; }
  const ring = (r, cy = 0, z = 0, n = 40) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 6.283) * r, cy + Math.sin(i / n * 6.283) * r, z]);
  const myCol = myTeam === 1 ? '#FF9A3C' : '#4AA8FF', oppCol = myTeam === 1 ? '#4AA8FF' : '#FF9A3C';
  // goals: soccar = boxes behind the back wall; hoops = horizontal rings at z 364 against the back wall; dropshot = none
  const goal = (sgn, col) => {
    if (A.kind === 'soccar') { const { w: GW, d: GD, h: GH } = A.goal, yb = sgn * FY, yk = sgn * (FY + GD);
      const back = poly([[-GW, yk, 0], [GW, yk, 0], [GW, yk, GH], [-GW, yk, GH]]), top = poly([[-GW, yb, GH], [GW, yb, GH], [GW, yk, GH], [-GW, yk, GH]]);
      const side = s => poly([[s * GW, yb, 0], [s * GW, yk, 0], [s * GW, yk, GH], [s * GW, yb, GH]]); const mouth = poly([[-GW, yb, 0], [GW, yb, 0], [GW, yb, GH], [-GW, yb, GH]]);
      return `<g class="goalbox" stroke="${col}" fill="${col}"><polygon points="${back}" fill-opacity=".10"/><polygon points="${side(-1)}" fill-opacity=".06"/><polygon points="${side(1)}" fill-opacity=".06"/><polygon points="${top}" fill-opacity=".12"/><polygon points="${mouth}" fill="none" stroke-width="1.6"/></g>`; }
    if (A.kind === 'hoops') { const { y, z, r } = A.ring, half = Array.from({ length: 21 }, (_, i) => { const t = Math.PI * i / 20; return [Math.cos(t) * r, sgn * (y - Math.sin(t) * r), z]; });
      const rim = [[r, sgn * FY, z], ...half, [-r, sgn * FY, z]], shadow = rim.map(([x, yy]) => [x, yy, 0]);
      const post = s => { const [a, b] = P(s * r, sgn * FY, 0), [c2, d2] = P(s * r, sgn * FY, z); return `<line x1="${f1(a)}" y1="${f1(b)}" x2="${f1(c2)}" y2="${f1(d2)}" stroke="${col}" stroke-opacity=".5"/>`; };
      return `<g class="hoop"><polygon points="${poly(shadow)}" fill="${col}" fill-opacity=".10" stroke="none"/>${post(-1)}${post(1)}<polyline points="${poly(rim)}" fill="none" stroke="${col}" stroke-width="2"/></g>`; }
    return '';
  };
  const third = y => { const a = P(-FX, y, 0), b = P(FX, y, 0); return `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" class="th"/>`; };
  const [nl0, nl1] = A.kind === 'dropshot' ? [P(-A.toCorner, 0, 0), P(A.toCorner, 0, 0)] : [P(-FX, 0, 0), P(FX, 0, 0)];
  // dropshot: faint hex tiles; each half tinted by how much damage it has taken (stat-feed totals; no per-tile data)
  let tiles = '';
  if (A.kind === 'dropshot') { const r = A.tile / Math.sqrt(3) * 0.92;
    const hex = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [cx + r * Math.cos(a), cy + r * Math.sin(a), 0]; });
    const dm = { mine: dmg ? dmg.them : 0, theirs: dmg ? dmg.us : 0 };       // our half takes the opponents' damage
    for (const [x, y, half] of dropshotTiles()) { const ours = (half === 0) === (myTeam !== 1), d = ours ? dm.mine : dm.theirs, op = Math.min(0.32, 0.04 + d * 0.012);
      tiles += `<polygon points="${poly(hex(x * flip, y * flip))}" fill="${ours ? myCol : oppCol}" fill-opacity="${op.toFixed(3)}" stroke="rgba(255,255,255,.10)" stroke-width=".6"/>`; } }
  // touches (far first so near ones overlap)
  const dots = (tm || []).map(t => { const [x, y, z, who, age, k] = t; const g = pp(x, y, 0), a = pp(x, y, Math.max(0, puck ? 0 : z)); return { t, g, a, d: g[2], who, age, k, z: puck ? 0 : z }; }).sort((p, q) => q.d - p.d);
  const newest = Math.min(...(tm || []).map(t => t[4]), 99);
  let body = '';
  for (const o of dots) {
    const col = WHO[o.who] || WHO.both, fresh = o.age < 10, op = fresh ? 1 : Math.max(0.16, 0.85 - o.age / 140);
    const sc = 1.25 - (o.d - 16000 * S) / (40000 * S);                    // depth-based size cue
    const r = Math.max(1.6, (fresh ? 3.6 : 2.5) * sc * (W / 300));
    const [gx, gy] = o.g, [ax, ay] = o.a;
    if (o.z > 140) body += `<line x1="${f1(gx)}" y1="${f1(gy)}" x2="${f1(ax)}" y2="${f1(ay)}" stroke="${col}" stroke-opacity="${(op * .55).toFixed(2)}" stroke-width="1"/><ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${f1(r * .9)}" ry="${f1(r * .35)}" fill="#000" fill-opacity="${(op * .45).toFixed(2)}"/>`;
    if (o.k === 'goal') { const R = r * 2.3, pts = Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? R * .45 : R, an = -Math.PI / 2 + i * Math.PI / 5; return `${f1(ax + rr * Math.cos(an))},${f1(ay + rr * Math.sin(an))}`; }).join(' ');
      body += `<polygon points="${pts}" fill="${col}" stroke="#fff" stroke-width=".9" filter="url(#${id}-glow)"/>`; continue; }
    if (o.k === 'power') body += `<circle cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(r * 2)}" fill="none" stroke="${col}" stroke-width="1.3" stroke-opacity="${(op * .9).toFixed(2)}"/>`;
    if (o.k === 'high') body += `<rect x="${f1(ax - r * 1.5)}" y="${f1(ay - r * 1.5)}" width="${f1(r * 3)}" height="${f1(r * 3)}" transform="rotate(45 ${f1(ax)} ${f1(ay)})" fill="none" stroke="${col}" stroke-width="1.1" stroke-opacity="${op.toFixed(2)}"/>`;
    if (puck) body += `<ellipse cx="${f1(ax)}" cy="${f1(ay)}" rx="${f1(r * 1.25)}" ry="${f1(r * .6)}" fill="${col}" fill-opacity="${op.toFixed(2)}"${fresh ? ` filter="url(#${id}-glow)"` : ''}/>`;
    else body += `<circle cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(r)}" fill="${col}" fill-opacity="${op.toFixed(2)}"${fresh ? ` filter="url(#${id}-glow)"` : ''}/>`;
    if (o.age === newest && o.age < 6) body += `<circle class="pulse" cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(r)}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
  }
  // screen analysis (dormant in 1.0: the overlay passes vis = null): estimated car/ball positions, drawn faintly (dashed = predicted / low confidence)
  for (const v of vis || []) { const [ax, ay] = pp(v.x, v.y, 0), col = v.ball ? '#ffffff' : WHO[v.who] || WHO.opp, op = Math.max(0.18, Math.min(0.6, (v.conf || 0) * 0.6)), rr = (v.ball ? 2.6 : 3.8) * (W / 300);
    body += `<circle class="vis" cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(rr)}" fill="${col}" fill-opacity="${(op * 0.35).toFixed(2)}" stroke="${col}" stroke-opacity="${op.toFixed(2)}" stroke-width="1"${v.conf < 0.4 ? ' stroke-dasharray="2 2"' : ''}/>`; }
  // minimap cues (engine/minimap.js): 'ghost' = suggested shadow spot (dashed ring), 'lastback' = ring around the last-back car
  for (const k of marks || []) { if (k?.x == null || k?.y == null) continue;
    if (k.kind === 'arrow') { const [a1, b1] = pp(k.x, k.y, 0), [a2, b2] = pp(k.tx, k.ty, 0), dx = a2 - a1, dy = b2 - b1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = 6 * (W / 300), e2 = [a2 - ux * h * 0.6, b2 - uy * h * 0.6];   // rotation cue: you (or the last touch) -> shadow spot
      body += `<g class="rotarrow"><line x1="${f1(a1)}" y1="${f1(b1)}" x2="${f1(e2[0])}" y2="${f1(e2[1])}" stroke="#FF5C00" stroke-width="${f1(2 * W / 300)}" stroke-linecap="round"${k.fromCar ? '' : ' stroke-dasharray="3 3"'}/><path d="M${f1(a2)} ${f1(b2)}L${f1(a2 - ux * h - uy * h * 0.6)} ${f1(b2 - uy * h + ux * h * 0.6)}L${f1(a2 - ux * h + uy * h * 0.6)} ${f1(b2 - uy * h - ux * h * 0.6)}Z" fill="#FF5C00"/></g>`; continue; }
    const [ax, ay] = pp(k.x, k.y, 0), rr = (k.kind === 'ghost' ? 5 : 6.5) * (W / 300);
    body += k.kind === 'ghost' ? `<circle class="ghost" cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(rr)}" fill="none" stroke="#F4F1EC" stroke-opacity=".75" stroke-width="1.4" stroke-dasharray="2.5 2"/>`
      : `<circle class="lastback" cx="${f1(ax)}" cy="${f1(ay)}" r="${f1(rr)}" fill="none" stroke="#FF5C00" stroke-width="1.6"/>`; }
  const extra = A.kind === 'dropshot' ? `<span>Tiles: shade = damage taken${dmg ? ` (you ${dmg.us} · them ${dmg.them})` : ''}</span>` : A.kind === 'hoops' ? '<span><b class="ring"></b>Hoop</span>' : puck ? '<span><b>⬭</b>Puck</span>' : '';
  const leg = legend ? `<div class="fmleg"><span><i style="background:${WHO.me}"></i>You</span><span><i style="background:${WHO.mate}"></i>Mate</span><span><i style="background:${WHO.opp}"></i>Opp</span>${A.kind === 'dropshot' ? '' : '<span><b>★</b>Goal</span>'}<span><b class="ring"></b>Power</span><span><b class="dia"></b>${A.kind === 'soccar' ? 'Ceiling/backboard' : 'High touch'}</span>${extra}</div>` : '';
  const center = A.kind === 'soccar' ? `<polygon points="${poly(ring(1000))}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>` : A.kind === 'hoops' ? `<polygon points="${poly(ring(600))}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>` : '';
  return `<div class="fmap" data-arena="${A.kind}"><svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;aspect-ratio:${W}/${H}">
  <defs><linearGradient id="${id}-turf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${puck ? '#3a4a58' : '#1b3b44'}"/><stop offset=".5" stop-color="${puck ? '#2a3644' : '#14262f'}"/><stop offset="1" stop-color="${puck ? '#1e2733' : '#101a26'}"/></linearGradient>
  <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="${id}-own" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${myCol}" stop-opacity=".22"/><stop offset=".45" stop-color="${myCol}" stop-opacity="0"/><stop offset=".55" stop-color="${oppCol}" stop-opacity="0"/><stop offset="1" stop-color="${oppCol}" stop-opacity=".18"/></linearGradient></defs>
  ${goal(1, oppCol)}
  <polygon points="${poly(outline)}" fill="url(#${id}-turf)" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>
  <polygon points="${poly(outline)}" fill="url(#${id}-own)"/>
  ${tiles}
  ${A.kind === 'dropshot' ? '' : third(-A.third) + third(A.third)}
  <line x1="${f1(nl0[0])}" y1="${f1(nl0[1])}" x2="${f1(nl1[0])}" y2="${f1(nl1[1])}" stroke="rgba(255,255,255,${A.kind === 'dropshot' ? '.5' : '.3'})" stroke-width="${A.kind === 'dropshot' ? 2 : 1}"/>
  ${center}
  ${body}
  ${goal(-1, myCol)}
  </svg>${leg}</div>`;
}
export const CATCOLOR = { cause: 'var(--opp)', good: 'var(--more)', boost: 'var(--boost)', opp: 'var(--opp)', more: 'var(--more)', less: 'var(--less)', rot: 'var(--rot)', state: 'var(--state)', mate: 'var(--mate)', follow: 'var(--more)', notyet: 'var(--less)' };
// one icon family: 24-grid, 1.8 stroke, round caps/joins, currentColor (outline; `fill` variants for active states)
const P = {
  up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>', star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>', flag: '<path d="M6 20V4.5M6 5h10l-2 3.5 2 3.5H6"/>', chev: '<path d="M9 6l6 6-6 6"/>', chevd: '<path d="M6 9l6 6 6-6"/>',
  bolt: '<path d="M13 3L6 13.5h5L10 21l7-10.5h-5z"/>', arrowUR: '<path d="M7 17L17 7M9 7h8v8"/>', ceiling: '<path d="M4 5h16M12 19V9M8 12l4-4 4 4"/>', wall: '<path d="M6 4v16M10 18c3-1 6-5 6-12"/>',
  board: '<path d="M4 6h16M7 6v3a5 5 0 0010 0V6"/>', redirect: '<path d="M5 18c0-6 4-10 10-10h4M16 5l3 3-3 3"/>', flick: '<path d="M20 12a8 8 0 11-3-6.2M20 4v4h-4"/>', reset: '<path d="M4 12a8 8 0 108-8M4 4v5h5"/>',
  bump: '<path d="M4 12h6M14 12h6M8 9l-3 3 3 3M16 9l3 3-3 3"/>', save: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>', wave: '<path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  walldash: '<path d="M8 4l-3 16M13 4l-3 16M18 8l-3 8"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.6v.4"/>',
  wifi: '<path d="M3 9a14 14 0 0118 0M6 12.5a9 9 0 0112 0M9 16a4.5 4.5 0 016 0"/><circle cx="12" cy="19" r="1"/>', list: '<path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>', users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M15.5 5.6a3 3 0 010 5.8M17.5 14.4c1.6.7 2.6 2.4 3 4.6"/>' };
// Heroicons v2 (outline, 1.5 stroke) — same family as mockups-v2; `solid` fills the outline path (or uses a solid variant)
const HERO = { plus: 'M12 4.5v15m7.5-7.5h-15', refresh: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99', copy: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75m8.25 10.5h3.375c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125h-9.75c-.621 0-1.125.504-1.125 1.125v3.375m8.25 10.5H9.375a1.125 1.125 0 0 1-1.125-1.125V8.25',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  photo: 'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z',
  download: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  sliders: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75', bolt: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  users: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', x: 'M6 18 18 6M6 6l12 12',
  filter: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
  flag: 'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5',
  chev: 'm8.25 4.5 7.5 7.5-7.5 7.5', left: 'M15.75 19.5 8.25 12l7.5-7.5', chevd: 'm19.5 8.25-7.5 7.5-7.5-7.5',
  bulb: 'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  up: 'm4.5 15.75 7.5-7.5 7.5 7.5', down: 'm19.5 8.25-7.5 7.5-7.5-7.5',
  search: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z', check: 'm4.5 12.75 6 6 9-13.5',
  star: 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
  info: 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  target: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
  map: 'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
  shield: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0',
  wifi: 'M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z' };
const HERO_SOLID = { clock: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"/>' };
export function hi(name, size = 24, solid = false, cls = '') { const body = solid && HERO_SOLID[name] ? HERO_SOLID[name] : `<path d="${HERO[name] || P[name] || ''}"/>`;
  return `<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${solid ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`; }
export function ic(name, size = 16, cls = '') { if (HERO[name]) return hi(name, size, false, 'ic ' + cls); return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`; }
export const MECH = { power: ['Power shots', ic('bolt')], aerial: ['Aerial touches', ic('arrowUR')], ceiling: ['Ceiling', ic('ceiling')], wall: ['Wall touches', ic('wall')], backboard: ['Backboard', ic('board')], redirect: ['Redirects', ic('redirect')], flick: ['Flicks', ic('flick')], bumps: ['Bumps (car contacts)', ic('bump')], epicSaves: ['Epic saves', ic('save')], wavedash: ['Wavedashes', ic('wave')], walldash: ['Wall dashes', ic('walldash')],
  chainwave: ['Chain wavedashes', ic('wave')], fastaerial: ['Fast aerials', ic('arrowUR')], airdribble: ['Air dribbles', ic('arrowUR')], wallairdribble: ['Wall air dribbles', ic('wall')], doubletap: ['Aerial (double-tap pattern)', ic('board')],
  dribble: ['Dribbles', ic('flick')], bouncedribble: ['Bounce dribbles', ic('flick')], cushion: ['Dribble (catch)', ic('flick')], pinch: ['Shots (pinch pattern)', ic('bolt')] };
export function sparkline(series, w = 340, h = 46, color = '#C68BFF') {
  if (!series || series.length < 2) return `<svg class="sp" viewBox="0 0 ${w} ${h}"><text x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle" fill="#5E6679" font-size="11">building trend…</text></svg>`;
  const lo = Math.min(...series) - .4, hi = Math.max(...series) + .4, X = i => i / (series.length - 1) * w, Y = v => h - 4 - (v - lo) / (hi - lo) * (h - 10);
  let d = `M0 ${Y(series[0]).toFixed(1)}`; for (let i = 1; i < series.length; i++) { const x0 = X(i - 1), x1 = X(i); const xm = (x0 + x1) / 2; d += ` C${xm.toFixed(1)} ${Y(series[i - 1]).toFixed(1)} ${xm.toFixed(1)} ${Y(series[i]).toFixed(1)} ${x1.toFixed(1)} ${Y(series[i]).toFixed(1)}`; }
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg class="sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
  <path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#${id})"/><path d="${d}" stroke="${color}" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/><circle cx="${w - 2}" cy="${Y(series[series.length - 1]).toFixed(1)}" r="3.5" fill="#fff"/></svg>`;
}
export function playlistName(s) { const n = s?.match?.teamSize || 2; return ['', 'Duel', 'Doubles', 'Standard', 'Chaos'][n] || `${n}v${n}`; }

export const SHORT_ALL = ['B1','B2','B3','S1','S2','S3','G1','G2','G3','P1','P2','P3','D1','D2','D3','C1','C2','C3','GC1','GC2','GC3','SSL'];
export const rankImg = (short, size = 24, cls = '') => { const i = short == null ? -1 : typeof short === 'number' ? Math.max(0, Math.min(21, Math.floor(short))) : shortIdx(String(short).replace(/^~/, '')); return `<img class="rimg ${cls}" src="ranks/${i < 0 ? 'unranked' : i}.png" width="${size}" height="${size}" alt="" draggable="false">`; };

/**
 * "View on tracker" deep link (v0.7). Tracker Network offers no Rocket League API to third parties (Psyonix agreement),
 * and Psyonix/Epic have no public stats API, so we only link to the public profile page; nothing is fetched or scraped.
 * PrimaryId is "<Platform>|<id>|<split>". Steam pages are keyed by SteamID64; Epic/PSN/Xbox/Switch by display name.
 * @returns {string|null}
 */
export function trackerUrl(id, name) {
  const [plat, pid] = String(id || '').split('|'); const P = { Epic: 'epic', Steam: 'steam', PS4: 'psn', PS5: 'psn', XboxOne: 'xbl', Xbox: 'xbl', Switch: 'switch' }[plat];
  if (!P) return null; const key = P === 'steam' ? pid : name; if (!key || (P === 'steam' && !/^\d{17}$/.test(pid))) return null;
  return `https://rocketleague.tracker.network/rocket-league/profile/${P}/${encodeURIComponent(key)}/overview`;
}


// R1 rank honesty (Toby 2:48 PM): rank is a model estimate. Holdout (19 Doubles pairs) reads ~1 tier low with history, ~2 low cold start.
export const RANK_TIP = "Which rank's average this game looks like, from your speed, boost, air, shots and saves. Your real rank is never an input.";
