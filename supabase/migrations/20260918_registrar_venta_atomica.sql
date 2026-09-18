-- Registra una venta y descuenta el stock en una única transacción.
-- Ejecutar en Supabase SQL Editor o mediante `supabase db push`.
create or replace function public.registrar_venta_atomica(
  p_turno_id uuid,
  p_total numeric,
  p_pagos jsonb,
  p_productos jsonb
)
returns uuid
language plpgsql
as $$
declare
  producto record;
  venta_id uuid;
begin
  if p_total <= 0 or jsonb_array_length(p_productos) = 0 then
    raise exception 'La venta debe incluir productos y un total válido';
  end if;

  for producto in
    select id, cantidad
    from jsonb_to_recordset(p_productos) as item(id bigint, cantidad integer)
  loop
    if producto.cantidad is null or producto.cantidad <= 0 then
      raise exception 'Cantidad de producto inválida';
    end if;

    update public.productos
    set stock = stock - producto.cantidad
    where id = producto.id
      and stock >= producto.cantidad;

    if not found then
      raise exception 'Stock insuficiente o producto inexistente: %', producto.id;
    end if;
  end loop;

  insert into public.ventas (turno_id, total, pagos, productos)
  values (p_turno_id, p_total, p_pagos, p_productos)
  returning id into venta_id;

  return venta_id;
end;
$$;

grant execute on function public.registrar_venta_atomica(uuid, numeric, jsonb, jsonb)
to anon, authenticated;
