'use strict';
const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {makeApp,validDate} = require('../server');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'uchus-exam-'));
const {server,db} = makeApp({dbPath:path.join(tmp,'test.sqlite')});
let base;
let studentCookie,adminCookie,newCookie,ownApp;
const futureDate = `25.12.${new Date().getFullYear()+1}`;
async function request(url,method='GET',data, cookie){
  const r=await fetch(base+url,{method,headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  const contentType=r.headers.get('content-type')||'';
  const body=contentType.includes('json')?await r.json():await r.text();
  return {status:r.status,body,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function setup(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(tmp,{recursive:true,force:true});});
test('Подготовка сервера, ER-связей и программы курсов',async()=>{
  await setup();
  const r=await request('/api/courses');
  assert.equal(r.status,200);assert.equal(r.body.courses.length,6);
  assert.ok(r.body.courses.some(c=>c.title==='Охрана труда'));
  const health=await request('/api/health');assert.equal(health.body.ok,true);
  const html=await request('/register.html');assert.equal(html.status,200);assert.ok(html.body.includes('id="register-form"'));
  const svg=await request('/assets/slides/slide-4.svg');assert.equal(svg.status,200);
  assert.equal(validDate('29.02.2028'),'2028-02-29');
  assert.equal(validDate('31.02.2028'),null);
});
test('Регистрация: валидация, уникальность, вход и защищённые маршруты',async()=>{
  const unauth=await request('/api/applications');assert.equal(unauth.status,401);
  const invalid=await request('/api/auth/register','POST',{login:'ABC',password:'short',fullName:'А',phone:'123',email:'no'});
  assert.equal(invalid.status,400);
  const payload={login:'examuser2026',password:'StrongPassword123',fullName:'Сидоров Пётр Ильич',phone:'+7 (999) 456-78-90',email:'petr.test@example.ru'};
  const reg=await request('/api/auth/register','POST',payload);assert.equal(reg.status,201);
  const twice=await request('/api/auth/register','POST',payload);assert.equal(twice.status,409);
  const wrong=await request('/api/auth/login','POST',{login:payload.login,password:'wrong'});assert.equal(wrong.status,401);
  const login=await request('/api/auth/login','POST',{login:payload.login,password:payload.password});
  assert.equal(login.status,200);assert.equal(login.body.user.role,'user');assert.ok(login.cookie);newCookie=login.cookie;
  const me=await request('/api/auth/me','GET',undefined,newCookie);assert.equal(me.body.user.login,payload.login);
  const forbidden=await request('/api/admin/applications','GET',undefined,newCookie);assert.equal(forbidden.status,403);
});
test('Запись на курс и защита данных',async()=>{
  const courses=(await request('/api/courses')).body.courses;
  const bad=await request('/api/applications','POST',{courseId:courses[0].id,startDate:'31.02.2028',paymentMethod:'СБП'},newCookie);
  assert.equal(bad.status,400);
  const old=await request('/api/applications','POST',{courseId:courses[0].id,startDate:'01.01.2020',paymentMethod:'СБП'},newCookie);
  assert.equal(old.status,400);
  const badPayment=await request('/api/applications','POST',{courseId:courses[0].id,startDate:futureDate,paymentMethod:'Криптовалюта'},newCookie);
  assert.equal(badPayment.status,400);
  const ok=await request('/api/applications','POST',{courseId:courses[0].id,startDate:futureDate,paymentMethod:'Банковская карта'},newCookie);
  assert.equal(ok.status,201);ownApp=ok.body.id;assert.equal(ok.body.status,'Новая');
  const my=await request('/api/applications','GET',undefined,newCookie);
  assert.ok(my.body.applications.some(a=>a.id===ownApp&&a.courseTitle==='Веб-разработка с нуля'));
  const earlyReview=await request(`/api/applications/${ownApp}/review`,'POST',{rating:5,text:'Очень хорошее обучение, рекомендую'},newCookie);
  assert.equal(earlyReview.status,400);
  const someoneElses=await request('/api/applications/1/review','POST',{rating:4,text:'Отзыв на чужую заявку недоступен'},newCookie);
  assert.equal(someoneElses.status,404);
});
test('Администратор: фильтры, изменение статуса и журнал изменений',async()=>{
  const login=await request('/api/auth/login','POST',{login:'Admin26',password:'Demo20'});
  assert.equal(login.status,200);assert.equal(login.body.user.role,'admin');adminCookie=login.cookie;
  const all=await request('/api/admin/applications','GET',undefined,adminCookie);
  assert.equal(all.status,200);assert.ok(all.body.applications.length>=4);
  const onlyNew=await request('/api/admin/applications?status='+encodeURIComponent('Новая'),'GET',undefined,adminCookie);
  assert.ok(onlyNew.body.applications.every(a=>a.status==='Новая'));
  const filtered=await request('/api/admin/applications?q=Сидоров&sort=name','GET',undefined,adminCookie);
  assert.ok(filtered.body.applications.some(a=>a.id===ownApp));
  const invalid=await request(`/api/admin/applications/${ownApp}/status`,'PATCH',{status:'Отмена'},adminCookie);assert.equal(invalid.status,400);
  const denied=await request(`/api/admin/applications/${ownApp}/status`,'PATCH',{status:'Обучение завершено'},newCookie);assert.equal(denied.status,403);
  const updated=await request(`/api/admin/applications/${ownApp}/status`,'PATCH',{status:'Идет обучение'},adminCookie);assert.equal(updated.status,200);
  const finished=await request(`/api/admin/applications/${ownApp}/status`,'PATCH',{status:'Обучение завершено'},adminCookie);assert.equal(finished.status,200);
  const history=await request('/api/admin/history','GET',undefined,adminCookie);
  assert.ok(history.body.history.filter(h=>h.application_id===ownApp).length===2);
  const stats=await request('/api/admin/stats','GET',undefined,adminCookie);
  assert.ok(stats.body.all>=4);
});
test('Отзыв разрешён только после завершения, повторное добавление запрещено',async()=>{
  const review=await request(`/api/applications/${ownApp}/review`,'POST',{rating:5,text:'Очень полезное обучение и отличная практика!'},newCookie);
  assert.equal(review.status,201);
  const duplicate=await request(`/api/applications/${ownApp}/review`,'POST',{rating:5,text:'Ещё один повторный отзыв.'},newCookie);assert.equal(duplicate.status,409);
  const reviews=await request('/api/reviews');assert.ok(reviews.body.reviews.some(r=>r.text.includes('отличная практика')));
});
test('Завершение сеанса и ограничение доступа',async()=>{
  const bye=await request('/api/auth/logout','POST',{},newCookie);assert.equal(bye.status,200);
  const denied=await request('/api/applications','GET',undefined,newCookie);assert.equal(denied.status,401);
  const logStudent=await request('/api/auth/login','POST',{login:'student26',password:'Student2026'});assert.equal(logStudent.status,200);studentCookie=logStudent.cookie;
  const apps=await request('/api/applications','GET',undefined,studentCookie);assert.equal(apps.body.applications.length,3);
});
