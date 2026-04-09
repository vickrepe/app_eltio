-- ============================================================
-- Datos iniciales: 28 clientes con saldos actuales
-- IMPORTANTE: reemplazá ORG_ID y PROFILE_ID antes de ejecutar
--
-- Para obtener ORG_ID:  SELECT id FROM organizations LIMIT 1;
-- Para obtener PROFILE_ID: SELECT id FROM profiles LIMIT 1;
-- ============================================================

do $$
declare
  v_org_id     uuid := 'be564013-8c06-45ba-9305-e291c9bdd5c1';
  v_profile_id uuid := '9f5c7919-65d4-4cfe-b0cc-3f0e2ccc4e05';
begin

  -- Insertar clientes y sus saldos iniciales
  -- Saldo > 0: el cliente debe (una transacción de "debe" con ese monto)
  -- Saldo < 0: a favor del cliente (una transacción de "entrega" con el abs del monto)
  -- Saldo = 0: solo se crea el cliente, sin transacción inicial

  with clientes_data (nombre, saldo) as (
    values
      ('Alberto Flia',    9000),
      ('Amalia',             0),
      ('Andrea Brassat',  33000),
      ('Betty',           31600),
      ('Bourlot',         12600),
      ('Choco',           29300),
      ('Dario Pelizzari',     0),
      ('Espil',           12000),
      ('Eva',              2400),
      ('Froy',          -886260),   -- a favor: el negocio le debe a Froy
      ('Graciela',        14400),
      ('Jorge Sandoval',      0),
      ('JoseOzuna',           0),
      ('Mama de Juan',        0),
      ('Mariano',             0),
      ('Moix',            54000),
      ('Nestor',           6000),
      ('Pablo Miño',      18495),
      ('Panozo',          52000),
      ('Pastorini',           0),
      ('Payuca',       -1988380),   -- a favor: el negocio le debe a Payuca
      ('Pedro',               0),
      ('Peluquera',           0),
      ('Pepe',             4400),
      ('Perita',          33800),
      ('Roxana',          55000),
      ('Ruben Cegovia',   27000),
      ('Susana Bogado',       0)
  ),
  clientes_insertados as (
    insert into clients (org_id, nombre, activo)
    select v_org_id, nombre, true
    from clientes_data
    returning id, nombre
  )
  -- Insertar transacción inicial solo para clientes con saldo ≠ 0
  insert into transactions (client_id, org_id, debe, entrega, observaciones, fecha, creado_por)
  select
    ci.id,
    v_org_id,
    case when cd.saldo > 0 then cd.saldo::numeric else 0 end,
    case when cd.saldo < 0 then abs(cd.saldo)::numeric else 0 end,
    'Saldo inicial',
    '2026-04-01'::date,
    v_profile_id
  from clientes_insertados ci
  join clientes_data cd on cd.nombre = ci.nombre
  where cd.saldo <> 0;

end;
$$;
