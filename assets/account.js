// Web account: sign in, create account, reset password, plan, free trial, manage subscription, redeem a code.
// Same Supabase project and account as the app (ui/engine/cloud.js in the app repo). Only the public (anon) key is used;
// Row Level Security limits every request to the signed-in user's own rows. Billing goes through the `billing` edge function.
(function () {
  const root = document.getElementById('acct');
  const URL_ = root.dataset.url, KEY = root.dataset.key, PRO = root.dataset.pro || 'Instinct Pro';
  const STORE = 'instinct.web.session.v1';
  const HERE = location.origin + location.pathname;          // this page, on whatever domain the site runs
  const qs = new URLSearchParams(location.search);
  const startPlan = /^(yearly|monthly)$/.test(qs.get('start') || '') ? qs.get('start') : null;
  let pendingStart = startPlan;   // go straight to checkout once, after sign-in
  const $ = s => root.querySelector(s);
  const views = ['loading', 'signin', 'signup', 'forgot', 'reset', 'account'];

  // ---------- session ----------
  let session = null;
  function load() { try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { session = null; } return session; }
  function save(s) {
    session = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (+s.expires_in || 3600), user: s.user ? { id: s.user.id, email: s.user.email } : (session && session.user) || null } : null;
    try { session ? localStorage.setItem(STORE, JSON.stringify(session)) : localStorage.removeItem(STORE); } catch (e) { /* storage blocked */ }
    return session;
  }
  async function req(path, { method = 'GET', body, auth = true } = {}) {
    const h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (auth) { const s = await fresh(); if (!s) throw new Error('Your sign-in expired. Sign in again.'); h.Authorization = 'Bearer ' + s.access_token; }
    let r; try { r = await fetch(URL_ + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error("Couldn't reach the server. Check your connection and try again."); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
    if (!r.ok) throw new Error(friendly((j && (j.msg || j.message || j.error_description || j.error)) || 'HTTP ' + r.status));
    return j;
  }
  async function fresh() {
    const s = session || load(); if (!s) return null;
    if (s.expires_at * 1000 > Date.now() + 60000) return s;
    if (!s.refresh_token) return save(null);
    try { return save(await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } })); }
    catch (e) { return save(null); }
  }
  function friendly(m) {
    m = String(m || '');
    if (/invalid login credentials|invalid_grant/i.test(m)) return 'Wrong email or password.';
    if (/already (been )?registered|user_already_exists|email_exists/i.test(m)) return 'An account with that email already exists. Sign in instead.';
    if (/should be different|same_password/i.test(m)) return 'Choose a password different from your old one.';
    if (/weak|at least|should be/i.test(m) && /password/i.test(m)) return 'That password is too weak. Use at least 8 characters.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you.';
    if (/rate.?limit|too many|over_email_send/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/expired|invalid.*(token|link)|otp/i.test(m)) return 'That link has expired or was already used. Request a new one.';
    return m || 'Something went wrong. Try again.';
  }

  // ---------- UI helpers ----------
  function show(v, msg, kind) {
    views.forEach(n => { const el = $('[data-view="' + n + '"]'); if (el) el.hidden = n !== v; });
    root.querySelectorAll('.msg').forEach(m => { m.className = 'msg'; m.textContent = ''; });
    if (msg) note(v, msg, kind);
    const f = $('[data-view="' + v + '"] input:not([type=radio])'); if (f && v !== 'account') f.focus();
  }
  function note(v, msg, kind) { const m = $('[data-view="' + v + '"] .msg'); if (m) { m.textContent = msg; m.className = 'msg show ' + (kind || 'err'); } }
  function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'One moment…'; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }
  const fmt = iso => { try { return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } };
  function checkPw(a, b) { if (a.length < 8) throw new Error('Use at least 8 characters.'); if (a !== b) throw new Error("The two passwords don't match."); }

  // ---------- plan (mirrors parseSubscription / planState in the app) ----------
  function plan(row) {
    row = row || { status: 'free' };
    const status = String(row.status || 'free'), end = row.current_period_end ? Date.parse(row.current_period_end) : null, now = Date.now();
    let premium = ['active', 'lifetime', 'past_due', 'tester'].includes(status);
    if (status === 'canceled' && end && end > now) premium = true;
    if (status === 'trialing') premium = !end || end > now;
    if (!['lifetime', 'canceled', 'trialing'].includes(status) && end && end < now - 3 * 86400000) premium = false;
    const cancelAtEnd = !!row.cancel_at_period_end || (status === 'canceled' && premium), until = end ? fmt(end) : null;
    const p = { premium, manage: !!row.stripe_customer_id, trialUsed: !!row.trial_used, label: 'Free', note: '' };
    if (!premium) { p.note = p.trialUsed ? 'Your free trial has been used. You can still subscribe any time.' : 'Try ' + PRO + ' free for 7 days.'; return p; }
    if (status === 'tester') { p.label = PRO + ' (tester code)'; p.note = until ? 'Unlocked until ' + until + '.' : ''; return p; }
    if (status === 'lifetime') { p.label = PRO + ' (lifetime)'; return p; }
    if (status === 'trialing') { p.label = PRO + ' free trial'; p.note = cancelAtEnd ? 'Your trial ends ' + until + " and you won't be charged." : 'Your trial runs until ' + until + '. After that your plan starts; cancel before then and you pay nothing.'; return p; }
    p.label = status === 'past_due' ? PRO + ' (payment due)' : PRO + (row.plan ? ' · ' + row.plan : '');
    p.note = status === 'past_due' ? "Your last payment didn't go through. Update your card to keep Pro."
      : cancelAtEnd ? 'Cancelled. Pro stays on until ' + until + '.' : until && p.manage ? 'Renews ' + until + '.' : '';
    return p;
  }

  // ---------- account view ----------
  let current = null;
  async function openAccount(msg, kind) {
    show('loading');
    let user;
    try { user = await req('/auth/v1/user'); } catch (e) { save(null); return show('signin', e.message); }
    save({ ...session, user: { id: user.id, email: user.email } });
    let row = null, err = null;
    try { row = (await req('/rest/v1/subscriptions?select=status,plan,current_period_end,cancel_at_period_end,trial_used,stripe_customer_id&user_id=eq.' + encodeURIComponent(user.id)))[0]; }
    catch (e) { err = e.message; }
    current = plan(row);
    $('[data-email]').textContent = user.email || '';
    $('[data-plan-label]').textContent = err ? 'Couldn’t check your plan right now' : current.label;
    $('[data-plan-note]').textContent = err ? err : current.note;
    $('[data-upgrade]').hidden = current.premium;
    $('[data-manage]').hidden = !current.manage;
    $('[data-trial-btn]').textContent = current.trialUsed ? 'Subscribe' : 'Start free trial';
    $('[data-trial-terms]').hidden = current.trialUsed;
    if (startPlan) { const r = root.querySelector('input[name=plan][value=' + startPlan + ']'); if (r) r.checked = true; }
    document.querySelectorAll('[data-acct-link]').forEach(a => { a.textContent = 'Account'; });
    show('account', msg, kind);
    if (pendingStart && !current.premium && !err) { const p = pendingStart; pendingStart = null; checkout(p); }
    else if (pendingStart && current.premium) { pendingStart = null; note('account', 'You already have ' + PRO + '.', 'ok'); }
  }
  async function checkout(p) {
    const btn = $('[data-trial-btn]'); busy(btn, true, 'Opening checkout…');
    try { const r = await req('/functions/v1/billing', { method: 'POST', body: { action: 'checkout', plan: p } }); if (!r || !r.url) throw new Error('Checkout is not available right now.'); location.href = r.url; }
    catch (e) { busy(btn, false); note('account', e.message); }
  }

  // ---------- events ----------
  root.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; e.preventDefault(); show(b.dataset.go); });
  root.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button[type=submit]'), v = f.closest('[data-view]').dataset.view;
    busy(btn, true);
    try {
      if (f.name === 'signin') {
        save(await req('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: f.email.value.trim(), password: f.password.value } }));
        return openAccount();
      }
      if (f.name === 'signup') {
        checkPw(f.password.value, f.confirm.value);
        const j = await req('/auth/v1/signup?redirect_to=' + encodeURIComponent(HERE + (startPlan ? '?start=' + startPlan : '')), { method: 'POST', auth: false, body: { email: f.email.value.trim(), password: f.password.value } });
        const s = j && (j.access_token ? j : j.session);
        if (s && s.access_token) { save(s); return openAccount('Account created. You can sign in to the app with the same email and password.', 'ok'); }
        return show('signin', 'Check your email and open the link to confirm your account. Then sign in here or in the app.', 'ok');
      }
      if (f.name === 'forgot') {
        await req('/auth/v1/recover?redirect_to=' + encodeURIComponent(HERE), { method: 'POST', auth: false, body: { email: f.email.value.trim() } });
        f.reset(); return note(v, 'If that email has an account, we sent a link to reset your password. The link works once. Check spam if it doesn’t arrive in a few minutes.', 'ok');
      }
      if (f.name === 'reset' || f.name === 'change') {
        checkPw(f.password.value, f.confirm.value);
        await req('/auth/v1/user', { method: 'PUT', body: { password: f.password.value } });
        f.reset(); if (f.name === 'change') f.closest('details').open = false;
        return openAccount('Password saved. Use it to sign in here and in the app.', 'ok');
      }
      if (f.name === 'redeem') {
        const r = await req('/rest/v1/rpc/redeem_tester_code', { method: 'POST', body: { code: f.code.value.trim() } });
        f.reset();
        return openAccount(r && r.already ? 'This account already redeemed a code.' : r && r.status === 'tester' ? PRO + ' unlocked.' : 'Code accepted. Your existing plan is kept.', 'ok');
      }
      if (f.name === 'upgrade') return checkout(f.querySelector('input[name=plan]:checked').value);
    } catch (err) { note(v, err.message); }
    finally { if (document.body.contains(btn) && f.name !== 'upgrade') busy(btn, false); }
  });
  $('[data-manage]').addEventListener('click', async e => {
    const btn = e.currentTarget; busy(btn, true, 'Opening…');
    try { const r = await req('/functions/v1/billing', { method: 'POST', body: { action: 'portal' } }); location.href = r.url; }
    catch (err) { busy(btn, false); note('account', err.message); }
  });
  $('[data-signout]').addEventListener('click', async () => {
    try { await req('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* already gone */ }
    save(null); document.querySelectorAll('[data-acct-link]').forEach(a => { a.textContent = 'Sign in'; });
    show('signin', "You're signed out on this browser. The app stays signed in.", 'ok');
  });

  // ---------- start ----------
  // Email links (reset, confirm) arrive as #access_token=…&type=recovery|signup, or #error_code=… when expired / used.
  const h = new URLSearchParams(location.hash.slice(1));
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (h.get('error_code') || h.get('error')) {
    show('forgot', /expired|invalid/i.test(h.get('error_description') || h.get('error_code') || '') ? 'That link has expired or was already used (some email apps open links early). Enter your email for a new one.' : friendly(h.get('error_description')));
  } else if (h.get('access_token')) {
    save({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') });
    if (h.get('type') === 'recovery') show('reset');
    else openAccount(h.get('type') === 'signup' ? 'Email confirmed. Welcome to Instinct.' : null, 'ok');
  } else if (load()) openAccount();
  else {
    const m = qs.get('mode');
    show(m === 'signup' || m === 'forgot' ? m : 'signin', startPlan ? 'Sign in or create an account to start your free trial. It’s the same account as in the app.' : null, 'ok');
  }
})();
