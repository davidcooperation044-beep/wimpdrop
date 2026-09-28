-- Paste into the Supabase SQL editor and run once.
-- Backs the shipping-quote edge function's cache (see supabase/functions/shipping-quote).
create table if not exists public.shipping_quote_cache (
  cache_key   text primary key,
  quote       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Only the shipping-quote edge function (service role) reads/writes this —
-- browsers never touch it directly, so RLS stays locked down by default.
alter table public.shipping_quote_cache enable row level security;