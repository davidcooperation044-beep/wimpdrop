-- CJ supplier catalog, token cache, sync state, and fulfillment state.
-- Additive migration: existing storefront columns are preserved.

alter table public.products
  add column if not exists supplier text,
  add column if not exists supplier_product_id text,
  add column if not exists supplier_variant_id text,
  add column if not exists supplier_sku text,
  add column if not exists supplier_cost numeric(12, 2),
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_status text not null default 'pending',
  add column if not exists sync_error text;

create unique index if not exists products_supplier_variant_uidx
  on public.products (supplier, supplier_variant_id);
create index if not exists products_supplier_sync_idx
  on public.products (supplier, sync_status, last_synced_at);

alter table public.orders
  add column if not exists supplier text,
  add column if not exists supplier_order_id text,
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists fulfillment_attempts integer not null default 0,
  add column if not exists fulfillment_next_retry_at timestamptz,
  add column if not exists fulfillment_last_error text,
  add column if not exists fulfillment_updated_at timestamptz;

create index if not exists orders_fulfillment_queue_idx
  on public.orders (fulfillment_status, fulfillment_next_retry_at);

alter table public.payments
  add column if not exists provider text,
  add column if not exists provider_transaction_id text,
  add column if not exists verified_at timestamptz;

create table if not exists public.integration_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.integration_settings (key, value)
values ('cj', '{"markup_percent": 30, "import_requires_review": true}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.cj_token_cache (
  id boolean primary key default true check (id),
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_sync_runs (
  id uuid primary key default gen_random_uuid(),
  supplier text not null,
  sync_type text not null check (sync_type in ('stock', 'product_import')),
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  products_checked integer not null default 0,
  products_changed integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  attempt integer not null default 0,
  status text not null,
  error text,
  response jsonb,
  created_at timestamptz not null default now()
);

alter table public.integration_settings enable row level security;
alter table public.cj_token_cache enable row level security;
alter table public.supplier_sync_runs enable row level security;
alter table public.fulfillment_events enable row level security;

-- These service tables are intentionally service-role-only. No client policy is added.
