// Denúncias: enviadas por qualquer conta; lidas SOMENTE por contas "Administrativa — Acolhimento".
// Denúncias anônimas não guardam NENHUMA ligação com a conta que enviou (nem a hora exata).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { todayISO } = require('../util');
const { requireLogin, requireAcolhimento } = require('../middleware');

const router = express.Router();
const CATEGORIES = ['Assédio sexual', 'Assédio moral', 'Discriminação (racismo, LGBTfobia, capacitismo, etc.)', 'Violência física ou verbal', 'Trote abusivo', 'Outro'];
const STATUS = { nova: 'Nova', em_andamento: 'Em andamento', concluida: 'Concluída' };
const denunciaTab = () => db.prepare("SELECT * FROM tabs WHERE type = 'denuncia' LIMIT 1").get();
const limiter = rateLimit({ windowMs: 60 * 60e3, limit: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('error', { title: 'Calma aí', message: 'Muitos envios em pouco tempo. Tente novamente mais tarde.' }) });

function renderDenuncia(req, res, tab, extra) {
  const mine = req.user
    ? db.prepare('SELECT id, subject, category, status, created_at FROM reports WHERE user_id = ? AND anonymous = 0 ORDER BY id DESC').all(req.user.id)
    : [];
  res.render('tabs/denuncia', { ...extra, tab, CATEGORIES, STATUS, mine, form: {} });
}

router.post('/denuncia', requireLogin, limiter, (req, res) => {
  const tab = denunciaTab();
  const anonymous = req.body.anonymous === '1' ? 1 : 0;
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'Outro';
  const subject = String(req.body.subject || '').trim().slice(0, 150);
  const body = String(req.body.body || '').trim().slice(0, 20000);
  const contact = anonymous ? '' : String(req.body.contact || '').trim().slice(0, 200);
  if (subject.length < 3 || body.length < 10) {
    req.session.flash = { type: 'error', msg: 'Preencha o assunto e descreva o ocorrido (mínimo de 10 caracteres).' };
    return res.redirect('/t/' + tab.slug);
  }
  db.prepare(`INSERT INTO reports(user_id, anonymous, category, subject, body, contact, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ${anonymous ? '?' : "datetime('now')"})`)
    .run(...(anonymous ? [null, 1, category, subject, body, contact, todayISO()] : [req.user.id, 0, category, subject, body, contact]));
  res.render('auth/message', {
    title: 'Denúncia enviada',
    heading: 'Sua denúncia foi enviada 💙',
    message: anonymous
      ? 'Ela foi enviada <b>de forma anônima</b>: ninguém, nem a equipe de acolhimento, consegue saber quem enviou. Apenas as contas de acolhimento podem ler o conteúdo.'
      : 'Apenas as contas de acolhimento do CAEB podem ler a denúncia. A equipe pode entrar em contato com você. Você pode acompanhar o status na aba de denúncia.',
  });
});

// ---------- Caixa de denúncias (somente Acolhimento) ----------
router.get('/acolhimento', requireAcolhimento, (req, res) => {
  const filter = STATUS[req.query.status] ? req.query.status : null;
  const reports = db.prepare(`SELECT r.id, r.anonymous, r.category, r.subject, r.status, r.created_at, u.username
    FROM reports r LEFT JOIN users u ON u.id = r.user_id AND r.anonymous = 0
    ${filter ? 'WHERE r.status = ?' : ''} ORDER BY r.id DESC`).all(...(filter ? [filter] : []));
  res.render('reports/inbox', { title: 'Caixa de denúncias', reports, STATUS, filter });
});

router.get('/acolhimento/:id', requireAcolhimento, (req, res, next) => {
  const r = db.prepare(`SELECT r.*, CASE WHEN r.anonymous = 0 THEN u.username END username,
    CASE WHEN r.anonymous = 0 THEN u.email END email, CASE WHEN r.anonymous = 0 THEN u.id END uid
    FROM reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(Number(req.params.id));
  if (!r) return next();
  res.render('reports/show', { title: 'Denúncia #' + r.id, r, STATUS });
});

router.post('/acolhimento/:id', requireAcolhimento, (req, res) => {
  const id = Number(req.params.id);
  if (req.body.action === 'apagar') {
    db.prepare('DELETE FROM reports WHERE id = ?').run(id);
    req.session.flash = { type: 'success', msg: 'Denúncia apagada.' };
    return res.redirect('/acolhimento');
  }
  const status = STATUS[req.body.status] ? req.body.status : 'nova';
  db.prepare('UPDATE reports SET status = ?, notes = ? WHERE id = ?').run(status, String(req.body.notes || '').slice(0, 20000), id);
  req.session.flash = { type: 'success', msg: 'Denúncia atualizada.' };
  res.redirect('/acolhimento/' + id);
});

module.exports = router;
module.exports.renderDenuncia = renderDenuncia;
