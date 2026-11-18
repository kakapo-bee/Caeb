// Cadastro (com confirmação por e-mail), login, logout e recuperação de senha
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { newToken, hashToken, USERNAME_RE } = require('../util');
const { sendConfirmation, sendReset } = require('../mailer');
const { destroyUserSessions } = require('../middleware');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60e3, limit: 20, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: 'Calma aí', message: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }) });

const baseUrl = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const safeBack = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/');
const EMAIL_DOMAIN = (process.env.EMAIL_DOMAIN || 'ufpr.br').toLowerCase();

// ---------- Login ----------
router.get('/entrar', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { title: 'Entrar', voltar: safeBack(req.query.voltar), email: '' });
});

router.post('/entrar', limiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const voltar = safeBack(req.body.voltar);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    res.locals.flash = { type: 'error', msg: 'E-mail ou senha incorretos.' };
    return res.status(401).render('auth/login', { title: 'Entrar', voltar, email });
  }
  req.session.regenerate(() => {
    req.session.userId = user.id;
    req.session.flash = { type: 'success', msg: `Bem-vindo(a), ${user.username}!` };
    req.session.save(() => res.redirect(voltar));
  });
});

router.post('/sair', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- Cadastro ----------
router.get('/cadastro', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { title: 'Criar conta', form: {}, domain: EMAIL_DOMAIN });
});

router.post('/cadastro', limiter, async (req, res, next) => {
  const form = {
    email: String(req.body.email || '').trim().toLowerCase(),
    username: String(req.body.username || '').trim().replace(/\s+/g, ' '),
  };
  const pass = String(req.body.password || '');
  const pass2 = String(req.body.password2 || '');
  const err = (msg) => {
    res.locals.flash = { type: 'error', msg };
    return res.status(400).render('auth/register', { title: 'Criar conta', form, domain: EMAIL_DOMAIN });
  };
  if (!new RegExp(`^[^\\s@]+@${EMAIL_DOMAIN.replace(/\./g, '\\.')}$`).test(form.email)) return err(`Use seu e-mail institucional terminado em @${EMAIL_DOMAIN}.`);
  if (!USERNAME_RE.test(form.username)) return err('O nome de usuário deve ter de 3 a 30 caracteres (letras, números, espaço, ponto, hífen ou _).');
  if (pass.length < 8) return err('A senha precisa ter pelo menos 8 caracteres.');
  if (pass !== pass2) return err('As senhas não são iguais.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(form.email)) return err('Já existe uma conta com este e-mail. Use "Esqueci minha senha" se não lembrar a senha.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(form.username)) return err('Este nome de usuário já está em uso.');

  const token = newToken();
  db.prepare('DELETE FROM pending_users WHERE email = ? OR expires_at < ?').run(form.email, Date.now());
  db.prepare('INSERT INTO pending_users(token_hash, email, username, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(hashToken(token), form.email, form.username, bcrypt.hashSync(pass, 10), Date.now() + 24 * 3600e3);
  try {
    await sendConfirmation(form.email, form.username, `${baseUrl(req)}/confirmar/${token}`);
  } catch (e) {
    console.error('[e-mail] falha ao enviar confirmação:', e.message);
    return err('Não foi possível enviar o e-mail de confirmação agora. Tente novamente mais tarde.');
  }
  res.render('auth/message', {
    title: 'Confira seu e-mail',
    heading: 'Quase lá! 📬',
    message: `Enviamos um e-mail para <b>${form.email.replace(/</g, '&lt;')}</b>. Abra a mensagem e clique em <b>Confirmar</b> para criar sua conta. Confira também a caixa de spam. O link vale por 24 horas.`,
  });
});

router.get('/confirmar/:token', (req, res) => {
  const p = db.prepare('SELECT * FROM pending_users WHERE token_hash = ?').get(hashToken(req.params.token));
  if (!p || p.expires_at < Date.now()) {
    return res.status(400).render('auth/message', { title: 'Link inválido', heading: 'Link inválido ou expirado', message: 'Este link de confirmação não é mais válido. Faça o cadastro novamente.' });
  }
  res.render('auth/confirm', { title: 'Confirmar conta', p, token: req.params.token });
});

router.post('/confirmar/:token', (req, res) => {
  const th = hashToken(req.params.token);
  const p = db.prepare('SELECT * FROM pending_users WHERE token_hash = ?').get(th);
  if (!p || p.expires_at < Date.now()) return res.redirect('/confirmar/' + encodeURIComponent(req.params.token));
  if (db.prepare('SELECT 1 FROM users WHERE email = ? OR username = ?').get(p.email, p.username)) {
    db.prepare('DELETE FROM pending_users WHERE token_hash = ?').run(th);
    return res.render('auth/message', { title: 'Conta já existe', heading: 'Conta já existe', message: 'Já existe uma conta com este e-mail ou nome de usuário. Tente entrar ou faça um novo cadastro com outro nome.' });
  }
  const info = db.prepare('INSERT INTO users(email, username, password_hash) VALUES (?, ?, ?)').run(p.email, p.username, p.password_hash);
  db.prepare('DELETE FROM pending_users WHERE token_hash = ?').run(th);
  req.session.regenerate(() => {
    req.session.userId = Number(info.lastInsertRowid);
    req.session.flash = { type: 'success', msg: 'Conta criada! Que tal colocar uma foto e uma descrição no seu perfil?' };
    req.session.save(() => res.redirect('/conta'));
  });
});

// ---------- Esqueci minha senha ----------
router.get('/esqueci-senha', (req, res) => res.render('auth/forgot', { title: 'Esqueci minha senha' }));

router.post('/esqueci-senha', limiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    const token = newToken();
    db.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').run(user.id, Date.now());
    db.prepare('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, Date.now() + 3600e3);
    try { await sendReset(user.email, user.username, `${baseUrl(req)}/redefinir-senha/${token}`); } catch (e) { console.error('[e-mail]', e.message); }
  }
  res.render('auth/message', { title: 'Confira seu e-mail', heading: 'Confira seu e-mail', message: 'Se existir uma conta com esse e-mail, você receberá um link para criar uma nova senha.' });
});

router.get('/redefinir-senha/:token', (req, res) => {
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?').get(hashToken(req.params.token), Date.now());
  if (!r) return res.status(400).render('auth/message', { title: 'Link inválido', heading: 'Link inválido ou expirado', message: 'Peça um novo link em "Esqueci minha senha".' });
  res.render('auth/reset', { title: 'Nova senha', token: req.params.token });
});

router.post('/redefinir-senha/:token', limiter, (req, res) => {
  const th = hashToken(req.params.token);
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?').get(th, Date.now());
  if (!r) return res.redirect('/redefinir-senha/' + encodeURIComponent(req.params.token));
  const pass = String(req.body.password || '');
  if (pass.length < 8 || pass !== req.body.password2) {
    res.locals.flash = { type: 'error', msg: 'A senha precisa ter 8+ caracteres e as duas precisam ser iguais.' };
    return res.render('auth/reset', { title: 'Nova senha', token: req.params.token });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pass, 10), r.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(r.user_id);
  destroyUserSessions(r.user_id);
  req.session.flash = { type: 'success', msg: 'Senha alterada! Entre com a nova senha.' };
  res.redirect('/entrar');
});

module.exports = router;
