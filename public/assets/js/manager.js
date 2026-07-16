/* =========================================================
   Growx — Manager Dashboard Front-end Controller
   ========================================================= */
(function () {
  'use strict';

  /* Backend lives on Node API server (default :8766). The static site's
     python/http.server on :8765 only serves files. We point fetch() at
     the absolute URL with CORS enabled so the dashboard can pull data
     regardless of which port the user landed on. */
  const API = (() => {
    try {
      // Prefer the meta tag the host page can set; fall back to env-like port 8766
      const meta = document.querySelector('meta[name="fnx-api-base"]');
      if (meta && meta.content) return meta.content.replace(/\/$/, '');
      const stored = localStorage.getItem('fnx_api_base');
      if (stored) return stored.replace(/\/$/, '');
    } catch (e) {}
    return 'http://localhost:8766';
  })();

  /* ---------- Helpers ---------- */
  const $  = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const fmtNum   = (n) => Number(n || 0).toLocaleString();
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const initials = (n) => String(n || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();

  function toast(message, type = 'success', duration = 3500) {
    const el = document.createElement('div');
    el.className = 'mgr-toast ' + (type === 'error' ? 'error' : (type === 'info' ? 'info' : ''));
    el.innerHTML = `<span>${escapeHtml(message)}</span><span class="x" aria-label="dismiss">×</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const kill = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); };
    el.querySelector('.x').addEventListener('click', kill);
    setTimeout(kill, duration);
  }

  async function api(path, options = {}) {
    try {
      const r = await fetch(API + path, Object.assign(
        { headers: { 'Content-Type': 'application/json' } },
        options,
        options.body ? { body: JSON.stringify(options.body) } : {}
      ));
      const txt = await r.text();
      try { return JSON.parse(txt); } catch (e) { return { raw: txt, status: r.status }; }
    } catch (e) { return { error: e.message }; }
  }

  /* ---------- Status pill renderer ---------- */
  function statusPill(s) {
    s = String(s || '').toLowerCase();
    if (!s) return '<span class="pill pill-neutral">—</span>';
    if (['verified','approved','completed','resolved','paid','sent','active'].includes(s)) return `<span class="pill pill-success">${escapeHtml(s)}</span>`;
    if (['pending','pending_verification','open','queued','new','in_progress'].includes(s)) return `<span class="pill pill-warning">${escapeHtml(s.replace(/_/g,' '))}</span>`;
    if (['rejected','failed','cancelled','closed'].includes(s)) return `<span class="pill pill-error">${escapeHtml(s)}</span>`;
    if (['escalated','high'].includes(s)) return `<span class="pill pill-pink">${escapeHtml(s)}</span>`;
    if (['normal','in progress'].includes(s)) return `<span class="pill pill-info">${escapeHtml(s)}</span>`;
    if (['low'].includes(s)) return `<span class="pill pill-neutral">${escapeHtml(s)}</span>`;
    return `<span class="pill pill-neutral">${escapeHtml(s)}</span>`;
  }
  function severityPill(s) {
    s = String(s || '').toLowerCase();
    if (s === 'high') return '<span class="pill pill-pink">High</span>';
    if (s === 'low') return '<span class="pill pill-neutral">Low</span>';
    return '<span class="pill pill-info">Normal</span>';
  }
  function networkPill(n) { return `<span class="pill pill-gold">${escapeHtml(n || '—')}</span>`; }

  /* ---------- Sidebar navigation ---------- */
  function showPane(pane) {
    $$('.mgr-pane').forEach(p => p.classList.toggle('active', p.dataset.paneContent === pane));
    $$('.mgr-side .nav-item').forEach(n => n.classList.toggle('active', n.dataset.pane === pane));
    location.hash = '#' + pane;
    if (pane === 'dash')        renderDashboard();
    else if (pane === 'comms')  renderCommsList();
    else if (pane === 'reports')renderReports();
    else if (pane === 'activity' || pane === 'notes' || pane === 'escalations' || pane === 'resolved' || pane === 'pending' || pane === 'kyc' || pane === 'dashboard-deposits' || pane === 'emails' || pane === 'tickets' || pane === 'complaints' || pane === 'deposits' || pane === 'withdrawals' || pane === 'verify' || pane === 'refunds' || pane === 'payments') {
      const id = `pane-${pane}`;
      const holder = document.querySelector(`[data-pane-content="${pane}"] [data-table-source]`);
      if (holder && !holder.dataset.loaded) { holder.dataset.loaded = '1'; renderTable(holder); }
    }
  }

  $$('.mgr-side .nav-item').forEach(n => n.addEventListener('click', () => showPane(n.dataset.pane)));

  /* ---------- Dashboard render ---------- */
  async function renderDashboard() {
    const data = await api('/api/dashboard');
    if (!data || !data.stats) return;
    $$('[data-kpi]').forEach(el => {
      const k = el.dataset.kpi;
      let v = data.stats[k];
      if (k.includes('volume_usdt')) el.textContent = fmtMoney(v);
      else el.textContent = fmtNum(v);
    });
    // Sidebar counters
    Object.keys(data.stats).forEach(k => {
      $$('[data-counter="' + k + '"]').forEach(el => el.textContent = data.stats[k]);
    });
    const notif = (data.stats.deposits_pending || 0) + (data.stats.withdrawals_pending || 0) + (data.stats.kyc_pending || 0) + (data.stats.tickets_open || 0);
    const notifCount = $('#notif-count');
    if (notif) { notifCount.textContent = notif; notifCount.style.display = 'inline-flex'; } else { notifCount.style.display = 'none'; }

    // Recent deposits
    const depEl = $('#dash-deposits');
    if (depEl) {
      depEl.innerHTML = data.recent.deposits.slice(0, 6).map(d => `
        <div class="feed-entry">
          <div class="icon" style="background:rgba(37,99,235,0.18);color:var(--accent-gold);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="body">
            <div><strong>${escapeHtml(d.user_name || d.user_email || 'User ' + d.user_id)}</strong> · ${escapeHtml(d.network || '—')}</div>
            <div class="t"><span style="font-family:'JetBrains Mono',monospace;">${fmtMoney(d.amount_usdt)} USDT</span> · ${statusPill(d.internal_status)}</div>
          </div>
        </div>`).join('') || '<div class="muted">No deposits yet.</div>';
    }
    // Recent tickets
    const ticEl = $('#dash-tickets');
    if (ticEl) {
      ticEl.innerHTML = data.recent.tickets.slice(0, 5).map(t => `
        <div class="feed-entry">
          <div class="icon" style="background:rgba(139,92,246,0.16);color:var(--accent-purple-soft);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="body">
            <div><strong>${escapeHtml(t.user_name || t.user_email || 'User ' + t.user_id)}</strong>: ${escapeHtml(t.subject)}</div>
            <div class="t">${severityPill(t.priority)} · ${statusPill(t.status)}</div>
          </div>
        </div>`).join('') || '<div class="muted">No tickets yet.</div>';
    }
    // Activity feed
    const actEl = $('#dash-activity');
    if (actEl) {
      actEl.innerHTML = data.recent.activities.slice(0, 12).map(a => {
        const meta = safeParse(a.metadata);
        return `<div class="feed-entry">
          <div class="icon" style="background:rgba(6,212,255,0.15);color:var(--accent-cyan);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
          </div>
          <div class="body">
            <div><strong>${escapeHtml(a.actor_id)}</strong> · ${escapeHtml(a.action)} ${a.target_type ? ' → <em>'+escapeHtml(a.target_type)+'</em> #'+ a.target_id : ''}</div>
            <div class="t">${fmtTime(a.created_at)}</div>
            ${meta ? `<div class="t"><strong>${escapeHtml(JSON.stringify(meta).slice(0,140))}</strong></div>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  }
  function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function fmtTime(s) { try { return new Date(s.replace(' ', 'T') + 'Z').toLocaleString(); } catch (e) { return s || ''; } }

  /* ---------- Generic table renderer ---------- */
  const TEMPLATES = {
    deposits: {
      columns: [
        { k: 'id',                label: '#',                   render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',              label: 'User',                render: r => `<div style="display:flex;align-items:center;gap:8px;"><span class="avatar" style="width:30px;height:30px;font-size:0.78rem;border-radius:8px;">${initials(r.user_name || r.user_email)}</span><div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div></div>` },
        { k: 'amount',            label: 'Amount',              render: r => `<div style="font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent-gold);">${fmtMoney(r.amount_usdt)}</div><div class="muted" style="font-size:0.78rem;">USDT</div>` },
        { k: 'network',           label: 'Network',             render: r => networkPill(r.network) },
        { k: 'tx_hash',           label: 'TX Hash',             render: r => `<span class="hash" title="${escapeHtml(r.tx_hash)}">${escapeHtml((r.tx_hash || '').slice(0,20))}…</span>` },
        { k: 'internal_status',   label: 'Status',              render: r => statusPill(r.internal_status) },
        { k: 'created_at',        label: 'Submitted',           render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'actions',           label: '',                    render: r => {
            if (r.internal_status === 'pending_verification') {
              return `<div class="row-actions"><button class="btn-verify" data-act="verify" data-id="${r.id}" data-endpoint="deposits">Verify</button><button class="btn-reject" data-act="reject" data-id="${r.id}" data-endpoint="deposits">Reject</button></div>`;
            }
            return `<div class="row-actions"><button data-act="open-drawer" data-case="deposit" data-id="${r.id}">View</button></div>`;
          }
        }
      ]
    },
    verify: {
      reuse: 'deposits',
      filter: { key: 'internal_status', value: 'pending_verification' }
    },
    history: {
      reuse: 'deposits'
    },
    withdrawals: {
      columns: [
        { k: 'id',               label: '#',             render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',             label: 'User',          render: r => `<div style="display:flex;align-items:center;gap:8px;"><span class="avatar" style="width:30px;height:30px;font-size:0.78rem;border-radius:8px;">${initials(r.user_name || r.user_email)}</span><div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div></div>` },
        { k: 'amount',           label: 'Amount',        render: r => `<div style="font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent-cyan);">${fmtMoney(r.amount_usdt)}</div><div class="muted" style="font-size:0.78rem;">USDT</div>` },
        { k: 'network',          label: 'Network',       render: r => networkPill(r.network) },
        { k: 'wallet_address',   label: 'Wallet',        render: r => `<span class="hash" title="${escapeHtml(r.wallet_address)}">${escapeHtml((r.wallet_address||'').slice(0,18))}…</span>` },
        { k: 'status',           label: 'Status',        render: r => statusPill(r.status) },
        { k: 'requested_at',     label: 'Requested',     render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.requested_at)}</span>` },
        { k: 'actions',          label: '', render: r => {
            if (r.status === 'pending') {
              return `<div class="row-actions"><button class="btn-approve" data-act="approve" data-id="${r.id}" data-endpoint="withdrawals">Pay</button><button class="btn-hold" data-act="reject" data-id="${r.id}" data-endpoint="withdrawals">Hold</button></div>`;
            }
            return `<div class="row-actions"><button data-act="open-drawer" data-case="withdrawal" data-id="${r.id}">View</button></div>`;
          }
        }
      ]
    },
    refunds: {
      columns: [
        { k: 'id',          label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',        label: 'User', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div>` },
        { k: 'amount',      label: 'Amount', render: r => `<div style="font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent-gold);">${fmtMoney(r.amount_usdt)}</div>` },
        { k: 'reason',      label: 'Reason', render: r => `<div style="max-width:280px;font-size:0.88rem;color:var(--text-secondary);">${escapeHtml(r.reason)}</div>` },
        { k: 'status',      label: 'Status', render: r => statusPill(r.status) },
        { k: 'created_at',  label: 'Created', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'admin_id',    label: 'Admin', render: r => escapeHtml(r.admin_id || '—') },
        { k: 'actions', label: '', render: r => {
            if (r.status === 'pending') return `<div class="row-actions"><button class="btn-approve" data-act="approve" data-id="${r.id}" data-endpoint="refunds">Approve</button><button class="btn-reject" data-act="reject" data-id="${r.id}" data-endpoint="refunds">Reject</button></div>`;
            if (r.status === 'approved') return `<div class="row-actions"><button class="btn-verify" data-act="mark_paid" data-id="${r.id}" data-endpoint="refunds">Mark paid</button></div>`;
            return `<div class="row-actions"><button data-act="open-drawer" data-case="refund" data-id="${r.id}">View</button></div>`;
          }
        }
      ]
    },
    tickets: {
      columns: [
        { k: 'id',         label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',       label: 'User', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div>` },
        { k: 'subject',    label: 'Subject', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.subject)}</div><div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml((r.body||'').slice(0,80))}…</div></div>` },
        { k: 'category',   label: 'Category', render: r => `<span class="pill pill-info">${escapeHtml(r.category || '—')}</span>` },
        { k: 'priority',   label: 'Priority', render: r => severityPill(r.priority) },
        { k: 'status',     label: 'Status', render: r => statusPill(r.status) },
        { k: 'assigned_to',label: 'Assigned', render: r => escapeHtml(r.assigned_to || '—') },
        { k: 'created_at', label: 'Opened', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'actions',    label: '', render: r => {
            const opts = [];
            if (r.status === 'open')           opts.push(`<button class="btn-hold" data-act="in_progress" data-id="${r.id}" data-endpoint="tickets">In Progress</button>`);
            if (r.status === 'open' || r.status === 'in_progress') opts.push(`<button class="btn-pink" data-act="escalate" data-id="${r.id}" data-endpoint="tickets">Escalate</button>`);
            if (r.status !== 'resolved')      opts.push(`<button class="btn-approve" data-act="resolve" data-id="${r.id}" data-endpoint="tickets">Resolve</button>`);
            opts.push(`<button data-act="open-drawer" data-case="ticket" data-id="${r.id}">Open</button>`);
            return `<div class="row-actions">${opts.join('')}</div>`;
          }
        }
      ]
    },
    complaints: {
      columns: [
        { k: 'id',          label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',        label: 'User', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div>` },
        { k: 'target',      label: 'Target', render: r => `<span class="pill pill-purple">${escapeHtml(r.target || '—')}</span>` },
        { k: 'body',        label: 'Issue', render: r => `<div style="max-width:280px;font-size:0.88rem;">${escapeHtml((r.body||'').slice(0,100))}…</div>` },
        { k: 'severity',    label: 'Severity', render: r => severityPill(r.severity) },
        { k: 'status',      label: 'Status', render: r => statusPill(r.status) },
        { k: 'created_at',  label: 'Opened', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'actions',     label: '', render: r => {
            const opts = [];
            if (r.status === 'open') opts.push(`<button class="btn-hold" data-act="in_progress" data-id="${r.id}" data-endpoint="complaints">In Progress</button>`);
            if (r.status !== 'resolved') opts.push(`<button class="btn-pink" data-act="escalate" data-id="${r.id}" data-endpoint="complaints">Escalate</button>`);
            opts.push(`<button class="btn-approve" data-act="resolve" data-id="${r.id}" data-endpoint="complaints">Resolve</button>`);
            opts.push(`<button data-act="open-drawer" data-case="complaint" data-id="${r.id}">Open</button>`);
            return `<div class="row-actions">${opts.join('')}</div>`;
          }
        }
      ]
    },
    kyc: {
      columns: [
        { k: 'id',              label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'user',            label: 'User', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div>` },
        { k: 'full_name',       label: 'Full name', render: r => escapeHtml(r.full_name || '—') },
        { k: 'doc_type',        label: 'Document', render: r => `<span class="pill pill-info">${escapeHtml((r.doc_type||'').toUpperCase())}</span>` },
        { k: 'doc_number',      label: 'Doc #', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;">${escapeHtml(r.doc_number || '—')}</span>` },
        { k: 'country',         label: 'Country', render: r => escapeHtml(r.country || '—') },
        { k: 'status',          label: 'Status', render: r => statusPill(r.status) },
        { k: 'submitted_at',    label: 'Submitted', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.submitted_at)}</span>` },
        { k: 'actions',         label: '', render: r => {
            if (r.status === 'pending') {
              return `<div class="row-actions"><button class="btn-approve" data-act="approve" data-id="${r.id}" data-endpoint="kyc">Approve</button><button class="btn-reject" data-act="reject" data-id="${r.id}" data-endpoint="kyc">Reject</button></div>`;
            }
            return `<div class="row-actions"><button data-act="open-drawer" data-case="kyc" data-id="${r.id}">View</button></div>`;
          }
        }
      ]
    },
    cases: {
      columns: [
        { k: 'id',          label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'subject',     label: 'Subject', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.subject)}</div><div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml((r.body||'').slice(0,80))}…</div></div>` },
        { k: 'user',        label: 'User', render: r => `<div><div style="font-weight:600;">${escapeHtml(r.user_name || '—')}</div><div class="email">${escapeHtml(r.user_email || '—')}</div></div>` },
        { k: 'priority',    label: 'Priority', render: r => severityPill(r.priority) },
        { k: 'status',      label: 'Status', render: r => statusPill(r.status) },
        { k: 'created_at',  label: 'Opened', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'actions', label: '', render: r => `<div class="row-actions"><button data-act="open-drawer" data-case="ticket" data-id="${r.id}">Open</button></div>` }
      ]
    },
    emails: {
      columns: [
        { k: 'id',            label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'to_email',      label: 'To', render: r => `<span class="email">${escapeHtml(r.to_email)}</span>` },
        { k: 'to_name',       label: 'Name', render: r => escapeHtml(r.to_name || '—') },
        { k: 'subject',       label: 'Subject', render: r => `<div style="font-weight:600;">${escapeHtml(r.subject || '—')}</div>` },
        { k: 'template',      label: 'Template', render: r => `<span class="pill pill-info">${escapeHtml(r.template || 'manual')}</span>` },
        { k: 'status',        label: 'Status', render: r => statusPill(r.status) },
        { k: 'scheduled_at',  label: 'Scheduled', render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.scheduled_at)}</span>` },
        { k: 'sent_at',       label: 'Sent', render: r => r.sent_at ? `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-secondary);">${fmtTime(r.sent_at)}</span>` : '<span class="muted">—</span>' },
        { k: 'actions',       label: '', render: r => r.status === 'queued'
            ? `<div class="row-actions"><button class="btn-approve" data-email-send="${r.id}">Send now</button><button data-act="open-drawer" data-case="email" data-id="${r.id}">View</button></div>`
            : `<div class="row-actions"><button data-act="open-drawer" data-case="email" data-id="${r.id}">View</button></div>` }
      ]
    },
    escalations: {
      columns: [
        { k: 'id',           label: '#',       render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'case_type',    label: 'Case',    render: r => `<span class="pill pill-purple">${escapeHtml(r.case_type)} #${r.case_id}</span>` },
        { k: 'from_level',   label: 'From',    render: r => `<span class="pill pill-neutral">${escapeHtml(r.from_level)}</span>` },
        { k: 'to_level',     label: 'To',      render: r => `<span class="pill pill-pink">${escapeHtml(r.to_level)}</span>` },
        { k: 'reason',       label: 'Reason',  render: r => `<div style="max-width:320px;font-size:0.88rem;">${escapeHtml(r.reason || '—')}</div>` },
        { k: 'escalated_by', label: 'By',      render: r => escapeHtml(r.escalated_by || '—') },
        { k: 'escalated_at', label: 'When',    render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.escalated_at)}</span>` }
      ]
    },
    notes: {
      columns: [
        { k: 'id',         label: '#',       render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'case_type',  label: 'Case',    render: r => `<span class="pill pill-purple">${escapeHtml(r.case_type)} #${r.case_id}</span>` },
        { k: 'author',     label: 'Author',  render: r => escapeHtml(r.author || '—') },
        { k: 'body',       label: 'Note',    render: r => `<div style="max-width:480px;font-size:0.88rem;">${escapeHtml((r.body||'').slice(0,180))}${(r.body||'').length>180?'…':''}</div>` },
        { k: 'visibility', label: 'Visibility', render: r => `<span class="pill pill-neutral">${escapeHtml(r.visibility)}</span>` },
        { k: 'created_at', label: 'When',    render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` }
      ]
    },
    activity: {
      columns: [
        { k: 'id',          label: '#', render: r => `<span style="font-family:'JetBrains Mono',monospace;color:var(--text-muted);">#${r.id}</span>` },
        { k: 'created_at',  label: 'Time',  render: r => `<span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted);">${fmtTime(r.created_at)}</span>` },
        { k: 'actor_id',    label: 'Actor', render: r => `<div><strong>${escapeHtml(r.actor_id || '—')}</strong></div><div class="muted" style="font-size:0.78rem;">${escapeHtml(r.actor_type || '')}</div>` },
        { k: 'action',      label: 'Action', render: r => `<span class="pill pill-purple">${escapeHtml(r.action)}</span>` },
        { k: 'target',      label: 'Target', render: r => r.target_type ? `${escapeHtml(r.target_type)} #${r.target_id}` : '—' },
        { k: 'metadata',    label: 'Metadata', render: r => `<div style="max-width:340px;font-size:0.78rem;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.metadata || '—')}</div>` }
      ]
    }
  };

  async function renderTable(holder) {
    const source = holder.dataset.tableSource;
    const tplKey = holder.dataset.tableTemplate;
    const tplCfg = TEMPLATES[tplKey];
    if (!tplCfg) {
      holder.innerHTML = `<div style="padding:24px;" class="muted">No renderer for ${tplKey}.</div>`;
      return;
    }
    const tpl = tplCfg.reuse ? TEMPLATES[tplCfg.reuse] : tplCfg;
    const data = await api(source);
    const rows = (data && data.rows) || [];
    holder.innerHTML = `
      <table class="mgr-table"><thead><tr>
        ${tpl.columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}
      </tr></thead><tbody>
        ${rows.length === 0 ? `<tr><td colspan="${tpl.columns.length}" style="text-align:center;color:var(--text-muted);padding:42px;">No records yet.</td></tr>` :
          rows.map(r => `<tr>${tpl.columns.map(c => `<td data-col="${c.k}">${c.render(r)}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;

    // Row-level action buttons
    holder.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        handleRowAction(b);
      });
    });
    // Drawer-open buttons (also rows themselves via data-act=open-drawer)
    holder.querySelectorAll('[data-email-send]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.emailSend;
        const r = await api('/api/emails/' + id + '/send', { method: 'POST' });
        if (r.ok) { toast('Email sent ✓', 'success'); renderTable(holder); refreshDashboard(); }
        else toast(r.error || 'Failed', 'error');
      });
    });
  }

  async function handleRowAction(btn) {
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const endpoint = btn.dataset.endpoint;
    if (act === 'open-drawer') {
      openDrawer(btn.dataset.case, btn.dataset.id);
      return;
    }
    if (!endpoint) return;
    btn.disabled = true; btn.style.opacity = '0.5';
    const note = act === 'reject' ? (prompt(`Reason for ${act}?`) || '') : '';
    const r = await api('/api/' + endpoint + '/' + id + '/act', {
      method: 'POST',
      body: { action: act, note: note, by: 'admin_001' }
    });
    btn.disabled = false; btn.style.opacity = '1';
    if (r && r.ok) {
      toast('Case updated · new status: ' + (r.status || 'updated'), 'success');
      const wrap = btn.closest('[data-table-source]');
      if (wrap) renderTable(wrap);
      refreshDashboard();
    } else {
      toast('Failed: ' + (r && r.error || 'unknown'), 'error');
    }
  }

  /* ---------- Detail drawer (messaging + actions) ---------- */
  const drawer = $('#mgr-drawer');
  const drawerState = { case_type: null, case_id: null, user_email: null };
  $('#drawer-close').addEventListener('click', () => closeDrawer());
  $('#drawer-send').addEventListener('click', () => sendDrawerMessage());
  $('#drawer-add-note').addEventListener('click', () => addDrawerNote());
  $('#drawer-input').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendDrawerMessage(); });

  async function openDrawer(caseType, id) {
    drawerState.case_type = caseType;
    drawerState.case_id = id;
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');

    // Show meta + load thread (case meta depending on type)
    let url, item;
    if (caseType === 'ticket')    { url = '/api/tickets'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'complaint') { url = '/api/complaints'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'kyc') { url = '/api/kyc'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'deposit') { url = '/api/deposits'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'withdrawal') { url = '/api/withdrawals'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'refund') { url = '/api/refunds'; item = (await api(url)).rows.find(r => r.id == id); }
    else if (caseType === 'email') { url = '/api/emails'; item = (await api(url)).rows.find(r => r.id == id); }

    drawerState.user_email = item && item.user_email;

    const meta = $('#drawer-meta');
    const title = $('#drawer-title');
    if (item) {
      title.textContent = (caseType.charAt(0).toUpperCase() + caseType.slice(1)) + ' #' + id;
      const rows = [];
      for (const k of Object.keys(item)) {
        if (['id','user_id','password_hash','metadata'].includes(k)) continue;
        const v = item[k];
        const safe = (typeof v === 'string') ? escapeHtml(v) : escapeHtml(JSON.stringify(v));
        rows.push(`<div class="k">${escapeHtml(k)}</div><div>${safe}</div>`);
      }
      meta.innerHTML = rows.join('');
    }

    // Thread (messages)
    const thread = $('#drawer-convo');
    thread.innerHTML = '<div class="muted">Loading conversation…</div>';
    const msgs = (await api('/api/messages?case_type=' + caseType + '&case_id=' + id)).rows || [];
    thread.innerHTML = msgs.length === 0
      ? '<div class="muted" style="text-align:center;padding:18px;">No messages yet — start the conversation below.</div>'
      : msgs.map(m => `<div class="msg ${m.direction === 'admin' ? 'admin' : 'user'}">
          <div class="meta-line">${escapeHtml(m.sender_name || (m.direction === 'admin' ? 'Admin' : m.user_email || 'User'))} · ${fmtTime(m.created_at)}</div>
          ${escapeHtml(m.body)}
        </div>`).join('');
    thread.scrollTop = thread.scrollHeight;

    // Render actions bar
    const acts = $('#drawer-actions');
    acts.innerHTML = '';
    if (caseType === 'ticket' || caseType === 'complaint') {
      acts.innerHTML = `<button class="btn btn-purple btn-sm" data-drawer="escalate" data-from="L2" data-to="L3">Escalate L2→L3</button>
                        <button class="btn btn-hold btn-sm" data-drawer="escalate" data-from="L3" data-to="L4">Escalate L3→L4</button>`;
      acts.querySelectorAll('[data-drawer="escalate"]').forEach(b => b.addEventListener('click', () => doEscalation(b.dataset.from, b.dataset.to)));
    }
  }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); drawerState.case_type = null; drawerState.case_id = null; drawerState.user_email = null; }

  async function sendDrawerMessage() {
    const input = $('#drawer-input');
    const body = (input.value || '').trim();
    if (!body) return;
    const r = await api('/api/messages', {
      method: 'POST',
      body: {
        case_type: drawerState.case_type, case_id: drawerState.case_id,
        body: body, direction: 'admin', sender_name: 'Maya R.',
        user_id: 0  // backend will pull user via join (we embed email in meta)
      }
    });
    if (r && r.ok) {
      input.value = '';
      // Re-append visual + scroll
      const thread = $('#drawer-convo');
      const m = document.createElement('div'); m.className = 'msg admin';
      m.innerHTML = `<div class="meta-line">Maya R. · just now</div>${escapeHtml(body)}`;
      thread.appendChild(m);
      thread.scrollTop = thread.scrollHeight;
      toast('Message sent ✓', 'success');
    } else toast('Send failed', 'error');
  }

  async function addDrawerNote() {
    const body = prompt('Internal note (visible to admins only):', '');
    if (!body) return;
    const r = await api('/api/notes', {
      method: 'POST',
      body: { case_type: drawerState.case_type, case_id: drawerState.case_id, body: body, author: 'Maya R.' }
    });
    if (r && r.ok) { toast('Note added · internal only', 'info'); }
    else toast('Failed', 'error');
  }

  async function doEscalation(from, to) {
    const reason = prompt('Reason for escalation:', '');
    if (!reason) return;
    const r = await api('/api/escalations', {
      method: 'POST',
      body: { case_type: drawerState.case_type, case_id: drawerState.case_id, from_level: from, to_level: to, reason, escalated_by: 'Maya R.' }
    });
    if (r && r.ok) { toast('Case escalated to ' + to, 'info'); closeDrawer(); if (location.hash === '#escalations') renderTable(document.querySelector('[data-pane-content="escalations"] [data-table-source]')); }
    else toast('Failed', 'error');
  }

  /* ---------- User Communication hub ---------- */
  let activeComm = null;
  async function renderCommsList() {
    const list = $('#comms-list');
    const data = await api('/api/cases');
    const rows = (data.rows || []).filter(r => r.user_email);
    list.innerHTML = rows.slice(0, 30).map(r => `
      <div class="list-row" style="cursor:pointer;" data-comm-case="ticket" data-comm-id="${r.id}" data-comm-email="${escapeHtml(r.user_email)}">
        <div class="avatar">${initials(r.user_name || r.user_email)}</div>
        <div class="meta-line">
          <div class="name">${escapeHtml(r.user_name || 'User')}</div>
          <div class="email">${escapeHtml(r.user_email)}</div>
        </div>
        <span class="net-badge">${escapeHtml(r.subject)}</span>
      </div>`).join('') || '<div class="muted" style="padding:14px;">No cases to message.</div>';

    list.querySelectorAll('[data-comm-case]').forEach(el => el.addEventListener('click', () => loadCommThread(el)));
  }
  async function loadCommThread(el) {
    activeComm = { case_type: 'ticket', case_id: el.dataset.commId, email: el.dataset.commEmail };
    $('#comms-title').textContent = el.querySelector('.name').textContent;
    $('#comms-sub').textContent = el.dataset.commEmail;
    $('#comms-send').disabled = false;
    const thread = $('#comms-thread');
    thread.innerHTML = '<div class="muted">Loading thread…</div>';
    const data = await api('/api/messages?case_type=ticket&case_id=' + el.dataset.commId);
    const msgs = (data && data.rows) || [];
    thread.innerHTML = msgs.length === 0
      ? '<div class="muted" style="text-align:center;padding:18px;">No messages yet.</div>'
      : msgs.map(m => `<div class="msg ${m.direction === 'admin' ? 'admin' : 'user'}"><div class="meta-line">${escapeHtml(m.sender_name || (m.direction === 'admin' ? 'Admin' : m.user_email || 'User'))}</div>${escapeHtml(m.body)}</div>`).join('');
    thread.scrollTop = thread.scrollHeight;
  }
  $('#comms-send').addEventListener('click', async () => {
    if (!activeComm) return;
    const body = $('#comms-input').value.trim();
    if (!body) return;
    const r = await api('/api/messages', { method: 'POST', body: { case_type: activeComm.case_type, case_id: activeComm.case_id, body, direction: 'admin', sender_name: 'Maya R.' } });
    if (r && r.ok) {
      $('#comms-input').value = '';
      const thread = $('#comms-thread');
      const m = document.createElement('div'); m.className = 'msg admin';
      m.innerHTML = `<div class="meta-line">Maya R. · just now</div>${escapeHtml(body)}`;
      thread.appendChild(m);
      thread.scrollTop = thread.scrollHeight;
      toast('Sent ✓', 'success');
    } else toast('Failed', 'error');
  });

  /* ---------- Financial reports ---------- */
  async function renderReports() {
    const kind = $('#report-kind').value;
    const data = await api('/api/reports?kind=' + kind);
    const rows = (data.rows || []);
    const tableEl = $('#report-table');
    tableEl.innerHTML = `<table class="mgr-table"><thead><tr><th>Metric</th><th>Count</th><th>Amount (USDT)</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><strong>${escapeHtml(r.metric)}</strong></td><td>${fmtNum(r.count)}</td><td style="color:var(--accent-gold);font-family:'JetBrains Mono',monospace;">${fmtMoney(r.amount_usdt)}</td></tr>`).join('')}
    </tbody></table>`;
    const barsEl = $('#report-bars');
    const max = Math.max(...rows.map(r => Number(r.count) || Number(r.amount_usdt) || 1));
    barsEl.innerHTML = rows.map(r => {
      const value = Number(r.count) || Number(r.amount_usdt) || 0;
      const w = Math.max(8, Math.round((value / max) * 100));
      return `<div class="bar-row">
        <div class="lab">${escapeHtml(r.metric.replace(/_/g, ' '))}</div>
        <div class="bar"><div style="width:${w}%;"></div></div>
        <div class="num">${fmtNum(value)}</div>
      </div>`;
    }).join('');
  }
  $('#report-kind').addEventListener('change', renderReports);

  /* ---------- "New refund" + "Compose email" modal-ish popups ---------- */
  $('#new-refund-btn').addEventListener('click', async () => {
    const userId = parseInt(prompt('User ID (from /api/users):', '1') || '0', 10);
    if (!userId) return;
    const amount = parseFloat(prompt('Refund amount (USDT):', '159') || '0');
    if (!amount) return;
    const reason = prompt('Reason:', 'Customer request') || '';
    const r = await api('/api/refunds', { method: 'POST', body: { user_id: userId, amount_usdt: amount, reason, admin_id: 'admin_001' } });
    if (r && r.ok) { toast('Refund queued · status: pending', 'success'); renderTable(document.querySelector('[data-pane-content="refunds"] [data-table-source]')); refreshDashboard(); }
    else toast('Failed', 'error');
  });
  $('#new-email-btn').addEventListener('click', async () => {
    const to = prompt('Recipient email:', '');
    if (!to) return;
    const subject = prompt('Subject:', 'Update on your Growx account') || '';
    const body    = prompt('Body:', 'Hello, this is Maya from Growx support. Reaching out regarding your account…') || '';
    const r = await api('/api/emails', { method: 'POST', body: { to_email: to, subject, body, template: 'manual' } });
    if (r && r.ok) { toast('Email queued', 'info'); renderTable(document.querySelector('[data-pane-content="emails"] [data-table-source]')); refreshDashboard(); }
    else toast('Failed', 'error');
  });

  /* ---------- Live refresh ---------- */
  function refreshDashboard() { if (location.hash === '#dash' || !location.hash) renderDashboard(); }
  $('#refresh-btn').addEventListener('click', () => { renderDashboard(); toast('Refreshed', 'info', 1500); });
  setInterval(() => { $('#live-time').textContent = new Date().toLocaleTimeString(); }, 1000);
  setInterval(() => { refreshDashboard(); }, 12000);

  /* ---------- Initial load ---------- */
  const initial = (location.hash || '#dash').slice(1);
  showPane(['dash','deposits','withdrawals','verify','refunds','payments','tickets','complaints','kyc','comms','emails','reports','pending','resolved','escalations','notes','activity'].includes(initial) ? initial : 'dash');
  // Eagerly render visible pane
  if (initial === 'dash') renderDashboard();

  /* ---------- Simulate incoming live events so it feels alive ---------- */
  setInterval(async () => {
    try {
      await fetch(API + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'heartbeat', payload: { email: null, ts: Date.now() }, page: 'live_bg' })
      }).catch(()=>{});
    } catch (e) {}
  }, 30000);

})();
