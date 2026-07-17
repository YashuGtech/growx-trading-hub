
-- 1) Role column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
UPDATE public.users SET role = CASE WHEN is_admin THEN 'admin' ELSE 'user' END WHERE role = 'user';

-- 2) Trade account phase fields
ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS challenge_type text NOT NULL DEFAULT '2-step',   -- '1-step' | '2-step' | 'live'
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'phase_1',           -- 'phase_1'|'phase_2'|'live'
  ADD COLUMN IF NOT EXISTS phase_status text NOT NULL DEFAULT 'in_progress',-- 'in_progress'|'pending_review'|'passed'|'failed'|'rejected'
  ADD COLUMN IF NOT EXISTS profit_target_pct numeric(6,2) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS daily_loss_pct    numeric(6,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_loss_pct      numeric(6,2) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS min_trading_days  integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS profit_split_pct  numeric(6,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS refund_eligible   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_taken     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_account_id bigint REFERENCES public.trade_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reject_reason     text;

-- 3) Payout methods
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL,          -- 'usdt' | 'bank' | 'paypal'
  network text,
  wallet_address text,
  bank_name text,
  bank_account text,
  paypal_email text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payout_methods_id_seq TO authenticated, service_role;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

-- 4) Payout requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trade_account_id bigint NOT NULL REFERENCES public.trade_accounts(id) ON DELETE CASCADE,
  amount_usd numeric(14,2) NOT NULL,
  payout_method_id bigint REFERENCES public.payout_methods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|processing|completed|rejected
  admin_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payout_requests_id_seq TO authenticated, service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 5) Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,       -- payout|approval|news|promotion|ticket
  title text NOT NULL,
  body text,
  href text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_id_seq TO authenticated, service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 6) Purge fake / demo seeded users (server enforces auth so this is safe)
DELETE FROM public.users WHERE email IN ('admin@mail','manager@mail');
