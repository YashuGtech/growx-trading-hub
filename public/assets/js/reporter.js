/* =========================================================
   Growx — Realtime Reporter
   --------------------------------------------------------
   Loaded by every frontend page. Captures signup, login,
   plan selection, payment network, payment sent and
   verification events and POSTs them to the backend
   at /api/track on port 8765.
   ========================================================= */
(function () {
  'use strict';
  /* Detect API base dynamically: localhost pages on :8765 (python static
     server) only serve files, so we MUST post to the Node API explicitly.
     Honours <meta name="fnx-api-base"> or localStorage fnx_api_base, falls
     back to http://localhost:8766/api/track. */
  var ENDPOINT = (function () {
    try {
      var m = document.querySelector('meta[name="fnx-api-base"]');
      if (m && m.content) return m.content.replace(/\/$/, '') + '/api/track';
      var s = localStorage.getItem('fnx_api_base');
      if (s) return s.replace(/\/$/, '') + '/api/track';
    } catch (e) {}
    return 'http://localhost:8766/api/track';
  })();

  function get(name) { try { return localStorage.getItem(name); } catch (e) { return null; } }
  function set(name, v) { try { localStorage.setItem(name, v); } catch (e) {} }

  function snapshot() {
    var u = null;
    try { u = JSON.parse(get('fnx_user') || 'null'); } catch (e) {}
    return {
      email: u?.email || null,
      phone: u?.phone || null,
      country: u?.country || null,
      plan: get('fnx_plan'),
      balance: get('fnx_balance'),
      price: get('fnx_price'),
      network: get('fnx_network')
    };
  }

  function track(event, extra) {
    try {
      var payload = Object.assign({}, snapshot(), extra || {}, { ts: Date.now() });
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: event, payload: payload, page: location.pathname.split('/').pop() || '' })
      }).catch(function () { /* offline or static-preview — silently drop */ });
    } catch (e) { /* swallow */ }
  }

  window.fnxTrack = track;

  document.addEventListener('DOMContentLoaded', function () {
    // Sign-up completed (main.js fires toast "Account created"; we hook submit handler)
    var signup = document.getElementById('signup-form');
    if (signup) signup.addEventListener('submit', function () {
      var u = null; try { u = JSON.parse(get('fnx_user') || 'null'); } catch (e) {}
      setTimeout(function () {
        var fresh = null; try { fresh = JSON.parse(get('fnx_user') || 'null'); } catch (e) {}
        if (fresh) track('signup_completed', fresh);
        else if (u) track('signup_completed', u);
      }, 200);
    });

    // Login
    var login = document.getElementById('login-form');
    if (login) login.addEventListener('submit', function () {
      var email = login.querySelector('#li-email')?.value?.trim();
      if (email) {
        var prev = get('fnx_user');
        setTimeout(function () {
          var fresh = null; try { fresh = JSON.parse(get('fnx_user') || 'null'); } catch (e) {}
          var finalEmail = (fresh && fresh.email) || email;
          track('login', { email: finalEmail, identity_changed: prev !== get('fnx_user') });
        }, 200);
      }
    });

    // Plan / account selection (cards on index.html, accounts.html)
    document.body.addEventListener('click', function (e) {
      var card = e.target.closest('[data-plan]');
      if (card && card.dataset.balance && !e.target.closest('button[data-modal-open]')) {
        var p = card.dataset.plan, b = card.dataset.balance, pr = card.dataset.price;
        if (p && b && pr) setTimeout(function () { track('plan_selected', { plan: p, balance: b, price: pr }); }, 50);
      }
    });

    // Payment network selection
    var continuePay = document.getElementById('continue-pay');
    if (continuePay) continuePay.addEventListener('click', function () {
      var net = get('fnx_network');
      if (!net && typeof selectedNetwork !== 'undefined' && selectedNetwork) net = selectedNetwork;
      setTimeout(function () { track('payment_network_selected', { network: net }); }, 100);
    });
    // Click on network cards themselves
    document.body.addEventListener('click', function (e) {
      var card = e.target.closest('.network-card');
      if (card && card.dataset.network) {
        // already saved by main.js after click handler set fnx_network, but emit early
        setTimeout(function () { track('payment_network_selected', { network: card.dataset.network }); }, 50);
      }
    });

    // "I Have Paid" button (wallet.html)
    var paid = document.getElementById('paid-btn');
    if (paid) paid.addEventListener('click', function () {
      var snap = snapshot();
      setTimeout(function () { track('payment_sent', { amount_usd: parseFloat(snap.price) || 0 }); }, 80);
    });

    // Verify form submission
    var vf = document.getElementById('verify-form');
    if (vf) vf.addEventListener('submit', function () {
      var hash = document.getElementById('txn-hash')?.value?.trim() || '';
      var fileInput = document.getElementById('txn-img');
      var fname = (fileInput && fileInput.files && fileInput.files[0] && fileInput.files[0].name) || null;
      var snap = snapshot();
      setTimeout(function () {
        track('verification_submitted', { hash: hash, file_name: fname, amount_usd: parseFloat(snap.price) || 0 });
      }, 80);
    });
  });

  // On every load, broadcast a "page_view" so the manager sees live traffic
  try {
    var seen = (sessionStorage.getItem('fnx_seen_pv') || '').split('|');
    var page = location.pathname.split('/').pop() || 'index.html';
    if (seen.indexOf(page) === -1) {
      seen.push(page);
      sessionStorage.setItem('fnx_seen_pv', seen.join('|'));
      track('page_view', { path: page });
    }
  } catch (e) {}
})();
