import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, nombre, rol } = await req.json();

    if (!email || !nombre || !rol) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar que quien llama es un owner (usando su JWT)
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('rol, org_id')
      .eq('user_id', user.id)
      .single();

    const ALLOWED_INVITERS = ['owner', 'owner_agencia', 'owner_negocio'];
    const ALLOWED_ROLES: Record<string, string[]> = {
      owner:         ['owner', 'owner_agencia', 'employee', 'owner_negocio', 'empleado_negocio'],
      owner_agencia: ['owner_agencia', 'employee'],
      owner_negocio: ['owner_negocio', 'empleado_negocio'],
    };

    if (!callerProfile || !ALLOWED_INVITERS.includes(callerProfile.rol)) {
      return new Response(JSON.stringify({ error: 'No tenés permisos para invitar usuarios' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rolesPermitidos = ALLOWED_ROLES[callerProfile.rol] ?? [];
    if (!rolesPermitidos.includes(rol)) {
      return new Response(JSON.stringify({ error: `No podés invitar usuarios con el rol "${rol}"` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invitar usando service role (admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const appUrl = Deno.env.get('APP_URL') ?? '';
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${appUrl}/set-password` }
    );

    if (inviteError) {
      console.error('inviteError:', inviteError.message);
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Crear el perfil del usuario invitado
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: inviteData.user.id,
      org_id:  callerProfile.org_id,
      rol,
      nombre,
    });

    if (profileError) {
      console.error('profileError:', profileError.message);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
