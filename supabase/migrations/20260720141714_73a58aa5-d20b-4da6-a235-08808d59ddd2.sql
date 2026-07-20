
ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS daily_loss_peak_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_loss_peak_date date,
  ADD COLUMN IF NOT EXISTS overall_loss_peak_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_equity numeric,
  ADD COLUMN IF NOT EXISTS daily_lock_date date;
