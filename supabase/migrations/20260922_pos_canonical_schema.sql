-- Esquema canónico del POS (inglés) + RPC que ya llama el frontend.
-- Idempotente: se puede correr sobre una base que ya tenga parte de las tablas.
-- No habilita RLS restrictiva todavía (paso 2). Sí versiona las funciones
-- reales y revoca execute a anon sobre la RPC vieja.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.fn_current_negocio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.negocios where user_id = auth.uid() limit 1;
$$;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.fn_fill_negocio_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.negocio_id is null then
    new.negocio_id := public.fn_current_negocio_id();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Negocio
-- ---------------------------------------------------------------------------
create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre_personal text not null default '',
  nombre_negocio text not null,
  logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  supplier text default 'General',
  sale_price numeric(12, 2) not null default 0 check (sale_price >= 0),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  stock integer not null default 0,
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_categories add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.products add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.products add column if not exists category_id uuid;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists supplier text default 'General';
alter table public.products add column if not exists sale_price numeric(12, 2);
alter table public.products add column if not exists cost_price numeric(12, 2);
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists min_stock integer;
alter table public.products add column if not exists active boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();

create index if not exists products_negocio_idx on public.products (negocio_id);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_sku_idx on public.products (sku);
create unique index if not exists product_categories_negocio_name_idx
  on public.product_categories (negocio_id, name)
  where negocio_id is not null;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_products_negocio on public.products;
create trigger trg_products_negocio
before insert on public.products
for each row execute function public.fn_fill_negocio_id();

drop trigger if exists trg_categories_negocio on public.product_categories;
create trigger trg_categories_negocio
before insert on public.product_categories
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null,
  stock_after integer,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------------
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  name text not null default 'Caja Principal',
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cash_registers add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.cash_registers add column if not exists location text;
alter table public.cash_registers add column if not exists active boolean default true;

drop trigger if exists trg_cash_registers_negocio on public.cash_registers;
create trigger trg_cash_registers_negocio
before insert on public.cash_registers
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  cash_register_id uuid not null references public.cash_registers (id) on delete restrict,
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  opening_amount numeric(12, 2) not null default 0 check (opening_amount >= 0),
  counted_amount numeric(12, 2),
  expected_amount numeric(12, 2),
  difference_amount numeric(12, 2),
  notes text,
  opened_by uuid references auth.users (id),
  closed_by uuid references auth.users (id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.cash_shifts add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.cash_shifts add column if not exists counted_amount numeric(12, 2);
alter table public.cash_shifts add column if not exists expected_amount numeric(12, 2);
alter table public.cash_shifts add column if not exists difference_amount numeric(12, 2);
alter table public.cash_shifts add column if not exists notes text;
alter table public.cash_shifts add column if not exists opened_by uuid;
alter table public.cash_shifts add column if not exists closed_by uuid;
alter table public.cash_shifts add column if not exists closed_at timestamptz;

create unique index if not exists cash_shifts_one_open_per_register
  on public.cash_shifts (cash_register_id)
  where status = 'abierta';

drop trigger if exists trg_cash_shifts_negocio on public.cash_shifts;
create trigger trg_cash_shifts_negocio
before insert on public.cash_shifts
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  shift_id uuid not null references public.cash_shifts (id) on delete restrict,
  type text not null check (type in ('venta', 'ingreso', 'egreso')),
  amount numeric(12, 2) not null check (amount >= 0),
  method text,
  description text,
  sale_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

alter table public.cash_movements add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.cash_movements add column if not exists method text;
alter table public.cash_movements add column if not exists sale_id uuid;
alter table public.cash_movements add column if not exists created_by uuid;

create index if not exists cash_movements_shift_idx on public.cash_movements (shift_id, created_at desc);

drop trigger if exists trg_cash_movements_negocio on public.cash_movements;
create trigger trg_cash_movements_negocio
before insert on public.cash_movements
for each row execute function public.fn_fill_negocio_id();

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  shift_id uuid not null references public.cash_shifts (id) on delete restrict,
  client_id uuid,
  status text not null default 'completada',
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

alter table public.sales add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.sales add column if not exists client_id uuid;
alter table public.sales add column if not exists status text default 'completada';
alter table public.sales add column if not exists discount numeric(12, 2) default 0;
alter table public.sales add column if not exists total numeric(12, 2);
alter table public.sales add column if not exists created_by uuid;

create index if not exists sales_shift_idx on public.sales (shift_id, created_at desc);
create index if not exists sales_negocio_idx on public.sales (negocio_id, created_at desc);

drop trigger if exists trg_sales_negocio on public.sales;
create trigger trg_sales_negocio
before insert on public.sales
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  cost_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null
);

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method text not null check (method in ('efectivo', 'transferencia', 'debito', 'credito', 'qr')),
  amount numeric(12, 2) not null check (amount > 0)
);

create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cash_movements_sale_id_fkey'
  ) then
    alter table public.cash_movements
      add constraint cash_movements_sale_id_fkey
      foreign key (sale_id) references public.sales (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Señas y cuenta corriente (mismas tablas que usa el frontend, atadas al catálogo nuevo)
-- ---------------------------------------------------------------------------
create table if not exists public.senas (
  id bigint generated by default as identity primary key,
  negocio_id uuid references public.negocios (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  nombre_cliente text not null,
  telefono text default '',
  monto_sena numeric(12, 2) not null check (monto_sena >= 0),
  monto_total numeric(12, 2) not null check (monto_total >= 0),
  concepto text not null,
  fecha_sena date,
  fecha_vencimiento date,
  estado text not null default 'Pendiente',
  created_at timestamptz not null default now()
);

alter table public.senas add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;
alter table public.senas add column if not exists product_id uuid references public.products (id) on delete set null;

drop trigger if exists trg_senas_negocio on public.senas;
create trigger trg_senas_negocio
before insert on public.senas
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.clientes_deuda (
  id bigint generated by default as identity primary key,
  negocio_id uuid references public.negocios (id) on delete cascade,
  nombre_cliente text not null,
  monto_inicial_deuda numeric(12, 2) not null default 0,
  monto_abonado numeric(12, 2) not null default 0,
  saldo_actual numeric(12, 2) not null default 0,
  estado text not null default 'Pendiente',
  fecha_inicio_deuda date default current_date,
  created_at timestamptz not null default now()
);

alter table public.clientes_deuda add column if not exists negocio_id uuid references public.negocios (id) on delete cascade;

drop trigger if exists trg_clientes_deuda_negocio on public.clientes_deuda;
create trigger trg_clientes_deuda_negocio
before insert on public.clientes_deuda
for each row execute function public.fn_fill_negocio_id();

create table if not exists public.pagos_deuda (
  id bigint generated by default as identity primary key,
  deuda_id bigint not null references public.clientes_deuda (id) on delete cascade,
  monto_pagado numeric(12, 2) not null check (monto_pagado > 0),
  metodo_pago text,
  created_at timestamptz not null default now()
);

-- Vista de compatibilidad solo si no existe la tabla vieja `productos`.
do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'productos'
  ) then
    execute $v$
      create view public.productos as
      select
        id,
        name as nombre,
        name as titulo,
        name as descripcion,
        sale_price as precio,
        sale_price as precio_venta,
        cost_price as precio_costo,
        stock,
        min_stock,
        barcode as codigo_barras,
        sku,
        supplier as proveedor,
        active,
        category_id,
        negocio_id
      from public.products
    $v$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: abrir / cerrar turno / vender
-- ---------------------------------------------------------------------------
create or replace function public.fn_open_shift(
  p_register_id uuid,
  p_opening_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
  v_negocio_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_opening_amount is null or p_opening_amount < 0 then
    raise exception 'Monto inicial inválido';
  end if;

  v_negocio_id := public.fn_current_negocio_id();

  if not exists (select 1 from public.cash_registers where id = p_register_id) then
    raise exception 'Caja inexistente';
  end if;

  if exists (
    select 1 from public.cash_shifts
    where cash_register_id = p_register_id and status = 'abierta'
  ) then
    raise exception 'Ya hay un turno abierto en esta caja';
  end if;

  insert into public.cash_shifts (
    cash_register_id, negocio_id, status, opening_amount, opened_by
  ) values (
    p_register_id, v_negocio_id, 'abierta', p_opening_amount, auth.uid()
  )
  returning id into v_shift_id;

  return v_shift_id;
end;
$$;

create or replace function public.fn_close_shift(
  p_shift_id uuid,
  p_counted_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.cash_shifts%rowtype;
  v_expected numeric(12, 2);
  v_in numeric(12, 2);
  v_out numeric(12, 2);
  v_diff numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_counted_amount is null or p_counted_amount < 0 then
    raise exception 'Monto contado inválido';
  end if;

  select * into v_shift
  from public.cash_shifts
  where id = p_shift_id
  for update;

  if not found then
    raise exception 'Turno inexistente';
  end if;
  if v_shift.status <> 'abierta' then
    raise exception 'El turno ya está cerrado';
  end if;

  select coalesce(sum(amount), 0) into v_in
  from public.cash_movements
  where shift_id = p_shift_id and type in ('venta', 'ingreso');

  select coalesce(sum(amount), 0) into v_out
  from public.cash_movements
  where shift_id = p_shift_id and type = 'egreso';

  v_expected := v_shift.opening_amount + v_in - v_out;
  v_diff := p_counted_amount - v_expected;

  update public.cash_shifts
  set
    status = 'cerrada',
    counted_amount = p_counted_amount,
    expected_amount = v_expected,
    difference_amount = v_diff,
    notes = p_notes,
    closed_by = auth.uid(),
    closed_at = now()
  where id = p_shift_id;

  return jsonb_build_object(
    'shift_id', p_shift_id,
    'counted_amount', p_counted_amount,
    'expected_amount', v_expected,
    'difference_amount', v_diff
  );
end;
$$;

create or replace function public.fn_process_sale(
  p_shift_id uuid,
  p_client_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.cash_shifts%rowtype;
  v_item record;
  v_pay record;
  v_product public.products%rowtype;
  v_sale_id uuid;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_paid numeric(12, 2) := 0;
  v_cash numeric(12, 2) := 0;
  v_discount numeric(12, 2);
  v_line numeric(12, 2);
  v_new_stock integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir productos';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'La venta debe incluir pagos';
  end if;

  v_discount := coalesce(p_discount, 0);
  if v_discount < 0 then
    raise exception 'Descuento inválido';
  end if;

  select * into v_shift
  from public.cash_shifts
  where id = p_shift_id
  for update;

  if not found then
    raise exception 'Turno inexistente';
  end if;
  if v_shift.status <> 'abierta' then
    raise exception 'No hay un turno de caja abierto';
  end if;

  for v_item in
    select product_id, quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Ítem de venta inválido';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'Producto inexistente: %', v_item.product_id;
    end if;
    if v_product.active is distinct from true then
      raise exception 'Producto inactivo: %', v_product.name;
    end if;
    if v_product.stock < v_item.quantity then
      raise exception 'Stock insuficiente: %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (coalesce(v_product.sale_price, 0) * v_item.quantity);
  end loop;

  if v_discount > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal';
  end if;
  v_total := v_subtotal - v_discount;

  if v_total <= 0 then
    raise exception 'La venta debe incluir productos y un total válido';
  end if;

  for v_pay in
    select method, amount
    from jsonb_to_recordset(p_payments) as pay(method text, amount numeric)
  loop
    if v_pay.method not in ('efectivo', 'transferencia', 'debito', 'credito', 'qr') then
      raise exception 'Método de pago inválido: %', v_pay.method;
    end if;
    if v_pay.amount is null or v_pay.amount <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_paid := v_paid + v_pay.amount;
    if v_pay.method = 'efectivo' then
      v_cash := v_cash + v_pay.amount;
    end if;
  end loop;

  if v_paid < v_total then
    raise exception 'Falta cubrir el total de la venta';
  end if;

  insert into public.sales (shift_id, client_id, discount, total, created_by)
  values (p_shift_id, p_client_id, v_discount, v_total, auth.uid())
  returning id into v_sale_id;

  for v_item in
    select product_id, quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
  loop
    update public.products
    set stock = stock - v_item.quantity
    where id = v_item.product_id
    returning * into v_product;

    v_new_stock := v_product.stock;
    v_line := coalesce(v_product.sale_price, 0) * v_item.quantity;

    insert into public.sale_items (
      sale_id, product_id, product_name, quantity, unit_price, cost_price, line_total
    ) values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_item.quantity,
      v_product.sale_price,
      coalesce(v_product.cost_price, 0),
      v_line
    );

    insert into public.inventory_movements (
      negocio_id, product_id, quantity, stock_after, reason, ref_type, ref_id, created_by
    ) values (
      v_product.negocio_id,
      v_product.id,
      -v_item.quantity,
      v_new_stock,
      'venta',
      'sale',
      v_sale_id,
      auth.uid()
    );
  end loop;

  insert into public.sale_payments (sale_id, method, amount)
  select v_sale_id, method, amount
  from jsonb_to_recordset(p_payments) as pay(method text, amount numeric);

  if v_cash > 0 then
    insert into public.cash_movements (
      shift_id, type, amount, method, description, sale_id, created_by
    ) values (
      p_shift_id, 'venta', v_cash, 'efectivo', 'Venta POS', v_sale_id, auth.uid()
    );
  end if;

  return v_sale_id;
end;
$$;

revoke all on function public.fn_open_shift(uuid, numeric) from public, anon;
revoke all on function public.fn_close_shift(uuid, numeric, text) from public, anon;
revoke all on function public.fn_process_sale(uuid, uuid, jsonb, jsonb, numeric) from public, anon;
revoke all on function public.fn_current_negocio_id() from public, anon;

grant execute on function public.fn_open_shift(uuid, numeric) to authenticated;
grant execute on function public.fn_close_shift(uuid, numeric, text) to authenticated;
grant execute on function public.fn_process_sale(uuid, uuid, jsonb, jsonb, numeric) to authenticated;
grant execute on function public.fn_current_negocio_id() to authenticated;

-- RPC vieja: deja de estar callable por anon / authenticated.
drop function if exists public.registrar_venta_atomica(uuid, numeric, jsonb, jsonb);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.negocios to authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.cash_registers to authenticated;
grant select, insert, update, delete on public.cash_shifts to authenticated;
grant select, insert, update, delete on public.cash_movements to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update, delete on public.sale_payments to authenticated;
grant select, insert, update, delete on public.senas to authenticated;
grant select, insert, update, delete on public.clientes_deuda to authenticated;
grant select, insert, update, delete on public.pagos_deuda to authenticated;
