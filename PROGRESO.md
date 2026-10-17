# 📌 Planificador Familiar — Estado y siguientes pasos

> Última actualización: **17 oct 2026**.
> **El fichero que manda para continuar es `ORDENES.txt`** (qué hacer ahora,
> accesos y comandos). Este PROGRESO es el historial de lo ya hecho.

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
- **Migración a GitHub Pages** (17 oct tarde): Vodafone (AS12430) no enruta
  al rango 188.114.96.x de Cloudflare, así que `pages.dev` daba timeout
  (el sitio estaba bien; comprobado con `curl --resolve` contra otra IP).
  Repo público `cesargode/planificador-familiar` (rama `main`), workflow
  `.github/workflows/deploy-pages.yml` despliega `public/` en cada push.
  **URL actual: https://cesargode.github.io/planificador-familiar/**
  (HTTP 200 desde Vodafone). Cloudflare Pages queda de reserva sin tocar.

## 🌐 Datos de conexión
- Proyecto Supabase: `qvldxrsloszuuuwojxid` (https://qvldxrsloszuuuwojxid.supabase.co)
- Clave publicable en `public/config.js`
- **App publicada (GitHub Pages): https://cesargode.github.io/planificador-familiar/**
- Reserva (Cloudflare, la bloquea Vodafone): https://familia-planificador.pages.dev
- PC en la red local: **192.168.0.44** → app en http://192.168.0.44:8081
- Tailscale de la PC: **100.73.85.125** → http://100.73.85.125:8081
- Móvil: Redmi Note 14 Pro (Tailscale instalado, pero aparece offline)

## ⚠️ Bloqueo actual
Ninguno operativo. La app está publicada en GitHub Pages y se usa desde
la URL de arriba. Pasa que Vodafone no enruta a `pages.dev` (ver Hecho),
por eso se cambió el hosting.

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
- El proyecto **ya tiene git** (`git init` hecho, varios commits). Falta
  decidir si se sube a GitHub (PASO 6) y si se conecta Cloudflare Pages al
  repo para desplegar con `git push`.
- `supabase` CLI **sí instalado** (v2.121.0). El token debe pegarlo el usuario cada
  sesión (https://supabase.com/dashboard/account/tokens, con **todos los permisos**)
  y usarlo como variable de entorno: `export SUPABASE_ACCESS_TOKEN=...`
  — **nunca** guardarlo en ficheros ni en el historial.
- El usuario trabaja en español: responder siempre en español.

## 🚀 17 oct 2026 — PASO 1: publicación en HTTPS + push verificado

- **Cloudflare Pages** subiendo la carpeta `public/` (sin build, sin git).
  URL pública: **https://familia-planificador.pages.dev**
  Servida con `cache-control: public, max-age=0, must-revalidate`
  (igual que el `serve.py` local, así que la PWA se actualiza sola).
- Verificado con navegador automatizado contra la URL pública:
  `window.isSecureContext`, service worker controlando la página,
  APIs de `serviceWorker`/`PushManager`/`Notification` disponibles,
  login con contraseña y calendario cargando.
- **Push de extremo a extremo con el navegador real de César**: suscripción
  guardada en `push_subscriptions` (endpoint de Mozilla) y `notify-task`
  respondió `{"sent":1}` → le llegó la notificación de prueba.
- Limitación aprendida: en **Firefox headless no se puede automatizar el
  permiso** de notificaciones (el prompt no se resuelve; el pref
  `permissions.default.notification` ya no existe en Firefox 157). La prueba
  final del permiso la tiene que hacer el usuario en su navegador.
- Ojo: una limpieza de pruebas borró sin querer la fila de
  `push_subscriptions` y el usuario tuvo que reactivar. **No borrar esa fila.**
- Pendiente del PASO 1: el usuario debe añadir la URL de Pages en Supabase →
  Authentication → URL Configuration (Site URL + Redirect URLs), porque el
  token de gestión no llega a esa configuración (404 en `/v1/projects/.../config`).

## 🚀 17 oct 2026 — PASO 2: recordatorio «1 hora antes del vencimiento»

- **Regla `due_soon_1h`** en `supabase/functions/send-reminders/index.ts`
  (desplegada): tareas de hoy con `due_time`, estado `pending`/`accepted` y
  sin aviso previo se notifican en la ventana **[vencimiento − 1 h, vencimiento)**,
  con mensaje `⏳ En 1 hora: <título> (HH:MM)`.
- **`reminder_log_kind_check` ampliado** en vivo a
  `('due_soon','due_soon_1h','pending_24h')` y reflejado en `supabase/schema.sql`
  (con el bloque de actualización comentado para bases ya creadas).
- **Campo «hora» opcional** en el formulario de tarea (`#tf-time` en
  `index.html`, `due_time` en `createTask()` de `app.js`), con pista:
  «quien tenga la tarea recibirá un aviso 1 hora antes». Sin este campo la
  regla no habría tenido nunca datos que procesar (antes `due_time` solo se
  mostraba y propagaba, nunca se rellenaba).
- **Verificación de punta a punta** con el cron real: tarea de prueba con
  hora a +30 min → `reminder_log` con `kind='due_soon_1h'` a los 60 s
  (job `succeeded`), push recibido por el navegador de César; tarea de prueba
  borrada después.
- **E2E de navegador** (Firefox headless contra `http://127.0.0.1:8081`):
  login con contraseña → pestaña Nueva → campo de tipo `time` → creación →
  recarga → la tarea aparece «17 oct 12:10». Datos de prueba borrados.
- **Pendiente**: subir `public/` a Cloudflare Pages (el campo de hora y sus
  textos solo existen en local) — FALTA 2c en `ORDENES.txt`.

## ✅ 17 oct 2026 — PASO 3: editar y borrar tareas

- En el **detalle de tarea** (modal) hay ahora dos botones nuevos, visibles
  para cualquier miembro (la RLS ya lo permitía):
  - **✏️ Editar** → `openEditForm()` en `public/app.js`: formulario con
    título, detalles, asignado, categoría, fecha, **hora**, prioridad y
    repetición. *Cancelar* vuelve al detalle. Si cambia el asignado, aviso
    push al nuevo asignado vía `notify-task`.
  - **🗑 Borrar** → `confirm()` + `delete()`. `reminder_log` desaparece solo
    (cascade) y se avisa al creador si no eres tú.
- **E2E con navegador automatizado** (Firefox headless, `http://127.0.0.1:8081`):
  crear tarea → abrir modal (botones `accept/decline/wa/done/edit/del`) →
  editar título/prioridad/fecha/hora → guardar → cancelar → borrar.
  Comprobado al final que la tarea real **`planchar` sigue intacta** y la de
  prueba ya no existe.
- Al igual que el campo de hora, **esto solo está en local**: hay que volver
  a subir `public/` a Cloudflare Pages (FALTA 2c en `ORDENES.txt`).

## 🌐 17 oct 2026 — Publicación en Pages (PASO 2 y 3 ya en producción)

- **URL definitiva: https://familia-planificador.pages.dev** (producción).
  Verificado por diff fichero a fichero: **producción == `public/` local**
  (campo `#tf-time`, `openEditForm`, botones editar/borrar incluidos).
- ⚠ **Las URL con hash congelan el despliegue**: `86bd2a2e.familia-planificador.pages.dev`
  (la que tenía dada la familia) sigue sirviendo la versión **vieja** y no
  va a cambiar nunca. Cada despliegue nuevo genera su propio hash
  (`294c26b3…`, `bc4a67bb…`, …). **Solo hay que dar la de producción.**
- **wrangler quedó logueado** (OAuth con la cuenta del usuario) → ya no hace
  falta el dashboard para publicar:
  `npx wrangler pages deploy public/ --project-name=familia-planificador --branch=main`
  (sin `--branch=main` crea un *preview*, porque la rama local es `master` y
  la de producción es `main`).
- Etiquetas del dashboard en español (traducido por el navegador):
  *Deployments*→Despliegues, *Create deployment*→Crear despliegue,
  *Upload assets*→Subir recursos, *Deploy site*→Desplegar sitio.
- **Pendiente**: quien haya activado notificaciones o instalado la app desde
  la URL con hash debe abrir la de producción y volver a pulsar
  «🔔 Activar notificaciones» (permiso y service worker son de cada origen).

## ✅ 17 oct 2026 — PASO 1d + notificaciones en la URL nueva

- **PASO 1d hecho por el usuario**: Site URL y Redirect URLs de Supabase
  apuntan ya a `https://familia-planificador.pages.dev/*` (no verificable
  desde la terminal: `GET /v1/projects/.../config` → 404 con el token de gestión).
- **Notificaciones reactivadas en el origen nuevo**: `push_subscriptions`
  tiene ahora **2 filas** (la de la URL vieja `86bd2a2e…` y la creada a las
  12:14 en producción). Prueba de push enviada por el cron a las **12:16**.
- **La app ya se está usando con datos reales**: apareció la tarea familiar
  «Barrer» con hora, y su recordatorio *1 hora antes* salió a las **12:09**
  → el PASO 2 funciona en producción, no solo en la prueba.
- Tareas de prueba borradas: solo quedan `planchar` y `Barrer`.
