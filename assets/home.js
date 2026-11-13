// Home and How it works: the drawn match and overlay, the rank ladder, the evening chart, the feature explorer and the
// training-set chart. Every section is complete without this file except the drawn ones, which have text alternatives.
(function () {
  // ---- coach shape, after the app's ui/app/shapeviz.js: pale band = target range, white = you, dots green above / ember below
  var LBL = ['Speed', 'Supersonic', 'In air', 'Boost used', 'Big pads', 'Shots', 'Saves', 'Assists'];
  var SETS = { 'Diamond I': [1.08, 1.12, .98, 1.04, 1.06, .78, 1.02, .95], 'Diamond II': [1.14, 1.18, 1.05, 1.1, 1.08, .9, 1.06, 1.0], 'Diamond III': [1.18, 1.2, 1.1, 1.14, 1.12, .96, 1.08, 1.04] };
  function shapeSVG(tier, o) {
    o = o || {};
    var W = o.w || 230, H = o.h || 160, CX = W / 2, CY = H / 2, R = o.r || 50, fs = o.fs || 8.5, v = SETS[tier] || SETS['Diamond I'];
    function pt(i, f) { var a = -Math.PI / 2 + i * Math.PI / 4; return [(CX + R * f * Math.cos(a)).toFixed(1), (CY + R * f * Math.sin(a)).toFixed(1)]; }
    function poly(fs) { return fs.map(function (f, i) { return pt(i, f).join(','); }).join(' '); }
    function sh(x) { return Math.max(.25, Math.min(1.25, (x - .5) / .8 + .25)); }
    function all(f) { return LBL.map(function () { return f; }); }
    var s = '<svg class="shape" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Coach shape for ' + tier + ': shots below the target range, speed and supersonic above">';
    s += '<polygon points="' + poly(all(1.25)) + '" fill="none" stroke="rgba(255,255,255,.07)"/>';
    for (var i = 0; i < 8; i++) { var p = pt(i, 1.25); s += '<line x1="' + CX + '" y1="' + CY + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(255,255,255,.07)"/>'; }
    s += '<path fill-rule="evenodd" fill="rgba(244,241,236,.18)" d="M' + poly(all(1)).replace(/ /g, ' L') + 'Z M' + poly(all(.82)).replace(/ /g, ' L') + 'Z"/>';
    s += '<polygon points="' + poly(v.map(sh)) + '" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.88)" stroke-width="1.5" stroke-linejoin="round"/>';
    v.forEach(function (x, i) { var p = pt(i, sh(x)); s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (o.dot || 3) + '" fill="' + (x >= .95 ? '#22C55E' : '#FF8A3D') + '"/>'; });
    LBL.forEach(function (l, i) { var p = pt(i, 1.5), a = i === 0 || i === 4 ? 'middle' : (i < 4 ? 'start' : 'end'); s += '<text x="' + p[0] + '" y="' + (+p[1] + 3) + '" fill="#A1A1AA" font-size="' + fs + '" font-family="Inter,sans-serif" text-anchor="' + a + '">' + l + '</text>'; });
    return s + '</svg>';
  }
  function coach(tier) {
    return '<div class="ovp"><div class="hd"><span class="dot"></span><span class="pl">Doubles</span><span class="co">Coach</span></div><div class="k">Playing like</div><div class="tier" data-tier>' + tier + '</div>' +
      '<div class="meta">Target <b>Platinum III</b> · last 10 <b>Platinum III</b></div><div class="shp">' + shapeSVG(tier) + '</div>' +
      '<div class="rd"><div><em>Keep</em>Fast rotations<small>supersonic 18%</small></div><div><em>Shift</em>Take more shots<small>1 so far, Plat III has 2</small></div></div></div>';
  }

  var game = document.getElementById('hero-game');
  if (game) game.innerHTML = '<div class="gm" role="img" aria-label="Illustration of a match with the Instinct Coach panel in the top-left corner, shown at real size and zoomed"><div class="pitch"></div><div class="gcar b"></div><div class="gcar o"></div><div class="gball"></div>' +
    '<div class="bug"><span class="a">2</span><span class="t">3:47</span><span class="c">1</span></div><div class="boost">64</div><div class="mocknote">Illustration · panel at real size, then zoomed</div>' +
    '<div class="mini">' + coach('Diamond I') + '</div><div class="lens"><div class="zt">Coach panel, zoomed</div>' + coach('Diamond I') + '</div></div>';
  var big = document.getElementById('bigshape');
  if (big) big.innerHTML = shapeSVG('Diamond I', { w: 300, h: 230, r: 72, fs: 11, dot: 4 });

  // ---- ladder: the window of ranks around this example player
  var lad = document.getElementById('ladder');
  var RUNGS = ['Champion I', 'Diamond III', 'Diamond II', 'Diamond I', 'Platinum III', 'Platinum II', 'Platinum I', 'Gold III'];
  if (lad) lad.innerHTML = '<div class="end">↑ up to Supersonic Legend</div>' + RUNGS.map(function (r) { return '<div class="rung" data-r="' + r + '"><span>' + r + '</span><i></i></div>'; }).join('') +
    '<div class="end">↓ down to Bronze I</div><div class="lg">Your rank stays put. Playing like moves with how you play.</div>';
  function ladder(t) {
    if (!lad) return;
    lad.querySelectorAll('.rung').forEach(function (r) {
      var you = r.dataset.r === 'Platinum III', pl = r.dataset.r === t;
      r.classList.toggle('you', you); r.classList.toggle('pl', pl); r.querySelector('i').textContent = you ? 'Your rank' : pl ? 'Playing like' : '';
    });
  }
  ladder('Diamond I');

  // ---- the live reading moves; it stays above the Platinum III target so "your rank vs playing like" never reads as a tie
  var cyc = ['Diamond I', 'Diamond II', 'Diamond I', 'Diamond III', 'Diamond II'], ci = 0;
  function setTier(t) {
    document.querySelectorAll('[data-tier]').forEach(function (e) { e.classList.add('fade'); setTimeout(function () { e.textContent = t; e.classList.remove('fade'); }, 200); });
    document.querySelectorAll('.gm .shp').forEach(function (s) { s.innerHTML = shapeSVG(t); });
    ladder(t);
  }
  if (game && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(function () { if (document.hidden) return; ci = (ci + 1) % cyc.length; setTier(cyc[ci]); }, 3400);

  // ---- one evening: bar height = rank played like, dashed line = your usual
  var bars = document.getElementById('bars');
  if (bars) {
    var NIGHT = [['w', 'Platinum III'], ['w', 'Diamond I'], ['x', 'Diamond I'], ['w', 'Diamond II'], ['w', 'Diamond I'], ['x', 'Platinum II'], ['x', 'Platinum II'], ['x', 'Platinum I']];
    var TI = { 'Platinum I': 1, 'Platinum II': 2, 'Platinum III': 3, 'Diamond I': 4, 'Diamond II': 5 }, hp = function (t) { return 18 + (TI[t] - 1) * 18; };
    bars.innerHTML = '<div class="usual" style="bottom:calc(' + hp('Platinum III') + '% + 14px)"><span>Your usual</span></div>' + NIGHT.map(function (g, i) {
      return '<div class="g' + (i > 4 ? ' late' : '') + '" title="Game ' + (i + 1) + ': ' + (g[0] === 'w' ? 'win' : 'loss') + ', played like ' + g[1] + '"><i style="height:' + hp(g[1]) + '%"></i><s style="background:' + (g[0] === 'w' ? '#22C55E' : '#EF4444') + '"></s></div>';
    }).join('');
    document.getElementById('glab').innerHTML = NIGHT.map(function (_, i) { return '<span>G' + (i + 1) + '</span>'; }).join('');
  }

  // ---- feature explorer (tabs; arrow keys move between them)
  var tabs = [].slice.call(document.querySelectorAll('#flist button'));
  function pick(b) { tabs.forEach(function (x) { var on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; document.getElementById('p' + x.dataset.p).hidden = !on; }); }
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { pick(b); });
    b.addEventListener('keydown', function (e) { var d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); var n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus(); } });
  });
  if (tabs.length) pick(tabs[0]);

  // ---- ranked games in the training set, per tier (docs/RATING.md in the app repo)
  var DATA = {
    d: [209, 159, 193, 228, 335, 265, 341, 612, 454, 508, 321, 411, 612, 717, 880, 1192, 1549, 1481, 1631, 1885, 1127, 515],
    s: [91, 112, 158, 314, 468, 425, 258, 503, 403, 241, 299, 341, 415, 528, 558, 862, 807, 1060, 538, 1364, 1530, 167],
    '1': [0, 27, 110, 195, 250, 251, 331, 363, 349, 574, 817, 1344, 1587, 1373, 1183, 951, 736, 472, 302, 269, 366, 270]
  };
  var NAME = { d: '15,625 Doubles games', s: '11,442 Standard games', '1': '12,120 Duel games' };
  document.querySelectorAll('[data-bars]').forEach(function (b) { for (var i = 0; i < 22; i++) b.appendChild(document.createElement('i')); });
  function draw(key, k) {
    var d = DATA[k], mx = Math.max.apply(null, d);
    [].forEach.call(document.querySelector('[data-bars="' + key + '"]').children, function (b, i) { b.style.height = (d[i] / mx * 100) + '%'; b.title = d[i].toLocaleString() + ' games'; });
    var c = document.querySelector('[data-cap="' + key + '"]');
    if (c) c.textContent = NAME[k] + ' from June 2025 to April 2026, Bronze I to Supersonic Legend. Bronze is thin because few Bronze replays are uploaded.';
  }
  document.querySelectorAll('[data-chart]').forEach(function (g) {
    var key = g.dataset.chart;
    g.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(key, b.dataset.k); }); });
    draw(key, 'd');
  });
})();
