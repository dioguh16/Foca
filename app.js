/* ============================================================
   TRACKER DIÁRIO — Fase 1
   Persistência real via localStorage. Sem build step (JS puro).
   ============================================================ */

const STORAGE = {
  entries: 'tracker_entries',
  habits: 'tracker_habits',
  habitLog: 'tracker_habitlog',
  todos: 'tracker_todos',
  order: 'tracker_order'
};

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Tomar medicação' },
  { id: 'h2', name: 'Escovar os dentes (manhã)' },
  { id: 'h3', name: 'Beber 1.5L de água' },
  { id: 'h4', name: 'Escovar os dentes (noite)' }
];
const DEFAULT_ORDER = ['habits', 'todos', 'sleep', 'food', 'exercise', 'mood', 'tiredness'];
const MODULE_LABELS = {
  habits: 'Hábitos', todos: "To Do's", sleep: 'Sono', food: 'Alimentação',
  exercise: 'Exercício', mood: 'Mood', tiredness: 'Nível de cansaço'
};

const QUALITY_COLORS = { ma: '#d1554a', ok: '#dfc24a', boa: '#3f8f5f' };
const QUALITY_LABELS = { ma: 'Má', ok: 'Ok', boa: 'Boa' };
const MOOD_TIERS = ['muitomau', 'mau', 'neutro', 'bom', 'excelente'];
const MOOD_LABELS = { muitomau: 'Muito mau', mau: 'Mau', neutro: 'Neutro', bom: 'Bom', excelente: 'Excelente' };
const MOOD_COLORS = { muitomau: '#d1554a', mau: '#dd8a4a', neutro: '#dfc24a', bom: '#8fbf6a', excelente: '#3f8f5f' };
const TIRED_COLORS = ['#3f8f5f', '#6ea86a', '#9fc26a', '#dfc24a', '#dd8a4a', '#d1554a'];
const MONTH_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_FULL = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

let exerciseUnitDraft = 'min'; // estado transitório do formulário de adicionar exercício (não persistido)

/* ---------------- storage helpers ---------------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Erro ao ler storage', key, e);
    return fallback;
  }
}
function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Erro ao gravar storage', key, e);
    showToast('Erro ao guardar — espaço local pode estar cheio.');
  }
}

function getHabits() { return loadJSON(STORAGE.habits, DEFAULT_HABITS); }
function getTodos() { return loadJSON(STORAGE.todos, []); }
function getOrder() {
  const o = loadJSON(STORAGE.order, DEFAULT_ORDER);
  // garante que módulos novos introduzidos em atualizações futuras aparecem mesmo que não estejam gravados ainda
  DEFAULT_ORDER.forEach(k => { if (!o.includes(k)) o.push(k); });
  return o;
}
function getHabitLog() { return loadJSON(STORAGE.habitLog, {}); }
function getEntries() { return loadJSON(STORAGE.entries, {}); }
function getEntry(date) {
  const entries = getEntries();
  return entries[date] || { sleepStart: '', sleepEnd: '', sleepQuality: 'ok', meals: [], exercises: [], mood: 'neutro', tiredness: 2 };
}
function saveEntry(date, entry) {
  const entries = getEntries();
  entries[date] = entry;
  saveJSON(STORAGE.entries, entries);
}

/* ---------------- utilidades de data ---------------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDatePT(dateObj) {
  return `${WEEKDAYS[dateObj.getDay()]}, ${dateObj.getDate()} ${MONTHS_FULL[dateObj.getMonth()]}`;
}
function formatShortDatePT(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTH_ABBR[m-1]}`;
}
function sleepDuration(start, end) {
  if (!start || !end) return '--';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh*60+em) - (sh*60+sm);
  if (diff <= 0) diff += 24*60;
  const h = Math.floor(diff/60), m = diff%60;
  return `${h}h${String(m).padStart(2,'0')}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function getStreakForHabit(habitId, log) {
  let count = 0;
  let d = new Date();
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (log[key] && log[key][habitId]) {
      count++;
      d.setDate(d.getDate()-1);
    } else break;
  }
  return count;
}

/* ---------------- toast ---------------- */
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============================================================
   RENDER: módulos do Registo
   ============================================================ */
function renderHabitsModule() {
  const habits = getHabits();
  const log = getHabitLog();
  const today = todayKey();
  const todayLog = log[today] || {};
  const doneCount = habits.filter(h => todayLog[h.id]).length;

  const rows = habits.length ? habits.map(h => {
    const done = !!todayLog[h.id];
    const streak = getStreakForHabit(h.id, log);
    return `<div class="habit-item ${done ? 'done' : ''}">
      <button class="check-btn ${done ? 'checked' : ''}" data-action="toggle-habit" data-id="${h.id}"><span class="check-mark">✓</span></button>
      <span class="item-text">${escapeHtml(h.name)}</span>
      ${streak > 0 ? `<span class="streak">🔥${streak}</span>` : ''}
    </div>`;
  }).join('') : `<p class="empty-note">Ainda não tens hábitos. Adiciona no separador "Hábitos".</p>`;

  return `<div class="card drag-card" data-module="habits">
    <div class="card-head"><h3>Hábitos de hoje</h3><span class="pill">${doneCount} / ${habits.length}</span></div>
    ${rows}
  </div>`;
}

function renderTodosModule() {
  const today = todayKey();
  const todos = getTodos().filter(t => !t.done).sort((a,b) => a.date.localeCompare(b.date));

  const rows = todos.length ? todos.map(t => {
    const isToday = t.date === today;
    const isPast = t.date < today;
    const laterClass = (!isToday && !isPast) ? 'due-later' : '';
    const label = isToday ? 'Hoje' : (isPast ? 'Atrasado' : formatShortDatePT(t.date));
    return `<div class="todo-item ${laterClass}">
      <button class="check-btn" data-action="toggle-todo" data-id="${t.id}"><span class="check-mark">✓</span></button>
      <span class="item-text">${escapeHtml(t.text)}</span>
      <span class="todo-date">${label}</span>
    </div>`;
  }).join('') : `<p class="empty-note">Sem to-do's pendentes.</p>`;

  return `<div class="card drag-card" data-module="todos">
    <div class="card-head"><h3>To Do's</h3><span class="pill">${todos.length} pendentes</span></div>
    ${rows}
  </div>`;
}

function renderSleepModule(entry) {
  const chips = ['ma','ok','boa'].map(q => {
    const active = entry.sleepQuality === q;
    const style = active
      ? `background:${QUALITY_COLORS[q]};border-color:${QUALITY_COLORS[q]};color:#fff;`
      : `border-color:${QUALITY_COLORS[q]};color:${QUALITY_COLORS[q]};`;
    return `<div class="chip ${active?'active':''}" style="${style}" data-action="set-quality" data-value="${q}">${QUALITY_LABELS[q]}</div>`;
  }).join('');

  return `<div class="card drag-card" data-module="sleep">
    <div class="card-head"><h3>Sono</h3></div>
    <div class="sleep-inline">
      <input class="time-input" type="time" value="${entry.sleepStart||''}" data-field="sleepStart">
      <span class="sleep-arrow">→</span>
      <input class="time-input" type="time" value="${entry.sleepEnd||''}" data-field="sleepEnd">
      <span class="sleep-total">${sleepDuration(entry.sleepStart, entry.sleepEnd)}</span>
    </div>
    <div class="chip-row" style="margin-top:10px;margin-bottom:0;">${chips}</div>
  </div>`;
}

function renderFoodModule(entry) {
  const meals = entry.meals || [];
  const rows = meals.map((m, i) => `
    <div class="meal-entry">
      <button class="meal-del" data-action="del-meal" data-idx="${i}">×</button>
      <div class="meal-tag">${escapeHtml(m.time || '--:--')}</div>
      <div class="meal-text">${escapeHtml(m.text)}</div>
    </div>`).join('');

  return `<div class="card drag-card" data-module="food">
    <div class="card-head"><h3>Alimentação</h3><span class="pill">${meals.length} refeições</span></div>
    ${rows}
    <div class="row" style="gap:8px;margin-top:${meals.length?'10px':'0'};">
      <input class="text-input" type="time" id="meal-time-input" style="flex:0 0 90px;margin-bottom:0;">
      <input class="text-input" id="meal-text-input" placeholder="O que comeste?" style="flex:1;margin-bottom:0;">
    </div>
    <button class="btn-add" data-action="add-meal">+ Adicionar refeição</button>
  </div>`;
}

function renderExerciseModule(entry) {
  const exercises = entry.exercises || [];
  const rows = exercises.map((ex, i) => `
    <div class="exercise-entry">
      <span>${escapeHtml(ex.name)} · ${escapeHtml(ex.value)} ${ex.unit === 'min' ? 'min' : 'vezes'}</span>
      <button class="meal-del" data-action="del-exercise" data-idx="${i}">×</button>
    </div>`).join('');

  return `<div class="card drag-card" data-module="exercise">
    <div class="card-head"><h3>Exercício</h3></div>
    ${rows}
    <input class="text-input" id="exercise-name-input" placeholder="Que exercício fizeste?" style="margin-top:${exercises.length?'10px':'0'};">
    <div class="exercise-row">
      <input class="text-input" id="exercise-value-input" placeholder="Minutos ou nº de vezes">
      <div class="toggle">
        <div class="toggle-opt ${exerciseUnitDraft==='min'?'active':''}" data-action="toggle-unit" data-unit="min">Minutos</div>
        <div class="toggle-opt ${exerciseUnitDraft==='vezes'?'active':''}" data-action="toggle-unit" data-unit="vezes">Vezes</div>
      </div>
    </div>
    <button class="btn-add" data-action="add-exercise">+ Adicionar atividade</button>
  </div>`;
}

function renderMoodModule(entry) {
  const tiers = MOOD_TIERS.map(t => {
    const active = entry.mood === t;
    const style = active ? `background:${MOOD_COLORS[t]};border-color:${MOOD_COLORS[t]};` : `border-color:${MOOD_COLORS[t]};color:${MOOD_COLORS[t]};`;
    return `<div class="tier ${active?'active':''}" style="${style}" data-action="set-mood" data-value="${t}">${MOOD_LABELS[t]}</div>`;
  }).join('');
  return `<div class="card drag-card" data-module="mood">
    <div class="card-head"><h3>Mood</h3></div>
    <div class="tier-row">${tiers}</div>
  </div>`;
}

function renderTirednessModule(entry) {
  const dots = [0,1,2,3,4,5].map(n => {
    const active = entry.tiredness === n;
    const style = active ? `background:${TIRED_COLORS[n]};border-color:${TIRED_COLORS[n]};` : `border-color:${TIRED_COLORS[n]};color:${TIRED_COLORS[n]};`;
    return `<div class="scale-dot ${active?'active':''}" style="${style}" data-action="set-tired" data-value="${n}">${n}</div>`;
  }).join('');
  return `<div class="card drag-card" data-module="tiredness">
    <div class="card-head"><h3>Nível de cansaço</h3></div>
    <div class="scale-row">${dots}</div>
    <div class="scale-caption"><span>Nada cansado</span><span>Exausto</span></div>
  </div>`;
}

const MODULE_RENDERERS = {
  habits: () => renderHabitsModule(),
  todos: () => renderTodosModule(),
  sleep: (entry) => renderSleepModule(entry),
  food: (entry) => renderFoodModule(entry),
  exercise: (entry) => renderExerciseModule(entry),
  mood: (entry) => renderMoodModule(entry),
  tiredness: (entry) => renderTirednessModule(entry)
};

function renderRegisto() {
  document.getElementById('registo-date').textContent = formatDatePT(new Date());
  const order = getOrder();
  const entry = getEntry(todayKey());
  document.getElementById('registo-modules').innerHTML = order.map(key => MODULE_RENDERERS[key] ? MODULE_RENDERERS[key](entry) : '').join('');
}

/* ============================================================
   RENDER: separador Hábitos & To Do's (edição)
   ============================================================ */
function renderHabitsEditList() {
  const habits = getHabits();
  document.getElementById('habits-edit-list').innerHTML = habits.length ? habits.map(h => `
    <div class="settings-item">
      <span class="item-label">${escapeHtml(h.name)}</span>
      <button class="del-btn" data-action="del-habit" data-id="${h.id}">×</button>
    </div>`).join('') : `<p class="empty-note">Ainda não tens hábitos.</p>`;
}

function renderTodosEditList() {
  const todos = getTodos().slice().sort((a,b) => a.date.localeCompare(b.date));
  document.getElementById('todos-edit-list').innerHTML = todos.length ? todos.map(t => `
    <div class="settings-item">
      <span class="item-label" style="${t.done?'text-decoration:line-through;color:var(--ink-soft);':''}">${escapeHtml(t.text)}</span>
      <span class="pill" style="font-size:10px;">${formatShortDatePT(t.date)}</span>
      <button class="del-btn" data-action="del-todo" data-id="${t.id}">×</button>
    </div>`).join('') : `<p class="empty-note">Ainda não tens to-do's.</p>`;
}

/* ============================================================
   RENDER: Definições — ordem dos módulos
   ============================================================ */
function renderModuleOrderList() {
  const order = getOrder();
  document.getElementById('module-order-list').innerHTML = order.map((key, i) => `
    <div class="settings-item">
      <span class="item-label">${MODULE_LABELS[key] || key}</span>
      <div class="order-arrows">
        <button data-action="move-up" data-key="${key}" ${i===0?'disabled':''}>▲</button>
        <button data-action="move-down" data-key="${key}" ${i===order.length-1?'disabled':''}>▼</button>
      </div>
    </div>`).join('');
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function goToScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.goto === id));

  if (id === 'screen-registo') renderRegisto();
  if (id === 'screen-habitos') { renderHabitsEditList(); renderTodosEditList(); }
  if (id === 'screen-settings') renderModuleOrderList();
}

/* ============================================================
   EVENTOS
   ============================================================ */
document.addEventListener('click', (e) => {
  const gotoBtn = e.target.closest('[data-goto]');
  if (gotoBtn) { goToScreen(gotoBtn.dataset.goto); return; }
});

// chips de sub-navegação (Hábitos/To Do's dentro do separador; reutilizável)
document.addEventListener('click', (e) => {
  const chip = e.target.closest('#screen-habitos .chip[data-sub]');
  if (!chip) return;
  document.querySelectorAll('#screen-habitos .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  const sub = chip.dataset.sub;
  document.getElementById('sub-habitos').style.display = sub === 'habitos' ? 'block' : 'none';
  document.getElementById('sub-todos').style.display = sub === 'todos' ? 'block' : 'none';
});

// ações dentro do Registo (delegação)
document.getElementById('registo-modules').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const today = todayKey();

  if (action === 'toggle-unit') {
    exerciseUnitDraft = btn.dataset.unit;
    btn.parentElement.querySelectorAll('.toggle-opt').forEach(o => o.classList.remove('active'));
    btn.classList.add('active');
    return; // não re-renderiza para não perder o que já foi escrito no formulário
  }

  if (action === 'toggle-habit') {
    const id = btn.dataset.id;
    const log = getHabitLog();
    log[today] = log[today] || {};
    log[today][id] = !log[today][id];
    saveJSON(STORAGE.habitLog, log);
    renderRegisto();
    return;
  }

  if (action === 'toggle-todo') {
    const todos = getTodos();
    const t = todos.find(x => x.id === btn.dataset.id);
    if (t) { t.done = true; saveJSON(STORAGE.todos, todos); showToast('To-do concluído ✓'); }
    renderRegisto();
    return;
  }

  if (action === 'set-quality') {
    const entry = getEntry(today);
    entry.sleepQuality = btn.dataset.value;
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'set-mood') {
    const entry = getEntry(today);
    entry.mood = btn.dataset.value;
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'set-tired') {
    const entry = getEntry(today);
    entry.tiredness = parseInt(btn.dataset.value, 10);
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'del-meal') {
    const entry = getEntry(today);
    entry.meals.splice(parseInt(btn.dataset.idx, 10), 1);
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'add-meal') {
    const timeInput = document.getElementById('meal-time-input');
    const textInput = document.getElementById('meal-text-input');
    if (!textInput.value.trim()) { textInput.focus(); return; }
    const entry = getEntry(today);
    entry.meals = entry.meals || [];
    entry.meals.push({ time: timeInput.value || '--:--', text: textInput.value.trim() });
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'del-exercise') {
    const entry = getEntry(today);
    entry.exercises.splice(parseInt(btn.dataset.idx, 10), 1);
    saveEntry(today, entry);
    renderRegisto();
    return;
  }

  if (action === 'add-exercise') {
    const nameInput = document.getElementById('exercise-name-input');
    const valInput = document.getElementById('exercise-value-input');
    if (!nameInput.value.trim() || !valInput.value.trim()) return;
    const entry = getEntry(today);
    entry.exercises = entry.exercises || [];
    entry.exercises.push({ name: nameInput.value.trim(), unit: exerciseUnitDraft, value: valInput.value.trim() });
    saveEntry(today, entry);
    exerciseUnitDraft = 'min';
    renderRegisto();
    return;
  }
});

// hora de sono (input nativo type=time dispara 'change' ao escolher)
document.getElementById('registo-modules').addEventListener('change', (e) => {
  const field = e.target.dataset && e.target.dataset.field;
  if (field === 'sleepStart' || field === 'sleepEnd') {
    const today = todayKey();
    const entry = getEntry(today);
    entry[field] = e.target.value;
    saveEntry(today, entry);
    renderRegisto();
  }
});

// edição de hábitos/to-dos
document.getElementById('habits-edit-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-habit"]');
  if (!btn) return;
  const habits = getHabits().filter(h => h.id !== btn.dataset.id);
  saveJSON(STORAGE.habits, habits);
  renderHabitsEditList();
});
document.getElementById('todos-edit-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-todo"]');
  if (!btn) return;
  const todos = getTodos().filter(t => t.id !== btn.dataset.id);
  saveJSON(STORAGE.todos, todos);
  renderTodosEditList();
});

function addHabit() {
  const input = document.getElementById('new-habit-input');
  const name = input.value.trim();
  if (!name) return;
  const habits = getHabits();
  habits.push({ id: 'h' + Date.now(), name });
  saveJSON(STORAGE.habits, habits);
  input.value = '';
  renderHabitsEditList();
  showToast('Hábito adicionado');
}
document.getElementById('add-habit-btn').addEventListener('click', addHabit);
document.getElementById('new-habit-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addHabit(); });

function addTodo() {
  const textInput = document.getElementById('new-todo-text');
  const dateInput = document.getElementById('new-todo-date');
  const text = textInput.value.trim();
  if (!text) return;
  const date = dateInput.value || todayKey();
  const todos = getTodos();
  todos.push({ id: 't' + Date.now(), text, date, done: false });
  saveJSON(STORAGE.todos, todos);
  textInput.value = '';
  dateInput.value = '';
  renderTodosEditList();
  showToast('To-do adicionado');
}
document.getElementById('add-todo-btn').addEventListener('click', addTodo);

// reordenar módulos (Definições)
document.getElementById('module-order-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const order = getOrder();
  const idx = order.indexOf(btn.dataset.key);
  const dir = btn.dataset.action === 'move-up' ? -1 : 1;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= order.length) return;
  [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
  saveJSON(STORAGE.order, order);
  renderModuleOrderList();
});

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  renderRegisto();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      // verifica logo ao abrir se há uma versão mais recente publicada
      registration.update().catch(() => {});

      // verifica também sempre que a app volta a ficar visível (ex: voltar do fundo)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });

      // quando há um novo service worker à espera, avisa e ativa-o
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Nova versão disponível — a atualizar...');
          }
        });
      });
    }).catch(err => console.warn('SW não registado:', err));

    // assim que o novo service worker assume o controlo, recarrega a página sozinha
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  }
});
