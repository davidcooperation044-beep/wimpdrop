-- Server-owned payment intents and admin alerts for automated fulfillment.

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tx_ref text not null unique,
  user_id uuid,
  expected_amount numeric(12, 2) not null,
  currency text not null default 'NGN',
  shipping_address jsonb not null,
  cart_items jsonb not null,
  status text not null default 'pending',
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  order_id uuid references public.orders(id) on delete cascade,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payment_intents enable row level security;
alter table public.admin_alerts enable row level security;
