'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { initializeDatabase, hashPassword, checkPassword } = require('./db');
const WEB_DIR = path.join(__dirname, 'public');
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 7;
const STATUSES = ['Новая', 'Идет обучение', 'Обучение завершено'];
const PAYMENTS = ['Банковская карта', 'СБП', 'По счёту'];
const MIMES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.json':'application/json; charset=utf-8' };
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function validDate(input) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input || '');
  if (!match) return null;
  const [, d, m, y] = match; const date = `${y}-${m}-${d}`;
  const check = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCFullYear() !== +y || check.getUTCMonth()+1 !== +m || check.getUTCDate() !== +d) return null;
  return date;
}
const inputString = (v, max = 100) => typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
const publicUser = u => ({ id: u.id, login: u.login, fullName: u.full_name, email: u.email, phone: u.phone, role: u.role });
const baseSelect = `SELECT a.id,a.user_id AS userId,a.course_id AS courseId,a.start_date AS startDate,a.payment_method AS paymentMethod,a.status,a.created_at AS createdAt,a.updated_at AS updatedAt,
 c.title AS courseTitle,c.category AS courseCategory,c.duration AS courseDuration,c.price AS coursePrice,c.icon AS courseIcon,
 u.full_name AS userName,u.email AS userEmail,u.phone AS userPhone,u.login AS userLogin,
 r.id AS reviewId,r.rating AS reviewRating,r.text AS reviewText
 FROM applications a JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=a.user_id LEFT JOIN reviews r ON r.application_id=a.id`;

function makeApp(options = {}) {
  const db = initializeDatabase(options.dbPath);
  function json(res, status, value, extra = {}) {
    const body = JSON.stringify(value);
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra}); res.end(body);
  }
  function cookieUser(req) {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('uchus_session='));
    if (!cookie) return null;
    const token = cookie.slice('uchus_session='.length);
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const id = crypto.createHash('sha256').update(token).digest('hex');
    return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?').get(id, Date.now()) || null;
  }
  function requireUser(req) { const u = cookieUser(req); if (!u) throw new HttpError(401, 'Войдите в аккаунт, чтобы продолжить.'); return u; }
  function requireAdmin(req) { const u = requireUser(req); if (u.role !== 'admin') throw new HttpError(403, 'Доступ только для администратора.'); return u; }
  function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const id = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)').run(id, userId, Date.now() + SESSION_DAYS * DAY);
    return token;
  }
  function sessionCookie(token, maxAge = SESSION_DAYS*86400) { return `uchus_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`; }
  async function readJSON(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415,'Отправьте данные в формате JSON.');
    let raw = '';
    for await (const chunk of req) { raw += chunk.toString('utf8'); if (raw.length > 32768) throw new HttpError(413, 'Превышен допустимый размер запроса.'); }
    try { const data = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
    catch { throw new HttpError(400, 'Некорректный формат данных.'); }
  }
  const asyncRoute = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (origin && new URL(origin).host !== host) throw new HttpError(403,'Недопустимый источник запроса.');
      }
      if (route === '/api/health' && req.method === 'GET') return json(res,200,{ok:true,service:'Учусь.РФ',time:new Date().toISOString()});
      if (route === '/api/courses' && req.method === 'GET') {
        return json(res,200,{courses:db.prepare('SELECT * FROM courses WHERE is_active=1 ORDER BY id').all()});
      }
      if (route === '/api/reviews' && req.method === 'GET') {
        return json(res,200,{reviews:db.prepare(`SELECT r.rating,r.text,r.created_at AS createdAt,u.full_name AS author,c.title AS course FROM reviews r JOIN users u ON u.id=r.user_id JOIN applications a ON a.id=r.application_id JOIN courses c ON c.id=a.course_id ORDER BY r.id DESC LIMIT 10`).all()});
      }
      if (route === '/api/auth/me' && req.method === 'GET') { const u=cookieUser(req);return json(res,200,{user:u ? publicUser(u) : null}); }
      if (route === '/api/auth/register' && req.method === 'POST') {
        const p = await readJSON(req);
        const login=inputString(p.login,60),password=typeof p.password==='string'?p.password:'', fullName=inputString(p.fullName,120), phone=inputString(p.phone,30),email=inputString(p.email,120).toLowerCase();
        if (!/^[A-Za-z0-9]{6,60}$/.test(login) || !/[A-Za-z]/.test(login) || !/[0-9]/.test(login)) throw new HttpError(400,'Логин: от 6 символов, только латинские буквы и цифры, обязательно и то и другое.');
        if (password.length < 8 || password.length > 128) throw new HttpError(400,'Пароль должен содержать от 8 до 128 символов.');
        if (!/^[А-Яа-яЁёA-Za-z\s'-]{5,120}$/.test(fullName) || fullName.split(/\s+/).length < 2) throw new HttpError(400,'Введите ФИО (не менее имени и фамилии).');
        if (!/^\+?[\d\s()\-]{10,22}$/.test(phone) || phone.replace(/\D/g,'').length < 10) throw new HttpError(400,'Укажите корректный контактный телефон.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400,'Укажите корректный email.');
        if (db.prepare('SELECT id FROM users WHERE login=?').get(login)) throw new HttpError(409,'Этот логин уже занят.');
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new HttpError(409,'Этот email уже зарегистрирован.');
        const result=db.prepare('INSERT INTO users(login,password_hash,full_name,phone,email) VALUES(?,?,?,?,?)').run(login,hashPassword(password),fullName,phone,email);
        return json(res,201,{message:'Аккаунт создан. Теперь можно войти.',userId:Number(result.lastInsertRowid)});
      }
      if (route === '/api/auth/login' && req.method === 'POST') {
        const p=await readJSON(req); const login=inputString(p.login,60), password=p.password;
        const user=db.prepare('SELECT * FROM users WHERE login=?').get(login);
        if (!user || typeof password!=='string' || !checkPassword(password,user.password_hash)) throw new HttpError(401,'Неверный логин или пароль.');
        const token=createSession(user.id);
        return json(res,200,{message:'Вход выполнен.',user:publicUser(user)}, {'Set-Cookie':sessionCookie(token)});
      }
      if (route === '/api/auth/logout' && req.method === 'POST') {
        const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('uchus_session='));
        if (cookie) { const token=cookie.split('=')[1]; if (/^[0-9a-f]{64}$/.test(token)) db.prepare('DELETE FROM sessions WHERE id=?').run(crypto.createHash('sha256').update(token).digest('hex')); }
        return json(res,200,{message:'Вы вышли из аккаунта.'},{'Set-Cookie':sessionCookie('',0)});
      }
      if (route === '/api/applications' && req.method === 'GET') {
        const user=requireUser(req);
        return json(res,200,{applications:db.prepare(baseSelect+' WHERE a.user_id=? ORDER BY a.id DESC').all(user.id)});
      }
      if (route === '/api/applications' && req.method === 'POST') {
        const user=requireUser(req);
        if (user.role==='admin') throw new HttpError(403,'Администратор не может оформлять пользовательские заявки.');
        const p=await readJSON(req);
        if (!Number.isSafeInteger(p.courseId)) throw new HttpError(400,'Выберите курс.');
        const course=db.prepare('SELECT id FROM courses WHERE id=? AND is_active=1').get(p.courseId);
        if (!course) throw new HttpError(400,'Выбранный курс недоступен.');
        const date=validDate(p.startDate);
        if (!date) throw new HttpError(400,'Дата должна существовать и быть в формате ДД.ММ.ГГГГ.');
        const today=new Date().toISOString().slice(0,10);
        if (date < today) throw new HttpError(400,'Дата начала обучения не может быть в прошлом.');
        if (!PAYMENTS.includes(p.paymentMethod)) throw new HttpError(400,'Выберите допустимый способ оплаты.');
        const result=db.prepare('INSERT INTO applications(user_id,course_id,start_date,payment_method) VALUES(?,?,?,?)').run(user.id,course.id,date,p.paymentMethod);
        return json(res,201,{message:'Заявка успешно отправлена!',id:Number(result.lastInsertRowid),status:'Новая'});
      }
      const reviewPath = route.match(/^\/api\/applications\/(\d+)\/review$/);
      if (reviewPath && req.method==='POST') {
        const user=requireUser(req);
        const app=db.prepare('SELECT id,user_id,status FROM applications WHERE id=?').get(Number(reviewPath[1]));
        if (!app || app.user_id!==user.id) throw new HttpError(404,'Заявка не найдена.');
        if (app.status!=='Обучение завершено') throw new HttpError(400,'Отзыв можно оставить только после завершения обучения.');
        if (db.prepare('SELECT id FROM reviews WHERE application_id=?').get(app.id)) throw new HttpError(409,'Вы уже оставили отзыв по этой заявке.');
        const p=await readJSON(req); const rating=Number(p.rating), review=inputString(p.text,1000);
        if (!Number.isInteger(rating)||rating<1||rating>5) throw new HttpError(400,'Оценка должна быть от 1 до 5.');
        if (review.length<10||review.length>1000) throw new HttpError(400,'Отзыв должен содержать от 10 до 1000 символов.');
        db.prepare('INSERT INTO reviews(application_id,user_id,rating,text) VALUES(?,?,?,?)').run(app.id,user.id,rating,review);
        return json(res,201,{message:'Спасибо! Отзыв опубликован.'});
      }
      if (route==='/api/admin/stats' && req.method==='GET') {
        requireAdmin(req);
        const counts=db.prepare('SELECT status,COUNT(*) AS count FROM applications GROUP BY status').all();
        return json(res,200,{all:db.prepare('SELECT count(*) AS n FROM applications').get().n, users:db.prepare("SELECT count(*) AS n FROM users WHERE role='user'").get().n, reviews:db.prepare('SELECT count(*) AS n FROM reviews').get().n, statusCounts:Object.fromEntries(counts.map(x=>[x.status,x.count]))});
      }
      if (route==='/api/admin/applications' && req.method==='GET') {
        requireAdmin(req);
        const status=url.searchParams.get('status')||'';
        const course=url.searchParams.get('course')||'';
        const q=(url.searchParams.get('q')||'').trim().slice(0,80);
        const sort=url.searchParams.get('sort')||'newest';
        const clauses=[], args=[];
        if (status && STATUSES.includes(status)) { clauses.push('a.status=?');args.push(status); }
        if (course && /^\d+$/.test(course)) { clauses.push('a.course_id=?');args.push(Number(course)); }
        if (q) { clauses.push('(u.full_name LIKE ? OR u.login LIKE ? OR c.title LIKE ? OR u.email LIKE ?)'); for(let i=0;i<4;i++) args.push('%'+q+'%'); }
        const order = {newest:'a.id DESC',oldest:'a.id ASC',name:'u.full_name COLLATE NOCASE ASC',status:'a.status ASC, a.id DESC'}[sort]||'a.id DESC';
        const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
        return json(res,200,{applications:db.prepare(baseSelect+where+' ORDER BY '+order).all(...args)});
      }
      const statusPath=route.match(/^\/api\/admin\/applications\/(\d+)\/status$/);
      if (statusPath && req.method==='PATCH') {
        const admin=requireAdmin(req); const p=await readJSON(req);
        if (!STATUSES.includes(p.status)) throw new HttpError(400,'Недопустимый статус заявки.');
        const id=Number(statusPath[1]); const row=db.prepare('SELECT id,status FROM applications WHERE id=?').get(id);
        if (!row) throw new HttpError(404,'Заявка не найдена.');
        if (row.status===p.status) return json(res,200,{message:'Статус не изменился.',status:row.status});
        db.exec('BEGIN');
        try {
          db.prepare("UPDATE applications SET status=?,updated_at=datetime('now') WHERE id=?").run(p.status,id);
          db.prepare('INSERT INTO status_history(application_id,admin_id,old_status,new_status) VALUES(?,?,?,?)').run(id,admin.id,row.status,p.status);
          db.exec('COMMIT');
        } catch(e) { db.exec('ROLLBACK'); throw e; }
        return json(res,200,{message:'Статус заявки обновлён.',status:p.status});
      }
      if (route==='/api/admin/history' && req.method==='GET') {
        requireAdmin(req);
        return json(res,200,{history:db.prepare('SELECT h.*,a.user_id,u.full_name AS adminName FROM status_history h JOIN applications a ON a.id=h.application_id JOIN users u ON u.id=h.admin_id ORDER BY h.id DESC LIMIT 20').all()});
      }
      if (route.startsWith('/api/')) throw new HttpError(404,'API-метод не найден.');
      if (!['GET','HEAD'].includes(req.method)) throw new HttpError(405,'Метод не поддерживается.');
      let decoded;
      try { decoded=decodeURIComponent(route); } catch { throw new HttpError(400,'Некорректный путь.'); }
      const file=path.resolve(WEB_DIR,'.'+(decoded==='/'?'/index.html':decoded));
      if (!(file===WEB_DIR||file.startsWith(WEB_DIR+path.sep))) throw new HttpError(403,'Доступ запрещён.');
      let stat;
      try { stat=fs.statSync(file); if(!stat.isFile()) throw Error(); } catch { throw new HttpError(404,'Страница не найдена.'); }
      const ext=path.extname(file).toLowerCase();
      res.writeHead(200,{'Content-Type':MIMES[ext]||'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});
      if (req.method==='HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    } catch(err) {
      if(err.status) return json(res,err.status,{message:err.message});
      if (/UNIQUE constraint failed/i.test(err.message||'')) return json(res,409,{message:'Такая запись уже существует.'});
      console.error('Ошибка запроса:',err);
      return json(res,500,{message:'Внутренняя ошибка сервера.'});
    }
  };
  const server=http.createServer(asyncRoute);
  return {server,db};
}
if (require.main===module) {
  const port=Number(process.env.PORT)||3000;
  const {server}=makeApp();
  server.listen(port,()=>console.log(`\nУчусь.РФ запущен: http://localhost:${port}\nАдминистратор: Admin26 / Demo20\nТестовый ученик: student26 / Student2026\n`));
}
module.exports={makeApp,validDate};
