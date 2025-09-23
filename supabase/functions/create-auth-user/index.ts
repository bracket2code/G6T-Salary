import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, password, name, phone, role }: CreateUserRequest = await req.json();

    // Validar datos requeridos
    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password y name son requeridos" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Crear usuario en auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role || 'tecnico'
      }
    });

    if (authError) {
      throw authError;
    }

    if (!authUser.user) {
      throw new Error("No se pudo crear el usuario de autenticación");
    }

    // Crear perfil de trabajador
    const { error: workerError } = await supabaseAdmin
      .from('workers')
      .insert([{
        id: authUser.user.id,
        name: name,
        email: email.toLowerCase(),
        phone: phone || null,
        role: role || 'tecnico',
      }]);

    if (workerError) {
      // Si falla la creación del perfil, eliminar el usuario de auth
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw workerError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Usuario creado exitosamente",
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          name: name,
          role: role || 'tecnico'
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error interno del servidor"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});