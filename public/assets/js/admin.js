/* =========================================================
   Growx — Administrator Console JS
   --------------------------------------------------------
   - Mock data generator (offline-first demo)
   - Sidebar accordion + pane routing
   - Sortable / searchable / filterable / paginated tables
   - Chart.js visualizations (revenue, distribution, active,
     signups, tier, P&L, treasury, network splits)
   - User profile drawer
   - Action modal + toast system
   - Global Cmd-K command palette
   - CSV export + native print/PDF
   ========================================================= */

'use strict';

/* ----------------------------------------------------------------
   1. STATE + MOCK DATA
   ---------------------------------------------------------------- */

const FNX = {
  state: {
    activePane: 'dashboard',
    toastPause: 0,
    userDrawer: null,
    modal: null,
  },
  charts: {},            // chart.js instances
  pagination: {},       // per-table pagination cursor
  sort: {},              // { tableId: {col, dir} }
  data: {}
};

/* ---------- helpers ---------- */
const rand   = (min, max) => Math.random() * (max - min) + min;
const randi  = (min, max) => Math.floor(rand(min, max));
const choice = (arr)      => arr[randi(0, arr.length)];
const hash   = (n = 16)   => '0x' + Array.from({length:n}, () => Math.floor(Math.random()*16).toString(16)).join('');
const money  = (n)        => '$' + Number(Math.round(n)).toLocaleString();
const shortHash = (s, n = 8) => s ? s.slice(0, n) + '…' + s.slice(-4) : '—';

/* ---------- tier & plan definitions ---------- */
const TIERS = ['Lite', 'Stellar 1', 'Stellar 2', 'Orion Prime', 'Nebula Pro', 'Apex', 'Quantum'];
const TIER_PRICE = { 'Lite':89, 'Stellar 1':159, 'Stellar 2':289, 'Orion Prime':469, 'Nebula Pro':849, 'Apex':1499, 'Quantum':2199 };
const TIER_BALANCE = { 'Lite':'5,000', 'Stellar 1':'10,000', 'Stellar 2':'25,000', 'Orion Prime':'50,000', 'Nebula Pro':'100,000', 'Apex':'200,000', 'Quantum':'300,000' };
const STATUSES = ['active', 'suspended', 'frozen'];
const NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'Polygon', 'Arbitrum', 'Solana'];
const KYC_STATUS = ['approved', 'pending', 'rejected', 'unsubmitted'];
const COUNTRIES = ['United States','Sweden','Italy','India','United Kingdom','Japan','Brazil','United Arab Emirates','Germany','France','Canada','Spain','Singapore','Australia','Mexico','Netherlands','Poland','Switzerland'];

const USER_NAMES = [
  'Orion Hayashi','Sara Lindqvist','Marco Russo','Priya Iyer','Alex Bennett','Yuki Tanaka',
  'Carlos Mendes','Layla Mansour','Lukas Müller','Élodie Laurent','Diego Ramirez','Aiko Sato',
  'Hassan Ali','Maria Santos','Liam O\'Connor','Nadia Petrova','Ahmed Khan','Zoe Williams',
  'Felix Schröder','Anya Kuznetsova','Ben Carter','Ines Costa','Hiroto Yamada','Camille Roux',
  'Tom Andersson','Riya Sharma','Owen Wright','Sofia Romano','Khalid Yusuf','Petra Novak',
  'Ethan Cole','Maya Singh','Tobias Jensen','Chloé Dubois','Lucas Almeida','Ayesha Khan',
  'Akira Kim','Beatriz Silva','Erik Larsen','Linnea Berg','Noah Black','Beatrice Hall',
  'Oscar Nielsen','Tara Patel','Adam Kowalski','Maja Wiśniewska','Carl Bergström','Eva Lange'
];

/* ---------- generate USERS ---------- */
function generateUsers(n = 48) {
  const users = [];
  for (let i = 0; i < n; i++) {
    const name = USER_NAMES[i % USER_NAMES.length] + (i >= USER_NAMES.length ? ' ' + Math.floor(i / USER_NAMES.length + 2) : '');
    const tier = TIERS[randi(0, TIERS.length)];
    const balStr = TIER_BALANCE[tier];
    const balance = parseInt(balStr.replace(/,/g, ''));
    const depositCount = randi(1, 5);
    const totalDeposits = TIER_PRICE[tier] * depositCount;
    const totalWithdrawals = i % 3 === 0 ? randi(0, balance * 0.4) : 0;
    const profitSplitVal = tier === 'Lite' ? 80 : tier === 'Stellar 1' ? 85 : tier === 'Stellar 2' ? 88 : 90;
    const statuses = i % 11 === 0 ? 'suspended' : (i % 13 === 0 ? 'frozen' : 'active');
    const kyc = i % 5 === 0 ? 'pending' : (i % 7 === 0 ? 'pending' : (i % 17 === 0 ? 'rejected' : (i >= 5 ? 'approved' : 'unsubmitted')));
    const joinedDays = randi(1, 240);
    const lastLoginMin = randi(0, 60 * 24);

    users.push({
      id: i + 1001,
      name,
      email: name.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.') + '@' + choice(['example.com','gmail.com','outlook.com','trader.io','mail.com']),
      country: choice(COUNTRIES),
      country_code: choice(['+1','+46','+39','+91','+44','+81','+55','+971','+49','+33','+52','+34','+65','+61','+48','+41']),
      phone: randi(100000000, 999999999).toString(),
      tier,
      balance,
      balance_str: '$,' + balStr,
      status: statuses,
      kyc,
      joined_at: new Date(Date.now() - joinedDays * 24 * 3600 * 1000).toISOString().slice(0, 10),
      last_login: new Date(Date.now() - lastLoginMin * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
      login_count: randi(3, 380),
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
      profit_split: profitSplitVal,
      realized_pnl: randi(-8000, 60000),
      volume_lots: randi(0, 1800),
    });
  }
  return users.sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- generate TRANSACTIONS ---------- */
function generateTransactions(users, n = 220) {
  const txns = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const u = choice(users);
    const kind = choice(['deposit', 'withdrawal', 'refund']);
    const amount = kind === 'deposit' ? TIER_PRICE[u.tier] : randi(120, Math.max(500, u.balance / 8));
    const network = choice(NETWORKS);
    const statusMap = {
      deposit:    choice(['verified','verified','verified','pending_verification','rejected']),
      withdrawal: choice(['approved','approved','pending','rejected']),
      refund:     choice(['completed','completed','pending','approved'])
    };
    const status = statusMap[kind];
    const minutesAgo = randi(1, 90 * 24 * 60);
    txns.push({
      id: i + 90000,
      kind,
      user_id: u.id,
      user_name: u.name,
      user_email: u.email,
      amount,
      network,
      tx_hash: hash(28),
      status,
      created_at: new Date(now - minutesAgo * 60 * 1000).toISOString().replace('T',' ').slice(0, 19),
    });
  }
  return txns.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ---------- generate KYC ---------- */
function generateKyc(users) {
  const docs = ['passport', 'id_card', 'drivers'];
  return users.filter(u => u.kyc !== 'unsubmitted').map((u, i) => ({
    id: i + 8000,
    user_id: u.id,
    user_name: u.name,
    user_email: u.email,
    country: u.country,
    doc_type: choice(docs),
    doc_number: '' + randi(10000000, 99999999),
    full_name: u.name,
    submitted_at: new Date(Date.now() - randi(1, 72) * 3600 * 1000).toISOString().slice(0, 10),
    reviewed_at: u.kyc === 'pending' ? null : new Date(Date.now() - randi(1, 24) * 3600 * 1000).toISOString().slice(0, 10),
    status: u.kyc,
    review_hours: u.kyc === 'pending' ? null : randi(2, 18),
    reviewer: u.kyc === 'pending' ? null : 'Dana A.',
    notes: u.kyc === 'rejected' ? 'Image blurry — please reupload' : null,
  }));
}

/* ---------- LOGINS ---------- */
function generateLogins(users, n = 220) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const u = choice(users);
    out.push({
      id: i + 60000,
      user_name: u.name,
      user_email: u.email,
      ip: `${randi(20, 220)}.${randi(0, 255)}.${randi(0, 255)}.${randi(0, 255)}`,
      country: u.country,
      device: choice(['Chrome 124 · macOS','Safari 17 · iOS','Firefox 121 · Win11','Edge 120 · Win11','Chrome 124 · Android','Safari 17 · macOS']),
      success: Math.random() > 0.05,
      when: new Date(now - randi(1, 30 * 24 * 60) * 60 * 1000).toISOString().replace('T',' ').slice(0, 19),
    });
  }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}

/* ---------- ACTIVITY ---------- */
function generateActivity(users, n = 60) {
  const verbs = [
    ['admin', 'Approved KYC for', 'kyc', 'k-tick', 'ap-success', 'Approved'],
    ['admin', 'Suspended account', 'user', 'k-lock', 'ap-error', 'Suspended'],
    ['admin', 'Approved funded account for', 'user', 'k-fund', 'ap-emerald', 'Funded'],
    ['admin', 'Reset password for', 'user', 'k-key', 'ap-info', 'Reset'],
    ['admin', 'Rejected challenge for', 'user', 'k-x', 'ap-warning', 'Rejected'],
    ['user',  'Submitted KYC: ', 'kyc', 'k-id', 'ap-info', 'Submitted'],
    ['user',  'Requested withdrawal of $', 'withdrawal', 'k-arrow-up', 'ap-info', 'Requested'],
    ['system','Auto-seeded payments ledger', null, 'k-db', 'ap-neutral', 'System'],
    ['admin', 'Composed announcement: ', 'announcement', 'k-megaphone', 'ap-purple', 'Composed'],
    ['admin', 'Exported compliance report', 'report', 'k-export', 'ap-info', 'Exported'],
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = choice(verbs);
    const u = choice(users);
    const subject = v[2] ? (u.name + (v[1].endsWith('$') ? '' : '')) : '';
    const amountSuffix = v[1].endsWith('$') ? randi(120, 8000) : '';
    out.push({
      id: i,
      actor: v[0],
      action: v[1],
      target: subject,
      target_kind: v[2],
      suffix: amountSuffix,
      icon: v[3],
      pill: v[4],
      tag: v[5],
      when: new Date(Date.now() - randi(1, 14 * 24 * 60) * 60 * 1000).toISOString().replace('T',' ').slice(0, 19),
      meta: u.email,
    });
  }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}

/* ---------- CHALLENGES ---------- */
function generateChallenges(users) {
  return users.filter((u, i) => i % 4 !== 0).map((u, i) => ({
    id: 7000 + i,
    user_id: u.id,
    user_name: u.name,
    tier: u.tier,
    login: 'MT5-' + randi(1000000, 9999999),
    target_dd_daily: u.tier === 'Lite' ? '5%' : ['Stellar 1','Stellar 2'].includes(u.tier) ? '4%' : ['Orion Prime','Nebula Pro'].includes(u.tier) ? '3%' : u.tier === 'Apex' ? '2.5%' : '2%',
    target_dd_total: u.tier === 'Lite' ? '10%' : ['Stellar 1','Stellar 2'].includes(u.tier) ? '8%' : ['Orion Prime','Nebula Pro'].includes(u.tier) ? '6%' : u.tier === 'Apex' ? '5%' : '4%',
    current_dd_daily: (randi(0, 50) / 10).toFixed(1) + '%',
    current_dd_total: (randi(0, 90) / 10).toFixed(1) + '%',
    progress_pct: randi(15, 100),
    status: i % 5 === 0 ? 'awaiting_review' : (i % 9 === 0 ? 'failed' : 'in_progress'),
    phase: 'Phase 1',
    started_at: new Date(Date.now() - randi(1, 30) * 24 * 3600 * 1000).toISOString().slice(0,10),
  }));
}

/* ---------- TRADING ACCOUNTS ---------- */
function generateTradingAccounts() {
  const list = [];
  FNX.data.users.forEach((u, i) => {
    if (u.kyc !== 'approved') return;
    const acctType = i % 4 === 0 ? 'challenge' : (i % 4 === 1 ? 'funded' : (i % 4 === 2 ? 'breached' : 'inactive'));
    list.push({
      id: 5000 + i,
      user_name: u.name,
      user_email: u.email,
      type: acctType,
      tier: u.tier,
      login: 'MT5-' + randi(1000000, 9999999),
      leverage: choice(['1:30','1:50','1:100','1:200']),
      balance: u.balance + randi(-2000, 8000),
      equity_pct: randi(0, 100),
      open_pnl: randi(-2000, 5000),
      trades: randi(0, 280),
      last_trade: new Date(Date.now() - randi(0, 30 * 24 * 60) * 60 * 1000).toISOString().slice(0,10),
    });
  });
  return list;
}

/* ---------- NOTIFICATIONS (inbox + drafts) ---------- */
function generateNotifications() {
  return [
    { id: 1, title: '3 KYC documents pending > 12h',         body: 'Sara Lindqvist, Priya Iyer, Orion Hayashi KYC is overdue.',                kind: 'kyc',         when: '4m ago',   unread: true },
    { id: 2, title: 'Withdrawal queue spike ($12,400)',       body: '5 withdrawals batched from Alex Bennett, Marco Russo, +3',               kind: 'payout',      when: '18m ago',  unread: true },
    { id: 3, title: 'Stellar 2 challenge pass rate +6%',     body: 'Conversion improved — 64% (vs 58% last week).',                            kind: 'analytics',   when: '1h ago',   unread: true },
    { id: 4, title: 'Announcement sent: Weekend maintenance', body: 'Successfully delivered to 1,284 active users.',                          kind: 'announce',    when: '3h ago',   unread: false },
    { id: 5, title: 'Suspicious login cluster from TR',       body: '4 logins in 12 minutes from same /24 subnet. Reviewing.',                kind: 'security',    when: '6h ago',   unread: false },
    { id: 6, title: 'Treasury bridge synced',                body: 'Polygon → TRC20 sweep completed. $48k USDT settled.',                     kind: 'system',      when: '12h ago',  unread: false },
  ];
}

const ANNOUNCEMENT_TEMPLATES = {
  maintenance:  { title: 'Scheduled Maintenance — ', channel: 'all', body: 'Heads up — we\'re performing platform maintenance in 30 minutes. Trading will pause for ~15 minutes.' },
  'new-feature':{ title: 'New Feature Live — ',         channel: 'all', body: 'We just rolled out a new dashboard widget. Check your account overview for the latest metrics.' },
  'terms-update':{ title: 'Terms Update — ',             channel: 'all', body: 'We\'ve updated the platform terms effective immediately. Please review the latest terms.html.' },
  'market-alert':{ title: 'Market Alert — ',             channel: 'funded', body: 'High-impact news in 10 minutes. Consider tightening stops on funded positions.' },
};

/* ---------- boot data ---------- */
FNX.data.users        = generateUsers(48);
FNX.data.transactions = generateTransactions(FNX.data.users, 220);
FNX.data.kyc          = generateKyc(FNX.data.users);
FNX.data.logins       = generateLogins(FNX.data.users, 220);
FNX.data.activity     = generateActivity(FNX.data.users, 60);
FNX.data.challenges   = generateChallenges(FNX.data.users);
FNX.data.trading      = generateTradingAccounts();
FNX.data.notifications= generateNotifications();

/* ----------------------------------------------------------------
   2. SIDEBAR ACCORDION + PANE ROUTING
   ---------------------------------------------------------------- */
function setupSidebar() {
  document.querySelectorAll('.adm-acc-head').forEach(h => {
    h.addEventListener('click', () => {
      const acc = h.parentElement;
      // multi-open accordion
      acc.classList.toggle('open');
    });
  });

  document.querySelectorAll('.adm-nav-item').forEach(it => {
    it.addEventListener('click', () => {
      const pane = it.dataset.pane;
      switchPane(pane);
      // open its parent accordion
      const acc = it.closest('.adm-acc');
      if (acc && !acc.classList.contains('open')) acc.classList.add('open');
      // ensure mobile responsive (close sidebar if open on small)
    });
  });
}

function switchPane(pane) {
  FNX.state.activePane = pane;
  document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.toggle('active', n.dataset.pane === pane));
  document.querySelectorAll('.adm-pane').forEach(p => p.classList.toggle('active', p.dataset.paneContent === pane));
  // Lazy-init the pane (charts etc.)
  initPane(pane);
  // Reset pagination
  Object.keys(FNX.pagination).forEach(k => FNX.pagination[k] = 0);
}

/* ----------------------------------------------------------------
   3. PANE INITIALIZATION
   ---------------------------------------------------------------- */
function initPane(pane) {
  const runner = {
    dashboard:            () => renderDashboard(),
    all_users:            () => renderAllUsers(),
    user_profiles:        () => renderUserProfiles(),
    user_search:          () => renderUserSearch(),
    suspend:              () => renderSuspend(),
    freeze:               () => renderFreeze(),
    'reset-pw':           () => renderResetPw(),
    login_activity:       () => renderLoginActivity(),
    user_analytics:       () => renderUserAnalytics(),
    trading:              () => renderTrading(),
    challenge:            () => renderChallenge(),
    funded:               () => renderFunded(),
    challenge_approval:   () => renderChallengeApproval(),
    funded_approval:      () => renderFundedApproval(),
    trading_mgmt:         () => renderTradingMgmt(),
    trading_reports:      () => renderTradingReports(),
    kyc:                  () => renderKyc(),
    audit_logs:           () => renderAuditLogs(),
    txn_history:          () => renderTxnHistory(),
    depwd_overview:       () => renderDepwdOverview(),
    pending_payments:     () => renderPendingPayments(),
    revenue:              () => renderRevenue(),
    funds_collected:      () => renderFundsCollected(),
    funds_distributed:    () => renderFundsDistributed(),
    company_balance:      () => renderCompanyBalance(),
    pnl:                  () => renderPnl(),
    financial_reports:    () => renderFinancialReports(),
    exports:              () => {/* static — no render needed */},
    activity:             () => renderActivityLogs(),
    notifications:        () => renderNotificationsPane(),
  };
  if (runner[pane]) runner[pane]();
}

/* ----------------------------------------------------------------
   4. DASHBOARD
   ---------------------------------------------------------------- */
function renderDashboard() {
  // KPIs
  const users = FNX.data.users;
  const activeFunded = users.filter(u => u.kyc === 'approved' && ['Stellar 1','Stellar 2','Orion Prime','Nebula Pro','Apex','Quantum'].includes(u.tier)).length;
  const suspended = users.filter(u => u.status === 'suspended').length;
  const frozen = users.filter(u => u.status === 'frozen').length;
  const kycPending = users.filter(u => u.kyc === 'pending').length;

  el('#kpi-users').textContent = users.length.toLocaleString();
  el('#kpi-funded').textContent = activeFunded.toLocaleString();
  el('#kpi-suspended').textContent = suspended.toLocaleString();
  el('#kpi-frozen').textContent = frozen.toLocaleString();
  el('#kpi-kyc').textContent = kycPending.toLocaleString();

  const txns = FNX.data.transactions;
  const depVerified = txns.filter(t => t.kind === 'deposit' && t.status === 'verified').reduce((s, t) => s + t.amount, 0);
  el('#kpi-revenue').firstElementChild.textContent = Math.round(depVerified).toLocaleString();

  const wdPending = txns.filter(t => t.kind === 'withdrawal' && t.status === 'pending');
  el('#kpi-withdrawals').textContent = wdPending.length.toLocaleString();
  el('#kpi-withdrawals-usd').textContent = wdPending.reduce((s, t) => s + t.amount, 0).toLocaleString();

  // Stable values: derived at boot from totals, fixed so they don't flicker on re-renders.
  if (!FNX.counters) {
    FNX.counters = {
      passed24h: Math.max(2, Math.round(activeFunded * 0.08)),
      tickets:   Math.max(3, Math.round(users.length * 0.04)),
      pendingPay:FNX.data.transactions.filter(t => (t.kind === 'deposit' && t.status === 'pending_verification') || (t.kind === 'withdrawal' && t.status === 'pending')).length
    };
  }
  el('#kpi-passed').textContent = FNX.counters.passed24h;
  el('#kpi-tickets').textContent = FNX.counters.tickets;

  // Sidebar counts
  el('#users-count').textContent = users.length;

  // Clock
  const updClock = () => {
    const d = new Date();
    el('#dash-clock').textContent = d.toUTCString().slice(17, 25) + ' UTC';
  };
  updClock();
  clearInterval(window.__dashClock);
  window.__dashClock = setInterval(updClock, 1000);

  // Build charts
  if (typeof Chart === 'undefined') return; // CDN failed; silently skip
  buildChartRevenue();
  buildChartDistribution();
  buildChartActive();
  buildDashRecentFeed();
}

function buildChartRevenue() {
  const ctx = el('#chart-revenue').getContext('2d');
  if (FNX.charts.revenue) FNX.charts.revenue.destroy();
  const labels = Array.from({length: 30}, (_, i) => `D-${29 - i}`);
  const revData = labels.map(() => randi(2000, 20000));
  const payData = labels.map((_, i) => Math.round(revData[i] * rand(0.3, 0.6)));
  const net = labels.map((_, i) => revData[i] - payData[i]);

  FNX.charts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Revenue',  data: revData, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.18)', fill: true, tension: 0.35, borderWidth: 2 },
        { label: 'Payouts',  data: payData, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.10)', fill: true, tension: 0.35, borderWidth: 2 },
        { label: 'Net',      data: net,     borderColor: '#10b981', backgroundColor: 'transparent', borderDash: [4,4], borderWidth: 2, fill: false, tension: 0.35 },
      ]
    },
    options: chartOpts({ legend: true })
  });
}

function buildChartDistribution() {
  const ctx = el('#chart-distribution').getContext('2d');
  if (FNX.charts.distribution) FNX.charts.distribution.destroy();
  const accounts = FNX.data.trading;
  const buckets = { 'Challenge (active)': 0, 'Funded': 0, 'Breached': 0, 'Inactive': 0 };
  accounts.forEach(a => {
    if (a.type === 'challenge') buckets['Challenge (active)']++;
    else if (a.type === 'funded') buckets['Funded']++;
    else if (a.type === 'breached') buckets['Breached']++;
    else buckets['Inactive']++;
  });
  FNX.charts.distribution = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        data: Object.values(buckets),
        backgroundColor: ['#8b5cf6','#10b981','#ec4899','#06d4ff'],
        borderColor: 'rgba(8,8,26,0.9)',
        borderWidth: 3,
      }]
    },
    options: chartOpts({ legend: true, centerText: FNX.data.trading.length + ' total' })
  });
}

function buildChartActive() {
  const ctx = el('#chart-active').getContext('2d');
  if (FNX.charts.active) FNX.charts.active.destroy();
  const labels = Array.from({length: 14}, (_, i) => `D-${13 - i}`);
  const sess = labels.map(() => randi(450, 1800));
  FNX.charts.active = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Active sessions', data: sess, backgroundColor: labels.map((_, i) => i === sess.length - 1 ? '#06d4ff' : 'rgba(6,212,255,0.35)'), borderRadius: 6, maxBarThickness: 18 }],
    },
    options: chartOpts({})
  });
}

function buildDashRecentFeed() {
  const feed = el('#dash-recent');
  feed.innerHTML = FNX.data.activity.slice(0, 12).map(act => `
    <div class="feed-ev">
      <div class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${getActorColor(act.actor)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div class="body">
        <div class="act"><span class="adm-pill ${act.pill}" style="margin-right:6px;">${act.actor}</span><strong>${act.tag}</strong> ${act.action} ${act.target || ''} ${act.suffix ? '$' + act.suffix.toLocaleString() : ''}</div>
        <div class="when">${act.when} · <span style="color:var(--text-secondary);">${act.meta}</span></div>
      </div>
    </div>
  `).join('');
}

function chartOpts(opts = {}) {
  const dark = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: !!opts.legend, labels: { color: '#b4b4c8', boxWidth: 12, padding: 14, font: { family: 'Inter', size: 11 } } },
      tooltip: { backgroundColor: 'rgba(8,8,26,0.95)', borderColor: 'rgba(139,92,246,0.4)', borderWidth: 1, padding: 10, titleColor: '#fff', bodyColor: '#b4b4c8', cornerRadius: 8 },
    },
    scales: {
      x: { ticks: { color: '#6b6b85', font: { size: 10, family: 'JetBrains Mono' }, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#6b6b85', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true },
    },
  };
  if (opts.centerText) {
    dark.plugins.legend.display = true;
    dark.plugins.legend.position = 'right';
  }
  return dark;
}

function getActorColor(a) { return a === 'admin' ? '#a78bfa' : a === 'system' ? '#06d4ff' : '#10b981'; }

/* ----------------------------------------------------------------
   5. GENERIC TABLE RENDERER
   ---------------------------------------------------------------- */

function renderGenericTable(selector, rows, columns, opts = {}) {
  const tbl = el(selector);
  if (!tbl) return;
  const search = el(`[data-search-table="${opts.searchKey || guessKey(selector)}"]`);
  const filterElems = document.querySelectorAll(`[data-filter-table="${opts.filterKey || guessKey(selector)}"]`);

  const sortKey = `${opts.tableId || guessKey(selector)}`;
  if (!FNX.sort[sortKey]) FNX.sort[sortKey] = { col: null, dir: 'asc' };

  const apply = () => {
    let filtered = rows.slice();
    filterElems.forEach(f => {
      const key = f.dataset.filter;
      const v = f.value;
      if (!v) return;
      filtered = filtered.filter(r => {
        const val = r[key];
        return val !== undefined && String(val).toLowerCase() === v.toLowerCase();
      });
    });
    if (opts.searchKey) {
      const q = (search && search.value || '').toLowerCase().trim();
      if (q) filtered = filtered.filter(r => matchesQuery(r, q));
    }
    if (opts.tabKey) {
      const f = FNX._activeAcctTab || 'all';
      if (f !== 'all') filtered = filtered.filter(r => r.type === f);
    }
    const s = FNX.sort[sortKey];
    if (s.col) {
      filtered.sort((a, b) => {
        const A = a[s.col], B = b[s.col];
        if (typeof A === 'number' && typeof B === 'number') return s.dir === 'asc' ? A - B : B - A;
        return s.dir === 'asc' ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
      });
    }
    renderTableBody(tbl, filtered, columns, sortKey, opts);
    if (opts.after) opts.after(filtered);
  };
  apply();

  // Wire sort
  tbl.querySelectorAll('thead th[data-col]').forEach(th => {
    if (!th.dataset.col) return;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (FNX.sort[sortKey].col === col) FNX.sort[sortKey].dir = FNX.sort[sortKey].dir === 'asc' ? 'desc' : 'asc';
      else FNX.sort[sortKey] = { col, dir: 'asc' };
      apply();
    });
  });

  // Wire filters & search
  filterElems.forEach(f => f.addEventListener('input', apply));
  if (search) search.addEventListener('input', apply);

  // Pagination
  if (opts.pagination) {
    const cursor = `${sortKey}-cursor`;
    if (!FNX.pagination[cursor]) FNX.pagination[cursor] = 0;
    const pageSize = opts.pageSize || 12;
    const renderPager = (filtered) => {
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      FNX.pagination[cursor] = Math.min(FNX.pagination[cursor], pages - 1);
      const start = FNX.pagination[cursor] * pageSize;
      const slice = filtered.slice(start, start + pageSize);
      renderTableBody(tbl, slice, columns, sortKey, opts);
      const wrap = tbl.parentElement;
      let pager = wrap.querySelector('.adm-pager');
      if (!pager) {
        pager = document.createElement('div');
        pager.className = 'adm-pager';
        wrap.appendChild(pager);
      }
      pager.innerHTML = `
        <div>Showing ${total === 0 ? 0 : start + 1}–${Math.min(start + pageSize, total)} of <strong>${total}</strong></div>
        <div class="pg-pages">
          <button data-pg="prev" ${FNX.pagination[cursor] === 0 ? 'disabled' : ''}>‹</button>
          ${Array.from({length: pages}, (_, i) => `<span class="pg-num ${i === FNX.pagination[cursor] ? 'active' : ''}" data-pg="${i}">${i + 1}</span>`).join('')}
          <button data-pg="next" ${FNX.pagination[cursor] === pages - 1 ? 'disabled' : ''}>›</button>
        </div>
      `;
      pager.querySelectorAll('[data-pg]').forEach(b => {
        b.addEventListener('click', () => {
          const v = b.dataset.pg;
          if (v === 'prev') FNX.pagination[cursor] = Math.max(0, FNX.pagination[cursor] - 1);
          else if (v === 'next') FNX.pagination[cursor] = Math.min(pages - 1, FNX.pagination[cursor] + 1);
          else FNX.pagination[cursor] = parseInt(v, 10);
          apply();
        });
      });
      if (opts.after) opts.after(filtered);
    };
    const oldAfter = opts.after;
    opts = Object.assign(opts, { after: (f) => { if (oldAfter) oldAfter(f); renderPager(f); } });
    apply();
  }
}

function matchesQuery(r, q) {
  // Generic: concat all common string fields
  return ['name','email','country','tier','status','user_name','user_email','action','tx_hash','doc_number','ip','device']
    .some(k => r[k] !== undefined && String(r[k]).toLowerCase().includes(q));
}

function guessKey(sel) {
  return sel.replace('#tbl-', '').replace('#tbl_', '');
}

function renderTableBody(tbl, rows, columns, sortKey, opts) {
  const head = columns.map(c => `<th data-col="${c.col}" style="${c.width ? 'min-width:' + c.width : ''}">${c.label}${sortKey && FNX.sort[sortKey] && FNX.sort[sortKey].col === c.col ? '<span class="sort-arrow">' + (FNX.sort[sortKey].dir === 'asc' ? '↑' : '↓') + '</span>' : ''}</th>`).join('');
  if (!tbl.querySelector('thead')) tbl.innerHTML = '<thead>' + head + '</thead><tbody></tbody>';
  else tbl.querySelector('thead').innerHTML = head;

  const tbody = tbl.querySelector('tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td class="empty">No matching records</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => '<tr>' + columns.map(c => `<td class="${c.tdClass || ''}">${renderCell(c, r)}</td>`).join('') + '</tr>').join('');
}

function renderCell(c, r) {
  const v = typeof c.fmt === 'function' ? c.fmt(r[c.col], r) : (r[c.col] ?? '—');
  if (typeof v === 'string') return v;
  return v;
}

/* ----------------------------------------------------------------
   6. ALL 30 PANE RENDERERS
   ---------------------------------------------------------------- */

/* ===== USERS (3..10) ===== */

function userCell(u) {
  const ini = (u.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  return `<span class="usr-cell"><span class="mini-avatar">${ini}</span><div><div class="name">${u.name}</div><div class="sub">${u.email}</div></div></span>`;
}

function statusPill(s) {
  const map = { active: 'ap-emerald', suspended: 'ap-suspended', frozen: 'ap-frozen' };
  return `<span class="adm-pill ${map[s] || 'ap-neutral'}">${s}</span>`;
}

function kycPill(s) {
  const map = { approved: 'ap-success', pending: 'ap-warning', rejected: 'ap-error', unsubmitted: 'ap-neutral' };
  return `<span class="adm-pill ${map[s] || 'ap-neutral'}">${s}</span>`;
}

function renderAllUsers() {
  const cols = [
    { col:'user',     label:'User',     tdClass:'',    fmt:(_, r) => userCell(r), width:'220px' },
    { col:'country',  label:'Country',  tdClass:'mono' },
    { col:'tier',     label:'Tier',     tdClass:'',    fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'balance',  label:'Capital',  tdClass:'mono',fmt: v => '$' + v.toLocaleString() },
    { col:'total_deposits', label:'Deposits', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'kyc',      label:'KYC',                 fmt: v => kycPill(v) },
    { col:'status',   label:'Status',              fmt: v => statusPill(v) },
    { col:'last_login',label:'Last login', tdClass:'mono' },
    { col:'actions',  label:'Actions',             fmt: (_, r) => `<div class="row-actions">
        <button class="a-verify" data-action="open-user" data-id="${r.id}">Open</button>
      </div>` },
  ];
  renderGenericTable('#tbl-all-users', FNX.data.users, cols, {
    tableId:'all-users', searchKey:'all-users', filterKey:'all-users', pagination:true, pageSize:12,
    after:(rows)=>{ el('#all-users-count').textContent = rows.length.toLocaleString(); },
  });
}

function renderUserProfiles() {
  const cols = [
    { col:'user',  label:'User',  fmt:(_, r) => userCell(r), width:'220px' },
    { col:'id',    label:'ID',    tdClass:'mono' },
    { col:'kyc',   label:'KYC',   fmt: v => kycPill(v) },
    { col:'tier',  label:'Tier',  fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'login_count', label:'Logins', tdClass:'mono' },
    { col:'total_deposits', label:'Total deposits', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'realized_pnl', label:'Realized P&L', tdClass:'mono', fmt: v => (v >= 0 ? '<span style="color:var(--accent-emerald);">+$' : '<span style="color:var(--accent-pink);">-$</span>') + Math.abs(v).toLocaleString() },
    { col:'actions', label:'Profile', fmt: (_, r) => `<button class="a-verify" data-action="open-user" data-id="${r.id}">View →</button>` },
  ];
  renderGenericTable('#tbl-user-profiles', FNX.data.users, cols, {
    tableId:'user-profiles', searchKey:'user-profiles', filterKey:'user-profiles', pagination:true, pageSize:14,
  });
}

function renderUserSearch() {
  const cols = [
    { col:'user', label:'User', fmt:(_, r) => userCell(r), width:'220px' },
    { col:'country', label:'Country' },
    { col:'tier', label:'Tier', fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'balance', label:'Balance', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'status', label:'Status', fmt: v => statusPill(v) },
  ];
  // populate via advanced form
  const runBtn = el('#adv-search-run');
  const resetBtn = el('#adv-search-reset');
  runBtn.addEventListener('click', () => {
    const f = (id) => (el('#adv-q-' + id).value || '').toLowerCase().trim();
    const filters = { name:f('name'), email:f('email'), country:f('country'), tier:f('tier'), status:f('status'), balance:parseFloat(f('balance') || '0') };
    const filtered = FNX.data.users.filter(u => {
      if (filters.name && !u.name.toLowerCase().includes(filters.name)) return false;
      if (filters.email && !u.email.toLowerCase().includes(filters.email)) return false;
      if (filters.country && !u.country.toLowerCase().includes(filters.country)) return false;
      if (filters.tier && !u.tier.toLowerCase().includes(filters.tier)) return false;
      if (filters.status && u.status !== filters.status) return false;
      if (filters.balance && u.balance < filters.balance) return false;
      return true;
    });
    renderGenericTable('#tbl-user-search', filtered, cols, { pagination:true, pageSize:10 });
  });
  resetBtn.addEventListener('click', () => {
    ['name','email','country','tier','status','balance'].forEach(k => el('#adv-q-' + k).value = '');
    renderGenericTable('#tbl-user-search', FNX.data.users, cols, { pagination:true, pageSize:10 });
  });
  renderGenericTable('#tbl-user-search', FNX.data.users, cols, { pagination:true, pageSize:10 });
}

function renderSuspend() {
  const cols = [
    { col:'user', label:'User', fmt:(_, r) => userCell(r), width:'220px' },
    { col:'status', label:'Current status', fmt: v => statusPill(v) },
    { col:'login_count', label:'Logins', tdClass:'mono' },
    { col:'actions', label:'Actions', fmt: (_, r) => r.status === 'suspended'
        ? `<button class="a-approve" data-action="unsuspend" data-id="${r.id}">Unsuspend</button>`
        : `<button class="a-suspend" data-action="suspend" data-id="${r.id}">Suspend</button>` }
  ];
  renderGenericTable('#tbl-suspend', FNX.data.users, cols, {
    tableId:'suspend', searchKey:'suspend', pagination:true, pageSize:12,
    // IMPORTANT: badge counts come from the FULL user set, not the filtered/visible rows,
    // because the sidebar counter should reflect platform-wide totals regardless of
    // which filter the user picked on this pane.
    after:() => {
      const suspendedN = FNX.data.users.filter(u => u.status === 'suspended').length;
      document.getElementById('cnt-suspended').textContent = suspendedN;
      document.getElementById('suspend-active-count').textContent = suspendedN;
    }
  });
}

function renderFreeze() {
  const cols = [
    { col:'user', label:'User', fmt:(_, r) => userCell(r), width:'220px' },
    { col:'tier', label:'Tier', fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'balance', label:'Balance', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'status', label:'Status', fmt: v => statusPill(v) },
    { col:'actions', label:'Actions', fmt: (_, r) => r.status === 'frozen'
        ? `<button class="a-approve" data-action="unfreeze" data-id="${r.id}">Unfreeze</button>`
        : `<button class="a-hold" data-action="freeze" data-id="${r.id}">Freeze</button>` }
  ];
  renderGenericTable('#tbl-freeze', FNX.data.users, cols, {
    tableId:'freeze', searchKey:'freeze', pagination:true, pageSize:12,
    // Counts come from the full user set regardless of the active filter.
    after:() => {
      const frozenN = FNX.data.users.filter(u => u.status === 'frozen').length;
      document.getElementById('cnt-frozen').textContent = frozenN;
      document.getElementById('freeze-active-count').textContent = frozenN;
    }
  });
}

function renderResetPw() {
  const cols = [
    { col:'user', label:'User', fmt:(_, r) => userCell(r), width:'220px' },
    { col:'login_count', label:'Total logins', tdClass:'mono' },
    { col:'last_login', label:'Last login', tdClass:'mono' },
    { col:'actions', label:'Reset', fmt: (_, r) => `<button class="a-hold" data-action="reset-pw" data-id="${r.id}">Generate new password</button>` }
  ];
  renderGenericTable('#tbl-reset-pw', FNX.data.users, cols, {
    tableId:'reset-pw', searchKey:'reset-pw', pagination:true, pageSize:12,
    after:() => { document.getElementById('rspw-today').textContent = randi(2, 9); }
  });
}

function renderLoginActivity() {
  // heatmap (24 cells, randomness)
  const heat = el('#login-heatmap');
  heat.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const hour = (new Date().getUTCHours() - 23 + i + 24) % 24;
    const v = Math.max(1, Math.min(5, Math.round(Math.random() * (hour >= 8 && hour <= 20 ? 4 : 2) + 1)));
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.v = v;
    c.title = `Hour ${hour}:00 UTC · ${v * 60} logins`;
    heat.appendChild(c);
  }
  // countries top list
  const topCountries = {};
  FNX.data.logins.forEach(l => { topCountries[l.country] = (topCountries[l.country] || 0) + 1; });
  const sorted = Object.entries(topCountries).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...sorted.map(([, n]) => n));
  el('#login-countries').innerHTML = sorted.map(([c, n]) => `
    <div class="step"><span>${c}</span><div class="bar"><div class="fill" style="width:${(n / max * 100).toFixed(0)}%;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--text-secondary);">${n}</span></div>
  `).join('');

  const cols = [
    { col:'when', label:'Time', tdClass:'mono' },
    { col:'user_name', label:'User' },
    { col:'user_email', label:'Email', tdClass:'email' },
    { col:'ip', label:'IP', tdClass:'mono' },
    { col:'device', label:'Device' },
    { col:'country', label:'Country' },
    { col:'success', label:'Status', fmt: v => `<span class="adm-pill ${v ? 'ap-success' : 'ap-error'}">${v ? 'success' : 'failed'}</span>` },
  ];
  renderGenericTable('#tbl-login-activity', FNX.data.logins, cols, {
    tableId:'login-activity', searchKey:'login-activity', pagination:true, pageSize:14,
  });
}

function renderUserAnalytics() {
  if (typeof Chart === 'undefined') return;
  const ctx = el('#chart-signups').getContext('2d');
  if (FNX.charts.signups) FNX.charts.signups.destroy();
  const labels = Array.from({length: 60}, (_, i) => `D-${59 - i}`);
  const data = labels.map((_, i) => randi(0, 9) + Math.round(i * 0.15));
  FNX.charts.signups = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Signups', data, borderColor: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.2)', fill: true, tension: 0.35, borderWidth: 2 }] },
    options: chartOpts({})
  });

  const ctx2 = el('#chart-tier').getContext('2d');
  if (FNX.charts.tier) FNX.charts.tier.destroy();
  const tierCounts = {};
  TIERS.forEach(t => tierCounts[t] = 0);
  FNX.data.users.forEach(u => tierCounts[u.tier]++);
  FNX.charts.tier = new Chart(ctx2, {
    type: 'bar',
    data: { labels: TIERS, datasets: [{ label: 'Users', data: TIERS.map(t => tierCounts[t]), backgroundColor: TIERS.map(() => 'rgba(139,92,246,0.55)'), borderRadius: 6, maxBarThickness: 30 }] },
    options: chartOpts({})
  });

  // country funnel
  const countryCounts = {};
  FNX.data.users.forEach(u => countryCounts[u.country] = (countryCounts[u.country] || 0) + 1);
  const sortedC = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(...sortedC.map(([, n]) => n));
  el('#users-by-country').innerHTML = sortedC.map(([c, n], i) => `
    <div class="step"><span>${c}</span><div class="bar"><div class="fill" style="width:${(n / max * 100).toFixed(0)}%;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--text-secondary);">${n}</span></div>
  `).join('');
}

/* ===== ACCOUNTS (11..17) ===== */

const ACCT_COLS = () => [
  { col:'user_name', label:'User', fmt: (_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0] || 'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.user_email}</div></div></span>` },
  { col:'type', label:'Type', fmt: v => `<span class="adm-pill ${v === 'challenge' ? 'ap-purple' : v === 'funded' ? 'ap-emerald' : v === 'breached' ? 'ap-error' : 'ap-neutral'}">${v}</span>` },
  { col:'tier', label:'Tier' },
  { col:'login', label:'MT5 Login', tdClass:'mono' },
  { col:'leverage', label:'Leverage', tdClass:'mono' },
  { col:'balance', label:'Balance', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
  { col:'open_pnl', label:'Open P&L', tdClass:'mono', fmt: v => (v >= 0 ? '<span style="color:var(--accent-emerald);">+$' : '<span style="color:var(--accent-pink);">-$</span>') + Math.abs(v).toLocaleString() },
  { col:'trades', label:'Trades', tdClass:'mono' },
  { col:'last_trade', label:'Last trade', tdClass:'mono' },
  { col:'actions', label:'', fmt: (_, r) => `<button class="a-verify" data-action="open-trading" data-id="${r.id}">Manage</button>` },
];

function renderTrading() {
  renderGenericTable('#tbl-trading', FNX.data.trading, ACCT_COLS(), {
    tableId:'trading', searchKey:'trading', pagination:true, pageSize:10, tabKey:true,
    after:(rows)=>{
      document.getElementById('cnt-trading').textContent = FNX.data.trading.length;
    }
  });
  // NOTE: tab switching is wired ONCE in setupDelegatedEvents via event delegation.
  // Do not re-bind here — that would leak handlers and cause O(N²) renders.
}

function renderChallenge() {
  const cols = [
    { col:'user_name', label:'User', fmt:(_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0]||'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.tier}</div></div></span>`, width:'220px' },
    { col:'login', label:'MT5 Login', tdClass:'mono' },
    { col:'phase', label:'Phase', tdClass:'mono' },
    { col:'progress_pct', label:'Progress', tdClass:'mono', fmt: v => `<div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;"><div style="width:${v}%;height:100%;background:var(--grad-purple);border-radius:4px;"></div></div><span style="font-size:0.78rem;">${v}%</span></div>` },
    { col:'current_dd_total', label:'Total DD', tdClass:'mono' },
    { col:'target_dd_total', label:'Target DD', tdClass:'mono' },
    { col:'started_at', label:'Started', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ${v === 'awaiting_review' ? 'ap-warning' : v === 'failed' ? 'ap-error' : 'ap-info'}">${v.replace('_',' ')}</span>` },
    { col:'actions', label:'', fmt: (_, r) => `<div class="row-actions"><button class="a-approve" data-action="approve-challenge" data-id="${r.id}">Approve</button><button class="a-reject" data-action="reject-challenge" data-id="${r.id}">Reject</button></div>` },
  ];
  renderGenericTable('#tbl-challenge', FNX.data.challenges, cols, { tableId:'challenge', searchKey:'challenge', filterKey:'challenge', pagination:true, pageSize:12 });
}

function renderFunded() {
  const cols = [
    { col:'user_name', label:'User', fmt:(_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0]||'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.user_email}</div></div></span>`, width:'220px' },
    { col:'tier', label:'Tier', fmt: v => `<span class="adm-pill ap-emerald">${v}</span>` },
    { col:'login', label:'MT5 Login', tdClass:'mono' },
    { col:'leverage', label:'Leverage', tdClass:'mono' },
    { col:'balance', label:'Capital', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'open_pnl', label:'P&L', tdClass:'mono', fmt: v => (v >= 0 ? '<span style="color:var(--accent-emerald);">+$' : '<span style="color:var(--accent-pink);">-$</span>') + Math.abs(v).toLocaleString() },
    { col:'trades', label:'Trades', tdClass:'mono' },
    { col:'last_trade', label:'Last trade', tdClass:'mono' },
    { col:'actions', label:'', fmt: () => `<button class="a-verify" data-action="open-trading">Manage</button>` },
  ];
  const funded = FNX.data.trading.filter(a => a.type === 'funded');
  renderGenericTable('#tbl-funded', funded, cols, { tableId:'funded', searchKey:'funded', pagination:true, pageSize:12,
    after:(rows)=>{ document.getElementById('funded-count').textContent = rows.length; document.getElementById('funded-capital').textContent = rows.reduce((s,r)=>s+r.balance,0).toLocaleString(); } });
}

function renderChallengeApproval() {
  // derive from data.challenges with status awaiting_review OR in_progress near 100%
  const pending = FNX.data.challenges.filter(c => c.status === 'awaiting_review' || c.progress_pct >= 95).slice(0, 16);
  document.getElementById('chal-app-count').textContent = pending.length;
  document.getElementById('cnt-chal-app').textContent = pending.length;
  const cols = [
    { col:'user_name', label:'User', fmt:(_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0]||'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.tier}</div></div></span>` },
    { col:'tier', label:'Tier' },
    { col:'login', label:'MT5 Login', tdClass:'mono' },
    { col:'progress_pct', label:'Progress', tdClass:'mono', fmt: v => `<div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;"><div style="width:${v}%;height:100%;background:var(--grad-emerald,#10b981);border-radius:4px;"></div></div><span style="font-size:0.78rem;">${v}%</span></div>` },
    { col:'current_dd_total', label:'Total DD', tdClass:'mono' },
    { col:'target_dd_total', label:'Max DD', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ${v === 'awaiting_review' ? 'ap-warning' : 'ap-info'}">${v.replace('_',' ')}</span>` },
    { col:'actions', label:'', fmt: (_, r) => `<div class="row-actions"><button class="a-approve" data-action="approve-challenge" data-id="${r.id}">Approve & fund</button><button class="a-reject" data-action="reject-challenge" data-id="${r.id}">Reject</button></div>` },
  ];
  renderGenericTable('#tbl-challenge-approval', pending, cols, { tableId:'challenge-approval', pagination:true, pageSize:12 });
}

function renderFundedApproval() {
  const pending = FNX.data.users.filter(u => u.kyc === 'approved' && u.tier !== 'Lite').slice(0, 12);
  document.getElementById('funded-app-count').textContent = pending.length;
  document.getElementById('cnt-funded-app').textContent = pending.length;
  const cols = [
    { col:'user', label:'User', fmt:(_, r) => userCell(r) },
    { col:'tier', label:'Tier', fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'balance', label:'Capital to deploy', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'total_deposits', label:'Buyer deposit', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'kyc', label:'KYC', fmt: v => kycPill(v) },
    { col:'actions', label:'', fmt: (_, r) => `<div class="row-actions"><button class="a-approve" data-action="approve-funded" data-id="${r.id}">Approve → Fund</button><button class="a-reject" data-action="reject-funded" data-id="${r.id}">Reject</button></div>` },
  ];
  renderGenericTable('#tbl-funded-approval', pending, cols, { tableId:'funded-approval', pagination:true, pageSize:10 });
}

function renderTradingMgmt() {
  const cols = [
    { col:'user_name', label:'User', fmt:(_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0]||'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.tier}</div></div></span>` },
    { col:'login', label:'MT5 Login', tdClass:'mono' },
    { col:'leverage', label:'Leverage', tdClass:'mono' },
    { col:'balance', label:'Balance', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'trades', label:'Trades', tdClass:'mono' },
    { col:'actions', label:'', fmt: () => `<div class="row-actions"><button class="a-verify" data-action="reissue">Re-issue</button><button class="a-hold" data-action="set-leverage">Leverage</button><button class="a-reject" data-action="reset-dd">Reset DD</button></div>` },
  ];
  renderGenericTable('#tbl-trading-mgmt', FNX.data.trading.slice(0, 20), cols, { tableId:'trading-mgmt', pagination:true, pageSize:8 });
}

function renderTradingReports() {
  if (typeof Chart === 'undefined') return;
  // Volume leader
  const top = FNX.data.users.slice().sort((a, b) => b.volume_lots - a.volume_lots).slice(0, 8);
  const maxV = Math.max(...top.map(t => t.volume_lots));
  el('#volume-leader').innerHTML = top.map((t, i) => `
    <div class="step"><span style="width:140px;">${(i+1).toString().padStart(2,'0')}. ${t.name}</span><div class="bar"><div class="fill" style="width:${(t.volume_lots/maxV*100).toFixed(0)}%;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--text-secondary);">${t.volume_lots.toLocaleString()}</span></div>
  `).join('');

  // Profit factor chart
  const ctx = el('#chart-pf').getContext('2d');
  if (FNX.charts.pf) FNX.charts.pf.destroy();
  FNX.charts.pf = new Chart(ctx, {
    type: 'bar',
    data: { labels: TIERS, datasets: [{ label: 'Avg PF', data: TIERS.map(() => +(rand(0.8, 2.6)).toFixed(2)), backgroundColor: 'rgba(16, 185, 129, 0.6)', borderRadius: 6, maxBarThickness: 30 }] },
    options: chartOpts({})
  });

  const cols = [
    { col:'name', label:'Trader', fmt:(_, r) => userCell(r) },
    { col:'tier', label:'Tier', fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'volume_lots', label:'Lots', tdClass:'mono' },
    { col:'realized_pnl', label:'Realized P&L', tdClass:'mono', fmt: v => (v >= 0 ? '<span style="color:var(--accent-emerald);">+$' : '<span style="color:var(--accent-pink);">-$</span>') + Math.abs(v).toLocaleString() },
    { col:'profit_split', label:'Split', tdClass:'mono', fmt: v => v + '%' },
  ];
  renderGenericTable('#tbl-trading-reports', FNX.data.users.slice().sort((a,b)=>b.realized_pnl - a.realized_pnl).slice(0, 12), cols, { tableId:'trading-reports', pagination:true, pageSize:10 });
}

/* ===== COMPLIANCE (18..19) ===== */

function renderKyc() {
  document.getElementById('kyc-count').textContent = FNX.data.kyc.filter(k => k.status === 'pending').length;
  document.getElementById('cnt-kyc').textContent = FNX.data.kyc.filter(k => k.status === 'pending').length;
  document.getElementById('cnt-audit').textContent = FNX.data.activity.length;
  // funnel
  const fc = { submitted:0, under_review:0, approved:0, rejected:0, refunded:0 };
  FNX.data.kyc.forEach(k => { fc.submitted++; });
  fc.under_review = FNX.data.kyc.filter(k => k.status === 'pending').length;
  fc.approved = FNX.data.kyc.filter(k => k.status === 'approved').length;
  fc.rejected = FNX.data.kyc.filter(k => k.status === 'rejected').length;
  fc.refunded = Math.round(fc.rejected * 0.6);
  const order = [['Submitted', fc.submitted],['Under review', fc.under_review],['Approved', fc.approved],['Rejected', fc.rejected],['Refunded', fc.refunded]];
  const max = Math.max(...order.map(([,n]) => n));
  el('#kyc-funnel').innerHTML = order.map(([k, n]) => `
    <div class="step"><span style="color:var(--text-secondary);">${k}</span><div class="bar"><div class="fill" style="width:${(n/max*100).toFixed(0)}%;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--text-secondary);">${n}</span></div>
  `).join('');

  const cols = [
    { col:'user_name', label:'User', fmt:(_, r) => `<span class="usr-cell"><span class="mini-avatar">${(r.user_name[0]||'U')}</span><div><div class="name">${r.user_name}</div><div class="sub">${r.user_email}</div></div></span>` },
    { col:'doc_type', label:'Type', tdClass:'mono' },
    { col:'doc_number', label:'Doc #', tdClass:'mono' },
    { col:'country', label:'Country' },
    { col:'submitted_at', label:'Submitted', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => kycPill(v) },
    { col:'reviewer', label:'Reviewer', tdClass:'mono' },
    { col:'actions', label:'', fmt: (_, r) => r.status === 'pending'
        ? `<div class="row-actions"><button class="a-approve" data-action="kyc-approve" data-id="${r.id}">Approve</button><button class="a-reject" data-action="kyc-reject" data-id="${r.id}">Reject</button></div>`
        : `<button class="a-verify" data-action="kyc-view" data-id="${r.id}">View</button>` },
  ];
  renderGenericTable('#tbl-kyc', FNX.data.kyc, cols, { tableId:'kyc', searchKey:'kyc', filterKey:'kyc', pagination:true, pageSize:12 });
}

function renderAuditLogs() {
  const audit = FNX.data.activity.map((a, i) => ({
    id: i,
    when: a.when,
    level: a.actor === 'system' ? 'info' : (a.tag === 'Suspended' || a.tag === 'Rejected' ? 'warn' : 'info'),
    actor: a.actor,
    action: a.tag + ' ' + a.action + (a.target ? ' ' + a.target : '') + (a.suffix ? ' $' + a.suffix.toLocaleString() : ''),
    target: a.meta,
    page_url: 'admin.html'
  }));
  const cols = [
    { col:'when', label:'Time', tdClass:'mono' },
    { col:'level', label:'Level', fmt: v => `<span class="adm-pill ${v === 'warn' ? 'ap-warning' : v === 'error' ? 'ap-error' : v === 'critical' ? 'ap-pink' : 'ap-info'}">${v}</span>` },
    { col:'actor', label:'Actor', fmt: v => `<span class="adm-pill ap-purple">${v}</span>` },
    { col:'action', label:'Action' },
    { col:'target', label:'Target', tdClass:'email' },
    { col:'page_url', label:'Source', tdClass:'mono' },
  ];
  renderGenericTable('#tbl-audit-logs', audit, cols, { tableId:'audit-logs', searchKey:'audit-logs', filterKey:'audit-logs', pagination:true, pageSize:18 });
}

/* ===== FINANCE (20..29) ===== */

function renderTxnHistory() {
  const cols = [
    { col:'kind', label:'Kind', fmt: v => `<span class="adm-pill ${v === 'deposit' ? 'ap-emerald' : v === 'withdrawal' ? 'ap-pink' : 'ap-purple'}">${v}</span>` },
    { col:'user_email', label:'User', tdClass:'email' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
    { col:'tx_hash', label:'Hash / wallet', tdClass:'hash', fmt: v => shortHash(v, 14) },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ${v === 'verified' || v === 'approved' || v === 'completed' ? 'ap-success' : v === 'pending' || v === 'pending_verification' ? 'ap-warning' : 'ap-error'}">${v.replace('_',' ')}</span>` },
    { col:'created_at', label:'When', tdClass:'mono' },
  ];
  renderGenericTable('#tbl-txn-history', FNX.data.transactions, cols, { tableId:'txn-history', searchKey:'txn-history', filterKey:'txn-history', pagination:true, pageSize:14 });
}

function renderDepwdOverview() {
  const dep = FNX.data.transactions.filter(t => t.kind === 'deposit' && t.status === 'verified');
  const wd  = FNX.data.transactions.filter(t => t.kind === 'withdrawal' && t.status === 'approved');
  el('#dw-deposits-usd').textContent = dep.reduce((s,t)=>s+t.amount,0).toLocaleString();
  el('#dw-withdrawals-usd').textContent = wd.reduce((s,t)=>s+t.amount,0).toLocaleString();
  el('#dw-deposits-count').textContent = dep.length;
  el('#dw-withdrawals-count').textContent = wd.length;
  el('#dw-net').textContent = (dep.reduce((s,t)=>s+t.amount,0) - wd.reduce((s,t)=>s+t.amount,0)).toLocaleString();
  el('#dw-avg-deposit').textContent = Math.round(dep.reduce((s,t)=>s+t.amount,0) / Math.max(1,dep.length)).toLocaleString();

  if (typeof Chart === 'undefined') return;
  const ctx = el('#chart-flow').getContext('2d');
  if (FNX.charts.flow) FNX.charts.flow.destroy();
  const labels = Array.from({length: 30}, (_, i) => 'D-' + (29 - i));
  const depArr = labels.map(() => randi(2000, 22000));
  const wdArr = labels.map(() => randi(500, 9000));
  FNX.charts.flow = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Deposits', data: depArr, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4, maxBarThickness: 12 },
      { label: 'Withdrawals', data: wdArr, backgroundColor: 'rgba(236,72,153,0.7)', borderRadius: 4, maxBarThickness: 12 },
    ] },
    options: chartOpts({ legend:true })
  });

  // Mini tables
  const depCols = [
    { col:'created_at', label:'When', tdClass:'mono' },
    { col:'user_name', label:'User' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ap-success">${v}</span>` },
  ];
  renderGenericTable('#tbl-deposits-overview', dep, depCols, { pagination:true, pageSize:8 });
  const wdCols = [
    { col:'created_at', label:'When', tdClass:'mono' },
    { col:'user_name', label:'User' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ap-success">${v}</span>` },
  ];
  renderGenericTable('#tbl-withdrawals-overview', wd, wdCols, { pagination:true, pageSize:8 });
}

function renderPendingPayments() {
  const pending = FNX.data.transactions.filter(t => (t.kind === 'deposit' && t.status === 'pending_verification') || (t.kind === 'withdrawal' && t.status === 'pending'));
  document.getElementById('pending-pay-count').textContent = pending.length;
  document.getElementById('cnt-pending-pay').textContent = pending.length;
  const cols = [
    { col:'kind', label:'Kind', fmt: v => `<span class="adm-pill ${v === 'deposit' ? 'ap-info' : 'ap-warning'}">${v}</span>` },
    { col:'user_email', label:'User', tdClass:'email' },
    { col:'created_at', label:'Submitted', tdClass:'mono' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
    { col:'tx_hash', label:'Hash / Wallet', tdClass:'hash', fmt: v => shortHash(v, 16) },
    { col:'actions', label:'', fmt: (_, r) => `<div class="row-actions"><button class="a-approve" data-action="verify-txn" data-id="${r.id}">Verify</button><button class="a-reject" data-action="reject-txn" data-id="${r.id}">Reject</button></div>` },
  ];
  renderGenericTable('#tbl-pending-payments', pending, cols, { tableId:'pending-payments', pagination:true, pageSize:12 });
}

function renderRevenue() {
  const dep = FNX.data.transactions.filter(t => t.kind === 'deposit' && t.status === 'verified');
  const total = dep.reduce((s, t) => s + t.amount, 0);
  el('#rev-total').textContent = total.toLocaleString();
  el('#rev-deposits').textContent = dep.length;
  el('#rev-mrr').textContent = Math.round(total * 0.18).toLocaleString();
  el('#rev-arpu').textContent = Math.round(total / Math.max(1, FNX.data.users.length));

  if (typeof Chart === 'undefined') return;
  // by tier (stacked)
  const ctxA = el('#chart-rev-tier').getContext('2d');
  if (FNX.charts.revTier) FNX.charts.revTier.destroy();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const datasets = TIERS.map((t, i) => {
    const drops = ['rgba(139,92,246,0.85)','rgba(6,212,255,0.85)','rgba(16,185,129,0.85)','rgba(236,72,153,0.85)','rgba(251,191,36,0.85)','rgba(59,130,246,0.85)','rgba(167,139,250,0.85)'][i % 7];
    return { label: t, data: months.map(() => randi(2000, 12000)), backgroundColor: drops, borderRadius: 2, maxBarThickness: 28 };
  });
  FNX.charts.revTier = new Chart(ctxA, { type: 'bar', data: { labels: months, datasets }, options: chartOpts({ legend: true }) });

  const ctxB = el('#chart-rev-network').getContext('2d');
  if (FNX.charts.revNetwork) FNX.charts.revNetwork.destroy();
  FNX.charts.revNetwork = new Chart(ctxB, { type: 'doughnut',
    data: { labels: NETWORKS, datasets: [{ data: NETWORKS.map(() => randi(8, 40)), backgroundColor: ['#8b5cf6','#06d4ff','#10b981','#ec4899','#fbbf24','#60a5fa'], borderColor: 'rgba(8,8,26,0.9)', borderWidth: 3 }] },
    options: chartOpts({ legend:true }) });
}

function renderFundsCollected() {
  const dep = FNX.data.transactions.filter(t => t.kind === 'deposit' && t.status === 'verified');
  const proj = FNX.data.transactions.filter(t => t.kind === 'deposit' && t.status === 'pending_verification');
  el('#fc-total').textContent = dep.reduce((s,t) => s+t.amount,0).toLocaleString();
  el('#fc-count').textContent = dep.length;
  el('#fc-projected').textContent = proj.reduce((s,t) => s+t.amount,0).toLocaleString();

  const cols = [
    { col:'created_at', label:'Date', tdClass:'mono' },
    { col:'user_name', label:'User' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
    { col:'status', label:'Status', fmt: v => `<span class="adm-pill ap-success">verified</span>` },
  ];
  renderGenericTable('#tbl-funds-collected', dep, cols, { tableId:'funds-collected', pagination:true, pageSize:18 });
}

function renderFundsDistributed() {
  const outs = FNX.data.transactions.filter(t => (t.kind === 'withdrawal' && t.status === 'approved') || (t.kind === 'refund' && t.status === 'completed'));
  const payouts = outs.filter(t => t.kind === 'withdrawal');
  const refunds = outs.filter(t => t.kind === 'refund');
  el('#fd-payouts').textContent = payouts.reduce((s,t)=>s+t.amount,0).toLocaleString();
  el('#fd-refunds').textContent = refunds.reduce((s,t)=>s+t.amount,0).toLocaleString();
  el('#fd-total').textContent = outs.reduce((s,t)=>s+t.amount,0).toLocaleString();
  const cols = [
    { col:'created_at', label:'Date', tdClass:'mono' },
    { col:'kind', label:'Kind', fmt: v => `<span class="adm-pill ${v === 'withdrawal' ? 'ap-pink' : 'ap-purple'}">${v}</span>` },
    { col:'user_name', label:'User' },
    { col:'amount', label:'Amount', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    { col:'network', label:'Network', tdClass:'mono' },
  ];
  renderGenericTable('#tbl-funds-distributed', outs, cols, { tableId:'funds-distributed', pagination:true, pageSize:18 });
}

function renderCompanyBalance() {
  const total = randi(2_400_000, 3_600_000);
  const userHeld = randi(800_000, 1_400_000);
  el('#cb-total').textContent = total.toLocaleString();
  el('#cb-userheld').textContent = userHeld.toLocaleString();

  const shreds = NETWORKS.map(n => ({ network: n, balance: randi(80_000, 800_000) }));
  const sum = shreds.reduce((s, x) => s + x.balance, 0);
  el('#cb-network-list').innerHTML = shreds.map(s => `
    <div class="step"><span style="width:80px;color:var(--text-secondary);">${s.network}</span><div class="bar"><div class="fill" style="width:${(s.balance/sum*100).toFixed(1)}%;background:linear-gradient(135deg,#8b5cf6,#06d4ff);"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;color:var(--accent-purple-soft);">$${s.balance.toLocaleString()}</span></div>
  `).join('');

  if (typeof Chart === 'undefined') return;
  const ctx = el('#chart-treasury').getContext('2d');
  if (FNX.charts.treasury) FNX.charts.treasury.destroy();
  const labels = Array.from({length: 30}, (_, i) => 'D-' + (29 - i));
  let base = total * 0.92;
  const data = labels.map(() => base = Math.round(base + rand(-12000, 24000)));
  FNX.charts.treasury = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Treasury', data, borderColor: '#a78bfa', backgroundColor: 'rgba(139,92,246,0.18)', fill: true, tension: 0.35, borderWidth: 2 }] }, options: chartOpts({}) });
}

function renderPnl() {
  const rev = FNX.data.transactions.filter(t => t.kind === 'deposit' && t.status === 'verified').reduce((s,t)=>s+t.amount,0);
  const pay = FNX.data.transactions.filter(t => (t.kind === 'withdrawal' && t.status === 'approved') || (t.kind === 'refund' && t.status === 'completed')).reduce((s,t)=>s+t.amount,0);
  el('#pnl-rev').textContent = Math.round(rev/3).toLocaleString();
  el('#pnl-pay').textContent = Math.round(pay/3).toLocaleString();
  el('#pnl-net').textContent = Math.round((rev-pay)/3).toLocaleString();

  if (typeof Chart === 'undefined') return;
  const ctx = el('#chart-pnl').getContext('2d');
  if (FNX.charts.pnl) FNX.charts.pnl.destroy();
  const labels = Array.from({length: 90}, (_, i) => 'D-' + (89 - i));
  const r = labels.map(() => randi(8000, 24000));
  const p = labels.map((_, i) => Math.round(r[i] * rand(0.4, 0.7)));
  FNX.charts.pnl = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Revenue', data: r, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', fill: true, tension: 0.3, borderWidth: 2 },
      { label: 'Payouts', data: p, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.10)', fill: true, tension: 0.3, borderWidth: 2 },
    ] },
    options: chartOpts({ legend: true })
  });
}

function renderFinancialReports() {
  const kind = el('#fin-rpt-kind').value;
  const titles = { deposits_summary: 'Deposits Summary', withdrawals_summary: 'Withdrawals Summary', refunds_summary: 'Refunds Summary', pnl_by_tier: 'P&L by Tier' };
  el('#fin-rpt-title').textContent = titles[kind];
  const colsByKind = {
    deposits_summary: [
      { col:'tier',  label:'Tier' },
      { col:'count', label:'Count', tdClass:'mono' },
      { col:'sum',   label:'Total USDT', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
      { col:'avg',   label:'Avg ticket', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
      { col:'approved_rate', label:'Approval rate', tdClass:'mono', fmt: v => v + '%' },
    ],
    withdrawals_summary: [
      { col:'network', label:'Network' },
      { col:'count', label:'Count', tdClass:'mono' },
      { col:'sum',  label:'Total USDT', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
      { col:'avg_slippage', label:'Avg slippage', tdClass:'mono', fmt: v => v + 'm' },
    ],
    refunds_summary: [
      { col:'reason', label:'Reason' },
      { col:'count', label:'Count', tdClass:'mono' },
      { col:'sum', label:'Total refunded', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
    ],
    pnl_by_tier: [
      { col:'tier', label:'Tier' },
      { col:'rev', label:'Revenue', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
      { col:'pay', label:'Payouts', tdClass:'mono', fmt: v => '$' + v.toLocaleString() },
      { col:'net', label:'Net P&L', tdClass:'mono', fmt: v => '<span style="color:var(--accent-emerald);font-weight:700;">+$' + v.toLocaleString() + '</span>' },
      { col:'margin', label:'Margin', tdClass:'mono', fmt: v => v + '%' },
    ],
  };
  let rows = [];
  if (kind === 'deposits_summary') {
    rows = TIERS.map(t => {
      const count = randi(40, 220);
      const sum = count * TIER_PRICE[t] * rand(0.9, 1.1);
      return { tier: t, count, sum: Math.round(sum), avg: Math.round(sum / count), approved_rate: randi(85, 99) };
    });
  } else if (kind === 'withdrawals_summary') {
    rows = NETWORKS.map(n => {
      const count = randi(20, 110);
      const sum = count * randi(200, 1800);
      return { network: n, count, sum: Math.round(sum), avg_slippage: randi(1, 9) };
    });
  } else if (kind === 'refunds_summary') {
    rows = ['Accidental double-charge','Network fee dispute','Plan mismatch','KYC rejected','Voluntary cancel'].map(reason => ({
      reason, count: randi(8, 60), sum: randi(2000, 24000)
    }));
  } else if (kind === 'pnl_by_tier') {
    rows = TIERS.map(t => {
      const rev = randi(22000, 240000);
      const pay = Math.round(rev * rand(0.45, 0.75));
      return { tier: t, rev, pay, net: rev - pay, margin: Math.round((rev - pay) / rev * 100) };
    });
  }
  renderGenericTable('#tbl-financial-reports', rows, colsByKind[kind], { tableId:'financial-reports', pagination:true, pageSize:12 });
  el('#fin-rpt-kind').onchange = renderFinancialReports;
}

/* ===== NOTIFICATIONS (renders inbox) ===== */

function renderNotificationsPane() {
  el('#noti-inbox').innerHTML = FNX.data.notifications.map(n => `
    <div class="adm-noti-row ${n.unread ? 'unread' : ''}">
      <div class="nwkind">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </div>
      <div class="body">
        <h5>${n.title}</h5>
        <p>${n.body}</p>
        <div class="t">${n.when}</div>
      </div>
    </div>
  `).join('');
  el('#cnt-noti').textContent = FNX.data.notifications.filter(n => n.unread).length;
  el('#noti-badge').style.display = el('#cnt-noti').textContent !== '0' ? 'block' : 'none';
  // NOTE: announcement-template buttons are wired ONCE in setupDelegatedEvents via delegation.
}

function openAnnouncementComposer(tplKey) {
  const tpl = ANNOUNCEMENT_TEMPLATES[tplKey] || ANNOUNCEMENT_TEMPLATES['new-feature'];
  showModal({
    title: 'Compose Announcement',
    sub: 'Send to all users or a targeted segment.',
    body: `
      <div class="announcement-targeting">
        ${['all','funded','challenge','tier:Quantum','country:India','kyc-pending'].map(t => `
          <label class="announcement-target ${t === tpl.channel ? 'checked' : ''}">
            <input type="radio" name="audience" value="${t}" ${t === tpl.channel ? 'checked' : ''}>
            <div class="lab">${t}</div>
            <div class="count">${(Math.random() * 1200 | 0).toLocaleString()} users</div>
          </label>
        `).join('')}
      </div>
      <div class="field" style="margin-top:14px;"><label>Title</label><input class="input" id="ann-title" value="${tpl.title.replace(' — ', ' — ')}" /></div>
      <div class="field" style="margin-top:14px;"><label>Body</label><textarea class="textarea" id="ann-body" style="min-height:120px;">${tpl.body}</textarea></div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <label class="adm-pill ap-info"><input type="checkbox" checked style="margin-right:6px;">Email</label>
        <label class="adm-pill ap-purple"><input type="checkbox" checked style="margin-right:6px;">In-app banner</label>
        <label class="adm-pill ap-emerald"><input type="checkbox" style="margin-right:6px;">Push notification</label>
        <label class="adm-pill ap-pink"><input type="checkbox" style="margin-right:6px;">Telegram</label>
      </div>
    `,
    actions: [
      { label: 'Send now', kind: 'btn-purple', onClick: () => { toast('Announcement sent!', 'success'); closeModal(); } },
      { label: 'Schedule', kind: 'btn-ghost', onClick: () => { toast('Scheduled for tomorrow 09:00 UTC', 'purple'); closeModal(); } },
    ]
  });
}

/* ===== ACTIVITY LOGS ===== */

function renderActivityLogs() {
  el('#activity-feed').innerHTML = FNX.data.activity.map(act => `
    <div class="feed-ev">
      <div class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${getActorColor(act.actor)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div class="body">
        <div class="act"><span class="adm-pill ${act.pill}" style="margin-right:6px;">${act.actor}</span><strong>${act.tag}</strong> ${act.action} ${act.target || ''} ${act.suffix ? '$' + act.suffix.toLocaleString() : ''}</div>
        <div class="when">${act.when} · <span style="color:var(--text-secondary);">${act.meta}</span></div>
      </div>
    </div>
  `).join('');
}

/* ----------------------------------------------------------------
   7. USER PROFILE DRAWER
   ---------------------------------------------------------------- */

function openUserDrawer(userId) {
  const u = FNX.data.users.find(x => x.id === userId);
  if (!u) return;
  FNX.state.userDrawer = u;
  el('#ud-id').textContent = u.id;
  const body = el('#ud-body');
  const ini = (u.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const txns = FNX.data.transactions.filter(t => t.user_id === u.id).slice(0, 8);
  const kyc = FNX.data.kyc.find(k => k.user_id === u.id);
  body.innerHTML = `
    <div class="adm-profile-card">
      <div class="avatar-lg">${ini}</div>
      <div class="who">
        <h3>${u.name}</h3>
        <div class="email">${u.email}</div>
        <div class="meta-line">
          <span><strong>Country:</strong> ${u.country}</span>
          <span><strong>Phone:</strong> ${u.country_code} ${u.phone}</span>
          <span><strong>Joined:</strong> ${u.joined_at}</span>
        </div>
      </div>
    </div>

    <h4>Account snapshot</h4>
    <div class="kv-grid">
      <div class="k">Tier</div><div class="v"><span class="adm-pill ap-purple">${u.tier}</span></div>
      <div class="k">Funded capital</div><div class="v mono">${money(u.balance)}</div>
      <div class="k">Profit split</div><div class="v mono">${u.profit_split}%</div>
      <div class="k">Status</div><div class="v">${statusPill(u.status)}</div>
      <div class="k">KYC</div><div class="v">${kycPill(u.kyc)}</div>
      <div class="k">Total deposits</div><div class="v mono">${money(u.total_deposits)}</div>
      <div class="k">Total withdrawals</div><div class="v mono">${money(u.total_withdrawals)}</div>
      <div class="k">Realized P&amp;L</div><div class="v mono" style="color:${u.realized_pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-pink)'};">${u.realized_pnl >= 0 ? '+' : '-'}${money(Math.abs(u.realized_pnl))}</div>
      <div class="k">Volume (30d)</div><div class="v mono">${u.volume_lots.toLocaleString()} lots</div>
    </div>

    <h4>KYC document</h4>
    <div class="kv-grid">
      <div class="k">Type</div><div class="v mono">${kyc ? kyc.doc_type : '—'}</div>
      <div class="k">Doc #</div><div class="v mono">${kyc ? kyc.doc_number : '—'}</div>
      <div class="k">Submitted</div><div class="v mono">${kyc ? kyc.submitted_at : '—'}</div>
      <div class="k">Reviewed</div><div class="v mono">${kyc ? (kyc.reviewed_at || '—') : '—'}</div>
      <div class="k">Reviewer</div><div class="v mono">${kyc ? (kyc.reviewer || '—') : '—'}</div>
      <div class="k">Notes</div><div class="v">${kyc && kyc.notes ? kyc.notes : '—'}</div>
    </div>

    <h4>Access &amp; security</h4>
    <div class="kv-grid">
      <div class="k">Last login</div><div class="v mono">${u.last_login}</div>
      <div class="k">Total logins</div><div class="v mono">${u.login_count}</div>
      <div class="k">Login IP (last)</div><div class="v mono">${randi(20,220)}.${randi(0,255)}.${randi(0,255)}.${randi(0,255)}</div>
      <div class="k">Device</div><div class="v">Chrome 124 · macOS</div>
      <div class="k">2FA</div><div class="v"><span class="adm-pill ap-emerald">Enabled</span></div>
    </div>

    <h4>Recent activity</h4>
    <div class="mini-timeline">
      ${txns.length ? txns.map(t => `
        <div class="ev">
          <div class="ic">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${t.kind === 'deposit' ? '#10b981' : t.kind === 'withdrawal' ? '#ec4899' : '#a78bfa'}" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="body">
            <div><strong>${t.kind}</strong> · ${money(t.amount)} · <span style="color:var(--text-muted);">${t.network}</span></div>
            <div class="t">${t.created_at} · ${t.status.replace('_',' ')}</div>
          </div>
        </div>
      `).join('') : '<div class="adm-skel" style="height:60px;"></div>'}
    </div>

    <div class="drawer-actions">
      <button class="btn btn-purple btn-sm" data-drawer-action="reset-pw">Reset password</button>
      <button class="btn btn-ghost btn-sm" data-drawer-action="send-msg">Send message</button>
      <button class="btn btn-ghost btn-sm" data-drawer-action="reassign-tier">Reassign tier</button>
      ${u.status !== 'frozen' ? `<button class="btn btn-ghost btn-sm" data-drawer-action="freeze" style="color:#67e8f9;border-color:rgba(6,212,255,0.35);">Freeze</button>` : `<button class="btn btn-ghost btn-sm" data-drawer-action="unfreeze" style="color:#67e8f9;">Unfreeze</button>`}
      ${u.status !== 'suspended' ? `<button class="btn btn-ghost btn-sm" data-drawer-action="suspend" style="color:#f87171;border-color:rgba(239,68,68,0.35);">Suspend</button>` : `<button class="btn btn-ghost btn-sm" data-drawer-action="unsuspend" style="color:#f87171;">Unsuspend</button>`}
    </div>
  `;
  el('#user-drawer').classList.add('open');
  body.querySelectorAll('[data-drawer-action]').forEach(b => {
    b.addEventListener('click', () => {
      const action = b.dataset.drawerAction;
      if (action === 'send-msg') {
        showModal({
          title: 'Message to ' + u.name,
          sub: 'Internal note saved to audit log; user-visible messages trigger an email.',
          body: `<textarea class="textarea" placeholder="Write a message…"></textarea>`,
          actions: [
            { label: 'Send & email', kind: 'btn-purple', onClick: () => { toast('Message sent to ' + u.email, 'purple'); closeModal(); } },
          ]
        });
      } else if (action === 'reset-pw') doResetPassword(u);
      else if (action === 'freeze' || action === 'unfreeze' || action === 'suspend' || action === 'unsuspend' || action === 'reassign-tier') doToggleStatus(u, action);
    });
  });
}

function closeUserDrawer() {
  el('#user-drawer').classList.remove('open');
  FNX.state.userDrawer = null;
}

/* ----------------------------------------------------------------
   8. ACTIONS — Suspend / Freeze / Reset / Approve / etc.
   ---------------------------------------------------------------- */

function doToggleStatus(u, action) {
  const map = {
    suspend:    { label: 'Suspend account',    risk: 'User will be unable to log in, trade, or request payouts.' },
    unsuspend:  { label: 'Unsuspend account',  risk: 'User will regain full platform access immediately.' },
    freeze:     { label: 'Freeze account',     risk: 'User cannot place new trades. Existing positions are held.' },
    unfreeze:   { label: 'Unfreeze account',   risk: 'User may place new trades immediately.' },
    'reassign-tier': { label: 'Reassign tier', risk: 'Update the user\'s account tier — affects leverage and DD limits.' },
  };
  const { label, risk } = map[action];
  showModal({
    title: label + ' — ' + u.name,
    sub: risk,
    body: `
      <div class="adm-profile-card" style="margin-bottom:14px;">
        <div class="avatar-lg">${(u.name[0]+u.name.split(' ')[1][0]).toUpperCase()}</div>
        <div class="who">
          <h3>${u.name}</h3>
          <div class="email">${u.email}</div>
          <div class="meta-line"><span><strong>Tier:</strong> ${u.tier}</span><span><strong>Capital:</strong> ${money(u.balance)}</span><span><strong>Status:</strong> ${u.status}</span></div>
        </div>
      </div>
      <div class="field"><label>Reason / audit note</label><textarea class="textarea" id="audit-reason" placeholder="Internal note (visible in audit log)…" style="min-height:90px;"></textarea></div>
      ${action === 'reassign-tier' ? `<div class="field" style="margin-top:10px;"><label>New tier</label><select class="select" id="new-tier"><option value="">Choose…</option>${TIERS.map(t => `<option value="${t}" ${t === u.tier ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
    `,
    actions: [
      { label: 'Cancel', kind: 'btn-ghost', onClick: closeModal },
      { label: 'Confirm', kind: 'btn-purple', onClick: () => {
        const reason = (el('#audit-reason') || {}).value || '(no reason)';
        const newTier = (el('#new-tier') || {}).value;
        toast((action === 'reassign-tier' ? 'Tier updated to ' + newTier : action + ' ✓ for ' + u.name) + ' · reason: ' + reason, action.includes('un') ? 'success' : action === 'freeze' || action === 'unfreeze' ? 'info' : 'warn');
        closeModal();
        closeUserDrawer();
        // Update local state + re-render
        if (u.status !== 'suspended' && action === 'suspend') u.status = 'suspended';
        else if (u.status === 'suspended' && action === 'unsuspend') u.status = 'active';
        else if (u.status !== 'frozen' && action === 'freeze') u.status = 'frozen';
        else if (u.status === 'frozen' && action === 'unfreeze') u.status = 'active';
        if (newTier) u.tier = newTier;
        FNX.data.activity.unshift({
          id: 999, actor:'admin', action: action.replace(/^./, c => c.toUpperCase()), target: u.name, target_kind:'user',
          icon:'k-tick', pill:'ap-success', tag: action.replace(/^./, c => c.toUpperCase()), suffix:'', when: new Date().toISOString().replace('T',' ').slice(0, 19), meta: u.email
        });
        switchPane(FNX.state.activePane);
      } },
    ]
  });
}

function doResetPassword(u) {
  showModal({
    title: 'Reset password — ' + u.name,
    sub: 'A temporary password will be emailed and force-changed on next login.',
    body: `
      <div class="field"><label>Email to</label><input class="input" value="${u.email}" disabled /></div>
      <div style="background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.32);border-radius:var(--r-md);padding:14px;margin:14px 0;">
        <div style="font-size:0.74rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;font-weight:700;">Generated temporary password</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.4rem;font-weight:700;color:var(--accent-purple-soft);" id="gen-temp-pw">FNX-${randi(10,99)}-${hash(8).slice(2,10)}</div>
      </div>
      <div class="field"><label>Admin note (audit log)</label><textarea class="textarea" id="audit-reason" placeholder="e.g. 'User forgot password — verified via phone'" style="min-height:90px;"></textarea></div>
    `,
    actions: [
      { label: 'Cancel', kind: 'btn-ghost', onClick: closeModal },
      { label: 'Send reset email', kind: 'btn-purple', onClick: () => {
        const reason = (el('#audit-reason') || {}).value || '(no reason)';
        toast('Reset email sent to ' + u.email + ' · ' + reason, 'purple');
        FNX.data.activity.unshift({
          id: 998, actor:'admin', action: 'Reset password for', target: u.name, target_kind:'user',
          icon:'k-key', pill:'ap-info', tag:'Reset', suffix:'', when: new Date().toISOString().replace('T',' ').slice(0, 19), meta: u.email
        });
        closeModal();
        closeUserDrawer();
      } },
    ]
  });
}

/* ----------------------------------------------------------------
   9. MODAL + TOAST
   ---------------------------------------------------------------- */

function showModal(opts) {
  el('#modal-title').textContent = opts.title;
  el('#modal-sub').textContent = opts.sub || '';
  el('#modal-body').innerHTML = opts.body || '';
  el('#modal-foot').innerHTML = (opts.actions || []).map((a, i) => `<button class="btn ${a.kind || 'btn-ghost'} btn-sm" data-mod-act="${i}">${a.label}</button>`).join('');
  el('#modal-foot').querySelectorAll('[data-mod-act]').forEach(b => {
    b.addEventListener('click', () => {
      const i = parseInt(b.dataset.modAct, 10);
      opts.actions[i].onClick && opts.actions[i].onClick();
    });
  });
  el('#modal').classList.add('open');
}

function closeModal() {
  el('#modal').classList.remove('open');
}

function toast(message, kind = 'info', ttl = 4500) {
  const wrap = el('#toasts');
  const t = document.createElement('div');
  t.className = 'adm-toast ' + kind;
  t.innerHTML = `<span>${message}</span><span class="x">×</span>`;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  const dismiss = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); };
  t.querySelector('.x').addEventListener('click', dismiss);
  setTimeout(dismiss, ttl);
}

/* ----------------------------------------------------------------
   10. COMMAND PALETTE (Cmd-K)
   ---------------------------------------------------------------- */

const CMD_ITEMS = () => ([
  ...['dashboard','all-users','user-profiles','user-search','suspend','freeze','reset-pw','login-activity','user-analytics','trading','challenge','funded','challenge-approval','funded-approval','trading-mgmt','trading-reports','kyc','audit-logs','txn-history','depwd-overview','pending-payments','revenue','funds-collected','funds-distributed','company-balance','pnl','financial-reports','exports','activity','notifications'].map(p => ({
    id: 'pane:' + p, kind:'pane', label: titleCase(p), meta: 'pane', search: p, action: () => switchPane(p)
  })),
  ...FNX.data.users.slice(0, 12).map(u => ({ id: 'user:' + u.id, kind:'user', label: u.name, meta: u.email, search: u.name + ' ' + u.email, action: () => { switchPane('all-users'); setTimeout(() => openUserDrawer(u.id), 100); } })),
  { id:'cmd:export-users-csv', kind:'action', label:'Export Users → CSV', meta:'export', action:() => exportCSV('users') },
  { id:'cmd:export-txn-csv',   kind:'action', label:'Export Transactions → CSV', meta:'export', action:() => exportCSV('txn') },
  { id:'cmd:export-audit-csv',  kind:'action', label:'Export Audit Logs → CSV', meta:'export', action:() => exportCSV('audit') },
  { id:'cmd:approve-funded',    kind:'action', label:'Approve pending funded accounts', meta:'bulk', action: () => { switchPane('funded-approval'); toast('Opening approval queue', 'info'); } },
  { id:'cmd:compose-announcement', kind:'action', label:'Compose announcement', meta:'comms', action: () => { switchPane('notifications'); setTimeout(() => openAnnouncementComposer('new-feature'), 200); } },
  { id:'cmd:print-dashboard',   kind:'action', label:'Print Dashboard (PDF)', meta:'print', action:() => { switchPane('dashboard'); setTimeout(() => window.print(), 250); } },
]);

function setupCommandPalette() {
  el('#cmd-k-btn').addEventListener('click', openCmdK);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdK(); }
    if (e.key === 'Escape') {
      closeCmdK(); closeUserDrawer(); closeModal();
    }
  });
  el('#cmd-input').addEventListener('input', () => renderCmdList());
  el('#cmd-input').addEventListener('keydown', (e) => {
    const items = el('.adm-cmd-list .adm-cmd-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const cur = document.querySelector('.adm-cmd-item.active');
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let idx = cur ? Array.from(items).indexOf(cur) + dir : 0;
      idx = (idx + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cur = document.querySelector('.adm-cmd-item.active') || items[0];
      cur.click();
    }
  });
  el('#cmdk').addEventListener('click', (e) => { if (e.target === el('#cmdk')) closeCmdK(); });
}

function openCmdK() {
  el('#cmdk').classList.add('open');
  el('#cmd-input').value = '';
  renderCmdList();
  setTimeout(() => el('#cmd-input').focus(), 50);
}

function closeCmdK() {
  el('#cmdk').classList.remove('open');
}

function renderCmdList() {
  const q = el('#cmd-input').value.toLowerCase().trim();
  let items = CMD_ITEMS();
  if (q) items = items.filter(i => i.search.toLowerCase().includes(q) || i.label.toLowerCase().includes(q));
  items = items.slice(0, 12);
  const list = el('#cmd-list');
  if (!items.length) { list.innerHTML = '<div class="adm-cmd-empty">No matches for "' + q + '"</div>'; return; }
  list.innerHTML = items.map((it, i) => `
    <div class="adm-cmd-item ${i === 0 ? 'active' : ''}" data-cmd-id="${it.id}">
      <div class="ic">${it.kind === 'user' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'}</div>
      <div style="flex:1;">${it.label}</div>
      <div class="meta">${it.meta}</div>
    </div>
  `).join('');
  list.querySelectorAll('.adm-cmd-item').forEach(it => {
    it.addEventListener('click', () => {
      const id = it.dataset.cmdId;
      const item = items.find(x => x.id === id);
      if (item) item.action();
      closeCmdK();
    });
  });
}

/* ----------------------------------------------------------------
   11. GLOBAL SEARCH
   ---------------------------------------------------------------- */

function setupGlobalSearch() {
  const input = el('#global-search-input');
  let pop;
  input.addEventListener('focus', () => renderSearchResults());
  input.addEventListener('input', () => renderSearchResults());
  input.addEventListener('blur', () => setTimeout(() => { if (pop) pop.remove(); pop = null; }, 150));
  function renderSearchResults() {
    if (pop) { pop.remove(); pop = null; }
    const q = input.value.toLowerCase().trim();
    if (!q) return;
    const u = FNX.data.users.filter(x => x.name.toLowerCase().includes(q) || x.email.toLowerCase().includes(q) || x.country.toLowerCase().includes(q)).slice(0, 6);
    const t = FNX.data.transactions.filter(x => x.user_email.toLowerCase().includes(q) || x.tx_hash.toLowerCase().includes(q)).slice(0, 4);
    if (!u.length && !t.length) return;
    pop = document.createElement('div');
    pop.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);width:520px;max-width:96vw;background:rgba(8,8,26,0.97);border:1px solid rgba(139,92,246,0.32);border-radius:14px;padding:10px;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,0.5);backdrop-filter:blur(20px);max-height:380px;overflow-y:auto;';
    pop.innerHTML = `
      ${u.length ? `<div style="padding:8px 14px;font-size:0.74rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Users</div>`
        + u.map(x => `<div data-search="${x.id}" class="search-row" style="padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;">
            <div class="mini-avatar" style="width:30px;height:30px;border-radius:8px;background:var(--grad-purple);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:'Space Grotesk';font-weight:800;font-size:0.74rem;flex-shrink:0;">${x.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
            <div style="flex:1;"><div style="font-weight:600;">${x.name}</div><div style="font-size:0.78rem;color:var(--accent-blue-light);">${x.email}</div></div>
            <div class="adm-pill ap-purple" style="font-size:0.68rem;">${x.tier}</div>
          </div>`).join('') : ''}
      ${t.length ? `<div style="padding:8px 14px;font-size:0.74rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-top:8px;">Transactions</div>`
        + t.map(x => `<div style="padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;">
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--accent-cyan);">${shortHash(x.tx_hash)}</div>
            <div style="flex:1;font-size:0.85rem;">${x.user_email}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;">$${x.amount.toLocaleString()}</div>
          </div>`).join('') : ''}
    `;
    document.body.appendChild(pop);
    pop.querySelectorAll('[data-search]').forEach(r => {
      r.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const id = parseInt(r.dataset.search, 10);
        switchPane('all-users');
        setTimeout(() => openUserDrawer(id), 100);
        input.value = '';
        pop.remove(); pop = null;
      });
    });
  }
}

/* ----------------------------------------------------------------
   12. EXPORTS (CSV + PRINT)
   ---------------------------------------------------------------- */

function exportCSV(kind) {
  const CFGS = {
    users:    { rows: FNX.data.users.map(u => ({ id:u.id, name:u.name, email:u.email, country:u.country, tier:u.tier, balance:u.balance, status:u.status, kyc:u.kyc, joined:u.joined_at, logins:u.login_count, last_login:u.last_login })), filename:'fnx-admin-users.csv' },
    txn:      { rows: FNX.data.transactions.map(t => ({ id:t.id, kind:t.kind, user:t.user_email, amount:t.amount, network:t.network, hash:t.tx_hash, status:t.status, when:t.created_at })), filename:'fnx-admin-transactions.csv' },
    kyc:      { rows: FNX.data.kyc, filename:'fnx-admin-kyc.csv' },
    audit:    { rows: FNX.data.activity.map((a, i) => ({ id:i, when:a.when, actor:a.actor, action:a.tag + ' ' + a.action + (a.target ? ' ' + a.target : ''), target:a.meta })), filename:'fnx-admin-audit.csv' },
    noti:     { rows: FNX.data.notifications, filename:'fnx-admin-notifications.csv' },
    logins:   { rows: FNX.data.logins, filename:'fnx-admin-logins.csv' },
    dashboard:{ rows: FNX.data.users.map(u => ({ id:u.id, name:u.name, country:u.country, tier:u.tier, balance:u.balance, kyc:u.kyc, status:u.status, deposits:u.total_deposits, withdrawals:u.total_withdrawals, pnl:u.realized_pnl })), filename:'fnx-admin-dashboard.csv' },
  };
  const cfg = CFGS[kind];
  if (!cfg) { toast('Unknown export: ' + kind, 'error'); return; }
  const rows = cfg.rows;
  if (!rows.length) { toast('No data to export', 'error'); return; }
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => csvCell(r[h])).join(','))).join('\n');
  downloadFile(cfg.filename, csv, 'text/csv');
  toast('Exported ' + rows.length + ' rows → ' + cfg.filename, 'success');
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportPDF(selector) {
  // Switch to the requested pane, then trigger print.
  // Print rules in admin.css strip topbar/sidebar/drawer/modals and only render .adm-pane.active.
  const map = {
    'users-pdf':     'all-users',
    'txn-pdf':       'txn-history',
    'audit-pdf':     'audit-logs',
    'dashboard-pdf': 'dashboard',
    'noti-pdf':      'notifications',
    'kyc-pdf':       'kyc',
  };
  const pane = map[selector];
  if (pane) switchPane(pane);
  setTimeout(() => window.print(), 220);
}

/* ----------------------------------------------------------------
   13. EVENT DELEGATION (clicks on dynamic content)
   ---------------------------------------------------------------- */

function setupDelegatedEvents() {
  // Drawer close
  el('#ud-close').addEventListener('click', closeUserDrawer);

  // Modal close
  el('#modal-close').addEventListener('click', closeModal);
  el('#modal').addEventListener('click', (e) => { if (e.target === el('#modal')) closeModal(); });

  // Print button — switches to dashboard so the printout matches the canonical view.
  el('#print-btn').addEventListener('click', () => { switchPane('dashboard'); setTimeout(() => window.print(), 220); });

  // Noti button
  el('#noti-btn').addEventListener('click', () => switchPane('notifications'));

  // Compose announcement
  el('#btn-new-announcement').addEventListener('click', () => openAnnouncementComposer('new-feature'));

  // Dashboard refresh
  el('#dash-refresh')?.addEventListener('click', () => { renderDashboard(); toast('Dashboard refreshed', 'info'); });

  // Quick actions on dashboard (bind ONCE — these DOM nodes are static in HTML).
  document.querySelectorAll('[data-quick]').forEach(elx => {
    elx.addEventListener('click', () => {
      const a = elx.dataset.quick;
      if (a === 'approve-funded') { switchPane('funded-approval'); toast('Opening funded approval queue', 'info'); }
      else if (a === 'verify-kyc') { switchPane('kyc'); toast('Opening KYC review queue', 'purple'); }
      else if (a === 'release-payouts') { switchPane('pending-payments'); toast('Opening pending payments', 'info'); }
      else if (a === 'compose-announcement') { openAnnouncementComposer('new-feature'); }
      else if (a === 'run-report') { switchPane('financial-reports'); toast('Loaded financial reports', 'info'); }
      else if (a === 'audit-export') { exportCSV('audit'); }
    });
  });

  // Bulk action stubs (trading-mgmt) — bind once.
  document.querySelectorAll('[data-bulk]').forEach(elx => {
    elx.addEventListener('click', () => {
      const b = elx.dataset.bulk;
      toast('Bulk: ' + b.replace('-', ' ') + ' queued', 'info');
      showModal({
        title:'Bulk action: ' + b.replace('-', ' '),
        sub:'Select N accounts and confirm.',
        body: `<div style="padding:18px 0;">This would open a multi-select dialog for the <strong>${b.replace('-', ' ')}</strong> operation across selected trading accounts. (Demo — no real action)</div>`,
        actions: [{ label:'Close', kind:'btn-ghost', onClick: closeModal }]
      });
    });
  });

  // Delegated row actions (button-level interactions on dynamic content)
  document.body.addEventListener('click', (e) => {
    // Trading-pane tabs — event delegation prevents listener leak across re-renders.
    const tab = e.target.closest('[data-acct-tab]');
    if (tab) {
      document.querySelectorAll('[data-acct-tab]').forEach(x => x.classList.toggle('active', x === tab));
      FNX._activeAcctTab = tab.dataset.acctTab;
      if (FNX.state.activePane === 'trading') renderTrading();
      return;
    }
    // Announcement composer templates — bound once via delegation.
    const tpl = e.target.closest('[data-template]');
    if (tpl) {
      openAnnouncementComposer(tpl.dataset.template);
      return;
    }
    // Row-level actions (open-user, suspend, freeze, approve, kyc, etc.)
    const btn = e.target.closest('[data-action]');
    if (btn) {
      handleActionClick(btn.dataset.action, parseInt(btn.dataset.id, 10), btn);
      return;
    }
    // Export buttons (CSV / PDF)
    const exp = e.target.closest('[data-export]');
    if (exp) {
      const kind = exp.dataset.export;
      if (kind.endsWith('-csv')) exportCSV(kind.replace('-csv', ''));
      else if (kind.endsWith('-pdf')) exportPDF(kind);
      return;
    }
  });
}

function handleActionClick(action, id, btn) {
  if (action === 'open-user') { openUserDrawer(id); return; }
  if (action === 'open-trading') { switchPane('trading'); return; }

  const u = FNX.data.users.find(x => x.id === id);
  if (!u) {
    // Could be challenge/kyc id
    if (action === 'approve-challenge' || action === 'reject-challenge') {
      toast((action === 'approve-challenge' ? 'Approved' : 'Rejected') + ' challenge #' + id, action === 'approve-challenge' ? 'success' : 'warn');
      FNX.data.activity.unshift({
        id: 990 + randi(1, 99), actor:'admin',
        action: action === 'approve-challenge' ? 'Approved challenge ' : 'Rejected challenge ',
        target: 'ID ' + id, target_kind:'challenge',
        icon:'k-tick', pill: action === 'approve-challenge' ? 'ap-success' : 'ap-error',
        tag: action === 'approve-challenge' ? 'Approved' : 'Rejected', suffix:'',
        when: new Date().toISOString().replace('T',' ').slice(0, 19),
        meta: 'challenge pipeline'
      });
      switchPane(FNX.state.activePane);
      return;
    }
    if (action === 'kyc-approve' || action === 'kyc-reject') {
      const k = FNX.data.kyc.find(x => x.id === id);
      if (k) {
        k.status = action === 'kyc-approve' ? 'approved' : 'rejected';
        k.reviewed_at = new Date().toISOString().slice(0,10);
        k.reviewer = 'Dana A.';
        toast('KYC ' + (action === 'kyc-approve' ? 'approved' : 'rejected') + ' for ' + k.user_name, action === 'kyc-approve' ? 'success' : 'warn');
        FNX.data.activity.unshift({
          id: 991 + randi(1, 99), actor:'admin',
          action: action === 'kyc-approve' ? 'Approved KYC for ' : 'Rejected KYC for ',
          target: k.user_name, target_kind:'kyc',
          icon:'k-id', pill: action === 'kyc-approve' ? 'ap-success' : 'ap-error',
          tag: action === 'kyc-approve' ? 'Approved' : 'Rejected', suffix:'',
          when: new Date().toISOString().replace('T',' ').slice(0, 19),
          meta: k.user_email
        });
        switchPane(FNX.state.activePane);
      }
      return;
    }
    if (action === 'verify-txn' || action === 'reject-txn') {
      const t = FNX.data.transactions.find(x => x.id === id);
      if (t) {
        t.status = action === 'verify-txn' ? (t.kind === 'deposit' ? 'verified' : 'approved') : 'rejected';
        toast('Transaction ' + (action === 'verify-txn' ? 'verified' : 'rejected'), action === 'verify-txn' ? 'success' : 'warn');
        switchPane(FNX.state.activePane);
      }
      return;
    }
    return;
  }

  if (action === 'suspend' || action === 'unsuspend' || action === 'freeze' || action === 'unfreeze' || action === 'reset-pw' || action === 'reassign-tier') {
    doToggleStatus(u, action);
    return;
  }
  if (action === 'approve-funded' || action === 'reject-funded') {
    showModal({
      title: (action === 'approve-funded' ? 'Approve funded for ' : 'Reject funded for ') + u.name,
      sub: action === 'approve-funded' ? 'MT5 credentials will be provisioned and emailed.' : 'User will need to re-apply after rejection.',
      body: `<div class="field"><label>Note</label><textarea class="textarea" id="audit-reason" placeholder="Optional note for audit log…" style="min-height:80px;"></textarea></div>`,
      actions: [
        { label:'Cancel', kind:'btn-ghost', onClick: closeModal },
        { label: action === 'approve-funded' ? 'Approve & deploy' : 'Reject', kind: action === 'approve-funded' ? 'btn-purple' : 'btn-ghost', onClick: () => {
            toast('Action ' + action + ' for ' + u.name, action === 'approve-funded' ? 'success' : 'warn');
            closeModal();
          }
        }
      ]
    });
  }
}

/* ----------------------------------------------------------------
   14. UTILS
   ---------------------------------------------------------------- */
function el(s) { return document.querySelector(s); }
function titleCase(s) { return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

/* ----------------------------------------------------------------
   15. BOOT
   ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupCommandPalette();
  setupGlobalSearch();
  setupDelegatedEvents();
  // initial render of dashboard
  initPane('dashboard');
  // open overview by default (already open in HTML)
});
