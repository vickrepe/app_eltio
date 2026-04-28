-- ── Tipos personalizados para caja agencia ───────────────────────────────────

CREATE TABLE IF NOT EXISTS agencia_tipos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, nombre)
);

ALTER TABLE agencia_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agencia_tipos_all" ON agencia_tipos
  USING     (org_id = my_org_id() AND my_role() IN ('owner', 'empleado'))
  WITH CHECK (org_id = my_org_id() AND my_role() IN ('owner', 'empleado'));
