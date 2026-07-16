
-- USERS
CREATE TABLE public.users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  country_code TEXT,
  phone TEXT,
  country TEXT,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.users TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_otps (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup','reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_otps TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_otps_id_seq TO service_role;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_otps_lookup ON public.email_otps(email, purpose, expires_at);

CREATE TABLE public.sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ORDERS / PAYMENTS
CREATE TABLE public.orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan TEXT,
  balance TEXT,
  price_usd NUMERIC(10,2),
  network TEXT,
  tx_hash TEXT,
  hash_file TEXT,
  status TEXT DEFAULT 'pending_payment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.orders_id_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  order_id BIGINT,
  amount_usdt NUMERIC(12,2),
  network TEXT,
  tx_hash TEXT,
  blockchain_status TEXT DEFAULT 'pending',
  internal_status TEXT DEFAULT 'pending_verification',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);
GRANT ALL ON public.deposits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.deposits_id_seq TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount_usdt NUMERIC(12,2),
  wallet_address TEXT,
  network TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  admin_notes TEXT
);
GRANT ALL ON public.withdrawals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.withdrawals_id_seq TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.refunds (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  order_id BIGINT,
  amount_usdt NUMERIC(12,2),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  admin_id TEXT
);
GRANT ALL ON public.refunds TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.refunds_id_seq TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- SUPPORT / OPS
CREATE TABLE public.support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  subject TEXT,
  body TEXT,
  category TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT ALL ON public.support_tickets TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_tickets_id_seq TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.complaints (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  target TEXT,
  body TEXT,
  severity TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT ALL ON public.complaints TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.complaints_id_seq TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kyc_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  doc_type TEXT,
  doc_number TEXT,
  full_name TEXT,
  country TEXT,
  document_image TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id TEXT,
  reviewer_notes TEXT
);
GRANT ALL ON public.kyc_records TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kyc_records_id_seq TO service_role;
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id BIGSERIAL PRIMARY KEY,
  case_type TEXT,
  case_id BIGINT,
  user_id BIGINT,
  direction TEXT,
  body TEXT,
  sender_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.messages_id_seq TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_queue (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT,
  to_name TEXT,
  subject TEXT,
  body TEXT,
  template TEXT,
  status TEXT DEFAULT 'queued',
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error TEXT
);
GRANT ALL ON public.email_queue TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_queue_id_seq TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.internal_notes (
  id BIGSERIAL PRIMARY KEY,
  case_type TEXT,
  case_id BIGINT,
  author TEXT,
  body TEXT,
  visibility TEXT DEFAULT 'internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_notes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.internal_notes_id_seq TO service_role;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.escalations (
  id BIGSERIAL PRIMARY KEY,
  case_type TEXT,
  case_id BIGINT,
  from_level TEXT,
  to_level TEXT,
  reason TEXT,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  escalated_by TEXT
);
GRANT ALL ON public.escalations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.escalations_id_seq TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.financial_reports (
  id BIGSERIAL PRIMARY KEY,
  report_kind TEXT,
  period TEXT,
  metric TEXT,
  amount_usdt NUMERIC(14,2),
  count INT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.financial_reports TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.financial_reports_id_seq TO service_role;
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT,
  actor_type TEXT,
  action TEXT,
  target_type TEXT,
  target_id BIGINT,
  metadata JSONB,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.activity_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.activity_logs_id_seq TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- TRADING ACCOUNTS
CREATE TABLE public.trade_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  order_id BIGINT,
  trade_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_plain TEXT,
  plan TEXT NOT NULL,
  starting_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  equity NUMERIC(14,2) NOT NULL DEFAULT 0,
  used_margin NUMERIC(14,2) NOT NULL DEFAULT 0,
  leverage INT NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);
GRANT ALL ON public.trade_accounts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_accounts_id_seq TO service_role;
ALTER TABLE public.trade_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trade_positions (
  id BIGSERIAL PRIMARY KEY,
  trade_account_id BIGINT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  lots NUMERIC(8,2) NOT NULL,
  leverage INT NOT NULL DEFAULT 100,
  open_price NUMERIC(18,8) NOT NULL,
  close_price NUMERIC(18,8),
  stop_loss NUMERIC(18,8),
  take_profit NUMERIC(18,8),
  margin NUMERIC(14,2) NOT NULL DEFAULT 0,
  realized_pnl NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  order_type TEXT NOT NULL DEFAULT 'market',
  open_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  close_time TIMESTAMPTZ
);
GRANT ALL ON public.trade_positions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trade_positions_id_seq TO service_role;
ALTER TABLE public.trade_positions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tp_open ON public.trade_positions(trade_account_id, status);

CREATE TABLE public.trade_sessions (
  token TEXT PRIMARY KEY,
  trade_account_id BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.trade_sessions TO service_role;
ALTER TABLE public.trade_sessions ENABLE ROW LEVEL SECURITY;
