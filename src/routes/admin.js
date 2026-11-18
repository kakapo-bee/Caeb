// Painel de administração: abas, chapas/gestões, usuários e configurações
const express = require('express');
const { db, getSettings, setSetting, currentChapa } = require('../db');
const { ROLES, ADMIN_ROLES, TAB_TYPES, SPECIAL_TYPES, slugify } = require('../util');
const { requireAdmin, uploads, removeUpload } = require('../middleware');
const { allTabs } = require('../tabs-helper');

const router = express.Router();
router.use('/admin', requireAdmin);

const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const back = (req, res, fallback) => res.redirect(fallback || req.get('referer') || '/admin');

router.get('/admin', (req, res) => {
  const stats = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    admins: db.prepare(`SELECT COUNT(*) c FROM users WHERE role IN ('presidente','acolhimento','geral')`).get().c,
    posts: db.prepare('SELECT COUNT(*) c FROM blog_posts').get().c,
    items: db.prepare('SELECT COUNT(*) c FROM items').get().c,
  };
  res.render('admin/index', { title: 'Administração', stats });
});

// ======================= ABAS =======================
function tabTree() {
  const tabs = allTabs();
  const out = [];
  const walk = (pid, depth) => tabs.filter(t => (t.parent_id || null) === pid).forEach(t => {
    out.push({ ...t, depth, count: db.prepare('SELECT COUNT(*) c FROM items WHERE tab_id = ?').get(t.id).c });
    walk(t.id, depth + 1);
  });
  walk(null, 0);
  return out;
}
function descendants(id) {
  const tabs = allTabs(); const ids = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const t of tabs) if (t.parent_id && ids.has(t.parent_id) && !ids.has(t.id)) { ids.add(t.id); grew = true; } }
  return ids;
}
function uniqueSlug(base, ignoreId) {
  let slug = slugify(base); let n = 2;
  const reserved = ['novo', 'texto', 'admin'];
  while (reserved.includes(slug) || db.prepare('SELECT 1 FROM tabs WHERE slug = ? AND id <> ?').get(slug, ignoreId || 0)) slug = `${slugify(base)}-${n++}`;
  return slug;
}

router.get('/admin/abas', (req, res) => {
  res.render('admin/tabs', { title: 'Abas e sub-abas', tree: tabTree(), TAB_TYPES, SPECIAL_TYPES, home: getSettings().home_tab });
});

router.post('/admin/abas/nova', (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 60);
  const type = TAB_TYPES[req.body.type] ? req.body.type : 'posts';
  const parent = Number(req.body.parent_id) || null;
  if (!title) { flash(req, 'error', 'Dê um nome para a aba.'); return back(req, res); }
  if (parent && !db.prepare('SELECT 1 FROM tabs WHERE id = ?').get(parent)) { flash(req, 'error', 'Aba-mãe inválida.'); return back(req, res); }
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 p FROM tabs WHERE parent_id IS ?').get(parent).p;
  const slug = uniqueSlug(title);
  db.prepare('INSERT INTO tabs(parent_id, title, slug, type, position) VALUES (?, ?, ?, ?, ?)').run(parent, title, slug, type, pos);
  flash(req, 'success', `Aba "${title}" criada. Ela já aparece no menu.`);
  res.redirect('/admin/abas');
});

router.get('/admin/abas/:id', (req, res, next) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(Number(req.params.id));
  if (!tab) return next();
  const blocked = descendants(tab.id);
  const parents = tabTree().filter(t => !blocked.has(t.id));
  res.render('admin/tab-edit', { title: 'Editar aba', tab, parents, TAB_TYPES, SPECIAL_TYPES });
});

router.post('/admin/abas/:id', (req, res, next) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(Number(req.params.id));
  if (!tab) return next();
  const title = String(req.body.title || '').trim().slice(0, 60) || tab.title;
  let parent = Number(req.body.parent_id) || null;
  if (parent && (descendants(tab.id).has(parent) || !db.prepare('SELECT 1 FROM tabs WHERE id = ?').get(parent))) parent = tab.parent_id;
  const type = tab.system || SPECIAL_TYPES[tab.type] ? tab.type : (TAB_TYPES[req.body.type] ? req.body.type : tab.type);
  const slugIn = String(req.body.slug || '').trim();
  const slug = slugIn && slugify(slugIn) !== tab.slug ? uniqueSlug(slugIn, tab.id) : tab.slug;
  const visible = req.body.visible === '1' ? 1 : 0;
  const adminOnly = tab.slug === 'manual' || tab.id === manualId() ? 1 : (req.body.admin_only === '1' ? 1 : 0);
  db.prepare('UPDATE tabs SET title = ?, parent_id = ?, type = ?, slug = ?, visible = ?, admin_only = ? WHERE id = ?')
    .run(title, parent, type, slug, visible, adminOnly, tab.id);
  if (getSettings().home_tab === tab.slug && slug !== tab.slug) setSetting('home_tab', slug);
  flash(req, 'success', 'Aba atualizada.');
  res.redirect('/admin/abas');
});
const manualId = () => (db.prepare("SELECT id FROM tabs WHERE system = 1 AND admin_only = 1 AND parent_id IS NULL ORDER BY id LIMIT 1").get() || {}).id;

router.post('/admin/abas/:id/mover', (req, res, next) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(Number(req.params.id));
  if (!tab) return next();
  const siblings = db.prepare('SELECT id FROM tabs WHERE parent_id IS ? ORDER BY position, id').all(tab.parent_id).map(r => r.id);
  const i = siblings.indexOf(tab.id);
  const j = req.body.dir === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < siblings.length) [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  const upd = db.prepare('UPDATE tabs SET position = ? WHERE id = ?');
  db.transaction(() => siblings.forEach((id, k) => upd.run(k + 1, id)))();
  res.redirect('/admin/abas#aba-' + tab.id);
});

router.post('/admin/abas/:id/apagar', (req, res, next) => {
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(Number(req.params.id));
  if (!tab) return next();
  if (tab.system) { flash(req, 'error', 'Esta aba é do sistema e não pode ser apagada (mas você pode renomear ou ocultar).'); return back(req, res); }
  if (getSettings().home_tab === tab.slug) { flash(req, 'error', 'Esta é a aba da página inicial. Escolha outra página inicial em Configurações antes.'); return back(req, res); }
  const ids = [...descendants(tab.id)];
  const ph = ids.map(() => '?').join(',');
  const files = db.prepare(`SELECT image, attachment, video_file FROM items WHERE tab_id IN (${ph})`).all(...ids);
  db.prepare('DELETE FROM tabs WHERE id = ?').run(tab.id); // sub-abas e publicações são apagadas junto
  files.forEach(f => [f.image, f.attachment, f.video_file].forEach(removeUpload));
  flash(req, 'success', `Aba "${tab.title}" apagada.`);
  res.redirect('/admin/abas');
});

// ======================= CHAPAS / GESTÕES =======================
router.get('/admin/chapas', (req, res) => {
  const chapas = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.chapa_id = c.id) items,
    (SELECT COUNT(*) FROM chapa_photos p WHERE p.chapa_id = c.id) photos FROM chapas c ORDER BY is_current DESC, id DESC`).all();
  res.render('admin/chapas', { title: 'Chapas e gestões', chapas });
});

router.post('/admin/chapas/nova', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  if (!name) { flash(req, 'error', 'Dê um nome para a chapa.'); return back(req, res); }
  const info = db.prepare('INSERT INTO chapas(name, period) VALUES (?, ?)').run(name, String(req.body.period || '').trim().slice(0, 40));
  flash(req, 'success', `Chapa "${name}" criada. Agora você pode escrever o texto do memorial e enviar fotos.`);
  res.redirect('/admin/chapas/' + info.lastInsertRowid);
});

router.get('/admin/chapas/:id', (req, res, next) => {
  const chapa = db.prepare('SELECT * FROM chapas WHERE id = ?').get(Number(req.params.id));
  if (!chapa) return next();
  const photos = db.prepare('SELECT * FROM chapa_photos WHERE chapa_id = ? ORDER BY id').all(chapa.id);
  res.render('admin/chapa-edit', { title: 'Chapa ' + chapa.name, chapa, photos });
});

router.post('/admin/chapas/:id', (req, res, next) => {
  const chapa = db.prepare('SELECT * FROM chapas WHERE id = ?').get(Number(req.params.id));
  if (!chapa) return next();
  db.prepare('UPDATE chapas SET name = ?, period = ?, description = ? WHERE id = ?').run(
    String(req.body.name || '').trim().slice(0, 80) || chapa.name,
    String(req.body.period || '').trim().slice(0, 40),
    String(req.body.description || '').slice(0, 100000), chapa.id);
  flash(req, 'success', 'Chapa atualizada.');
  res.redirect('/admin/chapas/' + chapa.id);
});

router.post('/admin/chapas/:id/atual', (req, res, next) => {
  const chapa = db.prepare('SELECT * FROM chapas WHERE id = ?').get(Number(req.params.id));
  if (!chapa) return next();
  db.transaction(() => {
    db.prepare('UPDATE chapas SET is_current = 0').run();
    db.prepare('UPDATE chapas SET is_current = 1 WHERE id = ?').run(chapa.id);
  })();
  flash(req, 'success', `Agora o site mostra "Gestão ${chapa.name}". Novas publicações serão registradas no memorial desta chapa.`);
  res.redirect('/admin/chapas');
});

router.post('/admin/chapas/:id/fotos', uploads([{ name: 'photos', maxCount: 30 }]), (req, res, next) => {
  const chapa = db.prepare('SELECT * FROM chapas WHERE id = ?').get(Number(req.params.id));
  const files = (req.files && req.files.photos) || [];
  if (!chapa) { files.forEach(f => removeUpload(f.filename)); return next(); }
  const caption = String(req.body.caption || '').trim().slice(0, 200);
  const ins = db.prepare('INSERT INTO chapa_photos(chapa_id, filename, caption) VALUES (?, ?, ?)');
  files.forEach(f => ins.run(chapa.id, f.filename, caption));
  flash(req, files.length ? 'success' : 'error', files.length ? `${files.length} foto(s) adicionada(s).` : 'Nenhuma foto selecionada.');
  res.redirect('/admin/chapas/' + chapa.id);
});

router.post('/admin/fotos/:id', (req, res, next) => {
  const p = db.prepare('SELECT * FROM chapa_photos WHERE id = ?').get(Number(req.params.id));
  if (!p) return next();
  if (req.body.action === 'apagar') {
    db.prepare('DELETE FROM chapa_photos WHERE id = ?').run(p.id);
    removeUpload(p.filename);
    flash(req, 'success', 'Foto apagada.');
  } else {
    db.prepare('UPDATE chapa_photos SET caption = ? WHERE id = ?').run(String(req.body.caption || '').trim().slice(0, 200), p.id);
    flash(req, 'success', 'Legenda salva.');
  }
  res.redirect('/admin/chapas/' + p.chapa_id);
});

router.post('/admin/chapas/:id/apagar', (req, res, next) => {
  const chapa = db.prepare('SELECT * FROM chapas WHERE id = ?').get(Number(req.params.id));
  if (!chapa) return next();
  if (chapa.is_current) { flash(req, 'error', 'Não é possível apagar a chapa atual.'); return back(req, res); }
  const photos = db.prepare('SELECT filename FROM chapa_photos WHERE chapa_id = ?').all(chapa.id);
  db.prepare('DELETE FROM chapas WHERE id = ?').run(chapa.id);
  photos.forEach(p => removeUpload(p.filename));
  flash(req, 'success', `Chapa "${chapa.name}" apagada (as publicações continuam no site, só não ficam mais ligadas a ela).`);
  res.redirect('/admin/chapas');
});

// ======================= USUÁRIOS =======================
router.get('/admin/usuarios', (req, res) => {
  const q = String(req.query.q || '').trim();
  const papel = ROLES[req.query.papel] ? req.query.papel : (req.query.papel === 'admin' ? 'admin' : '');
  const where = []; const params = [];
  if (q) { where.push('(username LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (papel === 'admin') where.push(`role IN ('presidente','acolhimento','geral')`);
  else if (papel) { where.push('role = ?'); params.push(papel); }
  const users = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM blog_posts p WHERE p.user_id = u.id) posts FROM users u
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY CASE role WHEN 'presidente' THEN 0 WHEN 'acolhimento' THEN 1 WHEN 'geral' THEN 2 ELSE 3 END, username LIMIT 300`).all(...params);
  res.render('admin/users', { title: 'Usuários', users, q, papel, ROLES });
});

router.post('/admin/usuarios/:id/papel', (req, res, next) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!target) return next();
  if (target.id === req.user.id) { flash(req, 'error', 'Você não pode mudar o seu próprio cargo. Peça para outra conta administrativa.'); return back(req, res); }
  const role = ROLES[req.body.role] ? req.body.role : null;
  if (!role) return back(req, res);
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
  const verb = ADMIN_ROLES.includes(role) ? (ADMIN_ROLES.includes(target.role) ? 'agora tem o cargo' : 'foi promovido(a) para') : 'foi rebaixado(a) para';
  flash(req, 'success', `${target.username} ${verb} "${ROLES[role]}".`);
  back(req, res);
});

router.post('/admin/usuarios/:id/blog', (req, res, next) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!target) return next();
  const blocked = req.body.blocked === '1' ? 1 : 0;
  db.prepare('UPDATE users SET blog_blocked = ? WHERE id = ?').run(blocked, target.id);
  flash(req, 'success', blocked ? `${target.username} não pode mais publicar no blog.` : `${target.username} pode publicar no blog novamente.`);
  back(req, res);
});

// Transição de gestão: rebaixa todas as contas administrativas, menos a sua
router.post('/admin/usuarios/rebaixar-todos', (req, res) => {
  if (req.body.confirm !== 'REBAIXAR') { flash(req, 'error', 'Digite REBAIXAR para confirmar.'); return back(req, res); }
  const n = db.prepare(`UPDATE users SET role = 'discente' WHERE role IN ('presidente','acolhimento','geral') AND id <> ?`).run(req.user.id).changes;
  flash(req, 'success', `${n} conta(s) administrativa(s) foram rebaixadas para discente.`);
  res.redirect('/admin/usuarios');
});

// ======================= CONFIGURAÇÕES =======================
const CONFIG_KEYS = ['site_title', 'site_subtitle', 'footer_text', 'instagram', 'contact_email', 'home_tab'];
router.get('/admin/config', (req, res) => {
  const tabs = allTabs().filter(t => !t.admin_only && ['posts', 'events', 'page', 'videos', 'calendar', 'blog'].includes(t.type));
  res.render('admin/config', { title: 'Configurações do site', s: getSettings(), tabs, chapa: currentChapa() });
});
router.post('/admin/config', (req, res) => {
  for (const k of CONFIG_KEYS) {
    let v = String(req.body[k] || '').trim().slice(0, 300);
    if (k === 'home_tab' && !db.prepare('SELECT 1 FROM tabs WHERE slug = ?').get(v)) continue;
    if (k === 'instagram' && v && !/^https?:\/\//.test(v)) v = 'https://instagram.com/' + v.replace(/^@/, '');
    setSetting(k, v);
  }
  flash(req, 'success', 'Configurações salvas.');
  res.redirect('/admin/config');
});

module.exports = router;
