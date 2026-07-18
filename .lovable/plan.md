## Already shipped in this turn
- Real wallet addresses wired into payment flow:
  - EVM (ERC20/BEP20/Polygon/Arbitrum/Avalanche/Base/Optimism): `0xb3f27d0433191E2FD554448AF53Db61Eb043cdB4`
  - TRC20: `TCazUzQb4CqpBtrLsNtbVc44wYfxkw2XW2`
  - Solana: `DChYg7oNrutxaTR4hBz157YREXsuvKaPDw5jo4guUW19`
  - TON: `UQAqU4k5MV87GuXES4YgmfQRG8ychAckqTNEGblFIwJfQ_w8`

## Why this needs phases, not one turn
Everything below touches ~40 files, adds 6 new DB tables, rebuilds 3 full apps (user dashboard, admin, manager), a new trading terminal, and a mobile pass on 15 pages. Attempting it in one turn = broken build, no way to review. I'll ship each phase, you verify, then I move to the next.

## Phase A — Trading terminal redesign (Binance/MT5 dark-blue premium)
- New palette: deep navy `#0b1220` → `#0f1a2e`, cyan `#00d4ff`, violet `#7c5cff` accents. Zero yellow anywhere.
- Full-screen layout on desktop: collapsible left watchlist, center chart, right order ticket, bottom positions/history tabs.
- Real logo from your upload as the terminal brand mark (via lovable-assets).
- Custom candlestick canvas (no TradingView branding at all) fed by RealMarket WS, with M1/M5/M15/H1/H4/D1 timeframe switcher and 20+ symbols pulled from the API symbol list endpoint.
- Smooth animations: order-fill toast, ticker flash on price change, sidebar slide, tab crossfade.
- **Risk engine (server-side):** every tick recomputes equity. On daily loss ≥5% OR overall loss ≥8% → account `status='eliminated'`, all positions force-closed, login blocked with "Account breached — buy new funded account" screen linking to Accounts.

## Phase B — User dashboard rebuild
Real routes backed by DB, no localStorage state:
- Active / Inactive / Eliminated funded accounts with phase badges
- Metrics: equity, PnL, daily loss %, DD %, days traded
- Buy Funded Account CTA
- Notifications feed (from `notifications` table, realtime poll 5s)
- Purchase history + downloadable invoice PDF per order
- Payouts: request form, saved methods, status timeline (Pending/Processing/Completed/Rejected), history
- Certificates: auto-generated PDF (phase pass, live funded, payout milestone)
- Offers / referrals / coupons
- Support tickets: create with attachments, reply thread, status chips (Open/In Progress/Awaiting User/Resolved/Closed)
- Searchable FAQ
- Fully responsive: mobile bottom-nav, tablet 2-col, desktop 3-col

## Phase C — Admin & Manager panels
- Role-gated server routes (`role in ('admin','manager')` verified on every API call, not just page load)
- Real-time dashboards (5s poll) driven by `users`, `orders`, `trade_accounts`, `payout_requests`, `support_tickets`
- 2-Step approval UI:
  - Queue of Phase 1 completions → Approve (issues Phase 2 credentials + email) / Reject (with reason + email)
  - Queue of Phase 2 completions → Approve (issues Live Funded credentials + email) / Reject
- Payout approval queue with mark-paid + tx hash
- Ticket inbox with reply + status change
- User search, account freeze/unfreeze, manual credential re-send

## Phase D — Payout methods + payout requests UI
- Saved methods (USDT TRC20/ERC20/BEP20, bank) with default flag
- Request flow: amount → method → confirm → row in `payout_requests`
- Status timeline component reused on dashboard + admin

## Phase E — Certificates & referrals
- Server-generated PDF certificates (pdf-lib) on phase pass + live funded + each payout
- Referral code per user, tracked signups, % of referred fees credited, redeemable to payout

## Phase F — Mobile pass on remaining pages
`home`, `how-it-works`, `faq`, `contact`, `login`, `signup`, `verify-email`, `forgot`, `reset-password`, `waiting`, `download`, `checkout`. Fluid type, safe-area padding, hamburger nav, no horizontal scroll at 360px.

## Delivery order I recommend
A (terminal) → B (dashboard) → C (admin/manager + 2-step) → D (payouts) → E (certs/referrals) → F (mobile pass).

## What I need from you to start Phase A
1. Confirm the delivery order above, or reorder.
2. Confirm: OK to use your uploaded logo as the terminal brand mark (I'll register it via lovable-assets, not commit the binary).
3. Symbol list — keep the 6 (XAUUSD, EURUSD, GBPUSD, BTCUSD, ETHUSD, USDJPY) or expand? RealMarket supports many more.
4. Elimination behaviour — hard ban (must buy new account) or 24h cooldown + one free retry? You said hard ban; confirming.

Reply "go A" (or reorder) and I start immediately.