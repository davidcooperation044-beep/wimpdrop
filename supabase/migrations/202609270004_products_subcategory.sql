alter table public.products
  add column if not exists subcategory text;

create index if not exists products_category_idx
  on public.products (category);

create index if not exists products_subcategory_idx
  on public.products (subcategory);
