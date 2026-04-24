-- ============================================================================
-- Row Level Security for multi-tenant isolation. Run AFTER `drizzle-kit push`.
-- Staff access is gated by the `memberships` table. Customer portal access is
-- gated by `customer_contacts`. Public links (tokenized) go through server
-- routes using the service-role key — those bypass RLS by design.
-- ============================================================================

-- ─── Helper functions ────────────────────────────────────────────────────────
create or replace function public.current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.memberships where user_id = auth.uid()
$$;

create or replace function public.current_user_customer_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.customer_contacts where user_id = auth.uid()
$$;

create or replace function public.current_user_customer_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select customer_id from public.customer_contacts where user_id = auth.uid()
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id  = target_org
      and role    in ('super_admin','admin')
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (org_id, user_id, role)
  values (new.id, auth.uid(), 'super_admin')
  on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_org_created on public.organizations;
create trigger on_org_created after insert on public.organizations
  for each row execute procedure public.handle_new_org();

-- ─── Enable RLS ──────────────────────────────────────────────────────────────
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.memberships          enable row level security;
alter table public.access_tokens        enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.receipts             enable row level security;
alter table public.customers            enable row level security;
alter table public.customer_contacts    enable row level security;
alter table public.order_stages         enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_stage_history  enable row level security;
alter table public.invoice_templates    enable row level security;
alter table public.invoices             enable row level security;
alter table public.payments             enable row level security;
alter table public.dispatches           enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────────────
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid());

-- ─── organizations ───────────────────────────────────────────────────────────
create policy "orgs staff read" on public.organizations for select
  using (id in (select public.current_user_org_ids())
      or id in (select public.current_user_customer_org_ids()));
create policy "orgs admin update" on public.organizations for update
  using (public.is_org_admin(id));
create policy "orgs authenticated insert" on public.organizations for insert
  with check (auth.uid() is not null);

-- ─── memberships ─────────────────────────────────────────────────────────────
create policy "memberships self read" on public.memberships for select
  using (user_id = auth.uid() or public.is_org_admin(org_id));
create policy "memberships admin write" on public.memberships for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ─── Staff-scoped tables (full RW for org members) ───────────────────────────
do $$ declare t text; begin
  for t in select unnest(array[
    'categories','products','stock_movements','receipts',
    'customers','customer_contacts',
    'order_stages','order_stage_history',
    'invoice_templates','payments','dispatches',
    'access_tokens'
  ]) loop
    execute format($f$
      create policy "%1$s staff read" on public.%1$s for select
        using (org_id in (select public.current_user_org_ids()));
      create policy "%1$s staff write" on public.%1$s for all
        using (org_id in (select public.current_user_org_ids()))
        with check (org_id in (select public.current_user_org_ids()));
    $f$, t);
  end loop;
end $$;

-- ─── orders / order_items / invoices: staff + customer portal ────────────────
create policy "orders staff rw" on public.orders for all
  using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy "orders customer read" on public.orders for select
  using (customer_id in (select public.current_user_customer_ids()));
create policy "orders customer insert" on public.orders for insert
  with check (customer_id in (select public.current_user_customer_ids()));

create policy "order_items staff rw" on public.order_items for all
  using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy "order_items customer read" on public.order_items for select
  using (order_id in (
    select id from public.orders where customer_id in (select public.current_user_customer_ids())
  ));

create policy "invoices staff rw" on public.invoices for all
  using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy "invoices customer read" on public.invoices for select
  using (customer_id in (select public.current_user_customer_ids()));

-- Storefront: customer contacts can read active products in their org.
create policy "products storefront read" on public.products for select
  using (org_id in (select public.current_user_customer_org_ids())
         and is_active = true);
