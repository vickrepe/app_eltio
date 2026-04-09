-- ============================================================
-- Schema: app_eltio
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLAS
-- ============================================================

create table organizations (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table profiles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references organizations(id) on delete cascade,
  rol        text not null check (rol in ('owner', 'employee')),
  nombre     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create table clients (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references organizations(id) on delete cascade,
  nombre     text not null,
  telefono   text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table transactions (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  tipo        text not null check (tipo in ('deuda', 'pago')),
  monto       numeric(12, 2) not null check (monto > 0),
  descripcion text,
  fecha       date not null default current_date,
  creado_por  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table organizations  enable row level security;
alter table profiles       enable row level security;
alter table clients        enable row level security;
alter table transactions   enable row level security;

-- Organizations
create policy "org_select" on organizations
  for select using (
    id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "org_update" on organizations
  for update using (owner_id = auth.uid());

-- Profiles
create policy "profile_select" on profiles
  for select using (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "profile_update_own" on profiles
  for update using (user_id = auth.uid());

-- Clients
create policy "clients_select" on clients
  for select using (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "clients_insert" on clients
  for insert with check (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "clients_update" on clients
  for update using (
    org_id in (select org_id from profiles where user_id = auth.uid())
  );

create policy "clients_delete_owner" on clients
  for delete using (
    org_id in (
      select org_id from profiles where user_id = auth.uid() and rol = 'owner'
    )
  );

-- Transactions
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

-- ============================================================
-- VISTA: saldo calculado por cliente
-- ============================================================

create or replace view clients_with_balance as
select
  c.*,
  coalesce(
    sum(case when t.tipo = 'deuda' then t.monto else -t.monto end),
    0
  ) as saldo
from clients c
left join transactions t on t.client_id = c.id
group by c.id;

-- ============================================================
-- FUNCIÓN: crear organización (llamar después del primer signup)
-- ============================================================

create or replace function create_organization(org_nombre text, owner_nombre text)
returns uuid
language plpgsql security definer
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (nombre, owner_id)
  values (org_nombre, auth.uid())
  returning id into new_org_id;

  insert into profiles (user_id, org_id, rol, nombre)
  values (auth.uid(), new_org_id, 'owner', owner_nombre);

  return new_org_id;
end;
$$;
