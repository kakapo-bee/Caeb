// Exibição das abas e das publicações (itens) dentro delas
const express = require('express');
const { db, getSettings, currentChapa } = require('../db');
const { isAdmin, md, todayISO, MONTHS_FULL } = require('../util');
const { requireAdmin, uploads, fileOf, removeUpload } = require('../middleware');
const { getTab, canView, breadcrumb, childrenVisible, allTabs, isAdminOnly } = require('../tabs-helper');
const { renderBlog } = require('./blog');
const { renderDenuncia } = require('./reports');

const router = express.Router();
const PER_PAGE = 12;
const ITEM_TYPES = ['posts', 'events', 'calendar', 'cardapio', 'videos'];
const notFound = (res) => res.status(404).render('error', { title: 'Página não encontrada', message: 'A página que você procurou não existe ou foi removida.' });

function common(req, tab) {
  return {
    title: tab.title,
    tab,
    crumbs: breadcrumb(tab),
    subtabs: childrenVisible(tab, req.user),
    intro: md(tab.content),
    canEdit: isAdmin(req.user),
  };
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function renderTab(req, res, tab) {
  if (!canView(tab, req.user)) return notFound(res);
  const extra = common(req, tab);
  const page = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const today = todayISO();

  switch (tab.type) {
    case 'blog': return renderBlog(req, res, tab, extra);
    case 'denuncia': return renderDenuncia(req, res, tab, extra);
    case 'memorial': return renderMemorial(req, res, tab, extra);
    case 'page': return res.render('tabs/page', extra);

    case 'events': {
      const upcoming = db.prepare(`SELECT * FROM items WHERE tab_id = ? AND COALESCE(end_date, event_date) >= ?
                                   ORDER BY pinned DESC, event_date, event_time`).all(tab.id, today);
      const total = db.prepare('SELECT COUNT(*) c FROM items WHERE tab_id = ? AND (event_date IS NULL OR COALESCE(end_date, event_date) < ?)').get(tab.id, today).c;
      const past = db.prepare(`SELECT * FROM items WHERE tab_id = ? AND (event_date IS NULL OR COALESCE(end_date, event_date) < ?)
                               ORDER BY event_date DESC, created_at DESC LIMIT ? OFFSET ?`).all(tab.id, today, PER_PAGE, (page - 1) * PER_PAGE);
      return res.render('tabs/events', { ...extra, upcoming, past, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) });
    }

    case 'calendar': {
      const m = /^(\d{4})-(\d{2})$/.exec(req.query.mes || '') || /^(\d{4})-(\d{2})/.exec(today);
      const year = Number(m[1]); const month = Number(m[2]);
      const first = `${m[1]}-${m[2]}-01`;
      const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      // itens desta aba + eventos de todas as abas do tipo "eventos" visíveis
      const evTabs = allTabs().filter(t => t.type === 'events' && canView(t, req.user)).map(t => t.id);
      const ids = [tab.id, ...evTabs];
      const items = db.prepare(`SELECT i.*, t.slug tab_slug, t.type tab_type FROM items i JOIN tabs t ON t.id = i.tab_id
         WHERE i.tab_id IN (${ids.map(() => '?').join(',')}) AND i.event_date IS NOT NULL
         AND i.event_date <= ? AND COALESCE(i.end_date, i.event_date) >= ? ORDER BY i.event_date, i.event_time`).all(...ids, last, first);
      // grade do mês (semanas começando no domingo)
      const startDow = new Date(first + 'T12:00:00Z').getUTCDay();
      let cursor = addDays(first, -startDow);
      const weeks = [];
      while (cursor <= last || weeks.length < 5) {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const day = cursor;
          week.push({ date: day, inMonth: day.slice(0, 7) === first.slice(0, 7), today: day === today,
            items: items.filter(it => it.event_date <= day && (it.end_date || it.event_date) >= day) });
          cursor = addDays(cursor, 1);
        }
        weeks.push(week);
        if (cursor > last) break;
      }
      const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
      const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
      return res.render('tabs/calendar', { ...extra, weeks, items, monthLabel: `${MONTHS_FULL[month - 1]} de ${year}`, prev, next });
    }

    case 'cardapio': {
      const offset = Math.max(-52, Math.min(52, parseInt(req.query.semana, 10) || 0));
      const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7; // segunda = 0
      const monday = addDays(today, -dow + offset * 7);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(monday, i);
        days.push({ date, today: date === today, items: db.prepare('SELECT * FROM items WHERE tab_id = ? AND event_date = ? ORDER BY event_time, id').all(tab.id, date) });
      }
      return res.render('tabs/cardapio', { ...extra, days, offset });
    }

    default: { // posts e videos
      const total = db.prepare('SELECT COUNT(*) c FROM items WHERE tab_id = ?').get(tab.id).c;
      const items = db.prepare(`SELECT * FROM items WHERE tab_id = ? ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`)
        .all(tab.id, PER_PAGE, (page - 1) * PER_PAGE);
      return res.render(tab.type === 'videos' ? 'tabs/videos' : 'tabs/posts', { ...extra, items, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) });
    }
  }
}

function renderMemorial(req, res, tab, extra) {
  const chapas = db.prepare('SELECT * FROM chapas ORDER BY is_current DESC, id DESC').all();
  const current = currentChapa();
  const sel = chapas.find(c => c.id === Number(req.query.chapa)) || current || chapas[0];
  let photos = []; let items = []; let pages = 1;
  const page = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  if (sel) {
    photos = db.prepare('SELECT * FROM chapa_photos WHERE chapa_id = ? ORDER BY id').all(sel.id);
    const tabs = allTabs();
    const byId = new Map(tabs.map(t => [t.id, t]));
    const okIds = tabs.filter(t => canView(t, req.user) && !isAdminOnly(t, byId)).map(t => t.id);
    if (okIds.length) {
      const where = `i.chapa_id = ? AND i.tab_id IN (${okIds.map(() => '?').join(',')})`;
      const total = db.prepare(`SELECT COUNT(*) c FROM items i WHERE ${where}`).get(sel.id, ...okIds).c;
      pages = Math.max(1, Math.ceil(total / PER_PAGE));
      items = db.prepare(`SELECT i.*, t.title tab_title, t.slug tab_slug FROM items i JOIN tabs t ON t.id = i.tab_id
        WHERE ${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`)
        .all(sel.id, ...okIds, PER_PAGE, (page - 1) * PER_PAGE);
    }
  }
  res.render('tabs/memorial', { ...extra, chapas, sel, photos, items, page, pages });
}

// ---------- Rotas de exibição ----------
router.get('/', (req, res) => {
  const tab = getTab(getSettings().home_tab || 'mural') || db.prepare('SELECT * FROM tabs WHERE parent_id IS NULL ORDER BY position LIMIT 1').get();
  if (!tab) return notFound(res);
  res.locals.isHome = true;
  renderTab(req, res, tab);
});

router.get('/t/:slug', (req, res) => {
  const tab = getTab(req.params.slug);
  if (!tab) return notFound(res);
  renderTab(req, res, tab);
});

// ---------- Texto de apresentação da aba ----------
router.get('/t/:slug/texto', requireAdmin, (req, res) => {
  const tab = getTab(req.params.slug);
  if (!tab) return notFound(res);
  res.render('items/tab-text', { title: 'Editar texto — ' + tab.title, tab, crumbs: breadcrumb(tab) });
});
router.post('/t/:slug/texto', requireAdmin, (req, res) => {
  const tab = getTab(req.params.slug);
  if (!tab) return notFound(res);
  db.prepare('UPDATE tabs SET content = ? WHERE id = ?').run(String(req.body.content || '').slice(0, 100000), tab.id);
  req.session.flash = { type: 'success', msg: 'Texto atualizado.' };
  res.redirect('/t/' + tab.slug);
});

// ---------- Publicações (itens) ----------
const ITEM_FILES = [{ name: 'image', maxCount: 1 }, { name: 'attachment', maxCount: 1 }, { name: 'video_file', maxCount: 1 }];
const chapasList = () => db.prepare('SELECT id, name, period, is_current FROM chapas ORDER BY is_current DESC, id DESC').all();

function itemData(req, tab) {
  const s = (k, max = 500) => { const v = String(req.body[k] || '').trim().slice(0, max); return v || null; };
  const date = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(req.body[k] || '') ? req.body[k] : null);
  const d = {
    title: s('title', 200), body: String(req.body.body || '').slice(0, 100000),
    video_url: s('video_url'), event_date: date('event_date'), end_date: date('end_date'),
    event_time: /^\d{2}:\d{2}$/.test(req.body.event_time || '') ? req.body.event_time : null,
    location: s('location', 200), pinned: req.body.pinned === '1' ? 1 : 0,
    chapa_id: Number(req.body.chapa_id) || null,
  };
  if (d.end_date && d.event_date && d.end_date < d.event_date) d.end_date = null;
  if (d.end_date === d.event_date) d.end_date = null;
  let err = null;
  if (!d.title) err = 'O título é obrigatório.';
  else if (['events', 'calendar', 'cardapio'].includes(tab.type) && !d.event_date) err = 'A data é obrigatória neste tipo de aba.';
  return [d, err];
}

function cleanupFiles(req) { ['image', 'attachment', 'video_file'].forEach(f => { const x = fileOf(req, f); if (x) removeUpload(x.filename); }); }

router.get('/t/:slug/novo', requireAdmin, (req, res) => {
  const tab = getTab(req.params.slug);
  if (!tab || !ITEM_TYPES.includes(tab.type)) return notFound(res);
  const cur = currentChapa();
  res.render('items/form', { title: 'Nova publicação — ' + tab.title, tab, crumbs: breadcrumb(tab), item: { chapa_id: cur && cur.id, event_date: req.query.data || '' }, chapas: chapasList() });
});

router.post('/t/:slug/novo', requireAdmin, uploads(ITEM_FILES), (req, res) => {
  const tab = getTab(req.params.slug);
  if (!tab || !ITEM_TYPES.includes(tab.type)) { cleanupFiles(req); return notFound(res); }
  const [d, err] = itemData(req, tab);
  const att = fileOf(req, 'attachment');
  const vid = fileOf(req, 'video_file');
  if (!err && tab.type === 'videos' && !d.video_url && !vid) {
    cleanupFiles(req);
    res.locals.flash = { type: 'error', msg: 'Coloque um link de vídeo ou envie um arquivo de vídeo.' };
    return res.status(400).render('items/form', { title: 'Nova publicação', tab, crumbs: breadcrumb(tab), item: req.body, chapas: chapasList() });
  }
  if (err) {
    cleanupFiles(req);
    res.locals.flash = { type: 'error', msg: err };
    return res.status(400).render('items/form', { title: 'Nova publicação', tab, crumbs: breadcrumb(tab), item: req.body, chapas: chapasList() });
  }
  const img = fileOf(req, 'image');
  const info = db.prepare(`INSERT INTO items(tab_id, chapa_id, author_id, title, body, image, attachment, attachment_name, video_url, video_file,
      event_date, event_time, end_date, location, pinned) VALUES (@tab_id, @chapa_id, @author_id, @title, @body, @image, @attachment, @attachment_name,
      @video_url, @video_file, @event_date, @event_time, @end_date, @location, @pinned)`).run({
    ...d, tab_id: tab.id, author_id: req.user.id, image: img ? img.filename : null,
    attachment: att ? att.filename : null, attachment_name: att ? att.originalname.slice(0, 200) : null, video_file: vid ? vid.filename : null,
  });
  req.session.flash = { type: 'success', msg: 'Publicação criada!' };
  res.redirect(['cardapio', 'calendar'].includes(tab.type) ? '/t/' + tab.slug + (tab.type === 'calendar' ? '?mes=' + d.event_date.slice(0, 7) : '') : `/t/${tab.slug}/${info.lastInsertRowid}`);
});

router.get('/t/:slug/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  const tab = getTab(req.params.slug);
  const item = tab && db.prepare('SELECT i.*, c.name chapa_name FROM items i LEFT JOIN chapas c ON c.id = i.chapa_id WHERE i.id = ? AND i.tab_id = ?').get(Number(req.params.id), tab.id);
  if (!item || !canView(tab, req.user)) return notFound(res);
  res.render('items/show', { title: item.title, tab, crumbs: breadcrumb(tab), item, canEdit: isAdmin(req.user) });
});

function loadItem(req) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id));
  const tab = item && db.prepare('SELECT * FROM tabs WHERE id = ?').get(item.tab_id);
  return [item, tab];
}

router.get('/itens/:id/editar', requireAdmin, (req, res) => {
  const [item, tab] = loadItem(req);
  if (!item) return notFound(res);
  res.render('items/form', { title: 'Editar publicação', tab, crumbs: breadcrumb(tab), item, chapas: chapasList() });
});

router.post('/itens/:id/editar', requireAdmin, uploads(ITEM_FILES), (req, res) => {
  const [item, tab] = loadItem(req);
  if (!item) { cleanupFiles(req); return notFound(res); }
  const [d, err] = itemData(req, tab);
  if (err) {
    cleanupFiles(req);
    res.locals.flash = { type: 'error', msg: err };
    return res.status(400).render('items/form', { title: 'Editar publicação', tab, crumbs: breadcrumb(tab), item: { ...item, ...req.body }, chapas: chapasList() });
  }
  const files = {};
  for (const f of ['image', 'attachment', 'video_file']) {
    const up = fileOf(req, f);
    if (up) { removeUpload(item[f]); files[f] = up.filename; if (f === 'attachment') files.attachment_name = up.originalname.slice(0, 200); }
    else if (req.body['remove_' + f] === '1') { removeUpload(item[f]); files[f] = null; if (f === 'attachment') files.attachment_name = null; }
    else { files[f] = item[f]; if (f === 'attachment') files.attachment_name = item.attachment_name; }
  }
  db.prepare(`UPDATE items SET chapa_id=@chapa_id, title=@title, body=@body, image=@image, attachment=@attachment, attachment_name=@attachment_name,
    video_url=@video_url, video_file=@video_file, event_date=@event_date, event_time=@event_time, end_date=@end_date, location=@location,
    pinned=@pinned, updated_at=datetime('now') WHERE id=@id`).run({ ...d, ...files, id: item.id });
  req.session.flash = { type: 'success', msg: 'Publicação atualizada.' };
  res.redirect(`/t/${tab.slug}/${item.id}`);
});

router.post('/itens/:id/apagar', requireAdmin, (req, res) => {
  const [item, tab] = loadItem(req);
  if (!item) return notFound(res);
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  ['image', 'attachment', 'video_file'].forEach(f => removeUpload(item[f]));
  req.session.flash = { type: 'success', msg: 'Publicação apagada.' };
  res.redirect('/t/' + tab.slug);
});

module.exports = router;
