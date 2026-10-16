#!/usr/bin/env node
// Dependency-free build: renders src/*.html -> ./ (site root, served by GitHub Pages).
// Placeholders: {{PRODUCT_NAME}}, {{PRODUCT_BRAND_HTML}} (styled logo text; defaults to the name),
// {{PRODUCT_SLUG}} (derived: lowercase, non-alphanumerics -> "-"). Any other key in site.config.json also works.
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src'), out = process.argv[2] ? path.resolve(process.argv[2]) : root;
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
if (!cfg.PRODUCT_NAME) throw new Error('site.config.json: PRODUCT_NAME is required');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const vars = { PRODUCT_SLUG: cfg.PRODUCT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), ...cfg };
vars.PRODUCT_BRAND_HTML = cfg.PRODUCT_BRAND_HTML || esc(cfg.PRODUCT_NAME);
const raw = new Set(['PRODUCT_BRAND_HTML']);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(src, f), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`${f}: unknown placeholder ${m}`);
    return raw.has(k) ? vars[k] : esc(String(vars[k]));
  });
  fs.writeFileSync(path.join(out, f), html);
  console.log('built', path.relative(root, path.join(out, f)) || f);
}
