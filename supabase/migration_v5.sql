-- Migración v5: gestión de usuarios por owners

-- Funciones helper para obtener org y rol del usuario actual
-- SECURITY DEFINER evita recursión en las políticas RLS
create or replace function my_org_id()
returns uuid language sql security definer stable as $$
  select org_id from profiles where user_id = auth.uid() limit 1;
$$;

create or replace function my_role()
returns text language sql security definer stable as $$
  select rol from profiles where user_id = auth.uid() limit 1;
$$;

-- Reemplazar política SELECT de profiles:
-- cada usuario ve su propio perfil, y los owners ven todos los de su org
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "profiles_select" on profiles;

create policy "profiles_select" on profiles for select using (
  user_id = auth.uid()
  or (org_id = my_org_id() and my_role() = 'owner')
);

-- Owners pueden cambiar el rol de otros usuarios de su org
drop policy if exists "owners_update_profiles" on profiles;
create policy "owners_update_profiles" on profiles for update using (
  org_id = my_org_id() and my_role() = 'owner'
) with check (
  org_id = my_org_id()
);

-- Owners pueden eliminar usuarios de su org (excepto a sí mismos)
drop policy if exists "owners_delete_profiles" on profiles;
create policy "owners_delete_profiles" on profiles for delete using (
  org_id = my_org_id() and my_role() = 'owner' and user_id != auth.uid()
);
