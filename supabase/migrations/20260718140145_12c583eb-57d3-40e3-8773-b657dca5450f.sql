ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS elimination_reason TEXT NULL;
CREATE INDEX IF NOT EXISTS trade_accounts_status_idx ON public.trade_accounts (status);