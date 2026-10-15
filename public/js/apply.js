import {api,escapeHTML,fmtPrice} from './api.js';
import {requireAuth,setBusy} from './common.js';
const user=await requireAuth();
if(user){
  const form=document.getElementById('apply-form'),courseSelect=document.getElementById('course'),selected=document.getElementById('selected-course'),btn=document.getElementById('apply-submit'),error=document.getElementById('form-error');
  let courses=[];
  try {
    courses=(await api('/courses')).courses;
    courseSelect.innerHTML='<option value="">Выберите курс из списка</option>'+courses.map(c=>`<option value="${c.id}">${escapeHTML(c.title)} — ${fmtPrice(c.price)}</option>`).join('');
    const selectedId=new URLSearchParams(location.search).get('course');
    if(selectedId&&courses.some(c=>String(c.id)===selectedId)) courseSelect.value=selectedId;
    updateSelected();
  }catch(e){error.textContent=e.message;}
  function updateSelected(){const c=courses.find(x=>x.id===Number(courseSelect.value));selected.innerHTML=c?`<strong>${escapeHTML(c.title)}</strong><br>${escapeHTML(c.duration)} · ${fmtPrice(c.price)} · ${escapeHTML(c.level)}`:'';}
  courseSelect.addEventListener('change',updateSelected);
  const dateInput=document.getElementById('startDate');
  dateInput.addEventListener('input',()=>{
    const text=dateInput.value.replace(/\D/g,'').slice(0,8);
    let out=text.slice(0,2);
    if(text.length>2)out+='.'+text.slice(2,4);
    if(text.length>4)out+='.'+text.slice(4,8);
    dateInput.value=out;
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();error.textContent='';
    const courseId=Number(courseSelect.value),startDate=dateInput.value.trim(),paymentMethod=form.elements.paymentMethod.value;
    for(const id of ['course','startDate','paymentMethod'])document.getElementById('err-'+id).textContent='';
    if(!courseId){document.getElementById('err-course').textContent='Выберите курс.';return;}
    if(!/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)){document.getElementById('err-startDate').textContent='Укажите дату в формате ДД.ММ.ГГГГ.';return;}
    if(!paymentMethod){document.getElementById('err-paymentMethod').textContent='Выберите способ оплаты.';return;}
    setBusy(btn,true,'Отправляем заявку...');
    try {await api('/applications',{method:'POST',data:{courseId,startDate,paymentMethod}});location.href='/dashboard.html?created=1';}
    catch(err){error.textContent=err.message;setBusy(btn,false);}
  });
}
