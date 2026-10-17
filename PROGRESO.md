# 📌 Planificador Familiar — Estado y siguientes pasos

> Última actualización: **15 oct 2026**. Leer esto al empezar una sesión nueva para continuar donde dejamos.

## ✅ Hecho
- PWA completa en `public/` (login mágico Supabase, onboarding con nombre/móvil/color,
  calendario común y personal, tareas con aceptar/rechazar/hecha, recurrencias,
  prioridades, categorías, WhatsApp, push, service worker, manifest).
- Edge Functions escritas: `supabase/functions/notify-task` y `send-reminders`.
- Tablas de Supabase **ya creadas** y accesibles vía REST
  (`profiles`, `tasks`, `categories`, `push_subscriptions` responden OK).
- **Firewall abierto** (`ufw allow 8081/tcp`) → la app ya se ve desde el móvil
  en http://192.168.0.44:8081 (pendiente de confirmar el registro completo).
- **Edge Functions desplegadas y activas** (15 oct):
  `notify-task` y `send-reminders` en el proyecto `qvldxrsloszuuuwojxid`.
  Secretos VAPID ya puestos (`supabase secrets set`).
  Comprobado: `notify-task` → `{"sent":0}` y `send-reminders` → `{"ok":true}` (HTTP 200).
- **Cron de recordatorios ACTIVO** (15 oct, hecho desde aquí con el token de gestión):
  extensiones `pg_cron` y `pg_net` instaladas, y job `send-reminders` (`cron.job` id 1)
  cada minuto vía `net.http_post` a la función (usa la clave publicable, no la service role).
  Verificado: `cron.job_run_details` → `succeeded`.
  Para quitarlo:
  `select cron.unschedule('send-reminders');`
- **`notify-task` cerrada y desplegada** (15 oct): exige JWT de sesión de usuario
  y devuelve `401` con la clave publicable o con un JWT basura.
  Verificado con un usuario temporal (ya borrado): clave pública → `401`,
  JWT de usuario → `200 {"sent":0}`, payload sin `userId` → `400`.
  La PWA la llama con `callFunction()` (JWT de sesión) y la caché del SW está en `familia-v3`.
- **Login con contraseña añadido** (15 oct, E2E verificado con navegador real):
  en la pantalla de entrada hay dos formas: email + contraseña (la principal)
  y, dentro del desplegable, el enlace mágico + el campo para pegar la URL
  del enlace si el correo no abre. Cuenta existente: `cesargode@gmail.com`
  (perfil "Cesar", móvil +34692232900). La contraseña la tiene el usuario;
  si la olvida se resetea con `PUT /auth/v1/admin/users/{id}` (service role).
- **Site URL de Auth corregida**: el magic link redirige ya a
  `http://192.168.0.44:8081` (antes mandaba a `http://localhost:3000`,
  que era el motivo del error al abrir el correo).
- **E2E completo probado con Firefox headless** contra `http://192.168.0.44:8081`:
  magic link → onboarding → calendario → crear tarea → y también
  login con contraseña → calendario/familia/ajustes. Todo OK.
  Datos de prueba borrados (solo queda el perfil "Cesar" y 0 tareas).
- CLI de Supabase instalado y linkeado al proyecto
  (guardar el token solo en la sesión; NO escribirlo en archivos).
- **Servidor local con cabeceras anti-caché** (15 oct): `serve.py` sustituye a
  `python3 -m http.server` y manda `Cache-Control: no-cache` en HTML/JS/CSS,
  así la app se actualiza sola en todos los dispositivos sin borrar datos.
- **Service Worker v4: red primero, caché solo de respaldo** (15 oct):
  antes era cache-first y los móviles se quedaban con versiones viejas
  (de ahí el "email rate limit exceeded": usaban el formulario antiguo de
  enlace mágico y repetían envíos). Ahora siempre coge la última versión y
  solo usa la caché si no hay red.
- E2E verificado tras estos cambios (Firefox headless): carga → login con
  contraseña → onboarding → recarga → calendario y familia OK.
- **4 cuentas de la familia creadas** (15 oct), todas con la misma contraseña
  `Familia2026` (puede cambiarla César desde la app):
  `cesargode@gmail.com`, `itmsiagem113@gmail.com` (Isa),
  `saraamortorres3@gmail.com`, `alejandroamortorres@gmail.com`.
  Solo César tiene perfil; los otros3 se lo crean al entrar (nombre/móvil/color).
- **Administración de la familia** (15 oct, E2E verificado de punta a punta):
  - Nueva columna `profiles.is_admin` (solo César) y `profiles.email`
    (lo escribe el sistema desde `auth.users`; un trigger impide que el
    cliente se asigne admin o cambie el email).
  - Edge Function **`manage-users`** desplegada: `create_user`,
    `set_password`, `update_user`, `delete_user`. Exige JWT de un usuario
    con `is_admin` (401 sin sesión, 403 si no es admin).
  - Panel en **Ajustes** (solo visible para César): añadir miembro,
    cambiar contraseña, editar nombre/WhatsApp y borrar miembro.
  - Comprobado: admin crea miembro → le cambia la contraseña → ese miembro
    entra con la contraseña nueva y **no** ve el panel → el admin lo borra.

## 🌐 Datos de conexión
- Proyecto Supabase: `qvldxrsloszuuuwojxid` (https://qvldxrsloszuuuwojxid.supabase.co)
- Clave publicable en `public/config.js`
- PC en la red local: **192.168.0.44** → app en http://192.168.0.44:8081
- Tailscale de la PC: **100.73.85.125** → http://100.73.85.125:8081
- Móvil: Redmi Note 14 Pro (Tailscale instalado, pero aparece offline)

## ⚠️ Bloqueo actual
Ya no hay bloqueo de red ni de cron. Lo único que **no puedo hacer yo** desde la terminal:

1. **Hosting con HTTPS** → no hay `wrangler`/`vercel` instalados ni login de
   GitHub/Cloudflare/Vercel. Necesito que el usuario haga login o pegue un token.

## 📋 Siguientes pasos (en este orden)
1. **Probar en el móvil** con la contraseña (ya verificado en E2E desde la PC):
   `http://192.168.0.44:8081` → `cesargode@gmail.com` + contraseña.
   Si el móvil tiene la versión vieja cacheada, cerrar la pestaña y abrirla otra vez.
   (Push/instalar app NO funcionarán todavía: el navegador exige HTTPS.)
2. **Hosting con HTTPS** (Cloudflare Pages o Vercel, subiendo la carpeta `public/`):
   obligatorio para **push** e **"instalar app"** (por IP sin HTTPS el navegador
   bloquea el service worker). Al publicarlo, añadir esa URL a
   Authentication → URL Configuration (Redirect URLs) de Supabase.
3. Último día: que cada familiar se registre (email + contraseña que tú les des,
   o enlace mágico) y se repartan las tareas.

## 🔐 Seguridad
- `notify-task` ya **no** acepta la clave publicable: exige el JWT de la sesión
  (implementado y desplegado el 15 oct; la PWA lo manda con `callFunction()`).
- El cron usa la clave publicable como Bearer (no la service role), porque
  `send-reminders` no valida usuario: solo llama a la función con service role
  por dentro.

## 🔧 Comandos útiles
```bash
# Arrancar el servidor de pruebas (con no-cache, importante para la PWA)
cd /home/cesar/app-planificador-familiar
python3 serve.py

# Ver si sigue corriendo / accesible
pgrep -af "serve.py"; curl -sm 3 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/

# Redesplegar las Edge Functions (token en SUPABASE_ACCESS_TOKEN)
cd /home/cesar/app-planificador-familiar
supabase link --project-ref qvldxrsloszuuuwojxid
supabase functions deploy notify-task
supabase functions deploy send-reminders

# Poner / quitar el cron de recordatorios (pg_cron + pg_net, ya está puesto)
#   select cron.schedule('send-reminders','* * * * *', $$ <net.http_post ...> $$);
#   select cron.unschedule('send-reminders');
#   ver: select * from cron.job; select * from cron.job_run_details order by start_time desc limit 5;

# Probar send-reminders sin desplegar nada más
curl -s -X POST https://qvldxrsloszuuuwojxid.supabase.co/functions/v1/send-reminders \
  -H "apikey: $(grep -oP "SUPABASE_KEY: '\K[^']+" public/config.js)" \
  -H "Authorization: Bearer $(grep -oP "SUPABASE_KEY: '\K[^']+" public/config.js)"
```

## 💡 Notas
- **Cuentas creadas** (13 oct): `cesargode@gmail.com` (perfil Cesar),
  `saraamortorres3@gmail.com` y `alejandroamortorres@gmail.com` (esta dos **sin
  perfil aún**: se lo crean al entrar). Si se les olvida la contraseña:
  `PUT /auth/v1/admin/users/{id}` con service role → `{"password":"..."}`.
- El cron se programó con SQL (`pg_cron` + `pg_net`), así que **no hay que tocar
  el Dashboard** para los recordatorios.
- No hay git en el proyecto todavía (`git init` pendiente si se quiere versionar).
- `supabase` CLI **sí instalado** (v2.121.0). El token debe pegarlo el usuario cada
  sesión (https://supabase.com/dashboard/account/tokens, con **todos los permisos**)
  y usarlo como variable de entorno: `export SUPABASE_ACCESS_TOKEN=...`
  — **nunca** guardarlo en ficheros ni en el historial.
- El usuario trabaja en español: responder siempre en español.
