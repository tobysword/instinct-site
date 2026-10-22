# Instinct website (formerly LiveRLCoach)

Static marketing site for Instinct (downloads: [InstinctRL releases](https://github.com/tobysword/InstinctRL/releases/latest)), hosted on GitHub Pages. Plain HTML/CSS, no JavaScript, no dependencies.

Live: https://tobysword.github.io/instinct-site/

## Pages
`index` (Home) · `features` · `toxic` · `pricing` · `download` · `faq` · `privacy` · `terms` · `changelog` · `contact`.
Copy follows `docs/WEBSITE_BRIEF.md` in the app repo (1.0.0). Don't add claims that aren't in the brief.

## Build
Pages are templates in `src/`; run `node build.js` (no dependencies) to write the final HTML to the site root. Commit both.
- `src/partials/` holds the shared `head`, `header`, `footer` and `download-cta`. Include one with `<!--@include name-->`.
- Per-page variables: `<!--@set TITLE="..."-->`, `DESC`, `CANON` (path after the site URL, e.g. `features`).
- Site-wide values (product name, download URLs, Discord) are in `site.config.json`.
- Nav links carry `data-nav="file.html"`; the build turns that into `aria-current="page"` on the matching page.

**To rename the product:** edit `PRODUCT_NAME`, `PRO_NAME` (and `PRODUCT_BRAND_HTML`) in `site.config.json`, then run `node build.js`.

## Screenshots (placeholders)
Every app screenshot is a dashed placeholder box (`.shot-ph`) that names the file it expects, preceded by an
`<!-- SCREENSHOT: assets/shots/<file>.png -->` comment. To fill one, save the capture (1920x1080, Borderless, synthetic names
or Hide player names on) to `assets/shots/`, then replace the `<div class="shot-ph" ...>...</div>` with
`<img src="assets/shots/<file>.png" alt="..." width="1920" height="1080" loading="lazy">` and rebuild.
List: `grep -rn "SCREENSHOT:\|MEDIA:" src/`.

## Goal-break recording (optional)
`features.html` has a placeholder for `assets/media/goal-break-reads.mp4` (20-40 s, 1920x1080, H.264, muted, under ~8 MB).
Replace the placeholder with `<video controls muted playsinline loop preload="none" poster="..."><source src="assets/media/goal-break-reads.mp4" type="video/mp4"></video>`.
