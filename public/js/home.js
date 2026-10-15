import {api,escapeHTML,courseCard} from './api.js';
import {layout,toast} from './common.js';
await layout('home');
let courses=[],filter='Все';
const grid=document.getElementById('course-grid');
const chips=document.getElementById('course-filters');
function showCourses(){
  const list=filter==='Все'?courses:courses.filter(c=>c.category===filter);
  grid.innerHTML=list.map(courseCard).join('')||'<p class="muted">Программы не найдены.</p>';
}
try {
  courses=(await api('/courses')).courses;
  const cats=[...new Set(courses.map(c=>c.category))];
  chips.innerHTML='<button type="button" class="chip active" data-filter="Все">Все курсы</button>'+cats.map(c=>`<button type="button" class="chip" data-filter="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
  chips.addEventListener('click',event=>{const btn=event.target.closest('[data-filter]');if(!btn)return;filter=btn.dataset.filter;chips.querySelectorAll('.chip').forEach(item=>item.classList.toggle('active',item===btn));showCourses();});
  showCourses();
} catch (e) {grid.innerHTML=`<p class="muted">${escapeHTML(e.message)}</p>`;toast(e.message,true);}
const reviewGrid=document.getElementById('review-grid');
try {
  const {reviews}=await api('/reviews');
  if (!reviews.length) reviewGrid.innerHTML='<p class="muted">Первые отзывы появятся после завершения обучения.</p>';
  else reviewGrid.innerHTML=reviews.slice(0,4).map(r=>`<article class="review-card"><div class="review-stars" aria-label="Оценка ${Number(r.rating)} из 5">${'★'.repeat(Number(r.rating))}</div><blockquote>«${escapeHTML(r.text)}»</blockquote><div class="review-author">${escapeHTML(r.author)}</div><div class="review-course">${escapeHTML(r.course)}</div></article>`).join('');
} catch { reviewGrid.innerHTML='<p class="muted">Отзывы временно недоступны.</p>'; }
