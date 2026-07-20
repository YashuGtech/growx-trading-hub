/* GrowX Trade Terminal — v3 (TradingView + Market-only + sticky risk) */
(function(){
'use strict';

// ---------- Symbol catalog ----------
const SYMBOLS = [
  { s:'XAUUSD', name:'XAU/USD', sub:'Gold Spot / U.S. Dollar', tv:'OANDA:XAUUSD', p:2488.56, dec:2 },
  { s:'EURUSD', name:'EUR/USD', sub:'Euro / U.S. Dollar',      tv:'FX:EURUSD',    p:1.07520, dec:5 },
  { s:'AUDUSD', name:'AUD/USD', sub:'Aussie / U.S. Dollar',    tv:'FX:AUDUSD',    p:0.66005, dec:5 },
  { s:'GBPUSD', name:'GBP/USD', sub:'Pound / U.S. Dollar',     tv:'FX:GBPUSD',    p:1.27325, dec:5 },
  { s:'USDJPY', name:'USD/JPY', sub:'U.S. Dollar / Yen',       tv:'FX:USDJPY',    p:199.84,  dec:3 },
  { s:'USDCHF', name:'USD/CHF', sub:'U.S. Dollar / Franc',     tv:'FX:USDCHF',    p:0.5458,  dec:5 },
  { s:'BTCUSD', name:'BTC/USD', sub:'Bitcoin',                  tv:'BINANCE:BTCUSDT', p:67420, dec:2 },
  { s:'ETHUSD', name:'ETH/USD', sub:'Ethereum',                 tv:'BINANCE:ETHUSDT', p:3520.5, dec:2 },
];
const SYM = Object.fromEntries(SYMBOLS.map(x=>[x.s,x]));
const TF_LABEL = {'1':'1m','5':'5m','15':'15m','60':'1h','240':'4h','D':'1D'};

const state = {
  account:null, positions:[], risk:null,
  ticks:{}, activeSymbol:'XAUUSD', timeframe:'D',
  tpOn:true, slOn:true, side:'buy', ws:null, wsSymbol:null, wsConfig:null,
  tvWidget:null, rafPending:false,
};

const $ = id => document.getElementById(id);
const fmtPrice = (sym,n)=> n==null? '-' : Number(n).toFixed(SYM[sym]?.dec ?? 2);
const money = n => (n<0?'-':'') + Math.abs(Number(n||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + ' USD';

function toast(msg,type='success'){ const t=document.createElement('div'); t.className='toast '+type; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2400); }
window.showToast=toast;

async function api(path,opts={}){
  const res = await fetch('/api'+path,{ method:opts.method||'GET', headers: opts.body?{'Content-Type':'application/json'}:{},credentials:'include',body:opts.body?JSON.stringify(opts.body):undefined });
  const json = await res.json().catch(()=>({ok:false}));
  return { status:res.status, ...json };
}
async function logout(){ try{await api('/trade/logout',{method:'POST'});}catch(_){}
  localStorage.removeItem('gx_trade_token'); location.href='trade-terminal-login.html'; }
window.logout=logout;

// ---------- Quote strip ----------
function renderQuoteStrip(){
  const wrap = $('quote-strip');
  wrap.innerHTML = SYMBOLS.map(s=>{
    const t = state.ticks[s.s] || {price:s.p, chgPct:0};
    const cls = (t.chgPct||0) >= 0 ? 'up':'down';
    const sign = (t.chgPct||0) >= 0 ? '+':'';
    return `<div class="quote ${s.s===state.activeSymbol?'active':''}" data-s="${s.s}">
      <div class="q-sym">${s.name}</div>
      <div class="q-row"><span class="q-price">${fmtPrice(s.s,t.price)}</span><span class="q-chg ${cls}">${sign}${(t.chgPct||0).toFixed(2)}%</span></div>
    </div>`;
  }).join('') + `<div class="quote-add" title="Add"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>`;
  wrap.querySelectorAll('.quote').forEach(q=> q.onclick = ()=> selectSymbol(q.dataset.s));
}
function updateQuoteStripPrices(){
  $('quote-strip').querySelectorAll('.quote').forEach(q=>{
    const s = q.dataset.s; const t = state.ticks[s]; if(!t) return;
    q.querySelector('.q-price').textContent = fmtPrice(s,t.price);
    const chg = q.querySelector('.q-chg');
    const cls = (t.chgPct||0)>=0 ?'up':'down'; const sign = (t.chgPct||0)>=0 ? '+':'';
    chg.className = 'q-chg '+cls;
    chg.textContent = sign + (t.chgPct||0).toFixed(2)+'%';
  });
}

// ---------- Symbol selection ----------
function selectSymbol(s){
  if (!SYM[s]) return;
  state.activeSymbol = s;
  $('quote-strip').querySelectorAll('.quote').forEach(q=> q.classList.toggle('active', q.dataset.s===s));
  $('ct-sym').textContent = SYM[s].sub;
  mountTV();
  openRealMarketWS(s);
  updateTicket();
}

// ---------- TradingView widget ----------
let tvChartType = 1; // 1=candles, 3=line, 8=bars, 9=area
function mountTV(){
  if (!window.TradingView) return;
  const container = $('tv_chart_container');
  container.innerHTML='';
  state.tvWidget = new TradingView.widget({
    container_id:'tv_chart_container', autosize:true,
    symbol: SYM[state.activeSymbol].tv,
    interval: state.timeframe, timezone:'Etc/UTC',
    theme:'dark', style: String(tvChartType), locale:'en',
    toolbar_bg:'#000000', enable_publishing:false, hide_top_toolbar:false,
    hide_side_toolbar:false, allow_symbol_change:false, save_image:false,
    withdateranges:false, details:false, calendar:false, hotlist:false,
    studies:[], backgroundColor:'#000000', gridColor:'rgba(255,255,255,0.04)',
  });
  $('ct-tf-lbl').textContent = TF_LABEL[state.timeframe] || '1D';
}
window.cycleChartType = ()=>{ tvChartType = tvChartType===1?9: tvChartType===9?3: tvChartType===3?8:1; mountTV(); };
window.openIndicators = ()=> toast('Use the chart\u2019s indicator icon (top toolbar) to add indicators.','success');
window.toggleWatchlistSheet = ()=> toast('Watchlist','success');

// ---------- Live feed ----------
async function initFeed(){
  const cfg = await api('/chart/config'); state.wsConfig = cfg;
  for (const s of SYMBOLS) state.ticks[s.s] = { price:s.p, open:s.p, high:s.p*1.002, low:s.p*0.998, change:0, chgPct: (Math.random()-.5)*0.5 };
  startSyntheticFeed();
  openRealMarketWS(state.activeSymbol);
}
function tfToRM(tf){ return ({'1':'M1','5':'M5','15':'M15','60':'H1','240':'H4','D':'D1'})[tf] || 'M1'; }
function openRealMarketWS(symbol){
  const cfg = state.wsConfig; if (!cfg || !cfg.ws_base || !cfg.api_key) return;
  try{ if(state.ws) state.ws.close(); }catch(_){}
  const url = `${cfg.ws_base}?apiKey=${encodeURIComponent(cfg.api_key)}&symbolCode=${encodeURIComponent(symbol)}&timeFrame=${encodeURIComponent(tfToRM(state.timeframe))}`;
  try{
    const ws = new WebSocket(url); state.ws=ws; state.wsSymbol=symbol;
    ws.addEventListener('message', ev=>{
      try{ const f=JSON.parse(ev.data);
        const sym=(f.SymbolCode||f.symbol||'').toUpperCase().replace('/','');
        const price=Number(f.Bid??f.ClosePrice??f.close??0);
        if(sym && SYM[sym] && price) applyTick(sym,price);
      }catch(_){}
    });
    ws.addEventListener('close', ()=>{ if(state.wsSymbol===symbol) setTimeout(()=>openRealMarketWS(symbol),4000); });
  }catch(_){}
}
let synInt=null;
function startSyntheticFeed(){ if(synInt) return;
  synInt = setInterval(()=>{
    for(const s of SYMBOLS){ const cur = state.ticks[s.s]?.price ?? s.p;
      const j = cur * (Math.random()-0.5)*0.0006; applyTick(s.s, cur+j);
    }
  }, 1200);
}
function applyTick(sym,price){
  const t = state.ticks[sym] || {price,open:price,high:price,low:price,change:0,chgPct:0};
  t.change = price - t.open; t.chgPct = t.open? (t.change/t.open*100):0;
  t.high = Math.max(t.high,price); t.low = Math.min(t.low,price); t.price = price;
  state.ticks[sym] = t; scheduleUI();
}
function scheduleUI(){ if(state.rafPending) return; state.rafPending=true;
  requestAnimationFrame(()=>{ state.rafPending=false;
    updateQuoteStripPrices(); updateOHLCRow(); updateTicket(); renderPositions();
  });
}
function updateOHLCRow(){
  const s = state.activeSymbol; const t = state.ticks[s]; if(!t) return;
  $('oh-o').textContent = fmtPrice(s,t.open);
  $('oh-h').textContent = fmtPrice(s,t.high);
  $('oh-l').textContent = fmtPrice(s,t.low);
  $('oh-c').textContent = fmtPrice(s,t.price);
  const chgEl = $('oh-chg');
  const cls = t.change>=0?'up':'down';
  chgEl.className = 'v '+cls;
  chgEl.textContent = (t.change>=0?'+':'')+t.change.toFixed(SYM[s]?.dec||2)+' ('+(t.chgPct>=0?'+':'')+t.chgPct.toFixed(2)+'%)';
  ['oh-o','oh-h','oh-l','oh-c'].forEach(id=>{ const e=$(id); if(e) e.className='v '+cls; });
  $('oh-vol').textContent = Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:2}).format(Math.abs(t.price*11370));
}

// ---------- Ticket ----------
function isFx(s){ return /^[A-Z]{6}$/.test(s) && !s.startsWith('XA') && !['BTCUSD','ETHUSD'].includes(s); }
function marginFor(sym,lots,lev,price){
  const contract = 100000;
  return (lots * contract * price) / lev / (isFx(sym)?1:100);
}
function updateTicket(){
  const s = state.activeSymbol; const t = state.ticks[s]; if(!t) return;
  const lots = parseFloat($('tk-lots').value)||0;
  const lev = parseInt(($('tk-lev').value||'1:100').split(':')[1])||100;
  const spread = Math.max(t.price * 0.00003, 0.0001);
  $('btn-buy').textContent = fmtPrice(s, t.price + spread);
  $('btn-sell').textContent = fmtPrice(s, t.price - spread);
  const margin = marginFor(s,lots,lev,t.price);
  $('tk-margin').textContent = money(margin);
  // est profit from TP
  const tp = parseFloat($('tk-tp').value)||0;
  if (tp>0 && state.tpOn){
    const contract=100000; const dir = state.side==='buy'?1:-1;
    const est = dir*(tp - t.price)*lots*contract/(isFx(s)?1:1000);
    const el=$('tk-est'); el.className='v '+(est>=0?'up':'down'); el.textContent=(est>=0?'+':'')+money(est);
  } else { $('tk-est').textContent='—'; $('tk-est').className='v'; }
}
window.toggleTP = ()=>{ state.tpOn=!state.tpOn; $('tp-switch').classList.toggle('on',state.tpOn); $('tk-tp-block').classList.toggle('off',!state.tpOn); };
window.toggleSL = ()=>{ state.slOn=!state.slOn; $('sl-switch').classList.toggle('on',state.slOn); $('tk-sl-block').classList.toggle('off',!state.slOn); };

async function placeTrade(side){
  state.side=side;
  const s = state.activeSymbol; const t = state.ticks[s]; if(!t) return toast('No price yet','error');
  const lots = parseFloat($('tk-lots').value)||0; if(lots<0.01) return toast('Volume too small','error');
  const lev = parseInt(($('tk-lev').value||'1:100').split(':')[1])||100;
  const tp = state.tpOn ? (parseFloat($('tk-tp').value)||null) : null;
  const sl = state.slOn ? (parseFloat($('tk-sl').value)||null) : null;
  const r = await api('/trade/positions',{method:'POST', body:{
    pair:s, side, lots, leverage:lev, open_price:t.price, take_profit:tp, stop_loss:sl, order_type:'market'
  }});
  if(!r.ok) return toast(r.error||'Order failed','error');
  toast((side==='buy'?'Bought ':'Sold ')+lots+' '+SYM[s].name,'success');
  await loadAccount();
}
window.placeTrade = placeTrade;

// ---------- Positions ----------
function unrealized(p){
  const cur = state.ticks[p.pair]?.price; if(!cur) return 0;
  const contract = 100000; const dir = p.side==='buy'?1:-1;
  return dir*(cur - Number(p.open_price)) * Number(p.lots) * contract / (isFx(p.pair)?1:1000);
}
let posTab='open';
function renderPositions(){
  const wrap = $('pos-list'); if(!wrap) return;
  const open = state.positions.filter(p=>p.status==='open');
  const closed = state.positions.filter(p=>p.status==='closed').slice(0,20);
  $('pt-open-n').textContent = open.length;
  const list = posTab==='open'?open:closed;
  if(!list.length){ wrap.innerHTML = '<div class="pos-empty">No '+posTab+' positions</div>'; return; }
  wrap.innerHTML = list.map(p=>{
    const cur = state.ticks[p.pair]?.price;
    const pnl = p.status==='open' ? unrealized(p) : Number(p.realized_pnl||0);
    const cls = pnl>=0?'up':'down';
    return `<div class="pos-row">
      <div class="col-1"><div class="sym">${SYM[p.pair]?.name||p.pair}</div><div class="side ${p.side==='buy'?'up':'down'}">${p.side==='buy'?'Long':'Short'} · ${p.lots} @ 1:${p.leverage}</div></div>
      <div class="m"><div style="color:var(--dim);font-size:11px">Entry / ${p.status==='open'?'Now':'Close'}</div><div>${fmtPrice(p.pair,Number(p.open_price))} → ${fmtPrice(p.pair, p.status==='open'?cur:Number(p.close_price))}</div></div>
      <div class="m" style="text-align:right"><div class="${cls}" style="font-weight:800;font-size:14px">${pnl>=0?'+':''}${money(pnl)}</div>${p.status==='open'?`<button onclick="closePos(${p.id})" style="margin-top:4px;padding:4px 10px;border-radius:8px;border:1px solid var(--line);background:#0a0e1a;color:var(--text);font-size:11px;font-weight:700">Close</button>`:''}</div>
    </div>`;
  }).join('');
}
window.closePos = async (id)=>{
  const pos = state.positions.find(p=>p.id===id); if(!pos) return;
  const cur = state.ticks[pos.pair]?.price; if(!cur) return toast('No price yet','error');
  const r = await api(`/trade/positions/${id}/close`,{method:'POST', body:{close_price:cur}});
  if(!r.ok) return toast('Close failed','error');
  toast(`Closed ${money(r.pnl)}`, r.pnl>=0?'success':'error');
  await loadAccount();
};

// ---------- Account render ----------
function renderAccount(){
  const a = state.account; if(!a) return;
  const used = Number(a.used_margin||0); const eq = Number(a.equity||0); const bal = Number(a.balance||0);
  const free = bal - used; const mlvl = used>0? (eq/used*100).toFixed(2):'—';
  const set = (id,v)=>{ const e=$(id); if(e) e.innerHTML = v; };
  set('s-balance', bal.toFixed(2)+' <span class="u">USD</span>');
  set('s-equity', eq.toFixed(2)+' <span class="u">USD</span>');
  set('s-tmargin', used.toFixed(2)+' <span class="u">USD</span>');
  set('s-fmargin', free.toFixed(2)+' <span class="u">USD</span>');
  set('s-mlevel', mlvl+' <span class="u">%</span>');
  $('user-avatar').textContent = (a.trade_id||'GX').slice(-2);
  // Tools tab
  $('acc-trade-id').textContent = a.trade_id||'—';
  $('acc-plan').textContent = a.plan||'—';
  $('acc-phase').textContent = (a.phase||'phase_1').replace('_',' ');
  const status = (a.status||'active');
  const stEl=$('acc-status'); stEl.textContent = status; stEl.className = 'v '+(status==='active'?'up':'down');
  const r = state.risk||{};
  $('risk-daily').textContent = (r.daily_loss_pct||0).toFixed(2)+'%';
  $('risk-overall').textContent = (r.overall_loss_pct||0).toFixed(2)+'%';
  // suspended banner
  const suspended = !!r.suspended_today && status!=='eliminated';
  $('suspended-banner').style.display = suspended?'flex':'none';
}
function showBreach(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('screen-breached').classList.add('active');
  const r = state.risk||{};
  $('breach-reason').textContent = state.account?.elimination_reason || 'Your account has breached the 8% overall loss limit.';
  $('breach-daily').textContent = (r.daily_loss_pct||0).toFixed(2)+'% ($'+(r.daily_loss||0).toFixed(2)+')';
  $('breach-overall').textContent = (r.overall_loss_pct||0).toFixed(2)+'% ($'+(r.overall_loss||0).toFixed(2)+')';
}
async function loadAccount(){
  const r = await api('/trade/account');
  if(!r.ok){ location.href='trade-terminal-login.html'; return; }
  state.account = r.account; state.positions = r.positions||[]; state.risk = r.risk||null;
  if (state.account?.status==='eliminated') { renderAccount(); showBreach(); return; }
  renderAccount(); renderPositions();
}

// ---------- Wire UI ----------
function wire(){
  // TF buttons
  document.querySelectorAll('#tf-group button').forEach(b=>{
    b.onclick = ()=>{ state.timeframe = b.dataset.tf;
      document.querySelectorAll('#tf-group button').forEach(x=>x.classList.toggle('active',x===b));
      $('ct-tf-lbl').textContent = TF_LABEL[state.timeframe]||'1D';
      mountTV(); openRealMarketWS(state.activeSymbol);
    };
  });
  // Lots chips
  document.querySelectorAll('.chip-grid button').forEach(b=>{
    b.onclick = ()=>{ document.querySelectorAll('.chip-grid button').forEach(x=>x.classList.toggle('active',x===b));
      $('tk-lots').value = Number(b.dataset.lots).toFixed(2); updateTicket();
    };
  });
  // Ticket inputs
  ['tk-lots','tk-lev','tk-tp','tk-sl'].forEach(id=>{ const e=$(id); if(e) e.oninput = updateTicket; e && (e.onchange=updateTicket); });
  // Ticket tabs
  document.querySelectorAll('.ticket-tabs button').forEach(b=>{
    b.onclick = ()=>{ document.querySelectorAll('.ticket-tabs button').forEach(x=>x.classList.toggle('active',x===b));
      const tk = b.dataset.tk;
      $('tk-trade').style.display = tk==='trade'?'':'none';
      $('tk-tools').style.display = tk==='tools'?'':'none';
    };
  });
  // Position tabs
  document.querySelectorAll('.pos-tabs button').forEach(b=>{
    b.onclick = ()=>{ document.querySelectorAll('.pos-tabs button').forEach(x=>x.classList.toggle('active',x===b));
      posTab = b.dataset.pt; renderPositions();
    };
  });
  // Symbol search filter
  const sr = $('sym-search'); if(sr) sr.oninput = ()=>{
    const q = sr.value.toUpperCase();
    document.querySelectorAll('.quote').forEach(el=>{
      const s = el.dataset.s; el.style.display = (!q || s.includes(q)) ? '' : 'none';
    });
  };
}

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', async ()=>{
  wire(); renderQuoteStrip();
  await initFeed();
  mountTV();
  await loadAccount();
  updateTicket();
  setInterval(()=>{ if(document.visibilityState==='visible') loadAccount(); }, 5000);
});
})();
