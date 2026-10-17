# 👨‍👩‍👧‍👦 Familia — Planificador de tareas

App web (PWA) para el móvil y el PC: cualquiera asigna tareas, el asignado las acepta,
y todas se ven en un calendario común + calendario personal. Backend en **Supabase** (gratis).

## Funciones
- ✅ Asignar tareas a cualquier miembro (todos iguales)
- ✅ Aceptar / rechazar con motivo / marcar hecha
- 📅 Calendario común y calendario personal (toggle)
- 🔁 Tareas recurrentes (diarias, laborables, semanales, mensuales)
- 🟡🟠🔴 Prioridad y categorías
- 🔔 Notificaciones push + recordatorios automáticos (9:00 y si lleva 24h sin aceptar)
- 💬 Botón "Avisar por WhatsApp" (abre el chat con el mensaje listo)

## Configuración (una sola vez)

### 1. Base de datos
1. Ve a https://supabase.com → tu proyecto → **SQL Editor**
2. Pega todo el contenido de `supabase/schema.sql` y pulsa **Run**

### 2. Edge Functions (avisos y recordatorios)
```bash
npm install -g supabase
supabase login
supabase link --project-ref qvldxrsloszuuuwojxid

supabase secrets set \
  VAPID_PUBLIC_KEY="BKECEELK46JxVyWO3nldfJdXnmxJ21aM2eDAMKJvk-m3Ympc1G9WjFs_-gjMg8O0RRuOVc8-IjJ--4hwyV6CvUg" \
  VAPID_PRIVATE_KEY="<la clave privada está en Supabase → Edge Functions → Secrets>"

supabase functions deploy notify-task
supabase functions deploy send-reminders
```
Luego, en el Dashboard → **Edge Functions** → `send-reminders` → **Scheduling** → `* * * * *` (cada minuto).

### 3. Ejecutar en local
```bash
cd /home/cesar/app-planificador-familiar
python3 serve.py
# abre http://localhost:8081  (en la red local: http://TU_IP:8081)
```

### 4. Para la familia (hosting gratuito)
- **Producción:** https://cesargode.github.io/planificador-familiar/ (GitHub Pages;
  cada push a `main` despliega solo con Actions).
- **Reserva:** https://familia-planificador.pages.dev (Cloudflare Pages; ojo, el
  rango 188.114.x de Cloudflare da timeout desde Vodafone).

Cada miembro entra con su email y contraseña (o enlace mágico), pone nombre y móvil, y listo.
El primer día: cada uno se crea su perfil en Ajustes y tú repartes las tareas.

## Estructura
```
public/               → la PWA (index.html, app.js, sw.js, estilos)
supabase/schema.sql   → tablas y permisos
supabase/functions/   → notify-task (push inmediato) y send-reminders (cron)
```
