-- ============================================================
-- Migración v2: reemplazar tipo/monto por debe/entrega
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1. Eliminar vista y tabla anterior
drop view if exists clients_with_balance;
drop table if exists transactions;

-- 2. Nueva tabla transactions con debe + entrega
create table transactions (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references clients(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  debe          numeric(12, 2) not null default 0 check (debe >= 0),
  entrega       numeric(12, 2) not null default 0 check (entrega >= 0),
  observaciones text,
  fecha         date not null default current_date,
  creado_por    uuid not null references profiles(id),
  created_at    timestamptz not null default now(),
  constraint al_menos_un_monto check (debe > 0 or entrega > 0)
);

alter table transactions enable row level security;

create policy "transactions_select" on transactions
  for select using (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "transactions_insert" on transactions
  for insert with check (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "transactions_delete_owner" on transactions
  for delete using (
    org_id in (
      select org_id from profiles where user_id = auth.uid() and rol = 'owner'
    )
  );

-- 3. Vista actualizada: saldo = sum(debe) - sum(entrega)
-- Positivo = cliente debe, Negativo = a favor del cliente
create or replace view clients_with_balance as
select
  c.*,
  coalesce(sum(t.debe - t.entrega), 0) as saldo
from clients c
left join transactions t on t.client_id = c.id
group by c.id;
