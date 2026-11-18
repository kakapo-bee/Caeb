// Aba "Conta" e perfis públicos
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { USERNAME_RE, md } = require('../util');
const { requireLogin, uploads, fileOf, removeUpload, destroyUserSessions } = require('../middleware');

const router = express.Router();

const postCount = (id) => db.prepare('SELECT COUNT(*) c FROM blog_posts WHERE user_id = ?').get(id).c;

router.get('/conta', requireLogin, (req, res) => {
  res.render('account/account', { title: 'Minha conta', count: postCount(req.user.id) });
});

router.post('/conta/perfil', requireLogin, uploads([{ name: 'avatar', maxCount: 1 }]), (req, res) => {
  const username = String(req.body.username || '').trim().replace(/\s+/g, ' ');
  const bio = String(req.body.bio || '').replace(/\r\n/g, '\n').trim();
  const avatar = fileOf(req, 'avatar');
  const fail = (msg) => { if (avatar) removeUpload(avatar.filename); req.session.flash = { type: 'error', msg }; res.redirect('/conta'); };
  if (!USERNAME_RE.test(username)) return fail('O nome de usuário deve ter de 3 a 30 caracteres (letras, números, espaço, ponto, hífen ou _).');
  if (db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(username, req.user.id)) return fail('Este nome de usuário já está em uso.');
  if ([...bio].length > 300) return fail('A descrição pode ter no máximo 300 caracteres.');
  if (avatar && avatar.size > 5 * 1024 * 1024) return fail('A foto pode ter no máximo 5 MB.');

  let newAvatar = req.user.avatar;
  if (avatar) { removeUpload(req.user.avatar); newAvatar = avatar.filename; }
  if (req.body.remove_avatar === '1' && !avatar) { removeUpload(req.user.avatar); newAvatar = null; }
  db.prepare('UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?').run(username, bio, newAvatar, req.user.id);
  req.session.flash = { type: 'success', msg: 'Perfil atualizado!' };
  res.redirect('/conta');
});

router.post('/conta/senha', requireLogin, (req, res) => {
  const { current, password, password2 } = req.body;
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) {
    req.session.flash = { type: 'error', msg: 'A senha atual está incorreta.' };
  } else if (String(password || '').length < 8 || password !== password2) {
    req.session.flash = { type: 'error', msg: 'A nova senha precisa ter 8+ caracteres e as duas precisam ser iguais.' };
  } else {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.user.id);
    destroyUserSessions(req.user.id, req.sessionID);
    req.session.flash = { type: 'success', msg: 'Senha alterada!' };
  }
  res.redirect('/conta');
});

router.get('/u/:id', requireLogin, (req, res, next) => {
  const profile = db.prepare('SELECT id, username, role, avatar, bio, blog_blocked, created_at, email FROM users WHERE id = ?').get(Number(req.params.id));
  if (!profile) return next();
  const posts = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM blog_likes l WHERE l.post_id = p.id) likes
                            FROM blog_posts p WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).all(profile.id);
  res.render('account/profile', { title: profile.username, profile, posts, count: postCount(profile.id) });
});

// Pré-visualização do editor de texto
router.post('/preview', requireLogin, (req, res) => {
  res.json({ html: md(String((req.body && req.body.text) || '').slice(0, 100000)) });
});

module.exports = router;
