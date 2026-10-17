// ============================================================
//  manage-users: administración de la familia (solo admin)
//  Acciones: create_user, set_password, update_user, delete_user
//  El llamante debe ser un usuario autenticado con is_admin = true.
// ============================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

const authAdmin = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

async function callerId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))).sub;
    if (!sub || /^0+$/.test(sub.replace(/-/g, ""))) return null;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch {
    return null;
  }
}

const PALETTE = ["#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2980b9", "#8e44ad", "#16a085", "#d35400"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await callerId(req);
    if (!caller) return json({ error: "no autorizado" }, 401);

    const rows = await (await rest(`profiles?id=eq.${caller}&select=is_admin`)).json();
    if (!rows[0]?.is_admin) return json({ error: "solo el administrador puede hacer esto" }, 403);

    const b = await req.json();
    const { action, userId, email, password, name, phone, color } = b || {};

    if (action === "create_user") {
      if (!email || !password || !name) return json({ error: "faltan email, password o name" }, 400);
      if (password.length < 8) return json({ error: "la contraseña necesita al menos 8 caracteres" }, 400);
      const created = await authAdmin("users", {
        method: "POST",
        body: JSON.stringify({ email, password, email_confirm: true, email_verify: true }),
      });
      const data = await created.json();
      if (!created.ok) return json({ error: data?.msg || data?.message || "no se pudo crear" }, 400);
      const profile = await rest("profiles", {
        method: "POST",
        body: JSON.stringify({
          id: data.id,
          name,
          email,
          phone: phone || null,
          color: color || PALETTE[Math.floor(Math.random() * PALETTE.length)],
        }),
      });
      if (!profile.ok) return json({ error: "cuenta creada, pero falló el perfil" }, 400);
      return json({ ok: true, id: data.id });
    }

    if (action === "set_password") {
      if (!userId || !password) return json({ error: "faltan userId o password" }, 400);
      if (password.length < 8) return json({ error: "la contraseña necesita al menos 8 caracteres" }, 400);
      const r = await authAdmin(`users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      if (!r.ok) return json({ error: "no se pudo cambiar la contraseña" }, 400);
      return json({ ok: true });
    }

    if (action === "update_user") {
      if (!userId) return json({ error: "falta userId" }, 400);
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (phone !== undefined) patch.phone = phone || null;
      if (color !== undefined) patch.color = color;
      if (!Object.keys(patch).length) return json({ error: "nada que cambiar" }, 400);
      const r = await rest(`profiles?id=eq.${userId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { Prefer: "return=representation" },
      });
      if (!r.ok) return json({ error: "no se pudo actualizar el perfil" }, 400);
      return json({ ok: true });
    }

    if (action === "delete_user") {
      if (!userId) return json({ error: "falta userId" }, 400);
      if (userId === caller) return json({ error: "no puedes borrarte a ti mismo" }, 400);
      const r = await authAdmin(`users/${userId}`, { method: "DELETE" });
      if (!r.ok) return json({ error: "no se pudo borrar" }, 400);
      return json({ ok: true });
    }

    return json({ error: "acción desconocida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
