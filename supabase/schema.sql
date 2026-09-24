-- Wimp-Drop schema for Supabase
-- This file is the canonical database definition for the storefront, CJ supplier flow,
-- payment processing, and admin review features.

create extension if not exists pgcrypto;

-- =========================================
-- Auth/profile tables
-- =========================================

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- Catalog / product tables
-- =========================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  title text,
  description text,
  category text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) default 0,
  image_url text,
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  supplier text not null default 'Wimp-Drop Catalog',
  supplier_product_id text,
  supplier_variant_id text,
  supplier_sku text,
  supplier_cost numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  rating numeric(3,2) not null default 0,
  reviews_count integer not null default 0,
  is_active boolean not null default true,
  is_published boolean not null default true,
  sync_status text not null default 'pending',
  sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_supplier_variant_uidx
  on public.products (supplier, supplier_variant_id)
  where supplier is not null and supplier_variant_id is not null;

create index if not exists products_supplier_sync_idx
  on public.products (supplier, sync_status, last_synced_at);

create index if not exists products_is_published_idx
  on public.products (is_published, sync_status);

-- =========================================
-- Checkout / order tables
-- =========================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  order_number text unique,
  status text not null default 'pending',
  total_amount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_address jsonb,
  billing_address jsonb,
  items jsonb,
  order_items jsonb,
  shipping_method text,
  payment_ref text,
  tracking_number text,
  carrier text,
  notes text,
  supplier text,
  supplier_order_id text,
  fulfillment_status text not null default 'pending',
  fulfillment_attempts integer not null default 0,
  fulfillment_next_retry_at timestamptz,
  fulfillment_last_error text,
  fulfillment_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shipped_at timestamptz,
  delivered_at timestamptz
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_fulfillment_queue_idx
  on public.orders (fulfillment_status, fulfillment_next_retry_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'NGN',
  payment_method text,
  payment_status text,
  flutterwave_ref text,
  provider text,
  provider_transaction_id text,
  transaction_id text,
  receipt_url text,
  metadata jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_flutterwave_ref_idx on public.payments (flutterwave_ref);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tx_ref text not null unique,
  user_id uuid references public.user_profiles(id) on delete set null,
  expected_amount numeric(12,2) not null,
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

-- =========================================
-- Wishlist / reviews
-- =========================================

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists wishlist_user_id_idx on public.wishlist (user_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  content text,
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_user_id_idx on public.reviews (user_id);

-- =========================================
-- Supplier / CJ integration tables
-- =========================================

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
  open_id text,
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

create index if not exists fulfillment_events_order_id_idx
  on public.fulfillment_events (order_id, created_at);

-- =========================================
-- Row Level Security (recommended)
-- =========================================

alter table public.user_profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.wishlist enable row level security;
alter table public.reviews enable row level security;
alter table public.integration_settings enable row level security;
alter table public.cj_token_cache enable row level security;
alter table public.supplier_sync_runs enable row level security;
alter table public.fulfillment_events enable row level security;
alter table public.payment_intents enable row level security;
alter table public.admin_alerts enable row level security;

-- Public read access for published products
create policy "Products can be viewed by everyone" on public.products
for select using (is_published = true);

-- Users may view their own profile/order records and wishlist
create policy "Users can view their own profile" on public.user_profiles
for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.user_profiles
for update using (auth.uid() = id);

create policy "Users can view their own orders" on public.orders
for select using (auth.uid() = user_id);

-- Default deny for service tables; service-role only should be used by Edge Functions.
-- These tables are intentionally not exposed to the browser.
