'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const COURSES = [
  ['WEB-101', 'Веб-разработка с нуля', 'Разработка', 'HTML, CSS и JavaScript: создайте свой первый современный сайт.', '8 недель', 'Начальный', 12900, 'mint', 'code'],
  ['DATA-201', 'Аналитика данных', 'Аналитика', 'Python, визуализация и аналитическое мышление для реальных задач.', '10 недель', 'Средний', 16900, 'lavender', 'chart'],
  ['DES-105', 'UX/UI-дизайн', 'Дизайн', 'Исследуйте потребности пользователей и создавайте удобные интерфейсы.', '6 недель', 'Начальный', 11900, 'peach', 'palette'],
  ['SAFE-110', 'Охрана труда', 'Профессиональное обучение', 'Актуальные требования, инструкции и безопасная организация труда.', '4 недели', 'Начальный', 6900, 'sky', 'shield'],
  ['PM-210', 'Управление проектами', 'Переподготовка', 'Планирование, коммуникация, сроки и контроль результатов команды.', '12 недель', 'Средний', 18900, 'yellow', 'briefcase'],
  ['SEC-101', 'Основы кибербезопасности', 'Разработка', 'Защита информации, цифровая гигиена и основы сетевой безопасности.', '8 недель', 'Начальный', 14900, 'rose', 'lock']
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}
function checkPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(password, parts[1], expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

function initializeDatabase(dbPath = process.env.DB_PATH || path.join(__dirname, 'database', 'portal.sqlite')) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8'));
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  const insertCourse = db.prepare('INSERT OR IGNORE INTO courses(code,title,category,summary,duration,level,price,color,icon) VALUES(?,?,?,?,?,?,?,?,?)');
  for (const row of COURSES) insertCourse.run(...row);
  const newUser = db.prepare('INSERT OR IGNORE INTO users(login,password_hash,full_name,phone,email,role) VALUES(?,?,?,?,?,?)');
  newUser.run('Admin26', hashPassword('Demo20'), 'Администратор портала', '+79990000000', 'admin@uchus.rf', 'admin');
  newUser.run('student26', hashPassword('Student2026'), 'Иван Петров', '+79991234567', 'ivan@example.ru', 'user');
  const student = db.prepare("SELECT id FROM users WHERE login='student26'").get();
  const sampleCount = db.prepare('SELECT count(*) as total FROM applications WHERE user_id=?').get(student.id).total;
  if (!sampleCount) {
    const getCourse = db.prepare('SELECT id FROM courses WHERE code=?');
    const addApp = db.prepare('INSERT INTO applications(user_id,course_id,start_date,payment_method,status) VALUES(?,?,?,?,?)');
    addApp.run(student.id, getCourse.get('WEB-101').id, '2026-09-10', 'Банковская карта', 'Обучение завершено');
    addApp.run(student.id, getCourse.get('DES-105').id, '2026-10-20', 'СБП', 'Идет обучение');
    addApp.run(student.id, getCourse.get('PM-210').id, '2026-11-16', 'По счёту', 'Новая');
    const reviewApp = db.prepare('SELECT id FROM applications WHERE user_id=? AND status=? LIMIT 1').get(student.id, 'Обучение завершено');
    db.prepare('INSERT INTO reviews(application_id,user_id,rating,text) VALUES(?,?,?,?)').run(reviewApp.id, student.id, 5, 'Отличная подача материала и много полезной практики. Рекомендую курс!');
  }
  return db;
}
module.exports = { initializeDatabase, hashPassword, checkPassword };
