import {api,escapeHTML,fmtDate,statusBadge,icon} from './api.js';
import {requireAuth,toast,setBusy} from './common.js';
import {AccessibleSlider} from './slider.js';
const user=await requireAuth();
if(user){
  const list=document.getElementById('application-list');
  const firstName=user.fullName.split(/\s+/)[1]||user.fullName.split(/\s+/)[0];
  document.getElementById('student-name').textContent=firstName;
  new AccessibleSlider(document.getElementById('dashboard-slider'),{interval:3000});
  if(new URLSearchParams(location.search).has('created')){toast('Заявка успешно создана! Её статус — «Новая».');history.replaceState(null,'','/dashboard.html');}
  let applications=[],filter='Все';
  function showApplications(){
    const filtered=filter==='Все'?applications:applications.filter(a=>a.status===filter);
    document.getElementById('applications-count').textContent=`Найдено: ${filtered.length}`;
    if(!filtered.length){list.innerHTML=`<div class="empty-state">${icon('folder',48)}<h3>Пока нет заявок</h3><p>${filter==='Все'?'Вы ещё не записались ни на один курс.':'В выбранной категории пока нет заявок.'}</p><a class="btn btn-sm" href="/apply.html">Выбрать курс ↗</a></div>`;return;}
    list.innerHTML=filtered.map(a=>`<article class="application-card"><div><div class="eyebrow" style="font-size:10px">Заявка №${a.id}</div><h3>${escapeHTML(a.courseTitle)}</h3><div class="application-details"><span>${icon('calendar',14)} ${fmtDate(a.startDate)}</span><span>${icon('clock',14)} ${escapeHTML(a.courseDuration)}</span><span>Оплата: ${escapeHTML(a.paymentMethod)}</span></div>${a.reviewId?`<p class="review-existing">★ ${Number(a.reviewRating)}/5 · Ваш отзыв: «${escapeHTML(a.reviewText)}»</p>`:''}</div><div class="application-side">${statusBadge(a.status)}${a.status==='Обучение завершено'&&!a.reviewId?`<button type="button" class="btn btn-sm btn-soft" data-review="${a.id}">Оставить отзыв ↗</button>`:''}</div></article>`).join('');
  }
  async function load(){
    try{applications=(await api('/applications')).applications;document.getElementById('total-count').textContent=applications.length;document.getElementById('active-count').textContent=applications.filter(a=>a.status==='Идет обучение').length;document.getElementById('completed-count').textContent=applications.filter(a=>a.status==='Обучение завершено').length;showApplications();}
    catch(err){list.innerHTML=`<div class="empty-state"><h3>Ошибка загрузки</h3><p>${escapeHTML(err.message)}</p></div>`;}
  }
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.status;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===btn));showApplications();}));
  const dlg=document.getElementById('review-dialog'),rform=document.getElementById('review-form');let rating=5,selectedId=null;
  function paintStars(){document.querySelectorAll('.star-choice').forEach(btn=>{const selected=Number(btn.dataset.rating)<=rating;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(Number(btn.dataset.rating)===rating));});}
  document.querySelectorAll('.star-choice').forEach(btn=>btn.addEventListener('click',()=>{rating=Number(btn.dataset.rating);paintStars();}));
  list.addEventListener('click',event=>{const btn=event.target.closest('[data-review]');if(!btn)return;selectedId=Number(btn.dataset.review);const a=applications.find(x=>x.id===selectedId);if(!a)return;document.getElementById('review-course-title').textContent=`Курс «${a.courseTitle}» завершён. Расскажите, как прошло обучение.`;document.getElementById('review-text').value='';document.getElementById('review-error').textContent='';rating=5;paintStars();dlg.showModal();});
  document.getElementById('review-cancel').addEventListener('click',()=>dlg.close());
  rform.addEventListener('submit',async event=>{event.preventDefault();const text=document.getElementById('review-text').value.trim(),error=document.getElementById('review-error'),submit=document.getElementById('review-submit');error.textContent='';if(text.length<10){error.textContent='Напишите не менее 10 символов.';return;}setBusy(submit,true,'Публикуем...');try{await api(`/applications/${selectedId}/review`,{method:'POST',data:{rating,text}});dlg.close();toast('Спасибо! Ваш отзыв опубликован.');await load();}catch(e){error.textContent=e.message;}finally{setBusy(submit,false);}});
  await load();
}
