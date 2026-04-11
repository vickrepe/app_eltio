-- ── Tipo de movimiento ───────────────────────────────────────────────────────

-- Columna tipo en transactions (nullable, aplica solo a caja negocio)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tipo TEXT;

-- Tabla de tipos personalizados guardados por la organización (negocio)
CREATE TABLE IF NOT EXISTS negocio_tipos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, nombre)
);

ALTER TABLE negocio_tipos ENABLE ROW LEVEL SECURITY;

-- Los roles del negocio (y el owner super) pueden leer y crear tipos personalizados
CREATE POLICY "negocio_tipos_all" ON negocio_tipos
  USING     (org_id = my_org_id() AND my_role() IN ('owner', 'owner_negocio', 'empleado_negocio'))
  WITH CHECK (org_id = my_org_id() AND my_role() IN ('owner', 'owner_negocio', 'empleado_negocio'));
