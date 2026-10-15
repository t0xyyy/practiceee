import {api,escapeHTML,initials,icon} from './api.js';
let cachedUser = undefined;
export async function getUser(force = false) {
  if (!force && cachedUser !== undefined) return cachedUser;
  try { cachedUser = (await api('/auth/me')).user; }
  catch { cachedUser = null; }
  return cachedUser;
}
export function toast(message, error = false) {
  const area=document.getElementById('toast-stack');
  if (!area) return;
  const el=document.createElement('div');el.className='toast'+(error?' error':'');el.role='status';el.textContent=message;
  area.append(el);
  setTimeout(()=>el.remove(),4900);
}
async function logout() {
  try { await api('/auth/logout',{method:'POST'}); } catch { /* invalidate client view on server error by navigating */ }
  location.href='/login.html';
}
export async function layout(active='') {
  const user=await getUser();
  const navLinks=[['/', 'Главная', 'home'],['/#courses','Курсы','courses'],['/#how','Как это работает','how'],['/#reviews','Отзывы','reviews']];
  const desktopLinks=navLinks.map(([href,label,key])=>`<a class="${active===key?'active':''}" href="${href}">${label}</a>`).join('');
  let desktopActions;
  let mobileActions;
  if (user) {
    const target=user.role==='admin'?'/admin.html':'/dashboard.html';
    desktopActions=`<a class="profile-link" href="${target}"><span class="avatar-mini">${escapeHTML(initials(user.fullName))}</span><span>${user.role==='admin'?'Администратор':'Мой кабинет'}</span></a><button type="button" class="btn btn-outline btn-sm" data-logout>Выход</button>`;
    mobileActions=`<a href="${target}">${user.role==='admin'?'Админ-панель':'Мой кабинет'}</a><button type="button" data-logout>Выйти из аккаунта</button>`;
  } else {
    desktopActions='<a class="nav-login link" href="/login.html">Войти</a><a class="nav-cta btn" href="/register.html">Начать учиться ↗</a>';
    mobileActions='<a href="/login.html">Войти</a><a class="btn" href="/register.html">Создать аккаунт ↗</a>';
  }
  document.getElementById('site-header').innerHTML=`<header class="site-header"><div class="container navbar"><a class="brand" href="/" aria-label="Учусь.РФ, главная"><span class="brandmark"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 22 32 11l24 11-24 12z" fill="currentColor"/><path d="M16 31v15c12 9 20 9 32 0V31L32 39z" fill="currentColor" opacity=".75"/><path d="M55 24v18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></span>учусь<span class="dot">.</span>рф</a><nav class="nav-links" aria-label="Основная навигация">${desktopLinks}</nav><div class="nav-actions">${desktopActions}<button type="button" id="nav-toggle" class="nav-toggle" aria-label="Открыть меню" aria-expanded="false">${icon('menu')}</button></div></div><nav id="nav-drawer" class="nav-drawer" aria-label="Мобильное меню">${navLinks.map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}${mobileActions}</nav></header>`;
  document.getElementById('site-footer').innerHTML=`<footer class="site-footer"><div class="container"><div class="footer-grid"><div><a href="/" class="brand"><span class="brandmark">${icon('code')}</span>учусь<span class="dot">.</span>рф</a><p>Удобная запись на курсы повышения квалификации, профессиональной переподготовки и практического обучения.</p></div><div><div class="footer-title">Обучение</div><nav class="footer-links"><a href="/#courses">Каталог программ</a><a href="/#how">Как записаться</a><a href="/apply.html">Оставить заявку</a></nav></div><div><div class="footer-title">Платформа</div><nav class="footer-links"><a href="/login.html">Личный кабинет</a><a href="/register.html">Регистрация</a><a href="/#reviews">Отзывы</a></nav></div></div><div class="footer-bottom"><span>© 2026 Учусь.РФ • Учебный проект</span><span>Демонстрационный экзамен • Вариант № 5</span></div></div></footer>`;
  const toggle=document.getElementById('nav-toggle'),drawer=document.getElementById('nav-drawer');
  toggle.addEventListener('click',()=>{const visible=drawer.classList.toggle('open');toggle.setAttribute('aria-expanded',String(visible));toggle.setAttribute('aria-label',visible?'Закрыть меню':'Открыть меню');});
  document.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',logout));
  return user;
}
export async function requireAuth(admin=false) {
  const user=await layout(admin?'admin':'dashboard');
  if (!user) { const redirect=encodeURIComponent(location.pathname+location.search);location.replace('/login.html?next='+redirect);return null; }
  if (admin && user.role!=='admin') {location.replace('/dashboard.html');return null;}
  if (!admin && user.role==='admin') {location.replace('/admin.html');return null;}
  return user;
}
export function setBusy(button,busy,label) {
  if (!button) return;
  if (busy) { button.dataset.oldText=button.textContent;button.textContent=label||'Подождите...';button.disabled=true; }
  else {button.textContent=button.dataset.oldText||button.textContent;button.disabled=false;}
}
