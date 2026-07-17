# GrowX — Full Rebuild Plan

This is a large, multi-system change. I'll break it into phases so we can ship and verify each piece rather than one giant unreviewable batch. Please confirm this plan (or tell me which phases to drop / reorder) before I start.

## Scope summary

1. **Brand & copy sweep** — remove every "FundedNXT" / "Funded NXT" reference, replace with "GrowX". Remove all emoji from UI; swap to inline SVG icons.
2. **New plans & pricing** — rebuild Accounts page around 2-Step and 1-Step challenges with the exact sizes, prices, and rules you listed.
3. **Payment page mobile fix** — Binance-style layout, big QR, tap-to-copy address with visible full string, network selector, countdown, mobile-first.
4. **Trading terminal rebuild** — Binance-inspired desktop layout, remove Economic Calendar / Transfer / Swap / Deposit. Replace TradingView with a live chart powered by the RealMarket WebSocket API (`wss://api.realmarketapi.com/price`). Live balance/PnL persisted to DB and mirrored on the user dashboard.
5. **User dashboard rebuild** — active/inactive accounts, metrics, buy-account CTA, notifications, purchase history w/ invoices, payouts (request + history + statuses), certificates, offers/referrals, FAQ, support tickets w/ attachments + statuses, real-time updates.
6. **Two-Step approval flow** — Phase 1 → admin approve/reject → Phase 2 credentials emailed → Phase 2 → admin approve → Live Funded credentials emailed → payouts unlocked. 1-Step: single phase → approve → Live.
7. **Admin & Manager panels** — real security (hashed passwords in `users` table with `role` column, session-gated, no hardcoded `admin@mail/1234`), remove all seeded fake users, show only real users/funds/orders, real-time polling, approve/reject phases, issue credentials, manage payouts and tickets.
8. **Database** — extend schema: `challenge_phase`, `phase_status`, `payout_requests`, `payout_methods`, `notifications`, `certificates`, `offers`, `referrals`, `ticket_replies`, `ticket_attachments`, admin/manager role rows. All with RLS + GRANTs.
9. **End-to-end verification** — Playwright: signup → buy 2-Step $10k → pay → Phase 1 credentials → hit target in terminal → request approval → admin approves → Phase 2 credentials emailed → repeat → Live Funded → payout request → admin marks paid.

## Technical notes

- Chart: browser-side WebSocket to `wss://api.realmarketapi.com/price?apiKey=…&symbolCode=…&timeFrame=…`, rendered on a lightweight canvas candlestick (no TradingView). Symbol picker: XAUUSD, EURUSD, GBPUSD, BTCUSD, ETHUSD, USDJPY. API key read from a public config endpoint so it can be rotated without redeploy.
- Terminal PnL: every order fill writes to `trade_positions`; a server tick recomputes equity vs. `starting_balance` and pushes to `trade_accounts.balance` + `equity`. Dashboard polls `/api/accounts/mine` every 5s.
- Admin/Manager auth: `users.role in ('user','manager','admin')`, login through the same `/api/auth/login`, panel routes gated server-side by role. Seeded admin/manager rows removed; you'll create the first admin via a one-time setup token printed to server logs, or I can seed one pair of real credentials you give me.
- Emails: SMTP2GO for credentials, phase approvals, payout status.
- All fake/demo rows purged from `users`, `orders`, `trade_accounts`, `deposits`, `withdrawals`, `support_tickets`.

## Proposed delivery order

1. Schema migration + purge fake data + role-based auth.
2. Brand/emoji sweep + Accounts page with new plans/pricing.
3. Payment page mobile redesign.
4. Trading terminal redesign + RealMarket chart + live balance sync.
5. Two-Step / One-Step phase flow + emails.
6. Dashboard rebuild (accounts, payouts, tickets, notifications, certificates, offers).
7. Admin + Manager panels rebuilt on real data with real-time polling.
8. Playwright end-to-end run, fix, ship.

## What I need from you before starting

1. **Admin + Manager seed credentials** — give me one real email + password for each, or say "generate and email me". I will not keep `admin@mail / 1234`.
2. **Sender domain for emails** — keep `support@growxofficial.com` on SMTP2GO, or switch?
3. **Chart symbols** — the 6 above OK, or a different list?
4. **Certificates** — auto-generated PDF from a template, or upload-only by admin?
5. **Referrals** — flat % of referred user's fees, or fixed bounty? What amount?

Reply with answers (or "you decide on 3–5, here are creds for 1–2") and I'll start Phase 1 immediately.
