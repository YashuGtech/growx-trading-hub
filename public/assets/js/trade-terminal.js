/* GrowX Trade Terminal — client script
   - Loads account from /api/trade/account
   - Streams live prices via WebSocket to realmarketapi.com (config from /api/chart/config)
   - Falls back to a synthetic random-walk feed if the WS isn't reachable
   - Renders lightweight charts + full 12-screen navigation
*/
(function(){
'use strict';

// ---------- Symbol catalog ----------
const SYMBOLS = {
  forex: [
    { s:'EURUSD', name:'EUR/USD', sub:'Euro / US Dollar', p:1.08945 },
    { s:'GBPUSD', name:'GBP/USD', sub:'Pound / US Dollar', p:1.26980 },
    { s:'USDJPY', name:'USD/JPY', sub:'US Dollar / Yen', p:157.540 },
    { s:'AUDUSD', name:'AUD/USD', sub:'Aussie / US Dollar', p:0.68215 },
    { s:'USDCAD', name:'USD/CAD', sub:'US Dollar / Canadian', p:1.36120 },
    { s:'NZDUSD', name:'NZD/USD', sub:'Kiwi / US Dollar', p:0.61125 },
    { s:'USDCHF', name:'USD/CHF', sub:'US Dollar / Franc', p:0.89360 },
    { s:'EURGBP', name:'EUR/GBP', sub:'Euro / Pound', p:0.85740 },
    { s:'GBPJPY', name:'GBP/JPY', sub:'Pound / Yen', p:198.860 },
  ],
  commodities: [
    { s:'XAUUSD', name:'XAU/USD', sub:'Gold Spot', p:2382.40 },
    { s:'XAGUSD', name:'XAG/USD', sub:'Silver Spot', p:28.450 },
    { s:'USOIL',  name:'USOIL',   sub:'Crude Oil WTI', p:78.250 },
  ],
  indices: [
    { s:'US30',  name:'US30',  sub:'Dow Jones', p:39820.0 },
    { s:'SPX500',name:'SPX500',sub:'S&P 500', p:5432.10 },
    { s:'NAS100',name:'NAS100',sub:'Nasdaq 100', p:19420.5 },
  ],
  crypto: [
    { s:'BTCUSD', name:'BTC/USD', sub:'Bitcoin', p:67420 },
    { s:'ETHUSD', name:'ETH/USD', sub:'Ethereum', p:3520.5 },
    { s:'SOLUSD', name:'SOL/USD', sub:'Solana', p:184.20 },
  ],
};
const ALL_SYMBOLS = Object.values(SYMBOLS).flat();
const SYM_INDEX = Object.fromEntries(ALL_SYMBOLS.map(x => [x.s, x]));

// ---------- State ----------
const state = {
  screen: 'home',
  account: null,
  positions: [],
  ticks: {},           // symbol -> { price, change, chgPct, high, low, open }
  history: {},         // symbol -> [{time, open, high, low, close}]
  activeSymbol: 'EURUSD',
  timeframe: '15m',
  rafPending: false,
  chart: null,
  candleSeries: null,
  wsConfig: null,
  ws: null,
  wsSubs: new Set(),
  side: 'buy',
  orderType: 'market',
  favorites: new Set(JSON.parse(localStorage.getItem('gx_favs')||'["EURUSD","GBPUSD","XAUUSD","BTCUSD"]')),
  marketCat: 'forex',
};

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const money = (n) => (n<0?'-':'') + '$' + Math.abs(Number(n||0)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
const priceFmt = (sym, n) => {
  if (n == null) return '-';
  if (sym==='USDJPY'||sym==='GBPJPY') return n.toFixed(3);
  if (['XAUUSD','XAGUSD','USOIL','US30','SPX500','NAS100','BTCUSD','ETHUSD','SOLUSD'].includes(sym)) return n.toFixed(2);
  return n.toFixed(5);
};

function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2400);
}
window.showToast = showToast;

function showBreach(account, risk){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-breached');
  if (!el) { showToast('Account eliminated', 'error'); return; }
  el.classList.add('active');
  const reason = document.getElementById('breach-reason');
  if (reason) reason.textContent = account.elimination_reason || 'Risk limits breached. All positions closed.';
  const d = document.getElementById('breach-daily');
  const o = document.getElementById('breach-overall');
  if (d) d.textContent = (risk?.daily_loss_pct ?? 0).toFixed(2) + '% ($' + (risk?.daily_loss ?? 0).toFixed(2) + ')';
  if (o) o.textContent = (risk?.overall_loss_pct ?? 0).toFixed(2) + '% ($' + (risk?.overall_loss ?? 0).toFixed(2) + ')';
  const nav = document.querySelector('.bottom-nav'); if (nav) nav.style.display = 'none';
  const side = document.querySelector('.desktop-sidebar'); if (side) side.style.opacity = '0.4';
}
window.showBreach = showBreach;

function showScreen(name){
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $('screen-'+name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.bottom-nav .tab').forEach(t => t.classList.toggle('active', t.dataset.tab===name));
  // Lazy load per screen
  if (name==='markets') renderMarkets();
  if (name==='chart') { ensureChart(); redrawChart(); syncQuickTicket(); }
  if (name==='place') syncPlaceOrder();
  if (name==='positions') loadPositions();
  if (name==='watchlist') renderWatchlist();
  if (name==='wallet') renderWallet();
  if (name==='profile') renderProfile();
  if (name==='analytics') renderAnalytics();
  document.querySelectorAll('.desktop-sidebar .nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab===name));
  window.scrollTo(0,0);
}
window.showScreen = showScreen;

// ---------- API ----------
async function api(path, opts={}){
  const res = await fetch('/api'+path, {
    method: opts.method || 'GET',
    headers: opts.body ? {'Content-Type':'application/json'} : {},
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(()=>({ok:false}));
  return { status: res.status, ...json };
}

async function loadAccount(){
  const r = await api('/trade/account');
  if (!r.ok) {
    window.location.href = 'trade-terminal-login.html';
    return;
  }
  state.account = r.account;
  state.positions = r.positions || [];
  state.risk = r.risk || null;
  if (r.account && r.account.status === 'eliminated') {
    showBreach(r.account, r.risk);
    return;
  }
  renderHome();
}
async function loadPositions(){
  const r = await api('/trade/account');
  if (r.ok) { state.positions = r.positions || []; state.account = r.account; state.risk = r.risk || state.risk; if (r.account?.status === 'eliminated') return showBreach(r.account, r.risk); }
  renderPositions();
  renderHome();
}
async function logout(){
  try { await api('/trade/logout', {method:'POST'}); } catch(_){}
  localStorage.removeItem('gx_trade_token');
  window.location.href = 'trade-terminal-login.html';
}
window.logout = logout;

// ---------- Chart config + WS feed ----------
async function initFeed(){
  const cfg = await api('/chart/config');
  state.wsConfig = cfg;
  connectWS();
  // Seed tick baseline immediately from catalog so UI has values before first ws tick
  for (const s of ALL_SYMBOLS) {
    if (!state.ticks[s.s]) state.ticks[s.s] = { price: s.p, change: 0, chgPct: 0, high: s.p*1.002, low: s.p*0.998, open: s.p };
  }
  seedHistory();
}

function seedHistory(){
  const now = Math.floor(Date.now()/1000);
  const barSec = tfSec(state.timeframe);
  for (const s of ALL_SYMBOLS){
    const arr = [];
    let p = s.p;
    for (let i=200;i>0;i--){
      const t = now - i*barSec;
      const o = p;
      const move = p * (Math.random()-0.5) * 0.002;
      const c = o + move;
      const h = Math.max(o,c) + Math.abs(move)*0.6;
      const l = Math.min(o,c) - Math.abs(move)*0.6;
      arr.push({ time:t, open:o, high:h, low:l, close:c });
      p = c;
    }
    state.history[s.s] = arr;
  }
}
function tfSec(tf){
  return {'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400}[tf] || 900;
}

function connectWS(){
  const cfg = state.wsConfig;
  // Always keep the synthetic feed running so all market rows stay live. The
  // RealMarket WS below layers real ticks in for the currently viewed chart
  // symbol (their API is one WS per symbol/timeframe).
  startSyntheticFeed();
  if (!cfg || !cfg.ws_base || !cfg.api_key) return;
  // openRealMarketWS is invoked from openSymbol() when a chart opens.
}

function tfToRM(tf){
  return ({'1m':'M1','5m':'M5','15m':'M15','1h':'H1','4h':'H4','1d':'D1'})[tf] || 'M1';
}
function openRealMarketWS(symbol){
  const cfg = state.wsConfig;
  if (!cfg || !cfg.ws_base || !cfg.api_key) return;
  try { if (state.ws) state.ws.close(); } catch(_){}
  const url = `${cfg.ws_base}?apiKey=${encodeURIComponent(cfg.api_key)}`
    + `&symbolCode=${encodeURIComponent(symbol)}`
    + `&timeFrame=${encodeURIComponent(tfToRM(state.timeframe))}`;
  try {
    const ws = new WebSocket(url);
    state.ws = ws;
    state.wsSymbol = symbol;
    ws.addEventListener('message', (ev)=>{
      try {
        const frame = JSON.parse(ev.data);
        // Docs: frame.SymbolCode, frame.ClosePrice, frame.Bid
        const sym = (frame.SymbolCode || frame.symbol || '').toUpperCase().replace('/','');
        const price = Number(frame.Bid ?? frame.ClosePrice ?? frame.close ?? 0);
        if (sym && SYM_INDEX[sym] && price) applyTick(sym, price);
      } catch(_){}
    });
    ws.addEventListener('close', ()=>{
      if (state.wsSymbol === symbol) setTimeout(()=>openRealMarketWS(symbol), 4000);
    });
    ws.addEventListener('error', ()=>{ /* silent, synthetic feed keeps UI live */ });
  } catch(_){}
}
window.openRealMarketWS = openRealMarketWS;
function handleWsMessage(msg){
  const list = Array.isArray(msg) ? msg : (msg.data && Array.isArray(msg.data) ? msg.data : [msg]);
  for (const m of list){
    const sym = (m.symbol || m.s || m.pair || '').toUpperCase().replace('/','');
    const price = Number(m.price ?? m.p ?? m.last ?? m.close ?? m.bid ?? 0);
    if (!sym || !SYM_INDEX[sym] || !price) continue;
    applyTick(sym, price);
  }
}
let synInterval = null;
function startSyntheticFeed(){
  if (synInterval) return;
  synInterval = setInterval(()=>{
    for (const s of ALL_SYMBOLS){
      const cur = state.ticks[s.s]?.price || s.p;
      const jitter = cur * (Math.random()-0.5) * 0.0006;
      applyTick(s.s, cur + jitter);
    }
  }, 1200);
}
function applyTick(sym, price){
  const t = state.ticks[sym] || { price, change:0, chgPct:0, high:price, low:price, open:price };
  t.change = price - t.open;
  t.chgPct = (t.change / t.open) * 100;
  t.high = Math.max(t.high, price);
  t.low  = Math.min(t.low, price);
  t.price = price;
  state.ticks[sym] = t;
  // Update last candle
  const hist = state.history[sym];
  if (hist && hist.length){
    const last = hist[hist.length-1];
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low  = Math.min(last.low, price);
    if (sym === state.activeSymbol && state.candleSeries){
      state.candleSeries.update(last);
    }
  }
  // Live UI updates are throttled into one animation frame. This keeps the
  // desktop terminal smooth while the synthetic feed updates every symbol.
  scheduleLiveUiUpdate(sym);
}
function scheduleLiveUiUpdate(sym){
  state.lastTickSymbol = sym;
  if (state.rafPending) return;
  state.rafPending = true;
  requestAnimationFrame(()=>{
    state.rafPending = false;
    if (state.screen==='chart') { updateChartHUD(); updateQuickTicket(); }
    if (state.screen==='home') updateHomeMarketsPrices();
    if (state.screen==='markets') updateMarketsPrices();
    if (state.screen==='watchlist') updateWatchlistPrices();
    if (state.screen==='positions') updatePositionPnLs();
    if (state.screen==='place') updatePlacePrice();
  });
}

// ---------- HOME ----------
function renderHome(){
  if (!state.account) return;
  const a = state.account;
  const pnl = Number(a.equity || 0) - Number(a.starting_balance || 0);
  const pct = a.starting_balance ? (pnl/a.starting_balance*100) : 0;
  const free = Number(a.balance || 0) - Number(a.used_margin || 0);
  const marginLevel = Number(a.used_margin || 0) > 0 ? (Number(a.equity || 0)/Number(a.used_margin || 0)*100).toFixed(2)+'%' : '—';
  setText('home-name', a.trade_id || 'Trader');
  setText('home-plan', a.plan || 'GrowX Challenge');
  setText('home-trade-id', a.trade_id || 'GX-------');
  setText('home-balance', money(a.balance));
  setText('home-equity', money(a.equity));
  setText('home-equity-sub', 'Equity ' + money(a.equity));
  setText('home-free-margin', money(free));
  setText('home-margin-level', marginLevel);
  setText('home-status', (a.status || 'active').replace(/_/g,' '));
  setText('home-leverage', '1:'+(a.leverage || 100));
  setText('home-open-count', state.positions.filter(p=>p.status==='open').length);
  setText('home-used-margin', money(a.used_margin || 0));
  setText('home-pnl', (pnl>=0?'+':'')+money(pnl));
  setClass('home-pnl', 'value ' + (pnl>=0?'up':'down'));
  setText('home-pnl-pct', (pct>=0?'+':'')+pct.toFixed(2)+'%');
  setClass('home-pnl-pct', 'chip ' + (pct>=0?'up':'down'));
  setText('home-today-pnl', (pnl>=0?'+':'')+money(pnl));
  setClass('home-today-pnl', 'value ' + (pnl>=0?'up':'down'));
  setText('home-today-pct', (pct>=0?'+':'')+pct.toFixed(2)+'%');
  renderRiskObjectives(pct);
  updateHomeMarkets();
  renderHomeWatchlist();
}
function setText(id, value){ const el=$(id); if (el) el.textContent = value; }
function setClass(id, value){ const el=$(id); if (el) el.className = value; }
function renderRiskObjectives(profitPct){
  const risk = state.risk || {};
  const daily = Number(risk.daily_loss_pct || 0);
  const overall = Number(risk.overall_loss_pct || 0);
  const p1 = Math.max(0, Math.min(100, profitPct / 8 * 100));
  const p2 = Math.max(0, Math.min(100, profitPct / 5 * 100));
  setText('daily-used', `Used: ${daily.toFixed(2)}%`); setText('daily-rem', `Remaining: ${Math.max(0,5-daily).toFixed(2)}%`);
  setText('overall-used', `Used: ${overall.toFixed(2)}%`); setText('overall-rem', `Remaining: ${Math.max(0,8-overall).toFixed(2)}%`);
  const db=$('daily-bar'); if(db) db.style.width = Math.min(100, daily/5*100).toFixed(1)+'%';
  const ob=$('overall-bar'); if(ob) ob.style.width = Math.min(100, overall/8*100).toFixed(1)+'%';
  const p1b=$('phase1-bar'); if(p1b) p1b.style.width = p1.toFixed(1)+'%';
  const p2b=$('phase2-bar'); if(p2b) p2b.style.width = p2.toFixed(1)+'%';
  setText('phase1-progress', `Progress: ${Math.max(0, profitPct).toFixed(2)}%`);
  setText('phase2-progress', `Progress: ${Math.max(0, profitPct).toFixed(2)}%`);
  setText('phase1-status', profitPct >= 8 ? 'Achieved' : 'In Progress');
  setText('phase2-status', (state.account?.phase === 'phase_2' || state.account?.phase === 'live') ? (profitPct >= 5 ? 'Achieved' : 'In Progress') : 'Locked');
}
function updateHomeMarkets(){
  const wrap = $('home-markets');
  if (!wrap) return;
  const list = ['EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSD','ETHUSD'].map(x=>SYM_INDEX[x]).filter(Boolean);
  wrap.innerHTML = marketHeadHtml() + list.map(s => marketRowHtml(s)).join('');
  wrap.querySelectorAll('.market-row').forEach((r,i)=> r.addEventListener('click', ()=> openSymbol(list[i].s)));
}
function renderHomeWatchlist(){
  const wrap = $('home-watchlist'); if (!wrap) return;
  const list = ALL_SYMBOLS.filter(s => state.favorites.has(s.s)).slice(0,5);
  wrap.innerHTML = marketHeadHtml() + list.map(marketRowHtml).join('');
  wrap.querySelectorAll('.market-row').forEach((r,i)=> r.addEventListener('click', ()=> openSymbol(list[i].s)));
}
function updateHomeMarketsPrices(){ updateMarketRows($('home-markets')); updateMarketRows($('home-watchlist'));
}

// ---------- MARKETS ----------
function renderMarkets(){
  document.querySelectorAll('#market-cat-tabs button').forEach(b=>{
    b.classList.toggle('active', b.dataset.cat===state.marketCat);
    b.onclick = ()=>{ state.marketCat = b.dataset.cat; renderMarkets(); };
  });
  const q = ($('markets-search')?.value || '').toUpperCase();
  const list = (SYMBOLS[state.marketCat]||[]).filter(s=> !q || s.s.includes(q) || s.name.includes(q));
  const wrap = $('markets-list');
  wrap.innerHTML = marketHeadHtml() + list.map(s => marketRowHtml(s)).join('');
  wrap.querySelectorAll('.market-row').forEach((r,i)=> r.addEventListener('click', ()=> openSymbol(list[i].s)));
  $('markets-search').oninput = renderMarkets;
}
function updateMarketsPrices(){ updateMarketRows($('markets-list')); }
function updateWatchlistPrices(){ updateMarketRows($('watchlist-list')); }
function updateMarketRows(wrap){
  if (!wrap) return;
  wrap.querySelectorAll('.market-row').forEach(r => {
    const s = r.dataset.sym; const t = state.ticks[s]; if (!t) return;
    const price = r.querySelector('.market-price'); if (price) price.textContent = priceFmt(s, t.price);
    const chg = r.querySelector('.market-change');
    if (chg) { chg.textContent = (t.chgPct>=0?'+':'') + t.chgPct.toFixed(2)+'%'; chg.className = 'market-change ' + (t.chgPct>=0?'up':'down'); }
    const hi = r.querySelector('.market-high'); if (hi) hi.textContent = priceFmt(s, t.high);
    const lo = r.querySelector('.market-low'); if (lo) lo.textContent = priceFmt(s, t.low);
    const spark = r.querySelector('svg.spark polyline'); if (spark) spark.setAttribute('points', sparkPoints(s));
  });
}
function marketHeadHtml(){
  return `<div class="market-head"><span>Symbol</span><span style="text-align:right">Last Price</span><span>Change</span><span class="desktop-col" style="text-align:right">24H High / Low</span></div>`;
}
function sparkPoints(sym){
  const data = (state.history[sym] || []).slice(-18);
  if (!data.length) return '';
  const vals = data.map(d=>Number(d.close));
  const min = Math.min(...vals), max = Math.max(...vals), span = max-min || 1;
  return vals.map((v,i)=>`${(i/(vals.length-1))*78},${26-((v-min)/span)*24}`).join(' ');
}
function marketRowHtml(s){
  const t = state.ticks[s.s] || { price:s.p, chgPct:0, high:s.p*1.002, low:s.p*.998 };
  return `<div class="market-row" data-sym="${s.s}">
    <div class="hstack" style="min-width:0">
      <div class="market-flag">${s.s.slice(0,3)}</div>
      <div style="min-width:0"><div class="market-name">${s.name}</div><div class="market-sub">${s.sub}</div></div>
    </div>
    <div class="market-price">${priceFmt(s.s,t.price)}</div>
    <div><div class="market-change ${t.chgPct>=0?'up':'down'}">${(t.chgPct>=0?'+':'')+t.chgPct.toFixed(2)}%</div><svg class="spark" viewBox="0 0 78 28" preserveAspectRatio="none"><polyline points="${sparkPoints(s.s)}" fill="none" stroke="${t.chgPct>=0?'#00e889':'#ff3f57'}" stroke-width="2"/></svg></div>
    <div class="market-highlow desktop-col"><div class="market-high up">${priceFmt(s.s,t.high)}</div><div class="market-low down">${priceFmt(s.s,t.low)}</div></div>
  </div>`;
}

// ---------- CHART ----------
function openSymbol(sym){
  state.activeSymbol = sym;
  const s = SYM_INDEX[sym];
  $('chart-title').textContent = s.name;
  $('chart-sym-name').textContent = s.name;
  $('chart-sym-sub').textContent = s.sub;
  showScreen('chart');
  try { openRealMarketWS(sym); } catch(_){}
}
function ensureChart(){
  if (state.chart) return;
  const el = $('chart-container');
  el.innerHTML = '';
  const chart = LightweightCharts.createChart(el, {
    layout: { background:{ color:'#030b18' }, textColor:'#a7b3cc', fontFamily:"'JetBrains Mono',monospace" },
    grid: { vertLines:{ color:'rgba(82,124,174,.12)' }, horzLines:{ color:'rgba(82,124,174,.12)' } },
    timeScale: { timeVisible:true, secondsVisible:false, borderColor:'rgba(255,255,255,.06)' },
    rightPriceScale: { borderColor:'rgba(255,255,255,.06)' },
    crosshair: { mode: 0 },
    width: el.clientWidth, height: Math.max(320, el.clientHeight || 420),
  });
  const series = chart.addCandlestickSeries({
    upColor:'#00d8ff', downColor:'#7c5cff', wickUpColor:'#00d8ff', wickDownColor:'#7c5cff', borderVisible:false,
    priceLineColor:'#00d8ff', lastValueVisible:true,
  });
  state.chart = chart; state.candleSeries = series;
  new ResizeObserver(()=> chart.applyOptions({ width: el.clientWidth, height: Math.max(320, el.clientHeight || 420) })).observe(el);
  document.querySelectorAll('#tf-row button').forEach(b=>{
    b.onclick = ()=>{ state.timeframe = b.dataset.tf;
      document.querySelectorAll('#tf-row button').forEach(x=>x.classList.toggle('active', x===b));
      seedHistory(); redrawChart();
    };
  });
}
function redrawChart(){
  if (!state.candleSeries) return;
  const data = state.history[state.activeSymbol] || [];
  state.candleSeries.setData(data);
  updateChartHUD();
}
function updateChartHUD(){
  const t = state.ticks[state.activeSymbol];
  if (!t) return;
  const p = priceFmt(state.activeSymbol, t.price);
  $('chart-sym-price').textContent = p;
  const cls = t.change >= 0 ? 'up' : 'down';
  $('chart-sym-price').className = 'sym-price mono ' + cls;
  $('chart-sym-chg').className = 'sym-chg ' + cls;
  $('chart-sym-chg').textContent = `${t.change>=0?'+':''}${t.change.toFixed(5)} (${t.chgPct>=0?'+':''}${t.chgPct.toFixed(2)}%)`;
  $('cs-high').textContent = priceFmt(state.activeSymbol, t.high);
  $('cs-low').textContent = priceFmt(state.activeSymbol, t.low);
  setText('cs-open', priceFmt(state.activeSymbol, t.open));
  setText('cs-close', priceFmt(state.activeSymbol, Math.abs(t.price * 11.37)));
  updateQuickTicket();
}
function toggleFav(){
  const s = state.activeSymbol;
  if (state.favorites.has(s)) state.favorites.delete(s); else state.favorites.add(s);
  localStorage.setItem('gx_favs', JSON.stringify([...state.favorites]));
  $('fav-btn').style.color = state.favorites.has(s) ? 'var(--cyan)' : 'var(--text)';
  showToast(state.favorites.has(s)?'Added to watchlist':'Removed from watchlist');
}
window.toggleFav = toggleFav;

// ---------- PLACE ORDER ----------
function openOrder(side){
  state.side = side;
  showScreen('place');
}
function syncQuickTicket(){
  const lots = $('ct-lots'); if (lots) lots.oninput = updateQuickTicket;
  const lev = $('ct-leverage'); if (lev) lev.onchange = updateQuickTicket;
  const type = $('ct-order-type'); if (type) type.onchange = () => { state.orderType = type.value; };
  updateQuickTicket();
}
function stepQuickLots(delta){
  const src = $('ct-lots'); if (!src) return;
  const v = Math.max(0.01, (parseFloat(src.value)||0)+delta);
  src.value = v.toFixed(2); updateQuickTicket();
}
window.stepQuickLots = stepQuickLots;
function updateQuickTicket(){
  const s = state.activeSymbol; const t = state.ticks[s]; if (!t) return;
  const spread = Math.max(t.price * 0.00002, 0.00002);
  setText('ct-buy-price', `${priceFmt(s, t.price + spread)} BUY`);
  setText('ct-sell-price', `${priceFmt(s, t.price - spread)} SELL`);
  const lots = parseFloat($('ct-lots')?.value)||1;
  const lev = parseInt(($('ct-leverage')?.value||'1:100').split(':')[1])||100;
  const margin = (lots * 100000 * t.price) / lev / (isFx(s)?1:100);
  setText('ct-margin', money(margin));
}
async function quickSubmit(side){
  const lotsEl = $('po-lots'); if (lotsEl) lotsEl.value = ($('ct-lots')?.value || '1.00');
  const levEl = $('po-leverage'); if (levEl) levEl.value = ($('ct-leverage')?.value || '1:100');
  const tpEl = $('po-tp'); if (tpEl) tpEl.value = $('ct-tp')?.value || '';
  const slEl = $('po-sl'); if (slEl) slEl.value = $('ct-sl')?.value || '';
  state.orderType = $('ct-order-type')?.value || 'market';
  state.side = side;
  await submitOrder();
}
window.quickSubmit = quickSubmit;

window.openOrder = openOrder;
function syncPlaceOrder(){
  const s = SYM_INDEX[state.activeSymbol];
  $('po-symbol').textContent = s.name;
  $('po-symbol-sub').textContent = s.sub;
  setSide(state.side);
  updatePlacePrice();
  document.querySelectorAll('.order-type-tabs button').forEach(b=>{
    b.onclick = ()=>{ state.orderType = b.dataset.otype;
      document.querySelectorAll('.order-type-tabs button').forEach(x=>x.classList.toggle('active', x===b));
    };
  });
  $('po-lots').oninput = updatePlacePrice;
}
function setSide(side){
  state.side = side;
  $('po-buy-btn').classList.toggle('active-buy', side==='buy');
  $('po-sell-btn').classList.toggle('active-sell', side==='sell');
  const btn = $('po-submit');
  btn.className = 'submit-btn ' + side;
  updatePlacePrice();
}
window.setSide = setSide;
function stepVol(delta){
  const el = $('po-lots'); const v = Math.max(0.01, (parseFloat(el.value)||0)+delta);
  el.value = v.toFixed(2); updatePlacePrice();
}
window.stepVol = stepVol;
function updatePlacePrice(){
  const s = state.activeSymbol;
  const t = state.ticks[s]; if (!t) return;
  const price = t.price;
  $('po-price').textContent = priceFmt(s, price);
  $('po-submit-price').textContent = priceFmt(s, price);
  $('po-submit').firstChild && ( $('po-submit').innerHTML = `${state.side==='buy'?'Buy':'Sell'} ${SYM_INDEX[s].name} @ <span id="po-submit-price">${priceFmt(s,price)}</span>` );
  const lots = parseFloat($('po-lots').value)||0;
  const lev = parseInt(($('po-leverage').value||'1:100').split(':')[1])||100;
  const contract = 100000;
  const margin = (lots * contract * price) / lev / (isFx(s)?1:100);
  $('po-margin').textContent = money(margin);
  if (state.account) $('po-free').textContent = money(state.account.balance - state.account.used_margin);
}
function isFx(s){ return /^[A-Z]{3}[A-Z]{3}$/.test(s) && !s.startsWith('XA'); }

async function submitOrder(){
  const s = state.activeSymbol;
  const lots = parseFloat($('po-lots').value)||0;
  if (lots<0.01) return showToast('Volume too small','error');
  const lev = parseInt(($('po-leverage').value||'1:100').split(':')[1])||100;
  const price = state.ticks[s]?.price; if (!price) return showToast('No price yet','error');
  const tp = parseFloat($('po-tp').value)||null;
  const sl = parseFloat($('po-sl').value)||null;
  const r = await api('/trade/positions', { method:'POST', body:{
    pair:s, side:state.side, lots, leverage:lev, open_price:price, take_profit:tp, stop_loss:sl,
    order_type: state.orderType,
  }});
  if (!r.ok) return showToast(r.error||'Order failed','error');
  showToast('Order filled', 'success');
  await loadPositions();
  showScreen('positions');
}
window.submitOrder = submitOrder;

// ---------- POSITIONS ----------
function renderPositions(){
  const openPos = state.positions.filter(p=>p.status==='open');
  const closedPos = state.positions.filter(p=>p.status==='closed');
  $('pos-open-count').textContent = openPos.length;
  const activeTab = document.querySelector('#pos-tabs button.active')?.dataset.pos || 'open';
  document.querySelectorAll('#pos-tabs button').forEach(b=>{
    b.onclick = ()=>{ document.querySelectorAll('#pos-tabs button').forEach(x=>x.classList.toggle('active', x===b)); renderPositions(); };
  });
  const list = activeTab==='open' ? openPos : closedPos;
  const totalPnl = list.reduce((acc,p)=> acc + (activeTab==='open' ? unrealized(p) : Number(p.realized_pnl)), 0);
  $('pos-total-pnl').textContent = (totalPnl>=0?'+':'') + money(totalPnl);
  $('pos-total-pnl').className = 'mono ' + (totalPnl>=0?'up':'down');
  const wrap = $('positions-list');
  if (!list.length){ wrap.innerHTML = `<div class="card" style="text-align:center;color:var(--dim);padding:32px">No ${activeTab} positions</div>`; return; }
  wrap.innerHTML = list.map(p => posCardHtml(p, activeTab)).join('');
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = ()=> closePosition(Number(b.dataset.close)));
}
function unrealized(p){
  const cur = state.ticks[p.pair]?.price;
  if (!cur) return 0;
  const contract = 100000;
  const dir = p.side==='buy'?1:-1;
  return dir*(cur - Number(p.open_price)) * Number(p.lots) * contract / (isFx(p.pair)?1:1000);
}
function posCardHtml(p, tab){
  const pnl = tab==='open' ? unrealized(p) : Number(p.realized_pnl);
  const cur = state.ticks[p.pair]?.price;
  return `<div class="pos-card">
    <div class="pos-head">
      <div><div class="pos-pair">${SYM_INDEX[p.pair]?.name || p.pair}</div><div style="font-size:11px;color:var(--dim);margin-top:2px">${p.lots} lots · 1:${p.leverage}</div></div>
      <div class="${p.side==='buy'?'pos-side-buy':'pos-side-sell'}">${p.side.toUpperCase()}</div>
    </div>
    <div class="pos-grid">
      <div>Open<span>${priceFmt(p.pair, Number(p.open_price))}</span></div>
      <div>${tab==='open'?'Current':'Close'}<span>${priceFmt(p.pair, tab==='open' ? cur : Number(p.close_price))}</span></div>
      <div>Margin<span>${money(Number(p.margin))}</span></div>
    </div>
    <div class="pos-pnl">
      <div><div style="font-size:11px;color:var(--dim)">P&amp;L</div><div class="amount ${pnl>=0?'up':'down'}">${pnl>=0?'+':''}${money(pnl)}</div></div>
      ${tab==='open' ? `<button class="close-btn" data-close="${p.id}">Close</button>` : ''}
    </div>
  </div>`;
}
async function closePosition(id){
  const pos = state.positions.find(p=>p.id===id); if (!pos) return;
  const cur = state.ticks[pos.pair]?.price;
  if (!cur) return showToast('No price yet','error');
  const r = await api(`/trade/positions/${id}/close`, { method:'POST', body:{ close_price: cur } });
  if (!r.ok) return showToast('Close failed','error');
  showToast(`Closed ${money(r.pnl)}`, r.pnl>=0?'success':'error');
  await loadPositions();
}
function updatePositionPnLs(){
  const wrap = $('positions-list'); if (!wrap) return;
  // cheap re-render
  renderPositions();
}

// ---------- ORDERS / WATCHLIST / WALLET / PROFILE / ANALYTICS / CALENDAR ----------
function renderWatchlist(){
  const list = ALL_SYMBOLS.filter(s => state.favorites.has(s.s));
  const wrap = $('watchlist-list');
  if (!list.length) { wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim)">Favorite symbols will appear here</div>`; return; }
  wrap.innerHTML = marketHeadHtml() + list.map(marketRowHtml).join('');
  wrap.querySelectorAll('.market-row').forEach((r,i)=> r.addEventListener('click', ()=> openSymbol(list[i].s)));
}
function editWatchlist(){ showScreen('markets'); showToast('Tap ★ on any chart to add'); }
window.editWatchlist = editWatchlist;

function renderWallet(){
  if (!state.account) return;
  const a = state.account;
  $('wallet-total').textContent = money(a.equity);
  $('wallet-balance').textContent = money(a.balance);
  const pnl = a.equity - a.starting_balance;
  $('wallet-pnl').textContent = (pnl>=0?'+':'')+money(pnl);
  $('wallet-pnl').className = 'mono ' + (pnl>=0?'up':'down');
  const closed = state.positions.filter(p=>p.status==='closed').slice(0,8);
  const rows = closed.length ? closed.map(p => txRowHtml(p)).join('') :
    `<div style="text-align:center;color:var(--dim);padding:20px">No transactions yet</div>`;
  $('wallet-txn-list').innerHTML = rows;
}
function txRowHtml(p){
  const pnl = Number(p.realized_pnl||0);
  return `<div class="tx-row">
    <div class="hstack"><div class="tx-icon pnl">↕</div>
      <div><div style="font-weight:600;font-size:13px">${SYM_INDEX[p.pair]?.name || p.pair}</div>
        <div style="font-size:11px;color:var(--dim)">${p.side.toUpperCase()} · ${p.lots} lots</div></div></div>
    <div class="mono ${pnl>=0?'up':'down'}" style="font-weight:700">${pnl>=0?'+':''}${money(pnl)}</div>
  </div>`;
}

function renderProfile(){
  if (!state.account) return;
  const a = state.account;
  $('profile-name').textContent = a.trade_id;
  $('profile-plan').textContent = a.plan + ' · Trader';
  $('profile-avatar').textContent = a.trade_id.slice(-2);
  $('pr-plan').textContent = a.plan;
  $('pr-lev').textContent = '1:'+a.leverage;
  $('pr-bal').textContent = money(a.balance);
  $('pr-eq').textContent = money(a.equity);
  const free = a.balance - a.used_margin;
  $('pr-free').textContent = money(free);
  const marLev = a.used_margin>0 ? (a.equity/a.used_margin*100).toFixed(2)+'%' : '-';
  $('pr-marlev').textContent = marLev;
}

function renderAnalytics(){
  const closed = state.positions.filter(p=>p.status==='closed');
  const wins = closed.filter(p=>Number(p.realized_pnl)>0);
  const totalPnl = closed.reduce((a,p)=>a+Number(p.realized_pnl), 0);
  const wr = closed.length ? (wins.length/closed.length*100).toFixed(1) : '0.0';
  const grossW = wins.reduce((a,p)=>a+Number(p.realized_pnl), 0);
  const grossL = Math.abs(closed.filter(p=>Number(p.realized_pnl)<0).reduce((a,p)=>a+Number(p.realized_pnl), 0));
  const pf = grossL>0 ? (grossW/grossL).toFixed(2) : '-';
  $('an-total-profit').textContent = (totalPnl>=0?'+':'')+money(totalPnl);
  $('an-total-profit').className = 'mono ' + (totalPnl>=0?'up':'down');
  $('an-winrate').textContent = wr+'%';
  $('an-total').textContent = closed.length;
  $('an-pf').textContent = pf;
  const start = state.account?.starting_balance || 10000;
  const dd = closed.length ? Math.max(0, ((start - (start+Math.min(0, totalPnl)))/start*100)) : 0;
  $('an-dd').textContent = dd.toFixed(1)+'%';
  // mini sparkline
  const el = $('analytics-chart');
  el.innerHTML = '';
  if (typeof LightweightCharts !== 'undefined') {
    const chart = LightweightCharts.createChart(el, {
      layout:{background:{color:'#0a1220'}, textColor:'#8aa0c4'},
      grid:{vertLines:{color:'rgba(255,255,255,.03)'}, horzLines:{color:'rgba(255,255,255,.03)'}},
      width: el.clientWidth, height: 180,
      timeScale:{visible:false}, rightPriceScale:{visible:false},
    });
    const s = chart.addAreaSeries({ lineColor:'#22c55e', topColor:'rgba(34,197,94,.35)', bottomColor:'rgba(34,197,94,0)' });
    let bal = start;
    const now = Date.now()/1000;
    const data = [{ time: Math.floor(now-86400*7), value: bal }];
    closed.slice().reverse().forEach((p,i)=>{ bal += Number(p.realized_pnl); data.push({ time: Math.floor(now-86400*7 + i*3600), value: bal }); });
    if (data.length<2) data.push({time: Math.floor(now), value: bal});
    s.setData(data);
  }
}

function renderCalendar(){
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();
  const tabs = [];
  for (let i=-1;i<=3;i++){
    const d = new Date(today); d.setDate(d.getDate()+i);
    tabs.push({ label: days[d.getDay()], day: d.getDate(), key: d.toDateString() });
  }
  const catTabs = $('cal-tabs');
  const activeKey = today.toDateString();
  catTabs.innerHTML = tabs.map(t=>`<button data-k="${t.key}" class="${t.key===activeKey?'active':''}">${t.label}<div class="day">${t.day}</div></button>`).join('');
  catTabs.querySelectorAll('button').forEach(b => b.onclick = ()=>{
    catTabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active', x===b));
  });
  const events = [
    { time:'10:00', title:'US CPI m/m', currency:'USD', impact:'high', a:'0.3%', f:'0.2%' },
    { time:'10:30', title:'US Core Retail Sales m/m', currency:'USD', impact:'high', a:'0.2%', f:'0.3%' },
    { time:'12:30', title:'GBP GDP q/q', currency:'GBP', impact:'medium', a:'0.1%', f:'0.1%' },
    { time:'14:00', title:'EUR ECB Interest Rate', currency:'EUR', impact:'high', a:'4.25%', f:'4.25%' },
    { time:'16:00', title:'USOIL Inventories', currency:'USD', impact:'low', a:'-1.2M', f:'-0.8M' },
  ];
  $('cal-list').innerHTML = events.map(e => `<div class="cal-item">
    <div class="time">${e.time}</div>
    <div><div class="title">${e.currency} · ${e.title}</div><div style="font-size:11px;color:var(--dim);margin-top:2px">A: ${e.a} · F: ${e.f}</div></div>
    <div class="impact impact-${e.impact==='high'?'high':e.impact==='medium'?'med':'low'}">${e.impact.toUpperCase()}</div>
  </div>`).join('');
}

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', async ()=>{
  document.querySelectorAll('.bottom-nav .tab').forEach(t=>{
    t.addEventListener('click', ()=> showScreen(t.dataset.tab));
  });
  await initFeed();
  await loadAccount();
  // Periodic account resync (5s)
  setInterval(()=>{ if (document.visibilityState==='visible') loadAccount(); }, 5000);
});
})();
