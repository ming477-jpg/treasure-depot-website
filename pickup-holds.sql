create sequence if not exists public.pickup_hold_number_seq start 1001;

create table if not exists public.pickup_holds (
  id uuid primary key default gen_random_uuid(),
  hold_number text not null unique default (
    'TD-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.pickup_hold_number_seq')::text, 4, '0')
  ),
  product_id uuid not null references public.products(id),
  product_name text not null,
  product_sku text not null,
  product_image_url text,
  quantity integer not null check (quantity > 0),
  amount_paid numeric(10,2) not null check (amount_paid >= 0),
  customer_name text not null,
  customer_phone text not null,
  paid_at timestamptz not null,
  pickup_at timestamptz not null,
  expires_at timestamptz not null,
  warehouse_location text,
  notes text,
  status text not null default 'waiting'
    check (status in ('waiting','picked_up','expired','cancelled')),
  picked_up_at timestamptz,
  created_by uuid default auth.uid(),
  created_by_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pickup_holds enable row level security;

drop policy if exists "Admin can view pickup holds" on public.pickup_holds;
create policy "Admin can view pickup holds" on public.pickup_holds for select
using ((auth.jwt() ->> 'email') = 'treasuredepotva@gmail.com');

create or replace function public.create_pickup_hold(
  p_product_id uuid, p_quantity integer, p_amount_paid numeric,
  p_customer_name text, p_customer_phone text, p_paid_at timestamptz,
  p_pickup_at timestamptz, p_warehouse_location text default null,
  p_notes text default null
) returns public.pickup_holds
language plpgsql security definer set search_path = public
as $$
declare
  item public.products;
  new_hold public.pickup_holds;
  new_stock integer;
begin
  if (auth.jwt() ->> 'email') <> 'treasuredepotva@gmail.com' then
    raise exception 'Not authorized';
  end if;
  if p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  if p_pickup_at > p_paid_at + interval '7 days' then
    raise exception 'Pickup time must be within 7 days of payment';
  end if;

  select * into item from public.products where id = p_product_id for update;
  if item.id is null then raise exception 'Product not found'; end if;
  if item.stock_quantity < p_quantity then raise exception 'Not enough inventory'; end if;
  new_stock := item.stock_quantity - p_quantity;

  update public.products set
    stock_quantity = new_stock,
    status = case when new_stock = 0 then 'sold_out'
                  when new_stock <= 2 then 'low_stock' else 'in_stock' end,
    updated_at = now()
  where id = item.id;

  insert into public.pickup_holds (
    product_id, product_name, product_sku, product_image_url, quantity,
    amount_paid, customer_name, customer_phone, paid_at, pickup_at,
    expires_at, warehouse_location, notes
  ) values (
    item.id, coalesce(item.name_zh, item.name_en), item.sku, item.image_url,
    p_quantity, p_amount_paid, trim(p_customer_name), trim(p_customer_phone),
    p_paid_at, p_pickup_at, p_paid_at + interval '7 days',
    nullif(trim(p_warehouse_location), ''), nullif(trim(p_notes), '')
  ) returning * into new_hold;
  return new_hold;
end;
$$;

create or replace function public.update_pickup_hold_status(
  p_hold_id uuid, p_status text
) returns public.pickup_holds
language plpgsql security definer set search_path = public
as $$
declare
  hold_row public.pickup_holds;
  result public.pickup_holds;
begin
  if (auth.jwt() ->> 'email') <> 'treasuredepotva@gmail.com' then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('picked_up','cancelled','expired') then
    raise exception 'Invalid status';
  end if;
  select * into hold_row from public.pickup_holds where id = p_hold_id for update;
  if hold_row.id is null then raise exception 'Hold not found'; end if;
  if hold_row.status <> 'waiting' and not (hold_row.status = 'expired' and p_status = 'cancelled') then
    raise exception 'Hold is already closed';
  end if;

  if p_status = 'cancelled' then
    update public.products set
      stock_quantity = stock_quantity + hold_row.quantity,
      status = case when stock_quantity + hold_row.quantity <= 2
                    then 'low_stock' else 'in_stock' end,
      updated_at = now()
    where id = hold_row.product_id;
  end if;

  update public.pickup_holds set
    status = p_status,
    picked_up_at = case when p_status = 'picked_up' then now() else null end,
    updated_at = now()
  where id = p_hold_id returning * into result;
  return result;
end;
$$;

grant execute on function public.create_pickup_hold(
  uuid, integer, numeric, text, text, timestamptz, timestamptz, text, text
) to authenticated;
grant execute on function public.update_pickup_hold_status(uuid, text) to authenticated;
