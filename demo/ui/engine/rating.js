// Website stand-in for the app's rating.js: only the rank names viz.js imports.
export const TIERS = Object.freeze(["Bronze I","Bronze II","Bronze III","Silver I","Silver II","Silver III","Gold I","Gold II","Gold III","Platinum I","Platinum II","Platinum III","Diamond I","Diamond II","Diamond III","Champion I","Champion II","Champion III","Grand Champion I","Grand Champion II","Grand Champion III","Supersonic Legend"]);
export const SHORT = Object.freeze(["B1","B2","B3","S1","S2","S3","G1","G2","G3","P1","P2","P3","D1","D2","D3","C1","C2","C3","GC1","GC2","GC3","SSL"]);
export const shortName = s => s == null ? s : String(s).replace(/^(~?)(GC|B|S|G|P|D|C)([1-3])$/, (_, t, a, d) => `${t}${a} ${['I', 'II', 'III'][d - 1]}`);
