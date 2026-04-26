alter table public.products
  alter column low_stock_threshold drop not null,
  alter column low_stock_threshold drop default;
