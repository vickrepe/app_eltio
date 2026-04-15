import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Helpers Odoo JSON-RPC ───────────────────────────────────────────────────

const ODOO_URL      = Deno.env.get('ODOO_URL')!;
const ODOO_DB       = Deno.env.get('ODOO_DB')!;
const ODOO_USER     = Deno.env.get('ODOO_USER')!;
const ODOO_PASSWORD = Deno.env.get('ODOO_PASSWORD')!;

async function odooCall(service: string, method: string, args: unknown[]) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: 1,
      params: { service, method, args },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Odoo error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function odooAuthenticate(): Promise<number> {
  const uid = await odooCall('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_PASSWORD, {}]);
  if (!uid) throw new Error('Autenticación con Odoo fallida');
  return uid as number;
}

async function odooSearchRead(uid: number, model: string, domain: unknown[], fields: string[], limit?: number) {
  const kwargs: Record<string, unknown> = { fields };
  if (limit !== undefined) kwargs.limit = limit;
  return await odooCall('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_PASSWORD,
    model, 'search_read',
    [domain],
    kwargs,
  ]);
}

// ─── Fecha Argentina (UTC-3) ─────────────────────────────────────────────────

function argentinaToday(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Aceptar GET o POST (pg_cron usa POST)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  try {
    let body: { fecha?: string; debug?: boolean } = {};
    try { body = await req.json(); } catch { /* body vacío */ }
    const today = body.fecha ?? argentinaToday();
    console.log(`[odoo-sync] Iniciando sync para fecha Argentina: ${today}`);

    // ── Modo debug: devuelve datos crudos de Odoo sin filtros ───────────────
    if (body.debug) {
      const uid = await odooAuthenticate();
      const fechaDebug = body.fecha ?? today;
      const nextDayDebug = new Date(`${fechaDebug}T03:00:00Z`);
      nextDayDebug.setUTCDate(nextDayDebug.getUTCDate() + 1);
      const utcFromDebug = `${fechaDebug} 03:00:00`;
      const utcToDebug   = nextDayDebug.toISOString().slice(0, 10) + ' 03:00:00';
      console.log(`[debug] Rango UTC: ${utcFromDebug} → ${utcToDebug}`);
      const ordenes = await odooSearchRead(uid, 'pos.order',
        [['date_order', '>=', utcFromDebug], ['date_order', '<', utcToDebug]],
        ['name', 'date_order', 'amount_total', 'statement_ids'], 1000) as Array<{ id: number; statement_ids: number[] }>;
      const allIds = ordenes.flatMap(o => o.statement_ids);
      const lineas = allIds.length > 0
        ? await odooSearchRead(uid, 'account.bank.statement.line', [['id', 'in', allIds]], ['amount', 'journal_id', 'date', 'name'], 500)
        : [];
      // Agrupar por journal
      const porJournal: Record<string, number> = {};
      for (const l of lineas as Array<{ amount: number; journal_id: [number, string] }>) {
        const n = l.journal_id[1];
        porJournal[n] = (porJournal[n] ?? 0) + l.amount;
      }
      return new Response(JSON.stringify({ utcFrom: utcFromDebug, utcTo: utcToDebug, ordenes_count: ordenes.length, statement_ids_count: allIds.length, totales_por_journal: porJournal }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Supabase admin client ────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Buscar el cliente caja negocio y su org ──────────────────────────
    const { data: cajaCliente, error: cajaError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('es_caja_negocio', true)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();

    if (cajaError) throw new Error(`Error buscando caja negocio: ${cajaError.message}`);
    if (!cajaCliente) throw new Error('No existe cliente es_caja_negocio=true');

    const { id: clientId, org_id: orgId } = cajaCliente;

    // ── 3. Buscar un perfil para usar como creado_por ───────────────────────
    const { data: ownerProfile, error: ownerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .in('rol', ['owner', 'owner_negocio'])
      .limit(1)
      .maybeSingle();

    if (ownerError) throw new Error(`Error buscando perfil owner: ${ownerError.message}`);
    if (!ownerProfile) throw new Error('No existe perfil owner para la org');

    const creadoPor = ownerProfile.id;

    // ── 4. Idempotencia: verificar si ya se sincronizó hoy ─────────────────
    const TIPOS_VENTAS  = ['Ventas efectivo', 'Ventas tarjeta'];
    const { data: existentes } = await supabase
      .from('transactions')
      .select('tipo')
      .eq('client_id', clientId)
      .eq('fecha', today)
      .in('tipo', TIPOS_VENTAS)
      .eq('anulada', false);

    const tiposYaInsertados = new Set((existentes ?? []).map((r: { tipo: string }) => r.tipo));
    const ventasPendientes  = TIPOS_VENTAS.filter(t => !tiposYaInsertados.has(t));

    // Para fiados: si ya existe alguno para hoy, saltear todos
    const { count: fiadosExistentes } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('fecha', today)
      .in('tipo', ['Fiado', 'Pago fiado'])
      .eq('anulada', false);

    const sincronizarFiados = (fiadosExistentes ?? 0) === 0;

    if (ventasPendientes.length === 0 && !sincronizarFiados) {
      const msg = `[odoo-sync] Ya sincronizado para ${today}, nada que hacer.`;
      console.log(msg);
      return new Response(JSON.stringify({ ok: true, message: msg }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Consultar Odoo ───────────────────────────────────────────────────
    const uid = await odooAuthenticate();
    console.log(`[odoo-sync] Autenticado en Odoo como uid=${uid}`);

    const nextDay = new Date(`${today}T03:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const utcFrom = `${today} 03:00:00`;
    const utcTo   = nextDay.toISOString().slice(0, 10) + ' 03:00:00';

    // Traer órdenes POS del día con sus statement_ids (máx 1000)
    const ordenes = await odooSearchRead(uid, 'pos.order',
      [['date_order', '>=', utcFrom], ['date_order', '<', utcTo]],
      ['name', 'date_order', 'statement_ids'],
      1000
    ) as Array<{ id: number; name: string; statement_ids: number[] }>;

    console.log(`[odoo-sync] ${ordenes.length} órdenes POS encontradas para ${today}`);

    const allStatementIds = ordenes.flatMap(o => o.statement_ids);

    // Traer todas las líneas con partner_id para fiados
    const lineasRaw = allStatementIds.length > 0
      ? await odooSearchRead(uid, 'account.bank.statement.line',
          [['id', 'in', allStatementIds]],
          ['amount', 'journal_id', 'partner_id'],
          500
        ) as Array<{ amount: number; journal_id: [number, string]; partner_id: [number, string] | false }>
      : [];

    const insertados: string[] = [];
    const saltados:   string[] = [];

    // ── 6. Ventas efectivo y tarjeta (totales del día) ──────────────────────
    const JOURNALS_VENTAS: Record<string, string> = {
      'Efectivo (ARS)': 'Ventas efectivo',
      'Tarjeta (ARS)':  'Ventas tarjeta',
    };

    const totales: Record<string, number> = {};
    for (const l of lineasRaw) {
      const jName = l.journal_id[1];
      if (jName in JOURNALS_VENTAS) {
        totales[jName] = (totales[jName] ?? 0) + l.amount;
      }
    }
    console.log('[odoo-sync] Totales ventas:', totales);

    for (const [journalName, tipoTx] of Object.entries(JOURNALS_VENTAS)) {
      if (!ventasPendientes.includes(tipoTx)) {
        saltados.push(`${tipoTx} (ya existía)`);
        continue;
      }
      const monto = totales[journalName] ?? 0;
      if (monto <= 0) {
        saltados.push(`${tipoTx} (monto $0, no se inserta)`);
        continue;
      }
      const { error } = await supabase.from('transactions').insert({
        client_id: clientId, org_id: orgId,
        debe: 0, entrega: Math.round(monto * 100) / 100,
        fecha: today, tipo: tipoTx,
        observaciones: 'Sincronizado automáticamente desde Odoo',
        creado_por: creadoPor,
      });
      if (error) throw new Error(`Error insertando ${tipoTx}: ${error.message}`);
      insertados.push(`${tipoTx}: $${monto}`);
    }

    // ── 7. Fiados y pagos de fiados (una fila por línea) ────────────────────
    if (sincronizarFiados) {
      const lineasCC = lineasRaw.filter(l => l.journal_id[1] === 'Cuenta Corriente (ARS)');
      console.log(`[odoo-sync] ${lineasCC.length} líneas de Cuenta Corriente`);

      for (const l of lineasCC) {
        const monto   = Math.abs(Math.round(l.amount * 100) / 100);
        if (monto === 0) continue;
        const cliente = l.partner_id ? l.partner_id[1] : 'Sin cliente';
        const esFiado = l.amount > 0;
        const tipo    = esFiado ? 'Fiado' : 'Pago fiado';
        const obs     = esFiado ? `Fiado a ${cliente}` : `Pago de ${cliente}`;

        const { error } = await supabase.from('transactions').insert({
          client_id: clientId, org_id: orgId,
          debe:    esFiado ? monto : 0,
          entrega: esFiado ? 0 : monto,
          fecha: today, tipo,
          observaciones: obs,
          creado_por: creadoPor,
        });
        if (error) throw new Error(`Error insertando ${tipo}: ${error.message}`);
        insertados.push(`${tipo} ${cliente}: $${monto}`);
      }
    } else {
      saltados.push('Fiados (ya existían)');
    }

    const resumen = { ok: true, fecha: today, insertados, saltados, totalesOdoo: totales };
    console.log('[odoo-sync] Resultado:', resumen);

    return new Response(JSON.stringify(resumen), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[odoo-sync] ERROR:', message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
