# Instinct website

Marketing site, downloads and web account for Instinct. Hosted on GitHub Pages from `main` (repo root).
Live: https://tobysword.github.io/instinct-site/ · Downloads: [InstinctRL releases](https://github.com/tobysword/InstinctRL/releases/latest)

The plan this site follows (audience, free → Pro funnel, channels) is `docs/MARKETING.md` in the app repo.

## Pages
`index` (Home) · `features` · `pricing` · `download` · `faq` · `account` (sign in, create account, reset password, start the
Pro trial, manage subscription, redeem a code) · `pro` (Stripe return page) · `changelog` · `contact` · `privacy` · `terms` · `404`.

## Build
Plain HTML, CSS and a little JS; no dependencies. Pages are templates in `src/`; run `node build.js` to write the final
HTML to the site root, then commit both.
- `src/partials/`: shared `head`, `header`, `footer`, `cta`. Include one with `<!--@include name-->`.
- Per-page variables: `<!--@set TITLE="..."-->`, `DESC`, `CANON` (path after the site URL).
- Site-wide values (prices, version, download URLs, Discord, Supabase URL and public key) are in `site.config.json`.
- Nav links carry `data-nav="file.html"`; the build turns that into `aria-current="page"`.
- `assets/site.js`: pricing toggle, download autostart (`download.html?start`), header "Account" label.
- `assets/account.js`: the web account. Same Supabase project and account as the app; only the public (anon) key; RLS
  limits every request to the signed-in user. Billing calls the `billing` edge function (checkout / portal).

Preview locally from the app repo: the `website` entry in `.claude/launch.json` (port 8766), then open `/index.html`.

## On each app release
Set `VERSION` in `site.config.json`, add the release to `src/changelog.html`, update any changed prices or features,
`node build.js`, commit and push.

## Screenshots
`assets/shots/*.webp` are captured from the app's mock preview (`ui/main.html?mock&page=match&snap=idle.json`,
`&page=progress`) with headless Edge at 1440×900, scale 2, and converted to WebP. The in-game overlay on Home and Features
is drawn in HTML (`.stage` in `site.css`), not a screenshot. Never show real player names or Rocket League logos and art.

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
