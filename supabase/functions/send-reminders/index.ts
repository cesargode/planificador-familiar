// ============================================================
//  send-reminders: recordatorios automáticos (función programada)
//  Programar en Dashboard → Edge Functions → send-reminders
//  → Scheduling: "* * * * *" (cada minuto; internamente filtra)
//  Reglas:
//   - "due_soon": tarea pendiente/aceptada con fecha de hoy → 9:00
//   - "due_soon_1h": tarea con hora de vencimiento → 1 hora antes
//   - "pending_24h": creada hace 24h y sin aceptar → 1 solo aviso
// ============================================================
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:familia@example.com", VAPID_PUBLIC, VAPID_PRIVATE);

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

const TZ = "Europe/Madrid";
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...opts });

const todayISO = () => fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
  .format(new Date()).split("/").reverse().join("-"); // yyyy-mm-dd

const hourMadrid = () => Number(fmt({ hour: "numeric", hour12: false }).format(new Date()));

// fecha (yyyy-mm-dd) y minutos desde las 00:00 en Madrid
const nowParts = () => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    minutes: Number(g("hour")) * 60 + Number(g("minute")),
  };
};

async function sendPush(userId: string, body: string) {
  const subs = await (await rest(`push_subscriptions?user_id=eq.${userId}`)).json();
  await Promise.allSettled(
    subs.map((s: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Familia 📅", body, url: "/" })
      )
    )
  );
}

async function alreadySent(taskId: string, kind: string) {
  const rows = await (await rest(`reminder_log?task_id=eq.${taskId}&kind=eq.${kind}`)).json();
  return rows.length > 0;
}

async function logSent(taskId: string, kind: string) {
  await rest("reminder_log", {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, kind }),
    headers: { Prefer: "resolution=ignore-duplicates" },
  });
}

Deno.serve(async () => {
  const today = todayISO();
  const hour = hourMadrid();

  // 1) Recordatorio del día (una vez a las 9:00)
  if (hour === 9) {
    const dueToday = await (await rest(
      `tasks?due_date=eq.${today}&status=in.(pending,accepted)&select=id,title,assigned_to,profiles( name )`
    )).json();
    for (const t of dueToday) {
      if (!t.assigned_to || await alreadySent(t.id, "due_soon")) continue;
      await sendPush(t.assigned_to, `⏰ Hoy toca: ${t.title}`);
      await logSent(t.id, "due_soon");
    }
  }

  // 2) Una hora antes del vencimiento (tarea con hora)
  const now = nowParts();
  const withTime = await (await rest(
    `tasks?due_date=eq.${now.date}&due_time=not.is.null&status=in.(pending,accepted)&select=id,title,assigned_to,due_time`
  )).json();
  for (const t of withTime) {
    if (!t.assigned_to || await alreadySent(t.id, "due_soon_1h")) continue;
    const hhmm = String(t.due_time).slice(0, 5).split(":");
    const dueMin = Number(hhmm[0]) * 60 + Number(hhmm[1]);
    if (now.minutes >= dueMin - 60 && now.minutes < dueMin) {
      await sendPush(t.assigned_to, `⏳ En 1 hora: ${t.title} (${hhmm[0]}:${hhmm[1]})`);
      await logSent(t.id, "due_soon_1h");
    }
  }

  // 3) Sin aceptar tras 24h
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const unaccepted = await (await rest(
    `tasks?status=eq.pending&created_at=lt.${yesterday}&select=id,title,assigned_to`
  )).json();
  for (const t of unaccepted) {
    if (!t.assigned_to || await alreadySent(t.id, "pending_24h")) continue;
    await sendPush(t.assigned_to, `📋 Tarea sin aceptar: ${t.title}`);
    await logSent(t.id, "pending_24h");
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
