export async function api(path, options = {}) {
  const { method = 'GET', data, ...rest } = options;
  let response;
  try {
    response = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), ...rest
    });
  } catch {
    throw new Error('Не удаётся подключиться к серверу. Проверьте соединение.');
  }
  let result;
  try { result = await response.json(); } catch { throw new Error('Некорректный ответ сервера.'); }
  if (!response.ok) {
    const error = new Error(result.message || `Ошибка ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
export function fmtDate(iso) {
  if (!iso) return '—';
  const parts = String(iso).slice(0,10).split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
}
export function fmtPrice(num) { return new Intl.NumberFormat('ru-RU').format(Number(num)) + ' ₽'; }
export function initials(name) {
  return String(name || 'У').trim().split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase();
}
export function statusBadge(status) {
  const cls = status === 'Новая' ? 'new' : status === 'Идет обучение' ? 'progress' : 'complete';
  return `<span class="status status-${cls}">${escapeHTML(status)}</span>`;
}
export function icon(name, size = 24) {
  const shapes = {
    code: '<polyline points="8 17 3 12 8 7"/><polyline points="16 7 21 12 16 17"/><line x1="14" y1="4" x2="10" y2="20"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.6-3.2c-.7-.9-.1-2 .9-2h2a5 5 0 0 0 5-5A9.5 9.5 0 0 0 12 3z"/><circle cx="7" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12c4 4 14 4 18 0"/>',
    lock: '<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    folder: '<path d="M3 7h6l2 2h10v11H3z"/>',
    star: '<path d="m12 2 3.1 6.6 7.4 1-5.4 5.1 1.3 7.3-6.4-3.5-6.4 3.5 1.3-7.3-5.4-5.1 7.4-1z"/>',
  };
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || shapes.folder}</svg>`;
}
export function courseCard(course) {
  const id = Number(course.id);
  return `<article class="course-card"><div class="course-art art-${escapeHTML(course.color)}"><span class="course-art-icon">${icon(course.icon,40)}</span><span class="course-art-tag">${escapeHTML(course.level)}</span></div><div class="course-body"><span class="course-category">${escapeHTML(course.category)}</span><h3 class="course-title">${escapeHTML(course.title)}</h3><p class="course-desc">${escapeHTML(course.summary)}</p><div class="course-meta"><span>${icon('clock',15)} ${escapeHTML(course.duration)}</span><span>${icon('folder',15)} Онлайн</span></div><div class="course-end"><div class="course-price">${fmtPrice(course.price)}<small>за программу</small></div><a class="btn btn-sm" href="/apply.html?course=${id}">Записаться ↗</a></div></div></article>`;
}
