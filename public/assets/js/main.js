/* =========================================================
   Growx — Core Platform Script
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Floating Nav Scroll Effect ---------- */
  const nav = document.querySelector('.nav');
  if (nav) {
    const handleScroll = () => {
      if (window.scrollY > 30) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* ---------- Mobile Menu ---------- */
  const burger = document.querySelector('.nav-burger');
  const navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      navLinks.style.display = isOpen ? 'flex' : '';
    });
  }

  /* ---------- Scroll Reveal ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach((el) => obs.observe(el));
  }

  /* ---------- Mouse 3D Tilt ---------- */
  document.querySelectorAll('.tilt-card, .account-card').forEach((el) => {
    const intensity = el.dataset.tilt || 12;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const rx = ((cy / rect.height) - 0.5) * -intensity;
      const ry = ((cx / rect.width) - 0.5) * intensity;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });

  /* ---------- Toast ---------- */
  const toast = (msg, type = 'success') => {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.innerHTML = `<span class="toast-icon">${type === 'success' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'}</span>${msg}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  };
  window.fnxToast = toast;

  /* ---------- Copy to Clipboard ---------- */
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      toast('Copied to clipboard');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1600);
    } catch {
      toast('Failed to copy', 'error');
    }
  });

  /* ---------- Modal Logic ---------- */
  window.fnxOpenModal = (id) => {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.fnxCloseModal = (id) => {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('[data-modal-open]')) {
      e.preventDefault();
      fnxOpenModal(e.target.dataset.modalOpen);
    }
    if (e.target.matches('[data-modal-close]') || e.target.classList.contains('modal-overlay')) {
      const id = e.target.dataset.modalClose ||
                 (e.target.classList.contains('modal-overlay') ? e.target.id : null);
      if (id) fnxCloseModal(id);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach((m) => {
        fnxCloseModal(m.id);
      });
    }
  });

  /* ---------- Aggregate Conditions Checklist ---------- */
  /* Single aggregate T&C checkbox (replaces per-rule checkboxes) */
  const continueBtn = document.getElementById('continue-btn');
  const agreeAll = document.getElementById('agree-all');
  const agreementCard = document.querySelector('.agreement-card');
  if (continueBtn) {
    const setContinueState = (enabled) => {
      continueBtn.disabled = !enabled;
      continueBtn.style.opacity = enabled ? '1' : '0.5';
      continueBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
      if (enabled) continueBtn.classList.add('pulse-highlight');
      else continueBtn.classList.remove('pulse-highlight');
    };
    setContinueState(false);
    continueBtn.addEventListener('click', () => {
      if (continueBtn.disabled) return;
      const params = new URLSearchParams(window.location.search);
      const plan = localStorage.getItem('fnx_plan') || params.get('plan') || '';
      const balance = localStorage.getItem('fnx_balance') || params.get('balance') || '';
      const price = localStorage.getItem('fnx_price') || params.get('price') || '';
      const qs = new URLSearchParams();
      if (plan) qs.set('plan', plan);
      if (balance) qs.set('balance', balance);
      if (price) qs.set('price', price);
      window.location.href = 'payment.html' + (qs.toString() ? '?' + qs.toString() : '');
    });
    if (agreeAll) {
      agreeAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        setContinueState(checked);
        if (agreementCard) agreementCard.classList.toggle('accepted', checked);
        try { localStorage.setItem('fnx_agreed', checked ? '1' : '0'); } catch (e) {}
      });
      try {
        if (localStorage.getItem('fnx_agreed') === '1') {
          agreeAll.checked = true;
          setContinueState(true);
          if (agreementCard) agreementCard.classList.add('accepted');
        }
      } catch (e) {}
    }
  }

  /* ---------- FAQ Accordion ---------- */
  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // close others within the same list for cleaner UX
      const list = item.parentElement;
      if (list) {
        list.querySelectorAll('.faq-item.open').forEach((other) => {
          if (other !== item) other.classList.remove('open');
        });
      }
      item.classList.toggle('open', !isOpen);
    });
  });

  /* ---------- Auth Helpers ---------- */
  const fnxGetUser = () => {
    try {
      const raw = localStorage.getItem('fnx_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };
  const fnxSetUser = (u) => {
    try { localStorage.setItem('fnx_user', JSON.stringify(u)); } catch (e) {}
  };
  const fnxClearUser = () => {
    try {
      localStorage.removeItem('fnx_user');
      localStorage.removeItem('fnx_plan');
      localStorage.removeItem('fnx_balance');
      localStorage.removeItem('fnx_price');
      localStorage.removeItem('fnx_network');
      localStorage.removeItem('fnx_tx_hash');
    } catch (e) {}
  };
  window.fnxGetUser = fnxGetUser;
  window.fnxSetUser = fnxSetUser;
  window.fnxClearUser = fnxClearUser;

  /* ---------- Redirect logic after auth (preserves mid-flow order) ---------- */
  const postAuthRedirect = () => {
    try {
      const explicit = localStorage.getItem('fnx_redirect');
      if (explicit) {
        localStorage.removeItem('fnx_redirect');
        window.location.href = explicit;
        return;
      }
      const plan = localStorage.getItem('fnx_plan');
      if (plan) window.location.href = 'checkout.html';
      else window.location.href = 'dashboard.html';
    } catch (e) {
      window.location.href = 'dashboard.html';
    }
  };

  /* ---------- Sign-up form (real backend) ---------- */
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupForm.querySelector('#su-name')?.value?.trim();
      const email = signupForm.querySelector('#su-email')?.value?.trim();
      const country_code = signupForm.querySelector('#su-cc')?.value || '';
      const phone = signupForm.querySelector('#su-phone')?.value?.trim();
      const country = signupForm.querySelector('#su-country')?.value?.trim();
      const pw = signupForm.querySelector('#su-pw')?.value;
      const pw2 = signupForm.querySelector('#su-pw2')?.value;
      const terms = signupForm.querySelector('#su-terms')?.checked;

      if (!name || name.length < 2) return toast('Please enter your full name', 'error');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Please enter a valid email', 'error');
      if (!phone || !/^[0-9]{6,20}$/.test(phone)) return toast('Please enter a valid phone number (digits only, 6-20 chars)', 'error');
      if (!country) return toast('Please select your country', 'error');
      if (!pw || pw.length < 8) return toast('Password must be at least 8 characters', 'error');
      if (pw !== pw2) return toast('Passwords do not match', 'error');
      if (!terms) return toast('Please accept the Terms of Service', 'error');

      if (window.fnxSetButtonLoading) window.fnxSetButtonLoading(submitBtn, 'Creating account…');
      else { submitBtn.disabled = true; submitBtn.textContent = 'Creating account…'; }

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password: pw, country_code, phone, country })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          let msg = 'Could not create account';
          if (data.error === 'email_taken') msg = 'That email is already registered — sign in instead';
          else if (data.error === 'email_invalid') msg = 'Please enter a valid email';
          else if (data.error === 'password_weak') msg = 'Password must be at least 8 characters';
          else if (data.error === 'rate_limited') msg = 'Too many attempts — try again later';
          toast(msg, 'error');
          if (window.fnxResetButton) window.fnxResetButton(submitBtn);
          else { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
          return;
        }
        // Account created successfully — show animated success card,
        // fire confetti + paper plane, then redirect to the verify page.
        // Brief delay so the user perceives the green-check button morph
        // BEFORE the form is hidden by fnxShowSuccessCard.
        if (window.fnxSetButtonSuccess) window.fnxSetButtonSuccess(submitBtn, 'Account created');
        try { localStorage.setItem('growx_pending_email', email); } catch (_) {}
        setTimeout(function () {
          if (window.fnxShowSuccessCard) window.fnxShowSuccessCard({
            form: signupForm,
            title: 'Check your inbox!',
            sub: 'We sent a 6-digit verification code to your email. Open it to finish setting up your account.',
            icon: 'mail'
          });
          if (window.fnxConfetti) window.fnxConfetti({ count: 70, originX: 0.5 });
          if (window.fnxFlyPlane) window.fnxFlyPlane(submitBtn);
        }, 260);
        setTimeout(() => { window.location.href = 'verify-email.html?email=' + encodeURIComponent(email); }, 2000);
      } catch (_) {
        toast('Network error — try again', 'error');
        if (window.fnxResetButton) window.fnxResetButton(submitBtn);
        else { submitBtn.disabled = false; submitBtn.innerHTML = orig; }
      }
    });
  }

  /* ---------- Login form (real backend) ---------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Already-logged-in shortcut — confirm session before redirecting.
    if (fnxGetUser()) {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (j && j.ok && j.user) postAuthRedirect(); })
        .catch(() => {});
    }
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#li-email')?.value?.trim();
      const pw = loginForm.querySelector('#li-pw')?.value;
      if (!email) return toast('Please enter your email', 'error');
      if (!pw || pw.length < 8) return toast('Password must be at least 8 characters', 'error');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const orig = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password: pw })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          let msg = 'Sign in failed';
          if (data.error === 'invalid_credentials') msg = 'Wrong email or password';
          else if (data.error === 'email_not_verified') {
            msg = 'Verify your email first — we sent you a code';
            try { localStorage.setItem('growx_pending_email', email); } catch (_) {}
            setTimeout(() => { window.location.href = 'verify-email.html?email=' + encodeURIComponent(email); }, 1200);
            return;
          } else if (data.error === 'account_disabled') msg = 'Account is disabled — contact support';
          toast(msg, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = orig;
          return;
        }
        fnxSetUser({
          id: data.user.id, email: data.user.email,
          name: data.user.name || 'Trader', is_admin: !!data.user.is_admin,
          joined_at: Date.now()
        });
        toast('Welcome back, ' + (data.user.name || 'trader').split(' ')[0]);
        setTimeout(postAuthRedirect, 600);
      } catch (_) {
        toast('Network error — try again', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = orig;
      }
    });
  }

  /* ---------- Sign-out handler (real backend) ---------- */
  document.body.addEventListener('click', async (e) => {
    const target = e.target.closest('#signout-btn');
    if (!target) return;
    e.preventDefault();
    if (!window.confirm('Are you sure you want to sign out? Your in-flight order will be cleared.')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    fnxClearUser();
    toast('Signed out');
    setTimeout(() => { window.location.href = 'index.html'; }, 500);
  });

  /* ---------- Forgot-password link helper ---------- */
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('#forgot-pw');
    if (!link) return;
    e.preventDefault();
    window.location.href = 'forgot.html';
  });

  /* ---------- Auth gate for checkout / payment / wallet / verify / dashboard ---------- */
  const guardedPages = ['checkout.html', 'payment.html', 'wallet.html', 'verify.html', 'dashboard.html'];
  const currentFile = (location.pathname.split('/').pop() || '').toLowerCase();
  if (guardedPages.includes(currentFile) && !fnxGetUser()) {
    const plan = localStorage.getItem('fnx_plan');
    const tierNotice = plan ? ` to continue with your ${plan} plan` : '';
    // Toast is informational; redirect is the source of truth.
    toast('Sign up required' + tierNotice, 'error');
    try { localStorage.setItem('fnx_redirect', currentFile); } catch (e) {}
    setTimeout(() => { window.location.href = 'signup.html'; }, 350);
  }


  /* ---------- Contact form ---------- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = contactForm.querySelectorAll('input, textarea');
      let valid = true;
      inputs.forEach((i) => {
        if (!i.value.trim()) valid = false;
      });
      if (!valid) { toast('Please fill all fields', 'error'); return; }
      toast('Message sent — we will reply within 1 hour');
      contactForm.reset();
    });
  }

  /* ---------- Save / Read selection from URL ---------- */
  const params = new URLSearchParams(window.location.search);
  const selectedPlan = params.get('plan') || localStorage.getItem('fnx_plan') || '';
  if (selectedPlan) {
    localStorage.setItem('fnx_plan', selectedPlan);
    document.body.dataset.plan = selectedPlan;
  }

  /* ---------- Countdown Timer (24h wait) ---------- */
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    const startKey = 'fnx_tx_time';
    let startTime = parseInt(localStorage.getItem(startKey) || '0');
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(startKey, startTime.toString());
    }
    const totalMs = 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, startTime + totalMs - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const fmt = (n) => String(n).padStart(2, '0');
      const hEl = document.getElementById('cd-h');
      const mEl = document.getElementById('cd-m');
      const sEl = document.getElementById('cd-s');
      if (hEl) hEl.textContent = fmt(h);
      if (mEl) mEl.textContent = fmt(m);
      if (sEl) sEl.textContent = fmt(s);
      const ready = diff === 0;
      const readyCta = document.getElementById('ready-cta');
      const badgeEl = document.getElementById('status-badge');
      if (ready) {
        if (readyCta) readyCta.classList.remove('hidden');
        if (badgeEl) {
          badgeEl.textContent = '✓ Verified — Credentials Ready';
          badgeEl.style.background = 'rgba(16,185,129,0.12)';
          badgeEl.style.borderColor = 'var(--accent-emerald)';
          badgeEl.style.color = 'var(--accent-emerald)';
        }
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Verify Form Submission ---------- */
  const verifyForm = document.getElementById('verify-form');
  if (verifyForm) {
    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txnInput = document.getElementById('txn-hash');
      const fileInput = document.getElementById('txn-img');
      const hash = txnInput?.value.trim();
      const hasFile = fileInput?.files?.length > 0;
      if (!hash || hash.length < 10) {
        toast('Please paste a valid transaction hash', 'error');
        return;
      }
      if (!hasFile) {
        toast('Please upload the transaction image', 'error');
        return;
      }
      localStorage.setItem('fnx_tx_hash', hash);
      window.location.href = 'waiting.html';
    });
  }

  /* ---------- Network Selection (Payment) ---------- */
  const networkCards = document.querySelectorAll('.network-card');
  const continuePay = document.getElementById('continue-pay');
  let selectedNetwork = null;
  if (networkCards.length && continuePay) {
    networkCards.forEach((c) => {
      c.addEventListener('click', () => {
        networkCards.forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        selectedNetwork = c.dataset.network;
        continuePay.disabled = false;
        continuePay.style.opacity = '1';
        continuePay.style.cursor = 'pointer';
        continuePay.classList.add('pulse-highlight');
      });
    });
    continuePay.addEventListener('click', (e) => {
      /* Default: navigate to the Send Payment page with the chosen network.
         Inline payment controllers that run earlier (capture phase) can
         call preventDefault() to suppress this fallback. */
      if (continuePay.disabled) return;
      if (!selectedNetwork) return;
      localStorage.setItem('fnx_network', selectedNetwork);
      if (e && e.defaultPrevented) return;
      window.location.href = 'wallet.html?net=' + selectedNetwork;
    });
  }

  /* ---------- "I Have Paid" Button ---------- */
  const paidBtn = document.getElementById('paid-btn');
  if (paidBtn) {
    paidBtn.addEventListener('click', () => {
      const plan = localStorage.getItem('fnx_plan') || 'Stellar 1';
      const net = localStorage.getItem('fnx_network') || params.get('net') || 'TRC20';
      window.location.href = `verify.html?plan=${encodeURIComponent(plan)}&net=${net}`;
    });
  }

  /* ---------- Account Selection ---------- */
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-plan]');
    if (!btn) return;
    e.preventDefault();
    const plan = btn.dataset.selectPlan;
    const balance = btn.dataset.balance;
    const price = btn.dataset.price;
    localStorage.setItem('fnx_plan', plan);
    localStorage.setItem('fnx_balance', balance);
    localStorage.setItem('fnx_price', price);
    window.location.href = `checkout.html?plan=${encodeURIComponent(plan)}&balance=${balance}&price=${price}`;
  });

  /* ---------- Inject Account Summary from localStorage ---------- */
  const summaryTarget = document.getElementById('account-summary');
  if (summaryTarget) {
    const plan = localStorage.getItem('fnx_plan') || 'Stellar 1';
    const balance = localStorage.getItem('fnx_balance') || '10,000';
    const price = localStorage.getItem('fnx_price') || '159';
    summaryTarget.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.3rem;">${plan}</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">Funded Account · $${balance}</div>
        </div>
        <div style="text-align:right;">
          <div class="text-grad-gold" style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.6rem;">$${price}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">One-time fee</div>
        </div>
      </div>
    `;
  }

  /* ---------- Fill payment amount automatically ---------- */
  const amtEl = document.getElementById('amount-usdt');
  const qrNet = document.getElementById('qr-net');
  if (amtEl) {
    const price = localStorage.getItem('fnx_price') || '159';
    amtEl.textContent = price;
  }
  if (qrNet) {
    qrNet.textContent = (params.get('net') || localStorage.getItem('fnx_network') || 'TRC20').toUpperCase();
  }

  /* ---------- Generate simulated QR ---------- */
  const qrWrap = document.getElementById('qr-wrap');
  /* Skip rendering here if payment.html's inline controller is taking over
     (avoids a 1-frame flash of the wrong network's QR before our own inline flow handles it). */
  if (qrWrap && !document.getElementById('payment-wallet-section')) {
    const net = (params.get('net') || 'TRC20').toLowerCase();
    const addrs = {
      trc20: 'TX9a1Fnpk7Z8bX6n2GdQ7Cz3Yb5pNkRdLr',
      erc20: '0x4E73B4bD2fD7c9bA3F8AB6c3e21Df8a9B5c2D1eF',
      bep20: '0xa5b7C9d3F8e1B6a4C7c9F3a5b7d9e1f3a5b7c9D3',
      polygon: '0x9F8a7b6C5d4E3f2a1B0c9D8e7F6a5b4C3d2E1f0A',
      arbitrum: '0xC1d2E3f4A5b6C7d8E9f0A1b2C3d4E5f6A7b8C9d0',
      solana: '7xKXtg2CW87d97TX4SDArk4XKcZ8T9Y6Fv1oP2rN3mQ'
    };
    const addr = addrs[net] || addrs.trc20;
    qrWrap.innerHTML = `
      <div class="qr-wrap">
        <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;background:#fff;border-radius:14px;">
          <rect width="21" height="21" fill="#fff"/>
          ${generateQrPattern(addr)}
        </svg>
      </div>
    `;
    const addrEl = document.getElementById('addr-text');
    if (addrEl) {
      addrEl.textContent = addr;
      const copyBtn = document.querySelector('[data-copy-wallet]');
      if (copyBtn) copyBtn.dataset.copy = addr;
    }
  }

  /* Deterministic simulated QR generator (21x21 module grid).
     Exposed on window for any page that needs to render the same deterministic QR (e.g. an inline payment flow). */
  function generateQrPattern(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    let svg = '';
    /* Corner position markers */
    const corners = [[1,1],[14,1],[1,14]];
    corners.forEach(([x,y]) => {
      svg += `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/>`;
      svg += `<rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/>`;
      svg += `<rect x="${x+2}" y="${y+2}" width="3" height="3" fill="#000"/>`;
    });
    /* Data modules */
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        const corner = corners.some(([cx,cy]) => x >= cx && x < cx+7 && y >= cy && y < cy+7);
        const alignTop = y < 8 && x > 7 && x < 14;
        const alignLeft = x < 8 && y > 7;
        if (corner || alignTop || alignLeft) continue;
        const v = ((x * 31 + y * 17 + hash) & 0xFF);
        if (v > 110) svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
      }
    }
    /* Center logo dot */
    svg += `<rect x="9" y="9" width="3" height="3" fill="#fff"/>`;
    svg += `<rect x="9.5" y="9.5" width="2" height="2" fill="#000"/>`;
    return svg;
  }
  /* Expose for any inline flow that wants to reuse this QR algorithm */
  window.fnxGenerateQrPattern = generateQrPattern;

  /* ---------- Theme transition between account cards ---------- */
  const accountCards = document.querySelectorAll('.account-card');
  accountCards.forEach((c) => {
    c.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const plan = c.dataset.plan || c.querySelector('.account-name')?.textContent;
      const balance = c.dataset.balance;
      const price = c.dataset.price;
      if (plan) {
        localStorage.setItem('fnx_plan', plan);
        localStorage.setItem('fnx_balance', balance);
        localStorage.setItem('fnx_price', price);
        window.location.href = `checkout.html?plan=${encodeURIComponent(plan)}&balance=${balance}&price=${price}`;
      }
    });
  });

  /* ---------- Animated number ticker ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dur = 1800;
    const start = performance.now();
    const fmt = (n) => Number.isInteger(target) ? Math.round(n).toLocaleString() : n.toFixed(2);
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

})();
