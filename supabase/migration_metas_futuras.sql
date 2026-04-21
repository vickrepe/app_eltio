-- ── Metas Futuras ─────────────────────────────────────────────────────────────
-- Tabla para guardar objetivos o sueños futuros (no son hábitos diarios)

CREATE TABLE IF NOT EXISTS metas_futuras (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  titulo      TEXT        NOT NULL,
  notas       TEXT,
  lograda     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE metas_futuras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_metas_futuras_all" ON metas_futuras
  USING     (org_id = my_org_id() AND my_role() = 'owner')
  WITH CHECK (org_id = my_org_id() AND my_role() = 'owner');
