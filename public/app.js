/* ============================================================
   PLANIFICADOR FAMILIAR - lógica principal
   ============================================================ */
const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
const APP_URL = new URL('./', document.baseURI).href; // raíz real de la app (funciona en subcarpeta)

const state = {
  user: null,
  profile: null,
  profiles: [],
  categories: [],
  tasks: [],
  tab: 'calendario',
  calView: 'comun',       // comun | mio
  calDate: new Date(),    // mes mostrado
  calSelected: null,      // día seleccionado (ISO yyyy-mm-dd)
  filter: 'pend'          // pend | mis | hist
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const todayISO = () => new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd
const esc = (s) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================ ARRANQUE ============================ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('login-title').textContent = cfg.APP_NAME;
  document.getElementById('app-title').textContent = `📅 ${cfg.APP_NAME}`;
  document.title = cfg.APP_NAME;

  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user) await enterApp();
  else showView('view-login');

  sb.auth.onAuthStateChange(async (event, session) => {
    state.user = session?.user || null;
    if (event === 'SIGNED_IN' && state.user) {
      const { data: prof } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
      state.profile = prof;
      if (prof) { await enterApp(); } else { showView('view-onboarding'); }
    } else if (event === 'SIGNED_OUT') {
      showView('view-login');
    }
  });

  wireEvents();
  registerSW();
}

function showView(id) {
  ['view-login', 'view-onboarding', 'view-app'].forEach((v) => $(v).classList.toggle('hidden', v !== id));
}

async function enterApp() {
  const { data: prof } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  state.profile = prof;
  if (!prof) { showView('view-onboarding'); return; }
  $('btn-profile').textContent = prof.name[0].toUpperCase();
  $('btn-profile').style.background = prof.color;
  showView('view-app');
  await loadAll();
  switchTab(state.tab);
  render();
  subscribeRealtime();
  setupPeriodicSync();
}

/* ============================ CARGA DE DATOS ============================ */
async function loadAll() {
  const [profiles, categories, tasks] = await Promise.all([
    sb.from('profiles').select('*').order('name'),
    sb.from('categories').select('*').order('name'),
    sb.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(name,color,phone), creator:profiles!tasks_created_by_fkey(name,color)').order('due_date', { ascending: true, nullsFirst: false })
  ]);
  state.profiles = profiles.data || [];
  state.categories = categories.data || [];
  state.tasks = tasks.data || [];
  fillSelects();
  renderFamily();
  renderAdmin();
}

function subscribeRealtime() {
  sb.channel('tasks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadAll().then(render))
    .subscribe();
}

function setupPeriodicSync() {
  setInterval(() => loadAll().then(render), 60000);
}

/* ============================ EVENTOS ============================ */
function wireEvents() {
  // Login con contraseña
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-msg').textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({
      email: $('login-email').value.trim(),
      password: $('login-pass').value
    });
    $('login-msg').textContent = error
      ? (error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : `Error: ${error.message}`)
      : '¡Dentro!';
  });

  // Alternativa: enlace mágico por correo
  $('otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('otp-email').value.trim();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL } });
    $('otp-msg').textContent = error
      ? `Error: ${error.message}`
      : '📧 Te he enviado un enlace de acceso. Ábrelo desde el móvil o el PC y entrarás directamente.';
  });

  // Entrada de emergencia: pegar la URL completa del enlace mágico
  $('login-paste-btn').addEventListener('click', async () => {
    const raw = $('login-paste').value.trim();
    const hash = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : '';
    const p = new URLSearchParams(hash);
    const access_token = p.get('access_token'), refresh_token = p.get('refresh_token');
    if (!access_token || !refresh_token) {
      $('login-msg').textContent = 'Esa URL no trae un enlace de acceso válido (falta #access_token=…).';
      return;
    }
    const { error } = await sb.auth.setSession({ access_token, refresh_token });
    $('login-msg').textContent = error ? `Error: ${error.message}` : '¡Ya estás dentro!';
  });

  // Onboarding
  buildColorPicker();
  $('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const color = document.querySelector('#ob-colors .sel')?.dataset.color || '#e74c3c';
    const { error } = await sb.from('profiles').upsert({
      id: state.user.id,
      name: $('ob-name').value.trim(),
      phone: $('ob-phone').value.trim() || null,
      color
    });
    if (error) return alert('Error al guardar el perfil: ' + error.message);
    await enterApp();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // Calendario
  $('cal-prev').addEventListener('click', () => { state.calDate.setMonth(state.calDate.getMonth() - 1); renderCalendar(); });
  $('cal-next').addEventListener('click', () => { state.calDate.setMonth(state.calDate.getMonth() + 1); renderCalendar(); });
  $('seg-comun').addEventListener('click', () => { state.calView = 'comun'; syncSeg('seg-comun', 'seg-mio'); renderCalendar(); });
  $('seg-mio').addEventListener('click', () => { state.calView = 'mio'; syncSeg('seg-mio', 'seg-comun'); renderCalendar(); });

  // Filtros tareas
  $('flt-pend').addEventListener('click', () => { state.filter = 'pend'; syncSeg('flt-pend', 'flt-mis', 'flt-hist'); renderTaskList(); });
  $('flt-mis').addEventListener('click', () => { state.filter = 'mis'; syncSeg('flt-mis', 'flt-pend', 'flt-hist'); renderTaskList(); });
  $('flt-hist').addEventListener('click', () => { state.filter = 'hist'; syncSeg('flt-hist', 'flt-pend', 'flt-mis'); renderTaskList(); });

  // Nueva tarea
  $('task-form').addEventListener('submit', createTask);

  // Modal
  $('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); });

  // Ajustes
  $('btn-push').addEventListener('click', enablePush);
  $('btn-logout').addEventListener('click', () => sb.auth.signOut());
  $('btn-profile').addEventListener('click', () => switchTab('ajustes'));

  // Instalar PWA
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    $('btn-install').classList.remove('hidden');
  });
  $('btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('btn-install').classList.add('hidden');
  });
  // Botón de Ajustes: usa el prompt si existe; si no, explica cómo instalar
  $('btn-install2').addEventListener('click', async () => {
    const hint = $('install-hint');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      $('btn-install').classList.add('hidden');
      hint.classList.add('hidden');
      return;
    }
    // Diagnóstico: estado del service worker y del manifest
    let sw = 'no soportado';
    if ('serviceWorker' in navigator) {
      const r = await navigator.serviceWorker.getRegistration();
      sw = !r ? 'NO registrado' : (r.active ? 'activo' : (r.installing ? 'instalando' : (r.waiting ? 'esperando' : 'sin activar')));
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const manual = ios
      ? 'En iPhone/iPad: botón Compartir ↗ en Safari → "Añadir a pantalla de inicio" → Añadir.'
      : 'En Chrome (Android): pulsa ⋮ arriba → "Instalar aplicación" o "Añadir a pantalla de inicio" → Instalar. Si no lo ves: ⋮ → Configuración → Datos personales del sitio → borra cesargode.github.io y recarga la página.';
    hint.textContent = `Service worker: ${sw}. ${manual}`;
    hint.classList.remove('hidden');
  });
}

function syncSeg(...ids) { ids.forEach((id, i) => $(id).classList.toggle('active', i === 0)); }

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
  $(`tab-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

function buildColorPicker() {
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#16a085', '#d35400'];
  const wrap = $('ob-colors');
  wrap.innerHTML = '';
  colors.forEach((c, i) => {
    const d = el('div', i === 0 ? 'sel' : '');
    d.style.background = c; d.dataset.color = c;
    d.onclick = () => { wrap.querySelectorAll('div').forEach((x) => x.classList.remove('sel')); d.classList.add('sel'); };
    wrap.appendChild(d);
  });
}

function fillSelects() {
  const asg = $('tf-assignee');
  asg.innerHTML = '<option value="">— Asignar a —</option>' +
    state.profiles.map((p) => `<option value="${p.id}">${p.color ? '●' : ''} ${esc(p.name)}</option>`).join('');
  // preseleccionar a los demás (quien crea suele asignar a otro)
  const cat = $('tf-category');
  cat.innerHTML = '<option value="">📌 Sin categoría</option>' +
    state.categories.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
}

function renderFamily() {
  const wrap = $('family-list');
  wrap.innerHTML = '';
  state.profiles.forEach((p) => {
    const row = el('div', 'family-row');
    row.innerHTML = `<span class="avatar sm" style="background:${p.color}">${esc(p.name[0].toUpperCase())}</span>
      <span>${esc(p.name)}</span>
      <span class="hint">${p.phone ? '🟢 ' + esc(p.phone) : 'sin WhatsApp'}</span>`;
    wrap.appendChild(row);
  });
}

/* ============================ RENDER ============================ */
function render() {
  if ($('tab-calendario') && !$('tab-calendario').classList.contains('hidden')) renderCalendar();
  if (!$('tab-tareas').classList.contains('hidden')) renderTaskList();
}

/* --------- Calendario --------- */
function tasksForCalendar() {
  let list = state.tasks.filter((t) => t.due_date && t.status !== 'done' && t.status !== 'declined');
  if (state.calView === 'mio') list = list.filter((t) => t.assigned_to === state.user.id);
  return list;
}

function renderCalendar() {
  const y = state.calDate.getFullYear(), m = state.calDate.getMonth();
  $('cal-month').textContent = state.calDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const grid = $('cal-grid');
  grid.innerHTML = '';
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => grid.appendChild(el('div', 'cal-head', d)));

  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  const monthTasks = tasksForCalendar();
  const byDate = {};
  monthTasks.forEach((t) => { (byDate[t.due_date] = byDate[t.due_date] || []).push(t); });

  for (let i = 0; i < startOffset; i++) grid.appendChild(el('div', 'cal-cell empty'));
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = el('div', 'cal-cell' + (iso === today ? ' today' : '') + (iso === state.calSelected ? ' sel' : ''));
    cell.innerHTML = `<span class="cal-daynum">${d}</span>`;
    const ts = byDate[iso] || [];
    if (ts.length) {
      const dots = el('div', 'cal-dots');
      ts.slice(0, 4).forEach((t) => {
        const dot = el('span', 'dot');
        dot.style.background = prioColor(t.priority);
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }
    cell.onclick = () => { state.calSelected = iso; renderCalendar(); };
    grid.appendChild(cell);
  }
  renderDayTasks(byDate);
}

function prioColor(p) { return { alta: '#e74c3c', normal: '#e67e22', baja: '#f1c40f' }[p] || '#888'; }

function renderDayTasks(byDate) {
  const wrap = $('cal-day-tasks');
  const iso = state.calSelected;
  if (!iso) { wrap.innerHTML = '<p class="hint">Toca un día para ver sus tareas.</p>'; return; }
  const ts = byDate[iso] || [];
  const dateLabel = new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  wrap.innerHTML = `<h3 style="text-transform:capitalize">${dateLabel}</h3>`;
  if (!ts.length) { wrap.appendChild(el('p', 'hint', 'Sin tareas ese día 🎉')); return; }
  ts.forEach((t) => wrap.appendChild(taskCard(t)));
}

/* --------- Lista de tareas --------- */
function renderTaskList() {
  const wrap = $('task-list');
  wrap.innerHTML = '';
  let list = [...state.tasks];
  if (state.filter === 'pend') list = list.filter((t) => ['pending', 'accepted'].includes(t.status));
  else if (state.filter === 'mis') list = list.filter((t) => t.assigned_to === state.user.id && t.status !== 'done' && t.status !== 'declined');
  else list = list.filter((t) => t.status === 'done' || t.status === 'declined');

  if (!list.length) { wrap.innerHTML = '<p class="hint" style="padding:2rem;text-align:center">Nada por aquí 👍</p>'; return; }
  list.sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  list.forEach((t) => wrap.appendChild(taskCard(t)));
}

function taskCard(t) {
  const card = el('div', `task-card st-${t.status}`);
  card.style.borderLeftColor = prioColor(t.priority);
  const who = t.assignee || { name: 'Sin asignar', color: '#888' };
  const cat = state.categories.find((c) => c.id === t.category_id);
  const rec = { daily: '🔁', weekly: '🔁', monthly: '🔁', weekdays: '🔁' }[t.recurrence] || '';
  const statusBadge = {
    pending: '<span class="badge b-pend">Pendiente de aceptar</span>',
    accepted: '<span class="badge b-ok">Aceptada</span>',
    done: '<span class="badge b-done">✔ Hecha</span>',
    declined: '<span class="badge b-no">✗ Rechazada</span>'
  }[t.status];
  const dateStr = t.due_date
    ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + (t.due_time ? ` ${t.due_time.slice(0, 5)}` : '')
    : 'sin fecha';

  card.innerHTML = `
    <div class="task-top">
      <span class="task-title">${rec} ${esc(t.title)}</span>
      ${statusBadge}
    </div>
    <div class="task-meta">
      <span class="avatar xs" style="background:${who.color}">${esc(who.name[0].toUpperCase())}</span>
      <span>${esc(who.name)}</span>
      ${cat ? `<span>${cat.icon}</span>` : ''}
      <span class="task-date ${isOverdue(t) ? 'overdue' : ''}">${isOverdue(t) ? '⏰ ' : ''}${dateStr}</span>
    </div>`;
  card.onclick = () => openTaskModal(t);
  return card;
}

function isOverdue(t) {
  return t.due_date && t.due_date < todayISO() && !['done', 'declined'].includes(t.status);
}

/* --------- Modal detalle --------- */
function openTaskModal(t) {
  const c = $('modal-content');
  const who = t.assignee || { name: 'Sin asignar', color: '#888' };
  const cat = state.categories.find((x) => x.id === t.category_id);
  const isMine = t.assigned_to === state.user.id;
  let actions = '';

  if (t.status === 'pending' && isMine) {
    actions = `
      <button class="btn btn-primary" data-act="accept">✅ Aceptar tarea</button>
      <button class="btn btn-outline" data-act="decline">✗ Rechazar</button>`;
  } else if (t.status === 'accepted' && isMine) {
    actions = `<button class="btn btn-primary" data-act="done">🎉 Marcar como hecha</button>`;
  } else if (t.status === 'pending') {
    actions = `<p class="hint">Esperando a que ${esc(who.name)} la acepte.</p>`;
  } else if (t.status === 'accepted' && !isMine) {
    actions = `<button class="btn btn-primary" data-act="done">🎉 Marcar como hecha (admin familiar)</button>`;
  }

  const waBtn = who.phone
    ? `<button class="btn btn-wa" data-act="wa">💬 Avisar por WhatsApp a ${esc(who.name)}</button>`
    : (who.phone === null ? '' : '');

  const doneBtn = t.status !== 'done' && t.status !== 'declined' && !actions.includes('data-act="done"')
    ? `<button class="btn btn-outline" data-act="done">Marcar hecha</button>` : '';

  const editBtn = `<button class="btn btn-outline" data-act="edit">✏️ Editar</button>`;
  const delBtn = `<button class="btn btn-danger" data-act="del">🗑 Borrar</button>`;
  const extra = `${waBtn}${doneBtn}${editBtn}${delBtn}`;

  c.innerHTML = `
    <h2>${esc(t.title)}</h2>
    ${t.description ? `<p>${esc(t.description)}</p>` : ''}
    <div class="task-meta big">
      <span class="avatar xs" style="background:${who.color}">${esc(who.name[0].toUpperCase())}</span>
      <b>${esc(who.name)}</b>
      ${cat ? `<span>${cat.icon} ${esc(cat.name)}</span>` : ''}
      <span>📌 ${t.priority}</span>
      ${t.due_date ? `<span>📆 ${t.due_date}${t.due_time ? ' ' + t.due_time.slice(0, 5) : ''}</span>` : ''}
      ${t.recurrence !== 'none' ? `<span>${esc({ daily: '🔁 Diaria', weekdays: '🔁 Días laborables', weekly: '🔁 Semanal', monthly: '🔁 Mensual' }[t.recurrence])}</span>` : ''}
    </div>
    <div class="modal-actions">${actions || ''}${extra}</div>`;

  c.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => taskAction(b.dataset.act, t)));
  $('modal').classList.remove('hidden');
}

/* ============================ ACCIONES DE TAREA ============================ */
async function taskAction(act, t) {
  if (act === 'accept') {
    await sb.from('tasks').update({ status: 'accepted' }).eq('id', t.id);
    await notifyAssignedToCreator(t, '✅ ha aceptado la tarea');
  } else if (act === 'decline') {
    const reason = prompt('¿Por qué la rechazas? (opcional)') || null;
    await sb.from('tasks').update({ status: 'declined', decline_reason: reason }).eq('id', t.id);
    await notifyAssignedToCreator(t, '✗ ha rechazado la tarea' + (reason ? `: ${reason}` : ''));
  } else if (act === 'done') {
    await sb.from('tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', t.id);
    await notifyAssignedToCreator(t, '🎉 ha completado la tarea');
    await spawnNextOccurrence(t);
  } else if (act === 'wa') {
    sendWhatsApp(t);
    return;
  } else if (act === 'edit') {
    openEditForm(t);
    return;
  } else if (act === 'del') {
    if (!confirm(`¿Borrar la tarea «${t.title}»?\nNo se puede deshacer.`)) return;
    const { error } = await sb.from('tasks').delete().eq('id', t.id);
    if (error) return alert('Error: ' + error.message);
    await notifyAssignedToCreator(t, '🗑 ha borrado la tarea');
    $('modal').classList.add('hidden');
    await loadAll();
    render();
    return;
  }
  $('modal').classList.add('hidden');
  await loadAll();
  render();
}

/* ============================ EDITAR TAREA ============================ */
function openEditForm(t) {
  const c = $('modal-content');
  const opt = (v, sel, label) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${label}</option>`;
  const profOpts = state.profiles.map((p) => opt(p.id, t.assigned_to, esc(p.name))).join('');
  const catOpts = `<option value="">📌 Sin categoría</option>` +
    state.categories.map((x) => opt(x.id, t.category_id, `${x.icon} ${esc(x.name)}`)).join('');
  const prioLabel = { baja: '🟡 Prioridad baja', normal: '🟠 Prioridad normal', alta: '🔴 Prioridad alta' };
  const prioOpts = Object.keys(prioLabel).map((p) => opt(p, t.priority, prioLabel[p])).join('');
  const recLabel = { none: 'Sin repetición', daily: 'Todos los días', weekdays: 'Días laborables (L-V)', weekly: 'Cada semana', monthly: 'Cada mes' };
  const recOpts = Object.keys(recLabel).map((r) => opt(r, t.recurrence, recLabel[r])).join('');

  c.innerHTML = `
    <h2>✏️ Editar tarea</h2>
    <form id="edit-form">
      <input type="text" id="ef-title" maxlength="80" required value="${esc(t.title)}" />
      <textarea id="ef-desc" maxlength="300" placeholder="Detalles (opcional)">${esc(t.description || '')}</textarea>
      <div class="form-row">
        <select id="ef-assignee">${profOpts}</select>
        <select id="ef-category">${catOpts}</select>
      </div>
      <div class="form-row">
        <input type="date" id="ef-date" value="${t.due_date || ''}" />
        <input type="time" id="ef-time" value="${t.due_time ? t.due_time.slice(0, 5) : ''}" />
      </div>
      <select id="ef-priority">${prioOpts}</select>
      <select id="ef-recurrence">${recOpts}</select>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Guardar cambios</button>
        <button type="button" class="btn btn-outline" id="ef-cancel">Cancelar</button>
      </div>
    </form>`;

  $('ef-cancel').addEventListener('click', () => openTaskModal(t));
  $('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const assignee = $('ef-assignee').value;
    const changes = {
      title: $('ef-title').value.trim(),
      description: $('ef-desc').value.trim() || null,
      assigned_to: assignee || null,
      category_id: $('ef-category').value || null,
      due_date: $('ef-date').value || null,
      due_time: $('ef-time').value || null,
      priority: $('ef-priority').value,
      recurrence: $('ef-recurrence').value
    };
    const { error } = await sb.from('tasks').update(changes).eq('id', t.id);
    if (error) return alert('Error: ' + error.message);

    if (assignee && assignee !== t.assigned_to) {
      await callFunction('notify-task', {
        userId: assignee,
        message: `✏️ ${state.profile.name} te ha asignado la tarea editada: ${changes.title}`
      }).catch(() => {});
    }
    $('modal').classList.add('hidden');
    await loadAll();
    render();
  });
}

async function callFunction(name, body) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': cfg.SUPABASE_KEY,
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

async function notifyAssignedToCreator(t, msg) {
  // Si el creador no es quien actúa, avisa push
  if (!t.created_by || t.created_by === state.user.id) return;
  try {
    const resp = await callFunction('notify-task', {
      userId: t.created_by,
      message: `${state.profile.name} ${msg}: ${t.title}`
    });
    if (resp && !resp.ok) console.warn('notify-task', await resp.text());
  } catch (e) { console.warn('notify-task error', e); }
}

async function spawnNextOccurrence(t) {
  if (t.recurrence === 'none' || !t.due_date) return;
  const d = new Date(t.due_date + 'T12:00:00');
  if (t.recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (t.recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (t.recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (t.recurrence === 'weekdays') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  }
  const nextDate = d.toLocaleDateString('sv-SE');
  await sb.from('tasks').insert({
    title: t.title, description: t.description, category_id: t.category_id,
    priority: t.priority, due_date: nextDate, due_time: t.due_time,
    recurrence: t.recurrence, status: 'pending',
    assigned_to: t.assigned_to, created_by: t.created_by
  });
}

function sendWhatsApp(t) {
  const who = t.assignee;
  if (!who?.phone) return;
  const url = waLink(who, t.title, t.due_date);
  window.open(url, '_blank');
}

function waLink(who, title, dueDate) {
  const dateStr = dueDate ? ` para el ${new Date(dueDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : '';
  const text = `👋 Hola ${who.name}, tienes una tarea en *${cfg.APP_NAME}*: *${title}*${dateStr}. Mírala aquí: ${APP_URL}`;
  return `https://wa.me/${who.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
}

/* ============================ NUEVA TAREA ============================ */
async function createTask(e) {
  e.preventDefault();
  const assignee = $('tf-assignee').value;
  if (!assignee) return alert('Elige a quién se asigna la tarea.');
  const title = $('tf-title').value.trim();
  const dueDate = $('tf-date').value || null;
  const { error } = await sb.from('tasks').insert({
    title,
    description: $('tf-desc').value.trim() || null,
    assigned_to: assignee,
    category_id: $('tf-category').value || null,
    due_date: dueDate,
    due_time: $('tf-time').value || null,
    priority: $('tf-priority').value,
    recurrence: $('tf-recurrence').value,
    created_by: state.user.id,
    status: 'pending'
  });
  if (error) return alert('Error: ' + error.message);

  // Aviso inmediato al asignado (push)
  await callFunction('notify-task', {
    userId: assignee,
    message: `📋 Nueva tarea para ti: ${title}`
  }).catch(() => {});

  // Y WhatsApp con el mensaje listo (si tiene móvil y no te la asignas a ti)
  const who = state.profiles.find(p => p.id === assignee);
  if (who?.phone && assignee !== state.user.id) {
    window.open(waLink(who, title, dueDate), '_blank');
  }

  $('task-form').reset();
  switchTab('tareas');
  await loadAll();
  render();
}

/* ============================ ADMINISTRACIÓN DE LA FAMILIA ============================ */
function openModal(html) {
  $('modal-content').innerHTML = html;
  $('modal').classList.remove('hidden');
  return $('modal-content');
}

function renderAdmin() {
  const wrap = $('admin-panel');
  if (!wrap) return;
  if (!state.profile?.is_admin) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('hidden');
  wrap.innerHTML = `
    <h3>👨‍👩‍👧‍👦 Familia (administración)</h3>
    <p class="hint">Añade miembros, cámbiales la contraseña o edita su perfil y su WhatsApp.</p>
    <div id="admin-list"></div>
    <button class="btn btn-outline" id="admin-new">➕ Añadir miembro</button>`;
  const list = wrap.querySelector('#admin-list');
  state.profiles.forEach((p) => {
    const row = el('div', 'family-row admin-row');
    row.innerHTML = `<span class="avatar sm" style="background:${p.color}">${esc(p.name[0].toUpperCase())}</span>
      <span class="admin-who"><b>${esc(p.name)}</b>
        <span class="hint">${esc(p.email || 'sin email')}${p.phone ? ' · ' + esc(p.phone) : ''}${p.is_admin ? ' · 👑' : ''}</span></span>`;
    [['✏️', 'Editar perfil', () => adminEdit(p)],
     ['🔑', 'Cambiar contraseña', () => adminPassword(p)],
     ['🗑️', 'Borrar miembro', () => adminDelete(p)]].forEach(([icono, titulo, fn]) => {
      const b = el('button', 'btn-mini', icono);
      b.title = titulo; b.onclick = fn;
      row.appendChild(b);
    });
    list.appendChild(row);
  });
  wrap.querySelector('#admin-new').onclick = adminNew;
}

async function callManage(body) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'No hay sesión activa.' };
  try {
    const resp = await fetch(`${cfg.SUPABASE_URL}/functions/v1/manage-users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const out = await resp.json().catch(() => ({}));
    return resp.ok ? out : { error: out.error || `Error HTTP ${resp.status}` };
  } catch (e) {
    return { error: 'Sin conexión con el servidor.' };
  }
}

function adminEdit(p) {
  const c = openModal(`
    <h2>Editar a ${esc(p.name)}</h2>
    <form id="adm-form">
      <input type="text" id="adm-name" value="${esc(p.name)}" required maxlength="30" placeholder="Nombre" />
      <input type="tel" id="adm-phone" value="${esc(p.phone || '')}" placeholder="WhatsApp (+34600000000)" />
      <button class="btn btn-primary" type="submit">Guardar</button>
    </form>`);
  c.querySelector('#adm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await callManage({
      action: 'update_user', userId: p.id,
      name: c.querySelector('#adm-name').value.trim(),
      phone: c.querySelector('#adm-phone').value.trim()
    });
    if (error) return alert(error);
    $('modal').classList.add('hidden');
    await loadAll(); render();
  });
}

function adminPassword(p) {
  const c = openModal(`
    <h2>Contraseña de ${esc(p.name)}</h2>
    <form id="adm-form">
      <input type="text" id="adm-pass" required minlength="8" placeholder="Nueva contraseña (8+ caracteres)" />
      <button class="btn btn-primary" type="submit">Guardar contraseña</button>
    </form>`);
  c.querySelector('#adm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await callManage({ action: 'set_password', userId: p.id, password: c.querySelector('#adm-pass').value });
    if (error) return alert(error);
    $('modal').classList.add('hidden');
    alert(`Contraseña de ${p.name} actualizada.`);
  });
}

function adminDelete(p) {
  if (!confirm(`¿Borrar a ${p.name}? Se eliminará su cuenta y su perfil.`)) return;
  callManage({ action: 'delete_user', userId: p.id }).then(async (out) => {
    if (out.error) return alert(out.error);
    await loadAll(); render();
  });
}

function adminNew() {
  const c = openModal(`
    <h2>Añadir miembro</h2>
    <form id="adm-form">
      <input type="text" id="adm-name" required maxlength="30" placeholder="Nombre" />
      <input type="email" id="adm-email" required placeholder="su@email.com" />
      <input type="tel" id="adm-phone" placeholder="WhatsApp (+34600000000)" />
      <input type="text" id="adm-pass" required minlength="8" placeholder="Contraseña (8+ caracteres)" />
      <button class="btn btn-primary" type="submit">Crear miembro</button>
    </form>`);
  c.querySelector('#adm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await callManage({
      action: 'create_user',
      name: c.querySelector('#adm-name').value.trim(),
      email: c.querySelector('#adm-email').value.trim(),
      phone: c.querySelector('#adm-phone').value.trim(),
      password: c.querySelector('#adm-pass').value
    });
    if (error) return alert(error);
    $('modal').classList.add('hidden');
    await loadAll(); render();
  });
}

/* ============================ PUSH ============================ */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Tu navegador no soporta notificaciones push.');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Has denegado los permisos de notificación.'); return; }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cfg.VAPID_PUBLIC_KEY)
  });
  const j = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id: state.user.id,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth
  }, { onConflict: 'endpoint' });
  if (error) return alert('Error: ' + error.message);
  $('btn-push').textContent = '🔔 Notificaciones activadas';
  $('btn-push').classList.add('btn-ok');
}

/* ============================ PWA ============================ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  }
}
