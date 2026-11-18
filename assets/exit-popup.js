/**
 * NeuroPouch exit-intent popup: 10% off the first order.
 * Include with <script src="/assets/exit-popup.js" defer></script> on pages where it should run.
 * Posts to /api/subscribe (Brevo list 7, SOURCE = exit-popup); the Brevo welcome automation sends the code.
 * Spec and copy: Obsidian → Brands/Neuropouch/website development/Exit popup/.
 */
(function () {
  var LIST_ID = 7;                 // Brevo list that starts the welcome sequence
  var SOURCE = 'exit-popup';       // stored on the contact as SOURCE
  var MIN_SECONDS_ON_PAGE = 8;     // never fire in the first seconds
  var SNOOZE_DAYS = 7;             // after closing, stay hidden this long

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  function snoozed() {
    if (store('np_subscribed')) return true;
    var t = Number(store('np_exit_closed_at') || 0);
    return t && (Date.now() - t) < SNOOZE_DAYS * 864e5;
  }
  if (snoozed() || /checkout=success/.test(location.search)) return;

  var css = [
    '#np-exit{position:fixed;inset:0;z-index:9999;display:none}',
    '#np-exit.np-open{display:block}',
    '#np-exit .np-backdrop{position:absolute;inset:0;background:rgba(28,43,74,.55)}',
    '#np-exit .np-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 32px);max-width:440px;box-sizing:border-box;background:#FDFAF7;border-radius:10px;padding:36px 32px 28px;box-shadow:0 24px 60px rgba(28,43,74,.25);font-family:"Plus Jakarta Sans",Arial,sans-serif;color:#2D3142;text-align:center}',
    '#np-exit .np-close{position:absolute;top:10px;right:12px;width:40px;height:40px;border:0;background:transparent;font-size:26px;line-height:1;color:#6B7280;cursor:pointer}',
    '#np-exit .np-eyebrow{margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#C4956A;font-weight:600}',
    '#np-exit h2{margin:0 0 10px;font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:28px;line-height:1.2;color:#1C2B4A}',
    '#np-exit .np-sub{margin:0 0 20px;font-size:15px;line-height:1.55;color:#2D3142}',
    '#np-exit input[type=email]{width:100%;box-sizing:border-box;height:50px;padding:0 16px;margin:0 0 10px;border:1px solid #D9CFC4;border-radius:6px;font-size:16px;font-family:inherit;color:#1C2B4A;background:#fff}',
    '#np-exit input[type=email]:focus{outline:2px solid #C4956A;outline-offset:1px}',
    '#np-exit .np-submit{width:100%;height:50px;border:0;border-radius:6px;background:#1C2B4A;color:#F8F4EF;font-size:16px;font-weight:600;font-family:inherit;cursor:pointer}',
    '#np-exit .np-submit[disabled]{opacity:.6;cursor:wait}',
    '#np-exit .np-trust{margin:14px 0 0;font-size:12px;color:#6B7280}',
    '#np-exit .np-consent{margin:12px 0 0;font-size:11px;line-height:1.5;color:#6B7280}',
    '#np-exit .np-consent a{color:#6B7280}',
    '#np-exit .np-decline{margin:14px 0 0;border:0;background:none;font-family:inherit;font-size:13px;color:#6B7280;text-decoration:underline;cursor:pointer;padding:6px}',
    '#np-exit .np-error{margin:6px 0 0;font-size:13px;color:#A3412F;min-height:1em}',
    '#np-exit .np-success{display:none}',
    '#np-exit.np-done .np-form{display:none}',
    '#np-exit.np-done .np-success{display:block}',
    '#np-exit .np-sr{position:absolute;left:-9999px}',
    '@media (max-width:600px){#np-exit .np-card{top:auto;bottom:0;transform:translate(-50%,0);width:100%;max-width:none;border-radius:14px 14px 0 0;padding:30px 22px 22px}#np-exit h2{font-size:24px}}',
    '@media (prefers-reduced-motion:no-preference){#np-exit.np-open .np-card{animation:np-in .22s ease-out}@keyframes np-in{from{opacity:0}to{opacity:1}}}'
  ].join('\n');

  var markup =
    '<div class="np-backdrop" data-np-close></div>' +
    '<div class="np-card" role="dialog" aria-modal="true" aria-labelledby="np-exit-title">' +
      '<button type="button" class="np-close" data-np-close aria-label="Close">&times;</button>' +
      '<div class="np-form">' +
        '<p class="np-eyebrow">First order offer</p>' +
        '<h2 id="np-exit-title">Before you go, take 10% off your first order.</h2>' +
        '<p class="np-sub">Leave your email and we\'ll send your code straight away. It works on any bundle.</p>' +
        '<form id="np-exit-form" novalidate>' +
          '<label for="np-exit-email" class="np-sr">Email address</label>' +
          '<input id="np-exit-email" type="email" name="email" placeholder="Your email address" autocomplete="email" required>' +
          '<button type="submit" class="np-submit">Send my 10% code</button>' +
          '<p class="np-error" role="alert"></p>' +
        '</form>' +
        '<p class="np-trust">Nicotine-free &middot; 30-day first-order guarantee &middot; EU &amp; UK delivery</p>' +
        '<p class="np-consent">By signing up you agree to receive emails from NeuroPouch. Unsubscribe anytime. <a href="/privacy-policy">Privacy policy</a></p>' +
        '<button type="button" class="np-decline" data-np-close>No thanks</button>' +
      '</div>' +
      '<div class="np-success" aria-live="polite">' +
        '<p class="np-eyebrow">You\'re in</p>' +
        '<h2>Check your inbox.</h2>' +
        '<p class="np-sub">Your 10% code is on its way. If it isn\'t there in a few minutes, look in your spam or promotions folder.</p>' +
        '<button type="button" class="np-submit" data-np-close>Back to the site</button>' +
      '</div>' +
    '</div>';

  function mount() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var root = document.createElement('div');
    root.id = 'np-exit';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = markup;
    document.body.appendChild(root);
    return root;
  }

  var root = null, shown = false, lastFocus = null, startedAt = Date.now();

  function otherModalOpen() {
    var m = document.getElementById('waitlist-modal');
    return m && !m.classList.contains('hidden');
  }
  function open() {
    if (shown || snoozed() || otherModalOpen()) return;
    if ((Date.now() - startedAt) / 1000 < MIN_SECONDS_ON_PAGE) return;
    shown = true;
    if (!root) root = mount(), wire();
    lastFocus = document.activeElement;
    root.classList.add('np-open');
    root.setAttribute('aria-hidden', 'false');
    setTimeout(function () { var i = document.getElementById('np-exit-email'); if (i) i.focus(); }, 50);
    if (window.dataLayer) window.dataLayer.push({ event: 'np_exit_popup_shown' });
  }
  function close() {
    root.classList.remove('np-open');
    root.setAttribute('aria-hidden', 'true');
    if (!store('np_subscribed')) store('np_exit_closed_at', String(Date.now()));
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function wire() {
    root.addEventListener('click', function (e) { if (e.target.closest('[data-np-close]')) close(); });
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('np-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // keep focus inside the dialog
        var vis = Array.prototype.filter.call(root.querySelectorAll('button, input, a[href]'), function (el) { return el.offsetParent !== null; });
        if (!vis.length) return;
        var first = vis[0], last = vis[vis.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.getElementById('np-exit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('np-exit-email');
      var err = root.querySelector('.np-error');
      var btn = root.querySelector('.np-form .np-submit');
      var email = (input.value || '').trim();
      err.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Please enter a valid email address.'; input.focus(); return; }
      btn.disabled = true;
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, listId: LIST_ID, attributes: { SOURCE: SOURCE } })
      }).then(function (res) {
        if (!res.ok) throw new Error('subscribe failed');
        store('np_subscribed', '1');
        root.classList.add('np-done');
        if (window.dataLayer) window.dataLayer.push({ event: 'np_exit_popup_signup' });
      }).catch(function () {
        err.textContent = 'Something went wrong. Please try again, or email info@getneuropouch.com.';
      }).then(function () { btn.disabled = false; });
    });
  }

  // Desktop: cursor leaves through the top of the window.
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget && e.clientY <= 0) open();
  });
  // Touch devices: a quick upward scroll after reading 40% of the page.
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    var lastY = window.scrollY, lastT = Date.now(), deepest = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, t = Date.now();
      var depth = (y + window.innerHeight) / document.documentElement.scrollHeight;
      deepest = Math.max(deepest, depth);
      var speed = (lastY - y) / Math.max(t - lastT, 1); // px per ms, positive = upward
      if (deepest > 0.4 && speed > 1.2 && y > 200) open();
      lastY = y; lastT = t;
    }, { passive: true });
  }

  // Test hook: ?np_exit=1 opens the popup immediately (ignores snooze and the minimum time).
  if (/[?&]np_exit=1/.test(location.search)) {
    startedAt = 0;
    document.addEventListener('DOMContentLoaded', function () { shown = false; open(); });
    if (document.readyState !== 'loading') open();
  }
})();
