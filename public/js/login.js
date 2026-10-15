import {api} from './api.js';
import {layout,setBusy} from './common.js';
const user=await layout();
if(user) location.replace(user.role==='admin'?'/admin.html':'/dashboard.html');
const form=document.getElementById('login-form'),msg=document.getElementById('form-error'),button=document.getElementById('login-submit');
if(new URLSearchParams(location.search).has('registered')) {const box=document.createElement('div');box.className='form-success';box.textContent='Регистрация прошла успешно. Войдите в аккаунт.';form.prepend(box);}
form.addEventListener('submit',async e=>{
  e.preventDefault();msg.textContent='';
  const login=form.elements.login.value.trim(),password=form.elements.password.value;
  if(!login||!password){msg.textContent='Заполните логин и пароль.';return;}
  setBusy(button,true,'Проверяем данные...');
  try{
    const {user}=await api('/auth/login',{method:'POST',data:{login,password}});
    const next=new URLSearchParams(location.search).get('next');
    const safeNext=next&&next.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')?next:null;
    location.href=user.role==='admin'?'/admin.html':(safeNext&&safeNext!=='/admin.html'?safeNext:'/dashboard.html');
  }catch(err){msg.textContent=err.message;setBusy(button,false);}
});
