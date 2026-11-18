// Blog do CAEB: qualquer estudante com conta publica; todos podem curtir
const express = require('express');
const { db } = require('../db');
const { isAdmin } = require('../util');
const { requireLogin, uploads, fileOf, removeUpload } = require('../middleware');

const router = express.Router();
const PER_PAGE = 10;
const blogTab = () => db.prepare("SELECT * FROM tabs WHERE type = 'blog' LIMIT 1").get();

const POST_SQL = `SELECT p.*, u.username, u.avatar, u.role,
  (SELECT COUNT(*) FROM blog_likes l WHERE l.post_id = p.id) likes,
  EXISTS(SELECT 1 FROM blog_likes l WHERE l.post_id = p.id AND l.user_id = @uid) liked
  FROM blog_posts p JOIN users u ON u.id = p.user_id`;

// Chamado pela aba do tipo "blog" (ver routes/tabs.js)
function renderBlog(req, res, tab, extra) {
  const page = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const sort = req.query.ordem === 'curtidos' ? 'curtidos' : 'recentes';
  const total = db.prepare('SELECT COUNT(*) c FROM blog_posts').get().c;
  const posts = db.prepare(`${POST_SQL} ORDER BY ${sort === 'curtidos' ? 'likes DESC, p.created_at DESC' : 'p.created_at DESC'} LIMIT @lim OFFSET @off`)
    .all({ uid: req.user ? req.user.id : 0, lim: PER_PAGE, off: (page - 1) * PER_PAGE });
  res.render('tabs/blog', { ...extra, tab, posts, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), sort });
}

function canPost(req, res) {
  if (req.user.blog_blocked) {
    req.session.flash = { type: 'error', msg: 'Sua conta está bloqueada para publicar no blog. Procure a gestão do CAEB.' };
    res.redirect('/t/' + blogTab().slug);
    return false;
  }
  return true;
}

function validate(req) {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (title.length < 3 || title.length > 150) return [null, 'O título deve ter entre 3 e 150 caracteres.'];
  if (body.length < 3 || body.length > 20000) return [null, 'O texto deve ter entre 3 e 20.000 caracteres.'];
  return [{ title, body }, null];
}

router.get('/blog/novo', requireLogin, (req, res) => {
  if (!canPost(req, res)) return;
  res.render('blog/form', { title: 'Nova postagem', tab: blogTab(), post: {} });
});

router.post('/blog/novo', requireLogin, uploads([{ name: 'image', maxCount: 1 }]), (req, res) => {
  const img = fileOf(req, 'image');
  if (!canPost(req, res)) { if (img) removeUpload(img.filename); return; }
  const [data, err] = validate(req);
  if (err) {
    if (img) removeUpload(img.filename);
    res.locals.flash = { type: 'error', msg: err };
    return res.status(400).render('blog/form', { title: 'Nova postagem', tab: blogTab(), post: req.body });
  }
  const info = db.prepare('INSERT INTO blog_posts(user_id, title, body, image) VALUES (?, ?, ?, ?)')
    .run(req.user.id, data.title, data.body, img ? img.filename : null);
  req.session.flash = { type: 'success', msg: 'Postagem publicada!' };
  res.redirect('/blog/' + info.lastInsertRowid);
});

const getPost = (id, uid) => db.prepare(`${POST_SQL} WHERE p.id = @id`).get({ id: Number(id), uid: uid || 0 });

router.get('/blog/:id', (req, res, next) => {
  const post = getPost(req.params.id, req.user && req.user.id);
  if (!post) return next();
  res.render('blog/post', { title: post.title, tab: blogTab(), post });
});

router.get('/blog/:id/editar', requireLogin, (req, res, next) => {
  const post = getPost(req.params.id, req.user.id);
  if (!post || post.user_id !== req.user.id) return next();
  if (!canPost(req, res)) return;
  res.render('blog/form', { title: 'Editar postagem', tab: blogTab(), post });
});

router.post('/blog/:id/editar', requireLogin, uploads([{ name: 'image', maxCount: 1 }]), (req, res, next) => {
  const post = getPost(req.params.id, req.user.id);
  const img = fileOf(req, 'image');
  if (!post || post.user_id !== req.user.id) { if (img) removeUpload(img.filename); return next(); }
  if (!canPost(req, res)) { if (img) removeUpload(img.filename); return; }
  const [data, err] = validate(req);
  if (err) {
    if (img) removeUpload(img.filename);
    res.locals.flash = { type: 'error', msg: err };
    return res.status(400).render('blog/form', { title: 'Editar postagem', tab: blogTab(), post: { ...post, ...req.body } });
  }
  let image = post.image;
  if (img) { removeUpload(post.image); image = img.filename; } else if (req.body.remove_image === '1') { removeUpload(post.image); image = null; }
  db.prepare("UPDATE blog_posts SET title = ?, body = ?, image = ?, updated_at = datetime('now') WHERE id = ?").run(data.title, data.body, image, post.id);
  req.session.flash = { type: 'success', msg: 'Postagem atualizada.' };
  res.redirect('/blog/' + post.id);
});

// Apagar: o próprio autor ou qualquer conta administrativa
router.post('/blog/:id/apagar', requireLogin, (req, res, next) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(Number(req.params.id));
  if (!post) return next();
  if (post.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).render('error', { title: 'Sem permissão', message: 'Você não pode apagar esta postagem.' });
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(post.id);
  removeUpload(post.image);
  req.session.flash = { type: 'success', msg: 'Postagem apagada.' };
  res.redirect('/t/' + blogTab().slug);
});

// Curtir / descurtir
router.post('/blog/:id/curtir', requireLogin, (req, res, next) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM blog_posts WHERE id = ?').get(id)) return next();
  const exists = db.prepare('SELECT 1 FROM blog_likes WHERE post_id = ? AND user_id = ?').get(id, req.user.id);
  if (exists) db.prepare('DELETE FROM blog_likes WHERE post_id = ? AND user_id = ?').run(id, req.user.id);
  else db.prepare('INSERT INTO blog_likes(post_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  const likes = db.prepare('SELECT COUNT(*) c FROM blog_likes WHERE post_id = ?').get(id).c;
  if (req.get('accept') && req.get('accept').includes('application/json')) return res.json({ liked: !exists, likes });
  res.redirect(req.get('referer') || '/blog/' + id);
});

module.exports = router;
module.exports.renderBlog = renderBlog;
