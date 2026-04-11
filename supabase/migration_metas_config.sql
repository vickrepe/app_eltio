-- Configuración general de metas por organización (una fila por org)
CREATE TABLE IF NOT EXISTS metas_config (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  puntos_iniciales  INTEGER     NOT NULL DEFAULT 0,
  nombre_objetivo   TEXT,
  puntos_objetivo   INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

ALTER TABLE metas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_metas_config_all" ON metas_config
  USING     (org_id = my_org_id() AND my_role() = 'owner')
  WITH CHECK (org_id = my_org_id() AND my_role() = 'owner');
