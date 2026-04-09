-- Migración v4: campo es_caja en clients

alter table clients add column if not exists es_caja boolean not null default false;

-- Crear la Caja para la organización existente
insert into clients (org_id, nombre, activo, es_caja)
values ('be564013-8c06-45ba-9305-e291c9bdd5c1', 'Caja', true, true);

-- Actualizar vista para incluir es_caja
drop view if exists clients_with_balance;

create view clients_with_balance with (security_invoker = true) as
select
  c.*,
  coalesce(sum(t.debe - t.entrega), 0) as saldo
from clients c
left join transactions t on t.client_id = c.id
group by c.id;
