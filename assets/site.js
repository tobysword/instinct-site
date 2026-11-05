// Small progressive enhancements. Every page works without this file.
(function () {
  // Header: "Account" instead of "Sign in" once signed in on this browser (account.js keeps the session).
  try {
    if (localStorage.getItem('instinct.web.session.v1')) document.querySelectorAll('[data-acct-link]').forEach(a => { a.textContent = 'Account'; });
  } catch (e) { /* storage blocked */ }

  // Pricing: yearly / monthly switch. Without JS both prices show (see .plans noscript styles).
  const tog = document.querySelector('[data-billing-toggle]');
  if (tog) {
    const set = p => {
      document.body.classList.toggle('show-yearly', p === 'yearly');
      document.body.classList.toggle('show-monthly', p === 'monthly');
      tog.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plan === p)));
      document.querySelectorAll('[data-trial-link]').forEach(a => { a.href = 'account.html?start=' + p; });
    };
    tog.addEventListener('click', e => { const b = e.target.closest('button[data-plan]'); if (b) set(b.dataset.plan); });
    set('yearly');
  }

  // Download page: ?start begins the installer download, so "Download" buttons elsewhere land on the install steps.
  const dl = document.querySelector('[data-autostart]');
  if (dl && new URLSearchParams(location.search).has('start')) {
    document.querySelectorAll('[data-started]').forEach(el => { el.hidden = false; });
    setTimeout(() => { location.href = dl.getAttribute('href'); }, 600);
  }
})();
