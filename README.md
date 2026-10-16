# Instinct website (formerly LiveRLCoach)

Static marketing site for Instinct (downloads: [InstinctRL releases](https://github.com/tobysword/InstinctRL/releases/latest)), hosted on GitHub Pages. No build step: plain HTML/CSS.

Live: https://tobysword.github.io/instinct-site/

## Build / rename

Pages are templates in `src/`; run `node build.js` (no dependencies) to write the final HTML to the site root. Commit both.

**To rename the product:** edit `PRODUCT_NAME`, `PRO_NAME` (and the styled logo `PRODUCT_BRAND_HTML`) in `site.config.json`, then run `node build.js`. Repo and download URLs are hardcoded and are not affected.
