# Instinct website

Marketing site, downloads and web account for Instinct. Hosted on GitHub Pages from `main` (repo root).
Live: https://tobysword.github.io/instinct-site/ · Downloads: [InstinctRL releases](https://github.com/tobysword/InstinctRL/releases/latest)

The plan this site follows (audience, free → Pro funnel, channels) is `docs/MARKETING.md` in the app repo.

## Pages
`index` (Home: hero over the overlay, guided tour `#features` (live read, stats in game and after, Session Tracker, Teams), the interactive 3D map, Pro extras, pricing `#pricing`) · `how-it-works` · `download` · `faq` · `account` (sign in, create account, reset password, start the
Pro trial, manage subscription, redeem a code) · `pro` (Stripe return page) · `features` and `pricing` (redirects into Home, kept for old links) · `changelog` · `contact` · `privacy` · `terms` · `404`.

## Build
Plain HTML, CSS and a little JS; no dependencies. Pages are templates in `src/`; run `node build.js` to write the final
HTML to the site root, then commit both.
- `src/partials/`: shared `head`, `header`, `footer`, `cta`. Include one with `<!--@include name-->`.
- Per-page variables: `<!--@set TITLE="..."-->`, `DESC`, `CANON` (path after the site URL).
- Site-wide values (prices, version, download URLs, Discord, Supabase URL and public key) are in `site.config.json`.
- Nav links carry `data-nav="file.html"`; the build turns that into `aria-current="page"`.
- `assets/tour.css`, `assets/tour.js`: Home (four-size type scale, guided tour, 3D map frame). `assets/home.css`, `assets/home.js`: How it works (training-set chart).
- `demo/`: the 3D map demo on Home. `demo/field.html` is kept here; `demo/ui/` (the app's field code and CSS) and `demo/games.json` (ten sample games) are copied from the app repo by `node tools/site_field_demo.mjs`. Re-run it after the field changes.
- `assets/site.js`: pricing toggle, download autostart (`download.html?start`), header "Account" label.
- `assets/account.js`: the web account. Same Supabase project and account as the app; only the public (anon) key; RLS
  limits every request to the signed-in user. Billing calls the `billing` edge function (checkout / portal).

Preview locally from the app repo: the `website` entry in `.claude/launch.json` (port 8766), then open `/index.html`.

## On each app release
Set `VERSION` in `site.config.json`, add the release to `src/changelog.html`, update any changed prices or features,
`node build.js`, commit and push.

## Screenshots
Home's pictures are real app screens, never drawings: `assets/shots/home-*.png`, captured from the app's browser mock
(`main.html?mock&pro`, overlay `?mock=…&scene`) by `node tools/site_shots.mjs` in the app repo (headless Edge, 2×; needs the
`ui-mock` server on port 8765). The crops are defined in the app repo's `tools/site_capture/capture.html`. Older
`assets/shots/app-*.webp` are no longer used. Never show real player names or Rocket League logos and art.

## Password reset and email links
Supabase sends reset and confirmation links that end on this site with `#access_token=…&type=recovery` (or `#error_code=…`
when a link has expired). `account.html` reads that and asks for a new password. Every other page forwards such links to
`account.html` (script in `partials/head.html`), so links that fall back to the Supabase Site URL work too.
Supabase › Authentication › URL Configuration should have Site URL = the site, and the redirect allow list should include
`https://tobysword.github.io/instinct-site/**`.

## Moving to your own domain
1. Buy the domain; in GitHub › this repo › Settings › Pages, set the custom domain (this adds a `CNAME` file) and add the DNS
   records GitHub shows. Turn on "Enforce HTTPS" once the certificate is ready.
2. `site.config.json`: `SITE_URL` = `https://yourdomain/`, `BASE_PATH` = `/`. Run `node build.js`, commit, push.
3. Supabase › Authentication › URL Configuration: Site URL = the new domain; add `https://yourdomain/**` to redirect URLs
   (keep the old one for a while).
4. Supabase › Edge Functions › Secrets: set `BILLING_RETURN_URL` = `https://yourdomain/pro.html`.
5. App repo: update `RESET_REDIRECT` in `ui/engine/cloud.js`, the website link in `README.md` and any links in the app
   (search for `tobysword.github.io`), then ship a release.
All links inside the site are relative, so nothing else changes. GitHub keeps redirecting the old github.io address.
