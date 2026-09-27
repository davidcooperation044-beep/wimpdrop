-- Real marketplace data support for truthful bestseller, supplier verification, deals, and reviews

alter table public.products
  add column if not exists sold_count integer not null default 0,
  add column if not exists is_verified boolean not null default false;

create table if not exists public.product_deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null default 'Deal',
  deal_price numeric(12,2) not null default 0,
  original_price numeric(12,2) not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_deals_deal_price_check check (deal_price >= 0),
  constraint product_deals_original_price_check check (original_price >= 0)
);

create index if not exists product_deals_product_active_idx
  on public.product_deals (product_id, is_active, ends_at);

alter table public.reviews
  add column if not exists is_verified_purchase boolean not null default false,
  add column if not exists is_approved boolean not null default true,
  add column if not exists review_source text not null default 'site';

create index if not exists reviews_is_approved_idx
  on public.reviews (is_approved, created_at desc);

create or replace function public.order_item_quantity_from_json(item jsonb)
returns numeric
language plpgsql
immutable
as $$
begin
  if item is null or item = 'null'::jsonb then
    return 0;
  end if;

  if jsonb_typeof(item) <> 'object' then
    return 0;
  end if;

  return coalesce(
    (item->>'quantity')::numeric,
    (item->>'qty')::numeric,
    (item->>'count')::numeric,
    (item->>'units')::numeric,
    1
  );
exception when invalid_text_representation then
  return 0;
end;
$$;

create or replace function public.extract_order_items_payload(order_row public.orders)
returns jsonb
language plpgsql
immutable
as $$
begin
  if order_row.items is not null and jsonb_typeof(order_row.items) = 'array' then
    return order_row.items;
  end if;

  if order_row.order_items is not null and jsonb_typeof(order_row.order_items) = 'array' then
    return order_row.order_items;
  end if;

  return '[]'::jsonb;
end;
$$;

create or replace function public.refresh_products_sold_count()
returns void
language plpgsql
as $$
begin
  with aggregated as (
    select
      coalesce(
        item->>'product_id',
        item->>'productId',
        item->>'productID',
        item->'product'->>'id',
        item->>'id'
      ) as product_id,
      sum(public.order_item_quantity_from_json(item)) as total_sold
    from public.orders o
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(public.extract_order_items_payload(o)) = 'array' then public.extract_order_items_payload(o)
        else '[]'::jsonb
      end
    ) as item
    where o.status in ('paid', 'completed', 'fulfilled', 'shipped')
      and coalesce(item->>'product_id', item->>'productId', item->>'productID', item->'product'->>'id', item->>'id', '') <> ''
    group by coalesce(
      item->>'product_id',
      item->>'productId',
      item->>'productID',
      item->'product'->>'id',
      item->>'id'
    )
  )
  update public.products p
  set sold_count = coalesce(a.total_sold, 0)
  from aggregated a
  where p.id::text = a.product_id;

  update public.products p
  set sold_count = 0
  where p.id::text not in (
    select distinct coalesce(
      item->>'product_id',
      item->>'productId',
      item->>'productID',
      item->'product'->>'id',
      item->>'id'
    )
    from public.orders o
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(public.extract_order_items_payload(o)) = 'array' then public.extract_order_items_payload(o)
        else '[]'::jsonb
      end
    ) as item
    where o.status in ('paid', 'completed', 'fulfilled', 'shipped')
      and coalesce(item->>'product_id', item->>'productId', item->>'productID', item->'product'->>'id', item->>'id', '') <> ''
  );
end;
$$;

create or replace function public.refresh_products_sold_count_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_products_sold_count();
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_products_sold_count on public.orders;
create trigger trg_refresh_products_sold_count
after insert or update of status, items, order_items or delete
on public.orders
for each statement
execute function public.refresh_products_sold_count_trigger();

create or replace function public.sync_product_review_stats()
returns void
language plpgsql
as $$
begin
  update public.products p
  set reviews_count = (
    select count(*)
    from public.reviews r
    where r.product_id = p.id and r.is_approved = true
  ),
      rating = coalesce(
        (
          select round(avg(r.rating)::numeric, 2)
          from public.reviews r
          where r.product_id = p.id and r.is_approved = true
        ),
        0
      );
end;
$$;

create or replace function public.sync_review_stats_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.sync_product_review_stats();
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_product_review_stats on public.reviews;
create trigger trg_sync_product_review_stats
after insert or update of product_id, rating, is_approved or delete
on public.reviews
for each row
execute function public.sync_review_stats_trigger();

select public.refresh_products_sold_count();
select public.sync_product_review_stats();

alter table public.product_deals enable row level security;

create policy "Public can view active product deals"
on public.product_deals
for select
using (is_active = true and (ends_at is null or ends_at > now()));

create policy "Admins can manage product deals"
on public.product_deals
for all
using (exists (
  select 1
  from public.user_profiles up
  where up.id = auth.uid() and up.is_admin = true
))
with check (exists (
  select 1
  from public.user_profiles up
  where up.id = auth.uid() and up.is_admin = true
));

create policy "Users can view approved reviews"
on public.reviews
for select
using (is_approved = true);

create policy "Users can insert reviews"
on public.reviews
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
on public.reviews
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own reviews"
on public.reviews
for delete
using (auth.uid() = user_id);
