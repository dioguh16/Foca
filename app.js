/* ============================================================
   TRACKER DIÁRIO — Fase 1
   Persistência real via localStorage. Sem build step (JS puro).
   ============================================================ */

/* ------------------------------------------------------------
   REGRA DE VERSIONAMENTO (instrução permanente do utilizador):
   - APP_VERSION abaixo tem de ser atualizado sempre que o código
     desta app for alterado (qualquer fase/sessão).
   - O número de versão é mostrado nas Definições, em baixo à
     direita (ver #app-version-tag no index.html / renderVersionTag
     abaixo).
   - A pasta entregue ao utilizador com os ficheiros da app deve
     ter sempre o nome "Foca vX.X" (com este mesmo número).
   ------------------------------------------------------------ */
const APP_VERSION = '1.10.0';

const STORAGE = {
  entries: 'tracker_entries',
  habits: 'tracker_habits',
  habitLog: 'tracker_habitlog',
  todos: 'tracker_todos',
  order: 'tracker_order',
  profile: 'tracker_profile',
  weights: 'tracker_weights',
  insights: 'tracker_insights',
  backupWeekly: 'tracker_backup_weekly_enabled',
  backupLastAt: 'tracker_backup_last_at'
};

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Tomar medicação' },
  { id: 'h2', name: 'Escovar os dentes (manhã)' },
  { id: 'h3', name: 'Beber 1.5L de água' },
  { id: 'h4', name: 'Escovar os dentes (noite)' }
];
const DEFAULT_ORDER = ['habits', 'todos', 'sleep', 'food', 'exercise', 'mood', 'tiredness', 'notes'];
const MODULE_LABELS = {
  habits: 'Hábitos', todos: "To Do's", sleep: 'Sono', food: 'Alimentação',
  exercise: 'Exercício', mood: 'Mood', tiredness: 'Nível de cansaço', notes: 'Notas'
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
let editModalDate = null;      // data (YYYY-MM-DD) do registo aberto no modal de edição do Histórico
let editModalCat = null;       // categoria aberta no modal ('sono' | 'mood' | 'cansaco' | 'exercicio')
let editDraftEntry = null;     // cópia de trabalho do entry enquanto o modal está aberto
let editExerciseUnit = 'min';  // unidade transitória do form de exercício dentro do modal
let currentCategory = 'sono';  // estado do Histórico
let currentView = 'week';
let monthOffset = 0;           // 0 = mês atual, -1 = mês anterior, etc.
let insightRange = 7;          // dias, para o pedido de insight
const DATA_TYPE_LABELS = { sono:'Sono', alimentacao:'Alimentação', exercicio:'Exercício', mood:'Mood', cansaco:'Cansaço', peso:'Peso', habitos:'Hábitos', todos:"To Do's" };
const CAT_LABELS = { sono: 'Sono', mood: 'Mood', cansaco: 'Cansaço', exercicio: 'Exercício' };
const WEEKDAY_LETTER = ['D','S','T','Q','Q','S','S'];

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
function getProfile() { return loadJSON(STORAGE.profile, { name: '', sex: '', height: '', notes: '' }); }
function saveProfile(p) { saveJSON(STORAGE.profile, p); }
function getWeights() { return loadJSON(STORAGE.weights, []); }
function saveWeights(w) { saveJSON(STORAGE.weights, w); }
function getInsights() { return loadJSON(STORAGE.insights, []); }
function saveInsights(list) { saveJSON(STORAGE.insights, list); }
function getEntry(date) {
  const entries = getEntries();
  return entries[date] || { sleepStart: '', sleepEnd: '', sleepQuality: 'ok', meals: [], exercises: [], mood: 'neutro', tiredness: 2, notes: '' };
}
function saveEntry(date, entry) {
  const entries = getEntries();
  entries[date] = entry;
  saveJSON(STORAGE.entries, entries);
}
function deleteCategoryFromEntry(date, cat) {
  const entries = getEntries();
  const entry = entries[date];
  if (!entry) return;
  if (cat === 'sono') {
    entry.sleepStart = '';
    entry.sleepEnd = '';
    entry.sleepQuality = '';
  } else if (cat === 'mood') {
    entry.mood = '';
  } else if (cat === 'cansaco') {
    delete entry.tiredness;
  } else if (cat === 'exercicio') {
    entry.exercises = [];
  }
  saveJSON(STORAGE.entries, entries);
}

/* ---------------- utilidades de data ---------------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateKeyToObj(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function objToDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function shiftDateKey(key, days) {
  const d = dateKeyToObj(key);
  d.setDate(d.getDate() + days);
  return objToDateKey(d);
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
function sleepMinutes(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh*60+em) - (sh*60+sm);
  if (diff <= 0) diff += 24*60;
  return diff;
}
function exerciseScorePct(entry) {
  if (!entry || !entry.exercises || !entry.exercises.length) return 0;
  let totalMin = 0;
  entry.exercises.forEach(ex => {
    const v = parseFloat(ex.value) || 0;
    totalMin += ex.unit === 'min' ? v : v * 8; // aproximação: cada "vez" conta como ~8min de esforço
  });
  return Math.max(0, Math.min(100, Math.round((totalMin/90)*100)));
}
function getLastNDates(n) {
  const arr = [];
  const base = new Date();
  for (let i = n-1; i >= 0; i--) {
    const dt = new Date(base);
    dt.setDate(base.getDate()-i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    arr.push({ key, dateObj: dt });
  }
  return arr;
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

function renderNotesModule(entry) {
  return `<div class="card drag-card" data-module="notes">
    <div class="card-head"><h3>Notas</h3></div>
    <textarea class="text-input" id="notes-input" data-field="notes" placeholder="Escreve aqui o que quiseres sobre o teu dia...">${escapeHtml(entry.notes || '')}</textarea>
  </div>`;
}

const MODULE_RENDERERS = {
  habits: () => renderHabitsModule(),
  todos: () => renderTodosModule(),
  sleep: (entry) => renderSleepModule(entry),
  food: (entry) => renderFoodModule(entry),
  exercise: (entry) => renderExerciseModule(entry),
  mood: (entry) => renderMoodModule(entry),
  tiredness: (entry) => renderTirednessModule(entry),
  notes: (entry) => renderNotesModule(entry)
};

let currentRegistoDate = todayKey();

function renderRegisto() {
  const isToday = currentRegistoDate === todayKey();
  const dateObj = dateKeyToObj(currentRegistoDate);
  document.getElementById('registo-date').textContent = isToday
    ? `Hoje, ${dateObj.getDate()} ${MONTHS_FULL[dateObj.getMonth()]}`
    : formatDatePT(dateObj);
  document.getElementById('registo-day-next').disabled = isToday;

  const order = getOrder();
  const entry = getEntry(currentRegistoDate);
  const modulesEl = document.getElementById('registo-modules');
  modulesEl.innerHTML = order.map(key => MODULE_RENDERERS[key] ? MODULE_RENDERERS[key](entry) : '').join('');

  const bannerId = 'registo-past-banner';
  document.getElementById(bannerId)?.remove();
  if (!isToday) {
    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.className = 'past-day-banner';
    banner.textContent = 'A editar um dia passado — as alterações ficam guardadas nesse dia.';
    modulesEl.parentElement.insertBefore(banner, modulesEl);
  }
}

document.getElementById('registo-day-prev').addEventListener('click', () => {
  currentRegistoDate = shiftDateKey(currentRegistoDate, -1);
  renderRegisto();
});
document.getElementById('registo-day-next').addEventListener('click', () => {
  if (currentRegistoDate === todayKey()) return;
  currentRegistoDate = shiftDateKey(currentRegistoDate, 1);
  renderRegisto();
});

/* ============================================================
   RENDER: Histórico (Fase 2)
   ============================================================ */
function renderHistory() {
  document.getElementById('hist-records-title').textContent = 'Registos recentes · ' + CAT_LABELS[currentCategory];
  if (currentView === 'week') renderHistWeek(); else renderHistMonth();
  renderHistRecords();
}

function renderHistWeek() {
  const days = getLastNDates(8).filter(d => d.key !== todayKey()).slice(-7);
  const entries = getEntries();
  const titleEl = document.getElementById('hist-week-title');
  let bars = '', labels = '';

  days.forEach(({ key, dateObj }) => {
    const entry = entries[key];
    labels += `<span>${WEEKDAY_LETTER[dateObj.getDay()]}</span>`;

    if (currentCategory === 'sono') {
      titleEl.textContent = 'Sono · últimas 7 noites';
      if (entry && entry.sleepStart && entry.sleepEnd) {
        const mins = sleepMinutes(entry.sleepStart, entry.sleepEnd);
        const pct = Math.max(6, Math.min(100, Math.round((mins/540)*100)));
        const color = QUALITY_COLORS[entry.sleepQuality] || '#ccc';
        bars += `<div class="bar" style="height:${pct}%;background:${color};"></div>`;
      } else {
        bars += `<div class="bar" style="height:6%;"></div>`;
      }
    } else if (currentCategory === 'mood') {
      titleEl.textContent = 'Mood · últimos 7 dias';
      if (entry && entry.mood) {
        const heightMap = { muitomau:20, mau:40, neutro:60, bom:80, excelente:100 };
        bars += `<div class="bar" style="height:${heightMap[entry.mood]}%;background:${MOOD_COLORS[entry.mood]};"></div>`;
      } else {
        bars += `<div class="bar" style="height:6%;"></div>`;
      }
    } else if (currentCategory === 'cansaco') {
      titleEl.textContent = 'Nível de cansaço · últimos 7 dias';
      if (entry && typeof entry.tiredness === 'number') {
        const pct = Math.max(12, Math.round((entry.tiredness/5)*100));
        bars += `<div class="bar" style="height:${pct}%;background:${TIRED_COLORS[entry.tiredness]};"></div>`;
      } else {
        bars += `<div class="bar" style="height:6%;"></div>`;
      }
    } else {
      titleEl.textContent = 'Exercício · últimos 7 dias';
      const pct = exerciseScorePct(entry);
      bars += `<div class="bar" style="height:${Math.max(6,pct)}%;background:var(--accent);opacity:${pct>0?1:.3};"></div>`;
    }
  });

  document.getElementById('hist-bars').innerHTML = bars;
  document.getElementById('hist-bars-labels').innerHTML = labels;
}

function renderHistMonth() {
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth()+monthOffset, 1);
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const label = MONTHS_FULL[month];
  document.getElementById('month-label').textContent = `${label.charAt(0).toUpperCase()+label.slice(1)} ${year}`;
  document.getElementById('month-next').disabled = monthOffset >= 0;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const entries = getEntries();
  const todayStr = todayKey();

  let html = '';
  for (let i = 0; i < firstWeekday; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = key === todayStr;
    const entry = isToday ? null : entries[key]; // dia de hoje ainda não terminou: não mostra dados
    const todayClass = isToday ? ' today-outline' : '';

    if (currentCategory === 'exercicio') {
      const has = entry && entry.exercises && entry.exercises.length > 0;
      html += `<div class="cal-day${todayClass}">${d}${has ? '<span class="ex-dot"></span>' : ''}</div>`;
    } else {
      let color = null;
      if (currentCategory === 'sono' && entry && entry.sleepQuality) color = QUALITY_COLORS[entry.sleepQuality];
      else if (currentCategory === 'mood' && entry && entry.mood) color = MOOD_COLORS[entry.mood];
      else if (currentCategory === 'cansaco' && entry && typeof entry.tiredness === 'number') color = TIRED_COLORS[entry.tiredness];

      if (color) {
        html += `<div class="cal-day${todayClass}" style="background:${color}33;color:${color};border:1px solid ${color}66;">${d}</div>`;
      } else {
        html += `<div class="cal-day${todayClass}">${d}</div>`;
      }
    }
  }
  document.getElementById('cal-grid').innerHTML = html;
}

function renderHistRecords() {
  const days = getLastNDates(8).filter(d => d.key !== todayKey()).slice(-7).reverse();
  const entries = getEntries();
  const rows = [];

  days.forEach(({ key }) => {
    const entry = entries[key];
    const dateLabel = formatShortDatePT(key);

    if (currentCategory === 'sono' && entry && entry.sleepStart && entry.sleepEnd) {
      const color = QUALITY_COLORS[entry.sleepQuality] || '#999';
      rows.push(`<div class="log-row log-row-tap" data-date="${key}"><span class="log-date">${dateLabel}</span><span class="tag" style="background:${color}22;color:${color};">${sleepDuration(entry.sleepStart, entry.sleepEnd)} · ${QUALITY_LABELS[entry.sleepQuality]||'--'}</span></div>`);
    } else if (currentCategory === 'mood' && entry && entry.mood) {
      const color = MOOD_COLORS[entry.mood];
      rows.push(`<div class="log-row log-row-tap" data-date="${key}"><span class="log-date">${dateLabel}</span><span class="tag" style="background:${color}22;color:${color};">${MOOD_LABELS[entry.mood]}</span></div>`);
    } else if (currentCategory === 'cansaco' && entry && typeof entry.tiredness === 'number') {
      const color = TIRED_COLORS[entry.tiredness];
      rows.push(`<div class="log-row log-row-tap" data-date="${key}"><span class="log-date">${dateLabel}</span><span class="tag" style="background:${color}22;color:${color};">Nível ${entry.tiredness}</span></div>`);
    } else if (currentCategory === 'exercicio' && entry && entry.exercises && entry.exercises.length) {
      const label = entry.exercises.map(ex => `${ex.name} ${ex.value}${ex.unit==='min'?'min':'x'}`).join(', ');
      rows.push(`<div class="log-row log-row-tap" data-date="${key}"><span class="log-date">${dateLabel}</span><span class="tag">${escapeHtml(label)}</span></div>`);
    }
  });

  document.getElementById('hist-records').innerHTML = rows.length
    ? rows.join('')
    : `<p class="empty-note">Sem registos nos últimos 7 dias para esta categoria.</p>`;
}

/* ============================================================
   MODAL: editar registo antigo (a partir do Histórico)
   ============================================================ */
function openEditModal(date, cat) {
  editModalDate = date;
  editModalCat = cat;
  editDraftEntry = getEntry(date);
  editExerciseUnit = 'min';
  document.getElementById('edit-modal-title').textContent = CAT_LABELS[cat] + ' · ' + formatShortDatePT(date);
  renderEditModalBody();
  document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('show');
  editModalDate = null;
  editModalCat = null;
  editDraftEntry = null;
}

function renderEditModalBody() {
  const entry = editDraftEntry;
  const body = document.getElementById('edit-modal-body');
  if (editModalCat === 'sono') {
    body.innerHTML = renderSleepModule(entry).replace('<div class="card drag-card" data-module="sleep">', '<div>').replace(/<div class="card-head">.*?<\/div>/, '');
  } else if (editModalCat === 'mood') {
    body.innerHTML = renderMoodModule(entry).replace('<div class="card drag-card" data-module="mood">', '<div>').replace(/<div class="card-head">.*?<\/div>/, '');
  } else if (editModalCat === 'cansaco') {
    body.innerHTML = renderTirednessModule(entry).replace('<div class="card drag-card" data-module="tiredness">', '<div>').replace(/<div class="card-head">.*?<\/div>/, '');
  } else if (editModalCat === 'exercicio') {
    const exercises = entry.exercises || [];
    const rows = exercises.map((ex, i) => `
      <div class="exercise-entry">
        <span>${escapeHtml(ex.name)} · ${escapeHtml(ex.value)} ${ex.unit === 'min' ? 'min' : 'vezes'}</span>
        <button class="meal-del" data-action="edit-del-exercise" data-idx="${i}">×</button>
      </div>`).join('');
    body.innerHTML = `<div>
      ${rows}
      <input class="text-input" id="edit-exercise-name-input" placeholder="Que exercício fizeste?" style="margin-top:${exercises.length?'10px':'0'};">
      <div class="exercise-row">
        <input class="text-input" id="edit-exercise-value-input" placeholder="Minutos ou nº de vezes">
        <div class="toggle">
          <div class="toggle-opt ${editExerciseUnit==='min'?'active':''}" data-action="edit-toggle-unit" data-unit="min">Minutos</div>
          <div class="toggle-opt ${editExerciseUnit==='vezes'?'active':''}" data-action="edit-toggle-unit" data-unit="vezes">Vezes</div>
        </div>
      </div>
      <button class="btn-add" data-action="edit-add-exercise">+ Adicionar atividade</button>
    </div>`;
  }
}

document.getElementById('hist-records').addEventListener('click', (e) => {
  const row = e.target.closest('.log-row-tap');
  if (!row) return;
  openEditModal(row.dataset.date, currentCategory);
});

document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', (e) => {
  if (e.target.id === 'edit-modal') closeEditModal();
});

document.getElementById('edit-modal-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'set-quality') { editDraftEntry.sleepQuality = btn.dataset.value; renderEditModalBody(); return; }
  if (action === 'set-mood') { editDraftEntry.mood = btn.dataset.value; renderEditModalBody(); return; }
  if (action === 'set-tired') { editDraftEntry.tiredness = parseInt(btn.dataset.value, 10); renderEditModalBody(); return; }

  if (action === 'edit-toggle-unit') {
    editExerciseUnit = btn.dataset.unit;
    btn.parentElement.querySelectorAll('.toggle-opt').forEach(o => o.classList.remove('active'));
    btn.classList.add('active');
    return;
  }
  if (action === 'edit-del-exercise') {
    editDraftEntry.exercises.splice(parseInt(btn.dataset.idx, 10), 1);
    renderEditModalBody();
    return;
  }
  if (action === 'edit-add-exercise') {
    const nameInput = document.getElementById('edit-exercise-name-input');
    const valInput = document.getElementById('edit-exercise-value-input');
    if (!nameInput.value.trim() || !valInput.value.trim()) return;
    editDraftEntry.exercises = editDraftEntry.exercises || [];
    editDraftEntry.exercises.push({ name: nameInput.value.trim(), unit: editExerciseUnit, value: valInput.value.trim() });
    editExerciseUnit = 'min';
    renderEditModalBody();
    return;
  }
});

document.getElementById('edit-modal-body').addEventListener('change', (e) => {
  const field = e.target.dataset && e.target.dataset.field;
  if (field === 'sleepStart' || field === 'sleepEnd') {
    editDraftEntry[field] = e.target.value;
    renderEditModalBody();
  }
});

document.getElementById('edit-modal-save').addEventListener('click', () => {
  if (!editModalDate) return;
  saveEntry(editModalDate, editDraftEntry);
  showToast('Registo atualizado');
  closeEditModal();
  renderHistory();
});

document.getElementById('edit-modal-delete').addEventListener('click', () => {
  if (!editModalDate) return;
  document.getElementById('confirm-delete-text').textContent =
    `Vais apagar o registo de ${CAT_LABELS[editModalCat]} de ${formatShortDatePT(editModalDate)}. Esta ação não pode ser desfeita.`;
  document.getElementById('confirm-delete-modal').classList.add('show');
});

document.getElementById('confirm-delete-cancel').addEventListener('click', () => {
  document.getElementById('confirm-delete-modal').classList.remove('show');
});
document.getElementById('confirm-delete-modal').addEventListener('click', (e) => {
  if (e.target.id === 'confirm-delete-modal') {
    document.getElementById('confirm-delete-modal').classList.remove('show');
  }
});
document.getElementById('confirm-delete-confirm').addEventListener('click', () => {
  if (!editModalDate) return;
  deleteCategoryFromEntry(editModalDate, editModalCat);
  showToast('Registo apagado');
  document.getElementById('confirm-delete-modal').classList.remove('show');
  closeEditModal();
  renderHistory();
});

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
   RENDER: Definições — perfil
   ============================================================ */
function renderProfile() {
  const p = getProfile();
  document.getElementById('profile-name').value = p.name || '';
  document.getElementById('profile-height').value = p.height || '';
  document.getElementById('profile-notes').value = p.notes || '';
  document.querySelectorAll('#profile-sex-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.sex === p.sex));
  renderWeightHistory();
}

function renderWeightHistory() {
  const weights = getWeights().slice().sort((a,b) => b.date.localeCompare(a.date));
  const currentEl = document.getElementById('profile-weight-current');
  currentEl.textContent = weights.length ? `${weights[0].kg} kg atual` : 'sem registos';

  document.getElementById('weight-history-list').innerHTML = weights.length ? weights.map(w => `
    <div class="weight-row">
      <span class="log-date">${formatShortDatePT(w.date)}</span>
      <span class="tag">${w.kg} kg</span>
      <button class="del-btn" data-action="del-weight" data-date="${w.date}">×</button>
    </div>`).join('') : `<p class="empty-note">Ainda não tens registos de peso.</p>`;
}

/* ============================================================
   Backup: guarda/restaura todos os dados da app num ficheiro
   ============================================================ */
function isBackupWeeklyEnabled() { return loadJSON(STORAGE.backupWeekly, false); }
function getLastBackupAt() { return loadJSON(STORAGE.backupLastAt, null); }

function buildBackupPayload() {
  return {
    app: 'Foca',
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      entries: getEntries(),
      habits: getHabits(),
      habitLog: getHabitLog(),
      todos: getTodos(),
      order: getOrder(),
      profile: getProfile(),
      weights: getWeights(),
      insights: getInsights()
    }
  };
}

function doBackupNow(silent) {
  const payload = buildBackupPayload();
  const text = JSON.stringify(payload, null, 2);
  const filename = 'Foca_data.de.backup';

  const finish = () => {
    saveJSON(STORAGE.backupLastAt, new Date().toISOString());
    renderBackupPanel();
    if (!silent) showToast('Backup feito');
  };

  try {
    const file = new File([text], filename, { type: 'application/json' });
    if (!silent && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Backup Foca' }).catch(() => {});
      finish();
      return;
    }
  } catch (e) { /* partilha de ficheiros não suportada — cai para o download normal */ }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  finish();
}

function formatBackupTimestamp(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`;
}

function renderBackupPanel() {
  const toggle = document.getElementById('backup-weekly-toggle');
  if (!toggle) return;
  toggle.classList.toggle('on', isBackupWeeklyEnabled());
  const lastAt = getLastBackupAt();
  document.getElementById('backup-last-info').textContent = lastAt
    ? `Último backup: ${formatBackupTimestamp(lastAt)}`
    : 'Ainda não foi feito nenhum backup.';
}

function maybeRunWeeklyBackup() {
  if (!isBackupWeeklyEnabled()) return;
  const lastAt = getLastBackupAt();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (!lastAt || (Date.now() - new Date(lastAt).getTime()) >= weekMs) {
    doBackupNow(true);
  }
}

document.getElementById('backup-now-btn').addEventListener('click', () => doBackupNow(false));
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="toggle-backup-weekly"]');
  if (!btn) return;
  saveJSON(STORAGE.backupWeekly, !isBackupWeeklyEnabled());
  renderBackupPanel();
});

/* ============================================================
   Insights: exportar dados em bruto para ficheiro (Fase 3)
   ============================================================ */
function buildDataExport(rangeDays, dataTypes) {
  const days = getLastNDates(rangeDays);
  const entries = getEntries();
  const now = new Date();
  const lines = [];

  lines.push(`Dados da app Foca — exportado a ${formatShortDatePT(todayKey())}, ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  lines.push(`Intervalo: últimos ${rangeDays} dias`);
  lines.push(`Tipos incluídos: ${dataTypes.map(t => DATA_TYPE_LABELS[t]||t).join(', ')}`);
  lines.push('');

  days.forEach(({ key }) => {
    const entry = entries[key];
    const dayLines = [];

    if (dataTypes.includes('sono') && entry && entry.sleepStart && entry.sleepEnd) {
      dayLines.push(`Sono: ${entry.sleepStart} → ${entry.sleepEnd} (${sleepDuration(entry.sleepStart, entry.sleepEnd)}) · Qualidade: ${QUALITY_LABELS[entry.sleepQuality]||'--'}`);
    }
    if (dataTypes.includes('alimentacao') && entry && entry.meals && entry.meals.length) {
      entry.meals.forEach(m => dayLines.push(`Refeição ${m.time}: ${m.text}`));
    }
    if (dataTypes.includes('exercicio') && entry && entry.exercises && entry.exercises.length) {
      entry.exercises.forEach(ex => dayLines.push(`Exercício: ${ex.name} — ${ex.value} ${ex.unit==='min'?'minutos':'vezes'}`));
    }
    if (dataTypes.includes('mood') && entry && entry.mood) {
      dayLines.push(`Mood: ${MOOD_LABELS[entry.mood]}`);
    }
    if (dataTypes.includes('cansaco') && entry && typeof entry.tiredness === 'number') {
      dayLines.push(`Nível de cansaço: ${entry.tiredness}/5`);
    }
    if (dataTypes.includes('habitos')) {
      const habits = getHabits();
      const log = getHabitLog()[key] || {};
      const doneNames = habits.filter(h => log[h.id]).map(h => h.name);
      if (doneNames.length) dayLines.push(`Hábitos cumpridos: ${doneNames.join(', ')}`);
    }
    if (dataTypes.includes('todos')) {
      getTodos().filter(t => t.date === key).forEach(t => dayLines.push(`To-do: ${t.text} — ${t.done ? 'concluído' : 'pendente'}`));
    }

    lines.push(`--- ${key} ---`);
    lines.push(dayLines.length ? dayLines.join('\n') : '(sem dados)');
    lines.push('');
  });

  if (dataTypes.includes('peso')) {
    const weights = getWeights().filter(w => days.some(d => d.key === w.date)).sort((a,b) => a.date.localeCompare(b.date));
    lines.push('--- Peso registado no período ---');
    lines.push(weights.length ? weights.map(w => `${w.date}: ${w.kg} kg`).join('\n') : '(sem registos)');
    lines.push('');
  }

  return lines.join('\n');
}

function exportDataFile() {
  const checked = Array.from(document.querySelectorAll('#insight-check-list input:checked')).map(i => i.value);
  if (!checked.length) { showToast('Escolhe pelo menos um tipo de dados'); return; }

  const text = buildDataExport(insightRange, checked);
  const filename = `foca-dados-${todayKey()}.txt`;

  // no telemóvel, tenta abrir logo o menu de partilha (para escolheres a app de IA diretamente)
  try {
    const file = new File([text], filename, { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Dados do Foca' }).catch(() => {});
      return;
    }
  } catch (e) { /* File/partilha de ficheiros não suportada — cai para o download normal */ }

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Ficheiro descarregado');
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function goToScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.goto === id));

  if (id === 'screen-registo') { currentRegistoDate = todayKey(); renderRegisto(); }
  if (id === 'screen-historico') renderHistory();
  if (id === 'screen-habitos') { renderHabitsEditList(); renderTodosEditList(); }
  if (id === 'screen-settings') { renderModuleOrderList(); renderProfile(); }
}

/* ---------------- swipe lateral entre menus ---------------- */
(function setupSwipeNav() {
  const shell = document.querySelector('.app-shell');
  const navOrder = Array.from(document.querySelectorAll('.navbar .navbtn')).map(b => b.dataset.goto);
  let startX = 0, startY = 0, tracking = false, decided = null;
  const THRESHOLD = 55;

  function anyModalOpen() {
    return document.querySelector('.modal-overlay.show') !== null;
  }

  shell.addEventListener('touchstart', (e) => {
    if (anyModalOpen() || e.touches.length !== 1) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    decided = null;
  }, { passive: true });

  shell.addEventListener('touchmove', (e) => {
    if (!tracking || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (decided === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      decided = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (decided === 'horizontal') e.preventDefault();
  }, { passive: false });

  shell.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    if (decided !== 'horizontal') return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < THRESHOLD) return;

    const currentId = document.querySelector('.screen.active').id;
    const idx = navOrder.indexOf(currentId);
    if (idx === -1) return;

    // arrastar para a esquerda -> avança; para a direita -> recua
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= navOrder.length) return;
    goToScreen(navOrder[nextIdx]);
  });
})();

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

// chips de sub-navegação das Definições (Módulos/Perfil)
document.addEventListener('click', (e) => {
  const chip = e.target.closest('#screen-settings .chip[data-sub]');
  if (!chip) return;
  document.querySelectorAll('#screen-settings .chip[data-sub]').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  const sub = chip.dataset.sub;
  document.getElementById('sub-modulos').style.display = sub === 'modulos' ? 'block' : 'none';
  document.getElementById('sub-perfil').style.display = sub === 'perfil' ? 'block' : 'none';
  document.getElementById('sub-backup').style.display = sub === 'backup' ? 'block' : 'none';
  if (sub === 'backup') renderBackupPanel();
});

// ---- Perfil: nome, altura, notas ----
function persistProfileField(field, value) {
  const p = getProfile();
  p[field] = value;
  saveProfile(p);
}
document.getElementById('profile-name').addEventListener('change', (e) => persistProfileField('name', e.target.value));
document.getElementById('profile-height').addEventListener('change', (e) => persistProfileField('height', e.target.value));
document.getElementById('profile-notes').addEventListener('change', (e) => persistProfileField('notes', e.target.value));

// ---- Perfil: sexo ----
document.getElementById('profile-sex-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#profile-sex-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  persistProfileField('sex', chip.dataset.sex);
});

// ---- Perfil: peso ----
document.getElementById('add-weight-btn').addEventListener('click', () => {
  const dateInput = document.getElementById('weight-date-input');
  const valueInput = document.getElementById('weight-value-input');
  const kg = parseFloat(valueInput.value);
  if (!kg) { valueInput.focus(); return; }
  const date = dateInput.value || todayKey();
  const weights = getWeights().filter(w => w.date !== date); // um registo por dia — substitui se já existir
  weights.push({ date, kg });
  saveWeights(weights);
  dateInput.value = '';
  valueInput.value = '';
  renderWeightHistory();
  showToast('Peso registado');
});
document.getElementById('weight-history-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-weight"]');
  if (!btn) return;
  saveWeights(getWeights().filter(w => w.date !== btn.dataset.date));
  renderWeightHistory();
});

// ---- Insights: intervalo de tempo ----
document.getElementById('insight-range-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#insight-range-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  insightRange = parseInt(chip.dataset.range, 10);
});

// ---- Insights: gerar ficheiro para exportar ----
document.getElementById('generate-file-btn').addEventListener('click', exportDataFile);

// ações dentro do Registo (delegação)
document.getElementById('registo-modules').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const today = currentRegistoDate; // dia dos módulos diários: hoje ou um dia passado navegado
  const habitDay = todayKey(); // hábitos/to-do's continuam sempre ligados ao dia real de hoje

  if (action === 'toggle-unit') {
    exerciseUnitDraft = btn.dataset.unit;
    btn.parentElement.querySelectorAll('.toggle-opt').forEach(o => o.classList.remove('active'));
    btn.classList.add('active');
    return; // não re-renderiza para não perder o que já foi escrito no formulário
  }

  if (action === 'toggle-habit') {
    const id = btn.dataset.id;
    const log = getHabitLog();
    log[habitDay] = log[habitDay] || {};
    log[habitDay][id] = !log[habitDay][id];
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
    const today = currentRegistoDate;
    const entry = getEntry(today);
    entry[field] = e.target.value;
    saveEntry(today, entry);
    renderRegisto();
  } else if (field === 'notes') {
    const today = currentRegistoDate;
    const entry = getEntry(today);
    entry.notes = e.target.value;
    saveEntry(today, entry);
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

// Histórico: chips de categoria
document.getElementById('hist-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#hist-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentCategory = chip.dataset.cat;
  renderHistory();
});

// Histórico: alternar semana/mês
document.getElementById('hist-view-toggle').addEventListener('click', () => {
  currentView = currentView === 'week' ? 'month' : 'week';
  document.getElementById('hist-week-view').style.display = currentView === 'week' ? 'block' : 'none';
  document.getElementById('hist-month-view').style.display = currentView === 'month' ? 'block' : 'none';
  document.getElementById('hist-view-toggle').textContent = currentView === 'week' ? '📅' : '📊';
  document.getElementById('hist-subtitle').textContent = currentView === 'week' ? 'Vista semanal' : 'Vista mensal';
  renderHistory();
});

// Histórico: navegação entre meses
document.getElementById('month-prev').addEventListener('click', () => { monthOffset--; renderHistMonth(); });
document.getElementById('month-next').addEventListener('click', () => { monthOffset = Math.min(0, monthOffset+1); renderHistMonth(); });

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
function renderVersionTag() {
  const el = document.getElementById('app-version-tag');
  if (!el) return;
  el.className = 'app-version-tag';
  el.textContent = 'v' + APP_VERSION;
}

/* ------------------------------------------------------------
   Migração pontual (v1.7.1): corrige registos de sono já
   apagados antes da correção do bug de eliminação — dias sem
   sleepStart/sleepEnd mas que ficaram com sleepQuality guardada
   continuavam a colorir a vista de mês. Corre uma vez ao abrir.
   ------------------------------------------------------------ */
function migrateFixOrphanSleepQuality() {
  const entries = getEntries();
  let changed = false;
  Object.keys(entries).forEach(date => {
    const entry = entries[date];
    if (entry && !entry.sleepStart && !entry.sleepEnd && entry.sleepQuality) {
      entry.sleepQuality = '';
      changed = true;
    }
  });
  if (changed) saveJSON(STORAGE.entries, entries);
}

window.addEventListener('DOMContentLoaded', () => {
  migrateFixOrphanSleepQuality();
  maybeRunWeeklyBackup();
  renderRegisto();
  renderVersionTag();

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
