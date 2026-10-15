import {api} from './api.js';
import {layout,setBusy} from './common.js';
const user=await layout();
if(user) location.replace(user.role==='admin'?'/admin.html':'/dashboard.html');
const form=document.getElementById('register-form'),msg=document.getElementById('form-error'),button=document.getElementById('submit-register');
const tests={
  fullName:v=>/^[А-Яа-яЁёA-Za-z\s'-]{5,120}$/.test(v)&&v.trim().split(/\s+/).length>=2?'':'Введите фамилию и имя.',
  login:v=>/^[A-Za-z0-9]{6,60}$/.test(v)&&/[A-Za-z]/.test(v)&&/\d/.test(v)?'':'От 6 символов, латинские буквы и цифры.',
  password:v=>v.length>=8&&v.length<=128?'':'Не менее 8 символов.',
  phone:v=>/^\+?[\d\s()\-]{10,22}$/.test(v)&&v.replace(/\D/g,'').length>=10?'':'Проверьте номер телефона.',
  email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)?'':'Введите действительный email.'
};
for(const name of Object.keys(tests)) form.elements[name].addEventListener('blur',()=>validateField(name));
function validateField(name){const input=form.elements[name];const error=tests[name](input.value.trim());document.getElementById('err-'+name).textContent=error;input.classList.toggle('invalid',!!error);input.setAttribute('aria-invalid',String(!!error));return !error;}
form.addEventListener('submit',async event=>{
  event.preventDefault();msg.textContent='';
  const valid=Object.keys(tests).map(validateField).every(Boolean);
  if(!valid){form.querySelector('input.invalid')?.focus();return;}
  const data=Object.fromEntries(new FormData(form));
  setBusy(button,true,'Создаём аккаунт...');
  try{await api('/auth/register',{method:'POST',data});location.href='/login.html?registered=1';}
  catch(e){msg.textContent=e.message;setBusy(button,false);}
});
