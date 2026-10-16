# Instinct website (formerly LiveRLCoach)

Static marketing site for Instinct (downloads: [InstinctRL releases](https://github.com/tobysword/InstinctRL/releases/latest)), hosted on GitHub Pages. No build step: plain HTML/CSS.

Live: https://tobysword.github.io/instinct-site/

## Build / rename

Pages are templates in `src/`; run `node build.js` (no dependencies) to write the final HTML to the site root. Commit both.

**To rename the product:** edit `PRODUCT_NAME`, `PRO_NAME` (and the styled logo `PRODUCT_BRAND_HTML`) in `site.config.json`, then run `node build.js`. Repo and download URLs are hardcoded and are not affected.

## Live coaching video (media slot)

The home page has a "See it live" section (`#see-it-live` in `src/index.html`) with a `<video id="live-video">` placeholder. It currently shows only the poster.

To add the screen recording:
1. Export a short clip (20–40 s, 1920x1080, H.264 MP4, no audio needed, ideally under ~8 MB). Optionally also export a WebM (VP9) version.
2. Save it as `assets/media/live-coaching.mp4` (and `assets/media/live-coaching.webm`).
3. In `src/index.html`, uncomment the `<source>` lines inside `#live-video`.
4. Optionally replace `assets/media/live-coaching-poster.png` (1920x1080) with a frame from the clip, and delete the "Screen recording coming soon" `<figcaption>`.
5. Run `node build.js` and commit.

For autoplay, add `autoplay` to the `<video>` tag (it is already `muted playsinline loop`).
