// Sessões, permissões e envio de arquivos
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const multer = require('multer');
const { db, DATA_DIR } = require('./db');
const { isAdmin } = require('./util');

// ---- Armazena as sessões de login no próprio SQLite ----
class SqliteStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.setStmt = db.prepare('INSERT OR REPLACE INTO sessions(sid, sess, expires) VALUES (?, ?, ?)');
    this.delStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    setInterval(() => db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now()), 3600e3).unref();
  }
  get(sid, cb) { try { const r = this.getStmt.get(sid, Date.now()); cb(null, r ? JSON.parse(r.sess) : null); } catch (e) { cb(e); } }
  set(sid, sess, cb) {
    try {
      const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400e3;
      this.setStmt.run(sid, JSON.stringify(sess), exp); cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { this.delStmt.run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

// Remove de todas as sessões abertas de um usuário (ex.: ao mudar senha)
function destroyUserSessions(userId, exceptSid) {
  const rows = db.prepare('SELECT sid, sess FROM sessions').all();
  for (const r of rows) {
    try { if (JSON.parse(r.sess).userId === userId && r.sid !== exceptSid) db.prepare('DELETE FROM sessions WHERE sid = ?').run(r.sid); } catch { /* ignora */ }
  }
}

// ---- Proteção contra envio de formulários vindos de outros sites (CSRF) ----
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const src = req.get('origin') || req.get('referer');
  if (src) {
    try {
      if (new URL(src).host === req.get('host')) return next();
    } catch { /* cai no erro abaixo */ }
    return res.status(403).send('Requisição bloqueada (origem inválida).');
  }
  return next(); // navegadores modernos sempre mandam Origin; cookies SameSite=Lax completam a proteção
}

// ---- Permissões ----
function requireLogin(req, res, next) {
  if (req.user) return next();
  req.session.flash = { type: 'info', msg: 'Entre na sua conta para continuar.' };
  return res.redirect('/entrar?voltar=' + encodeURIComponent(req.originalUrl));
}
function requireAdmin(req, res, next) {
  if (isAdmin(req.user)) return next();
  return res.status(404).render('error', { title: 'Página não encontrada', message: 'Esta página não existe.' });
}
function requireAcolhimento(req, res, next) {
  if (req.user && req.user.role === 'acolhimento') return next();
  return res.status(404).render('error', { title: 'Página não encontrada', message: 'Esta página não existe.' });
}

// ---- Upload de arquivos ----
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')),
});
const IMG = /^image\/(png|jpe?g|gif|webp)$/;
const VIDEO = /^video\/(mp4|webm|ogg|quicktime)$/;
const DOC = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.oasis\.opendocument\..+|image\/(png|jpe?g|gif|webp))$/;

function fileFilter(req, file, cb) {
  const ok = {
    image: IMG, avatar: IMG, photos: IMG, video_file: VIDEO, attachment: DOC,
  }[file.fieldname];
  if (ok && ok.test(file.mimetype)) return cb(null, true);
  const err = new Error('Tipo de arquivo não permitido: ' + file.originalname);
  err.code = 'TIPO_INVALIDO';
  cb(err);
}
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 300);
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_MB * 1024 * 1024 } });

// envolve o multer para mostrar erros amigáveis
function uploads(fields) {
  const mw = upload.fields(fields);
  return (req, res, next) => mw(req, res, (err) => {
    if (!err) return next();
    req.session.flash = { type: 'error', msg: err.code === 'LIMIT_FILE_SIZE' ? `Arquivo grande demais (máximo ${MAX_MB} MB).` : err.message };
    return res.redirect(req.get('referer') || '/');
  });
}
const fileOf = (req, field) => (req.files && req.files[field] && req.files[field][0] ? req.files[field][0] : null);

function removeUpload(name) {
  if (!name) return;
  const fs = require('fs');
  fs.rm(path.join(UPLOAD_DIR, path.basename(name)), { force: true }, () => {});
}

module.exports = {
  SqliteStore, destroyUserSessions, sameOrigin, requireLogin, requireAdmin, requireAcolhimento,
  uploads, fileOf, removeUpload, UPLOAD_DIR,
};
