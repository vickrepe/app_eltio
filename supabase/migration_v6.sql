-- Migración v6: separación agencia / negocio

-- 1. Nueva columna en clients
alter table clients add column if not exists es_caja_negocio boolean not null default false;

-- 2. Insertar Caja Negocio para la organización existente
insert into clients (org_id, nombre, activo, es_caja_negocio)
values ('be564013-8c06-45ba-9305-e291c9bdd5c1', 'Caja Negocio', true, true);

-- 3. Actualizar vista
drop view if exists clients_with_balance;
create view clients_with_balance with (security_invoker = true) as
select
  c.*,
  coalesce(sum(t.debe - t.entrega), 0) as saldo
from clients c
left join transactions t on t.client_id = c.id
group by c.id;

-- ─── Políticas de clients ────────────────────────────────────

drop policy if exists "clients_select" on clients;
drop policy if exists "Authenticated users can view their org clients" on clients;
drop policy if exists "Users can view clients in their org" on clients;

create policy "clients_select" on clients for select using (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (my_role() in ('owner_agencia', 'employee') and es_caja_negocio = false)
    or (my_role() in ('owner_negocio', 'empleado_negocio') and es_caja_negocio = true)
  )
);

drop policy if exists "clients_insert" on clients;
drop policy if exists "Authenticated users can insert clients" on clients;
drop policy if exists "Users can insert clients in their org" on clients;

create policy "clients_insert" on clients for insert with check (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (my_role() in ('owner_agencia', 'employee') and es_caja_negocio = false)
  )
);

drop policy if exists "clients_update" on clients;
drop policy if exists "Authenticated users can update clients" on clients;
drop policy if exists "Users can update clients in their org" on clients;

create policy "clients_update" on clients for update using (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (my_role() in ('owner_agencia', 'employee') and es_caja_negocio = false)
    or (my_role() in ('owner_negocio', 'empleado_negocio') and es_caja_negocio = true)
  )
);

drop policy if exists "clients_delete" on clients;
drop policy if exists "Authenticated users can delete clients" on clients;
drop policy if exists "Users can delete clients in their org" on clients;

create policy "clients_delete" on clients for delete using (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (my_role() in ('owner_agencia', 'employee') and es_caja_negocio = false)
  )
);

-- ─── Políticas de transactions ───────────────────────────────

drop policy if exists "transactions_select" on transactions;
drop policy if exists "Authenticated users can view their org transactions" on transactions;
drop policy if exists "Users can view transactions in their org" on transactions;

create policy "transactions_select" on transactions for select using (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (
      my_role() in ('owner_agencia', 'employee')
      and not exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
    or (
      my_role() in ('owner_negocio', 'empleado_negocio')
      and exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
  )
);

drop policy if exists "transactions_insert" on transactions;
drop policy if exists "Authenticated users can insert transactions" on transactions;
drop policy if exists "Users can insert transactions in their org" on transactions;

create policy "transactions_insert" on transactions for insert with check (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (
      my_role() in ('owner_agencia', 'employee')
      and not exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
    or (
      my_role() in ('owner_negocio', 'empleado_negocio')
      and exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
  )
);

drop policy if exists "transactions_delete" on transactions;
drop policy if exists "Authenticated users can delete transactions" on transactions;
drop policy if exists "Users can delete transactions in their org" on transactions;

create policy "transactions_delete" on transactions for delete using (
  org_id = my_org_id() and (
    my_role() = 'owner'
    or (
      my_role() in ('owner_agencia', 'employee')
      and not exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
    or (
      my_role() in ('owner_negocio', 'empleado_negocio')
      and exists (
        select 1 from clients c where c.id = client_id and c.es_caja_negocio = true
      )
    )
  )
);

-- ─── Políticas de profiles ───────────────────────────────────

drop policy if exists "profiles_select" on profiles;

create policy "profiles_select" on profiles for select using (
  user_id = auth.uid()
  or (org_id = my_org_id() and my_role() = 'owner')
  or (org_id = my_org_id() and my_role() = 'owner_agencia' and rol in ('owner_agencia', 'employee'))
  or (org_id = my_org_id() and my_role() = 'owner_negocio' and rol in ('owner_negocio', 'empleado_negocio'))
);

drop policy if exists "owners_update_profiles" on profiles;

create policy "owners_update_profiles" on profiles for update using (
  org_id = my_org_id() and user_id != auth.uid() and (
    my_role() = 'owner'
    or (my_role() = 'owner_agencia' and rol in ('owner_agencia', 'employee'))
    or (my_role() = 'owner_negocio' and rol in ('owner_negocio', 'empleado_negocio'))
  )
) with check (org_id = my_org_id());

drop policy if exists "owners_delete_profiles" on profiles;

create policy "owners_delete_profiles" on profiles for delete using (
  org_id = my_org_id() and user_id != auth.uid() and (
    my_role() = 'owner'
    or (my_role() = 'owner_agencia' and rol in ('owner_agencia', 'employee'))
    or (my_role() = 'owner_negocio' and rol in ('owner_negocio', 'empleado_negocio'))
  )
);
