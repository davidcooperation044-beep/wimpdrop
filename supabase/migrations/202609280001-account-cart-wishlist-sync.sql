-- Account-synced cart + wishlist
-- Run this once in the Supabase SQL editor (safe to re-run).

-- 1) Make sure every signed-in user has a user_profiles row
--    (wishlist.user_id references it).
insert into public.user_profiles (id, email)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.user_profiles p where p.id = u.id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- 2) Wishlist: RLS was enabled but had no policies, so every read/write was denied.
alter table public.wishlist enable row level security;

drop policy if exists "Users can view their own wishlist" on public.wishlist;
create policy "Users can view their own wishlist" on public.wishlist
  for select using (auth.uid() = user_id);

drop policy if exists "Users can add to their own wishlist" on public.wishlist;
create policy "Users can add to their own wishlist" on public.wishlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove from their own wishlist" on public.wishlist;
create policy "Users can remove from their own wishlist" on public.wishlist
  for delete using (auth.uid() = user_id);

-- 3) Cart: one row per user holding the cart items as JSON.
create table if not exists public.user_carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_carts enable row level security;

drop policy if exists "Users can view their own cart" on public.user_carts;
create policy "Users can view their own cart" on public.user_carts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their own cart" on public.user_carts;
create policy "Users can create their own cart" on public.user_carts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cart" on public.user_carts;
create policy "Users can update their own cart" on public.user_carts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own cart" on public.user_carts;
create policy "Users can delete their own cart" on public.user_carts
  for delete using (auth.uid() = user_id);