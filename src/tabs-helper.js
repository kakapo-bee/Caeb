// Abas e sub-abas: montagem do menu e verificação de acesso
const { db } = require('./db');
const { isAdmin } = require('./util');

function allTabs() {
  return db.prepare('SELECT * FROM tabs ORDER BY position, id').all();
}

// Uma aba é "só administração" se ela ou qualquer aba-mãe for
function isAdminOnly(tab, byId) {
  let t = tab;
  for (let i = 0; t && i < 10; i++) {
    if (t.admin_only) return true;
    t = t.parent_id ? byId.get(t.parent_id) : null;
  }
  return false;
}
function isHidden(tab, byId) {
  let t = tab;
  for (let i = 0; t && i < 10; i++) {
    if (!t.visible) return true;
    t = t.parent_id ? byId.get(t.parent_id) : null;
  }
  return false;
}

function canView(tab, user) {
  if (!tab) return false;
  if (isAdmin(user)) return true;
  const byId = new Map(allTabs().map(t => [t.id, t]));
  return !isAdminOnly(tab, byId) && !isHidden(tab, byId);
}

// Árvore do menu de navegação, já filtrada para o usuário
function navTree(user) {
  const tabs = allTabs();
  const byId = new Map(tabs.map(t => [t.id, t]));
  const admin = isAdmin(user);
  const ok = (t) => t.visible && (admin || !isAdminOnly(t, byId));
  const build = (parentId) => tabs
    .filter(t => (t.parent_id || null) === parentId && ok(t))
    .map(t => ({ ...t, children: build(t.id) }));
  return build(null);
}

function getTab(slug) {
  return db.prepare('SELECT * FROM tabs WHERE slug = ?').get(slug);
}

function breadcrumb(tab) {
  const out = [];
  let t = tab;
  for (let i = 0; t && i < 10; i++) {
    out.unshift(t);
    t = t.parent_id ? db.prepare('SELECT * FROM tabs WHERE id = ?').get(t.parent_id) : null;
  }
  return out;
}

function childrenVisible(tab, user) {
  const admin = isAdmin(user);
  return db.prepare('SELECT * FROM tabs WHERE parent_id = ? ORDER BY position, id').all(tab.id)
    .filter(t => admin || (t.visible && !t.admin_only));
}

module.exports = { allTabs, navTree, getTab, canView, breadcrumb, childrenVisible, isAdminOnly };
