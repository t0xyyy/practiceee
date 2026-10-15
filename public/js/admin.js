import {api,escapeHTML,fmtDate,statusBadge} from './api.js';
import {requireAuth,toast,setBusy} from './common.js';
const user=await requireAuth(true);
if(user){
  const tbody=document.getElementById('admin-rows'),stats={all:document.getElementById('stat-all'),new:document.getElementById('stat-new'),progress:document.getElementById('stat-progress'),complete:document.getElementById('stat-complete')};
  let applications=[],pending=null,queryTimer;
  const q=document.getElementById('filter-query'),status=document.getElementById('filter-status'),course=document.getElementById('filter-course'),sort=document.getElementById('filter-sort');
  try{const res=await api('/courses');course.innerHTML='<option value="">Все курсы</option>'+res.courses.map(c=>`<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('');}
  catch(e){toast(e.message,true);}
  async function loadStats(){const result=await api('/admin/stats');stats.all.textContent=result.all;stats.new.textContent=result.statusCounts['Новая']||0;stats.progress.textContent=result.statusCounts['Идет обучение']||0;stats.complete.textContent=result.statusCounts['Обучение завершено']||0;}
  function render(){
    document.getElementById('results-count').textContent=`Показано заявок: ${applications.length}`;
    if(!applications.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:33px;color:#7a8e82">По выбранным фильтрам заявки не найдены.</td></tr>';return;}
    const statuses=['Новая','Идет обучение','Обучение завершено'];
    tbody.innerHTML=applications.map(a=>`<tr><td><div class="table-title">№${a.id}</div><div class="table-muted">${fmtDate(a.createdAt)}</div></td><td><div class="table-title">${escapeHTML(a.userName)}</div><div class="table-muted">${escapeHTML(a.userEmail)}</div><div class="table-muted">${escapeHTML(a.userPhone)}</div></td><td><div class="table-title">${escapeHTML(a.courseTitle)}</div><div class="table-muted">${escapeHTML(a.courseCategory)}</div></td><td><div class="table-title">${fmtDate(a.startDate)}</div><div class="table-muted">${escapeHTML(a.paymentMethod)}</div></td><td>${statusBadge(a.status)}</td><td><div class="admin-actions"><select aria-label="Изменить статус заявки ${a.id}" data-status-select="${a.id}">${statuses.map(s=>`<option value="${escapeHTML(s)}" ${s===a.status?'selected':''}>${escapeHTML(s)}</option>`).join('')}</select><button class="btn btn-sm" type="button" data-update="${a.id}">ОК</button></div></td></tr>`).join('');
  }
  async function load(){
    tbody.innerHTML='<tr><td colspan="6" class="muted">Обновляем список...</td></tr>';
    try{const params=new URLSearchParams({q:q.value,status:status.value,course:course.value,sort:sort.value});const [r]=await Promise.all([api('/admin/applications?'+params),loadStats()]);applications=r.applications;render();}
    catch(err){tbody.innerHTML=`<tr><td colspan="6" style="color:#b14a42">${escapeHTML(err.message)}</td></tr>`;toast(err.message,true);}
  }
  async function loadHistory(){
    try{const {history}=await api('/admin/history');document.getElementById('audit-list').innerHTML=history.length?history.map(h=>`<li>Заявка №${h.application_id}: <b>${escapeHTML(h.old_status)}</b> → <b>${escapeHTML(h.new_status)}</b><br><span class="muted">${escapeHTML(h.adminName)} · ${fmtDate(h.changed_at)}</span></li>`).join(''):'<li>Изменений пока нет.</li>';}
    catch{document.getElementById('audit-list').innerHTML='<li>Не удалось загрузить историю.</li>';}
  }
  q.addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(load,280);});
  [status,course,sort].forEach(el=>el.addEventListener('change',load));
  document.getElementById('refresh').addEventListener('click',()=>{load();loadHistory();});
  const dlg=document.getElementById('status-dialog');
  tbody.addEventListener('click',event=>{
    const btn=event.target.closest('[data-update]');if(!btn)return;
    const id=Number(btn.dataset.update),row=applications.find(a=>a.id===id),select=tbody.querySelector(`[data-status-select="${id}"]`);
    if(!row||!select)return;
    if(row.status===select.value){toast('Этот статус уже установлен.');return;}
    pending={id,status:select.value};document.getElementById('status-dialog-text').textContent=`Изменить статус заявки №${id} (${row.userName}, ${row.courseTitle}) с «${row.status}» на «${select.value}»?`;
    dlg.showModal();
  });
  document.getElementById('status-cancel').addEventListener('click',()=>{pending=null;dlg.close();load();});
  document.getElementById('status-confirm').addEventListener('click',async()=>{
    if(!pending)return;const current=pending,btn=document.getElementById('status-confirm');setBusy(btn,true,'Сохраняем...');
    try{await api(`/admin/applications/${current.id}/status`,{method:'PATCH',data:{status:current.status}});dlg.close();pending=null;toast('Статус заявки обновлён.');await Promise.all([load(),loadHistory()]);}
    catch(e){toast(e.message,true);}finally{setBusy(btn,false);}
  });
  await Promise.all([load(),loadHistory()]);
}
