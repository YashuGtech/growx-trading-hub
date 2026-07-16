/* =========================================================
   Growx — Background Particles & 3D Effects
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Particle Network Canvas ---------- */
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = window.innerWidth;
  let h = window.innerHeight;

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  const PARTICLE_COUNT = Math.min(80, Math.floor((w * h) / 22000));
  const particles = [];
  const mouse = { x: -9999, y: -9999 };

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 1.6 + 0.6;
      this.alpha = Math.random() * 0.5 + 0.3;
      this.color = Math.random() > 0.5 ? '255,215,0' : '139,92,246';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
      // mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        const force = (120 - d) / 120;
        this.vx += (dx / d) * force * 0.5;
        this.vy += (dy / d) * force * 0.5;
        this.vx *= 0.96; this.vy *= 0.96;
      } else {
        this.vx *= 0.995;
        this.vy *= 0.995;
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    // Draw particles
    particles.forEach((p) => { p.update(); p.draw(); });
    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 130) {
          const alpha = (1 - d / 130) * 0.18;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    // Mouse glow connection
    if (mouse.x > 0) {
      particles.forEach((p) => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140) {
          const alpha = (1 - d / 140) * 0.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255,215,0,${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      });
      // Cursor glow
      const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
      grd.addColorStop(0, 'rgba(255,215,0,0.15)');
      grd.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(mouse.x - 80, mouse.y - 80, 160, 160);
    }
    requestAnimationFrame(draw);
  };
  draw();

  /* ---------- Hero parallax on mouse ---------- */
  const heroStage = document.querySelector('.hero-3d');
  if (heroStage) {
    const orbs = heroStage.querySelectorAll('.hero-orb, .hero-orb-2, .hero-orb-3, .hero-ring, .hero-ring-2');
    document.addEventListener('mousemove', (e) => {
      const cx = (e.clientX / window.innerWidth) - 0.5;
      const cy = (e.clientY / window.innerHeight) - 0.5;
      orbs.forEach((o, i) => {
        const f = (i + 1) * 12;
        o.style.setProperty('--mx', `${cx * f}px`);
        o.style.setProperty('--my', `${cy * f}px`);
        o.style.transform = `translate(calc(-50% + var(--mx, 0)), calc(-50% + var(--my, 0)))`;
      });
    });
  }

  /* ---------- Scroll-linked parallax for orbs ---------- */
  const scrollOrbs = document.querySelectorAll('[data-scroll-parallax]');
  if (scrollOrbs.length) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      scrollOrbs.forEach((el) => {
        const rate = parseFloat(el.dataset.scrollParallax) || 0.3;
        el.style.transform = `translateY(${y * rate}px)`;
      });
    }, { passive: true });
  }

  /* ---------- Cursor trail ---------- */
  const trailEnabled = document.body.hasAttribute('data-trail');
  if (trailEnabled) {
    const dots = [];
    const TRAIL_LEN = 14;
    for (let i = 0; i < TRAIL_LEN; i++) {
      const d = document.createElement('div');
      d.style.cssText = `
        position:fixed;
        top:0;left:0;
        width:${10 - i * 0.4}px;
        height:${10 - i * 0.4}px;
        border-radius:50%;
        background:rgba(255,215,0,${0.5 - i * 0.03});
        pointer-events:none;
        z-index:9999;
        transform:translate(-50%,-50%);
        transition:transform 0.15s ease;
        box-shadow:0 0 ${i * 0.6}px rgba(255,215,0,0.6);
      `;
      document.body.appendChild(d);
      dots.push({ el: d, x: 0, y: 0 });
    }
    let cx = 0, cy = 0;
    document.addEventListener('mousemove', (e) => {
      cx = e.clientX; cy = e.clientY;
      dots[0].el.style.left = cx + 'px';
      dots[0].el.style.top = cy + 'px';
    });
    const animateTrail = () => {
      for (let i = 1; i < TRAIL_LEN; i++) {
        const dp = dots[i - 1];
        const dc = dots[i];
        dc.x += (dp.x - dc.x) * 0.4;
        dc.y += (dp.y - dc.y) * 0.4;
        dc.el.style.left = dc.x + 'px';
        dc.el.style.top = dc.y + 'px';
        dc.el.style.opacity = (1 - i / TRAIL_LEN).toFixed(2);
      }
      dots[0].x = cx; dots[0].y = cy;
      requestAnimationFrame(animateTrail);
    };
    animateTrail();
  }

  /* =========================================================
     Onboarding helpers — used by signup / verify / reset pages
     Exposed on `window.fnx*` so inline page scripts can call them.
     ========================================================= */

  const CONFETTI_COLORS = ['#ffb647', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#ffffff', '#f59e0b'];
  const CONFETTI_SHAPES = ['square', 'strip', 'circle'];

  function fnxConfetti(opts) {
    opts = opts || {};
    const count   = opts.count   != null ? opts.count   : 90;
    const originX = opts.originX != null ? opts.originX : 0.5;
    const spreadX = opts.spreadX != null ? opts.spreadX : 80;
    const minDur  = opts.minDur  != null ? opts.minDur  : 1500;
    const maxDur  = opts.maxDur  != null ? opts.maxDur  : 3000;
    if (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // honor accessibility setting
    }
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    document.body.appendChild(layer);
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      const shape = CONFETTI_SHAPES[i % CONFETTI_SHAPES.length];
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.className = 'confetti-piece' + (shape !== 'square' ? ' shape-' + shape : '');
      const baseLeft = originX * 100;
      const left = baseLeft + (Math.random() - 0.5) * 70;
      const dx  = (Math.random() - 0.5) * spreadX * 2;
      const rot = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
      const dur   = minDur + Math.random() * (maxDur - minDur);
      const delay = Math.random() * 350;
      const size  = 6 + Math.random() * 6;
      piece.style.cssText =
        'left:' + left + 'vw;' +
        'background:' + color + ';' +
        'width:' + size + 'px;' +
        'height:' + (size * (shape === 'strip' ? 2 : 1.4)) + 'px;' +
        'animation-duration:' + dur + 'ms;' +
        'animation-delay:' + delay + 'ms;' +
        '--dx:' + dx.toFixed(1) + 'px;' +
        '--rotate:' + rot.toFixed(0) + 'deg;';
      layer.appendChild(piece);
    }
    setTimeout(function () { layer.remove(); }, maxDur + 800);
  }

  /**
   * Replace a form (or any element) with a success card and return the card.
   * opts: { form, container, title, sub, icon }  // icon: 'check' | 'mail'
   */
  function fnxShowSuccessCard(opts) {
    opts = opts || {};
    const form = opts.form;
    const container = opts.container || (form && form.parentElement);
    if (!container) return null;
    const card = document.createElement('div');
    card.className = 'success-card is-visible';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    let iconHtml =
      '<svg class="success-checkmark" viewBox="0 0 64 64" aria-hidden="true">' +
        '<circle class="circle-bg" cx="32" cy="32" r="29"></circle>' +
        '<circle class="circle" cx="32" cy="32" r="29"></circle>' +
        '<path class="check" d="M18 33 L28 43 L46 23"></path>' +
      '</svg>';
    if (opts.icon === 'mail') {
      iconHtml =
        '<svg class="success-checkmark" viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle class="circle-bg" cx="32" cy="32" r="29"></circle>' +
          '<circle class="circle" cx="32" cy="32" r="29"></circle>' +
          '<path class="check" d="M14 26 L32 38 L50 26 M14 26 V40 H50 V26"></path>' +
        '</svg>';
    } else if (opts.icon === 'plane') {
      iconHtml =
        '<svg class="success-checkmark" viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle class="circle-bg" cx="32" cy="32" r="29"></circle>' +
          '<circle class="circle" cx="32" cy="32" r="29"></circle>' +
          '<path class="check" d="M8 36 L56 24 L42 30 L56 24 L36 42 L30 32 Z"></path>' +
        '</svg>';
    }
    card.innerHTML =
      iconHtml +
      '<h2>' + (opts.title || 'Success') + '</h2>' +
      '<p>' + (opts.sub || '') + '</p>' +
      (opts.actionsHtml ? '<div class="success-actions">' + opts.actionsHtml + '</div>' : '');
    if (form && form.parentElement === container) {
      form.style.display = 'none';
    }
    container.appendChild(card);
    return card;
  }

  /**
   * Flip the submit button into a spinner "loading" state.
   * Stores the original HTML in dataset.originalHtml so fnxResetButton can restore it.
   */
  function fnxSetButtonLoading(btn, label) {
    if (!btn) return;
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.classList.remove('is-success');
    btn.classList.add('is-loading');
    btn.disabled = true;
    btn.innerHTML =
      '<span class="btn-spinner" aria-hidden="true"></span>' +
      (label || 'Working\u2026');
  }

  /**
   * Flip the submit button into a green success-morph state with a drawn checkmark.
   */
  function fnxSetButtonSuccess(btn, label) {
    if (!btn) return;
    btn.classList.remove('is-loading');
    btn.classList.add('is-success');
    btn.disabled = true;
    btn.innerHTML =
      '<svg class="btn-success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 12L10 17L20 7"/>' +
      '</svg>' +
      (label || 'Done');
  }

  /** Restore a button to its pre-loading HTML. */
  function fnxResetButton(btn) {
    if (!btn) return;
    btn.classList.remove('is-loading', 'is-success');
    btn.disabled = false;
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }

  /** Spawn a paper plane that flies off the source element. */
  function fnxFlyPlane(srcEl) {
    if (!srcEl) return;
    if (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = srcEl.getBoundingClientRect();
    const plane = document.createElement('div');
    plane.className = 'plane-fly';
    plane.style.left = (r.left + window.scrollX + r.width  / 2 - 16) + 'px';
    plane.style.top  = (r.top  + window.scrollY + r.height / 2 - 16) + 'px';
    plane.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#ffb647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'style="width:100%;height:100%;filter:drop-shadow(0 0 8px rgba(255,182,71,0.7));" aria-hidden="true">' +
        '<path d="M22 2 L11 13 M22 2 L15 22 L11 13 M22 2 L2 9 L11 13" fill="#ffb647" stroke="#1a0d00" stroke-width="1.5"/>' +
      '</svg>';
    document.body.appendChild(plane);
    setTimeout(function () { plane.remove(); }, 1300);
  }

  window.fnxConfetti = fnxConfetti;
  window.fnxShowSuccessCard = fnxShowSuccessCard;
  window.fnxSetButtonLoading = fnxSetButtonLoading;
  window.fnxSetButtonSuccess = fnxSetButtonSuccess;
  window.fnxResetButton = fnxResetButton;
  window.fnxFlyPlane = fnxFlyPlane;

})();
