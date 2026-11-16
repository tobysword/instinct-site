/**
 * @module modes
 * Game modes and the Stats API `Game.PlaylistId` values that select them.
 *
 * IDs follow Psyonix's long-standing playlist numbering (the same IDs BakkesMod / RLBot expose). Verified against
 * local Stats API logs on 2026-10-13: 2 (casual Doubles), 9 (free play / training), 13 (ranked Standard),
 * 27 (ranked Hoops, Dunk House arena), 28 (ranked Rumble), 30 (ranked Snow Day, snowy DFH Stadium). The rest are
 * the documented values and are unverified locally.
 *
 * `table` names the Playing like table (rating.js tableFor, docs/RATING.md "Modes"): Duel / Doubles / Standard from
 * tables2026.json, Hoops / Rumble / Dropshot / Snow Day from modes2026.json (2.2). Chaos has no ranked population on
 * ballchasing, so it is not rated (its `table` is only a label for stored records).
 */
export const MODES = {
  duel:     { name: 'Duel',     teamSize: 1, table: 'DUELS',    measured: true },
  doubles:  { name: 'Doubles',  teamSize: 2, table: 'DOUBLES',  measured: true },
  standard: { name: 'Standard', teamSize: 3, table: 'STANDARD', measured: true },
  chaos:    { name: 'Chaos',    teamSize: 4, table: 'STANDARD', measured: false },
  // Extra modes: own rank tables (tools/build_mode_tables.mjs). arena: geometry for the mini-map (ARENAS below).
  hoops:    { name: 'Hoops',    teamSize: 2, table: 'HOOPS',    measured: true, arena: 'hoops',    pads: true,  backboard: false },
  rumble:   { name: 'Rumble',   teamSize: 3, table: 'RUMBLE',   measured: true, arena: 'soccar',   pads: true,  items: true },
  snowday:  { name: 'Snow Day', teamSize: 3, table: 'SNOWDAY',  measured: true, arena: 'soccar',   pads: true,  puck: true },
  dropshot: { name: 'Dropshot', teamSize: 3, table: 'DROPSHOT', measured: true, arena: 'dropshot', pads: false, backboard: false },
  training: { name: 'Free play', teamSize: 1, table: null, noMatch: true },
  pack:     { name: 'Training pack', teamSize: 1, table: null, noMatch: true, pack: true },   // 2.2: workshop / custom training (sessions count its time)
};
/** PlaylistId -> [mode key, ranked]. */
export const PLAYLIST_MODE = {
  1: ['duel', false], 2: ['doubles', false], 3: ['standard', false], 4: ['chaos', false],
  6: [null, false],   // private match: mode from team size
  7: [null, false], 8: [null, false],   // season / offline exhibition: mode from team size
  9: ['training', false], 19: ['pack', false], 20: ['pack', false], 21: ['pack', false],   // 19 workshop, 20 training editor, 21 custom training
  10: ['duel', true], 11: ['doubles', true], 13: ['standard', true],
  15: ['snowday', false], 16: [null, false], 17: ['hoops', false], 18: ['rumble', false],
  22: [null, true],   // tournament: mode from team size
  23: ['dropshot', false], 27: ['hoops', true], 28: ['rumble', true], 29: ['dropshot', true], 30: ['snowday', true],
};
const BY_SIZE = { 1: 'duel', 2: 'doubles', 3: 'standard', 4: 'chaos' };
/**
 * Resolve the mode for a playlist id; team size (max players per team seen this match) is the fallback.
 * @returns {{key:string, name:string, ranked:boolean, teamSize:number, table:string|null, measured:boolean}}
 */
export function modeFor(playlistId, seenTeamSize = 0, arena = '') {
  // A playlist id we don't know (limited-time modes, new modes) is never treated as soccar: stats yes, rating no.
  if (playlistId != null && !(playlistId in PLAYLIST_MODE))
    return { key: 'unknown', name: 'This mode', ranked: false, teamSize: seenTeamSize || 2, table: null, measured: false, unknown: true };
  let [k0, ranked = false] = PLAYLIST_MODE[playlistId] || [null, false];
  // private / tournament lobbies don't say the mode: the arena does for Hoops and Dropshot (Snow Day/Rumble share soccar maps)
  if (!k0 && /^hoops/i.test(arena)) k0 = 'hoops'; else if (!k0 && /^shattershot/i.test(arena)) k0 = 'dropshot';
  const key = k0 || BY_SIZE[Math.min(4, Math.max(1, seenTeamSize || 2))];
  const m = MODES[key];
  return { key, ranked, ...m, teamSize: k0 ? m.teamSize : seenTeamSize || m.teamSize, measured: !!m.measured };
}

/**
 * Arena geometry in Unreal units (RLBot wiki "Useful game values", "Hoops", "Dropshot"; checked 2026-10-13).
 * soccar: standard field (also Rumble, Snow Day, Chaos). hoops: Dunk House / The Block. dropshot: hexagonal Core 707.
 * `third` is the |y| that splits defensive / middle / attacking thirds.
 */
export const ARENAS = {
  soccar:   { kind: 'soccar', FX: 4096, FY: 5120, corner: 1152, height: 2044, goal: { w: 893, d: 880, h: 642 }, third: 1707 },
  hoops:    { kind: 'hoops', FX: 2966.67, FY: 3581, corner: 766, height: 1820, ring: { y: 2969, z: 364, r: 655 }, third: 1194 },
  dropshot: { kind: 'dropshot', toWall: 4555, toCorner: 5260, FX: 5260, FY: 4555, height: 1986, tile: 768, rows: [7, 8, 9, 10, 11, 12, 13], third: 1518 },
};
export const arenaFor = mode => ARENAS[(mode && mode.arena) || 'soccar'] || ARENAS.soccar;
/** Dropshot tile centers (140): rows of 7..13 per half, 768 uu apart, rows 665 uu apart, middle rows 256 uu apart. */
export function dropshotTiles() {
  const out = [], A = ARENAS.dropshot, dy = A.tile * Math.sqrt(3) / 2;
  for (const sgn of [-1, 1]) A.rows.forEach((n, i) => { const y = sgn * (128 + (6 - i) * dy); for (let j = 0; j < n; j++) out.push([(j - (n - 1) / 2) * A.tile, y, sgn < 0 ? 0 : 1]); });
  return out;
}
