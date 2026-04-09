-- ============================================================
-- Migración v3: campo anulada en transactions + políticas update
-- ============================================================

-- 1. Agregar campo anulada a transactions
alter table transactions add column if not exists anulada boolean not null default false;

-- 2. Política para que owners puedan anular transacciones (update)
create policy "transactions_update_owner" on transactions
  for update using (
    org_id in (
      select org_id from profiles where user_id = auth.uid() and rol = 'owner'
    )
  );

-- 3. Política para que owners puedan archivar clientes (update)
-- (ya existe clients_update para todos, agregamos una específica para owners)
-- La política existente ya cubre esto, no necesita cambios.

-- 4. Actualizar vista: excluir transacciones anuladas del saldo
create or replace view clients_with_balance with (security_invoker = true) as
select
  c.*,
  coalesce(
    sum(case when t.anulada = false then t.debe - t.entrega else 0 end),
    0
  ) as saldo
from clients c
left join transactions t on t.client_id = c.id
group by c.id;
