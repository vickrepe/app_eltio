-- ── Metas ────────────────────────────────────────────────────────────────────
-- Tabla de definición de metas (solo accesible por owner)

CREATE TABLE IF NOT EXISTS metas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  titulo      TEXT        NOT NULL,
  notas       TEXT,
  puntuacion  INTEGER     NOT NULL DEFAULT 1 CHECK (puntuacion > 0),
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de registros diarios de cumplimiento
CREATE TABLE IF NOT EXISTS meta_registros (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id    UUID        NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fecha      DATE        NOT NULL,
  cumplida   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meta_id, fecha)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE metas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_registros ENABLE ROW LEVEL SECURITY;

-- Solo el rol 'owner' puede leer y escribir sus propias metas
CREATE POLICY "owner_metas_all" ON metas
  USING     (org_id = my_org_id() AND my_role() = 'owner')
  WITH CHECK (org_id = my_org_id() AND my_role() = 'owner');

CREATE POLICY "owner_meta_registros_all" ON meta_registros
  USING     (org_id = my_org_id() AND my_role() = 'owner')
  WITH CHECK (org_id = my_org_id() AND my_role() = 'owner');
