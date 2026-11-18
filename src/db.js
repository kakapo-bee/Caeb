// Banco de dados SQLite (arquivo único em data/caeb.db)
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { MANUAL_PAGES } = require('./manual-seed');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'caeb.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'discente',   -- presidente | acolhimento | geral | discente
  avatar TEXT,
  bio TEXT NOT NULL DEFAULT '',
  blog_blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_users (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS chapas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapa_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapa_id INTEGER NOT NULL REFERENCES chapas(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'posts',
  content TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  admin_only INTEGER NOT NULL DEFAULT 0,
  system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  chapa_id INTEGER REFERENCES chapas(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image TEXT,
  attachment TEXT,
  attachment_name TEXT,
  video_url TEXT,
  video_file TEXT,
  event_date TEXT,
  event_time TEXT,
  end_date TEXT,
  location TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_tab ON items(tab_id);
CREATE INDEX IF NOT EXISTS idx_items_chapa ON items(chapa_id);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_likes (
  post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- Denúncias. Quando anonymous = 1, user_id é SEMPRE NULL e só a data (sem hora) é guardada.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  anonymous INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nova',      -- nova | em_andamento | concluida
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`);

// ---------- Dados iniciais (só na primeira execução) ----------
function seed() {
  const has = db.prepare('SELECT COUNT(*) c FROM tabs').get().c;
  if (has) return;

  const setSetting = db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)');
  setSetting.run('site_title', 'CAEB UFPR');
  setSetting.run('site_subtitle', 'Centro Acadêmico de Estudos Biológicos');
  setSetting.run('footer_text', 'Centro Acadêmico de Estudos Biológicos — Universidade Federal do Paraná');
  setSetting.run('instagram', '');
  setSetting.run('contact_email', '');

  db.prepare("INSERT INTO chapas(name, period, description, is_current) VALUES ('Germinar', '', 'Texto de apresentação da gestão Germinar. Edite em Administração → Chapas.', 1)").run();

  const ins = db.prepare(`INSERT INTO tabs(parent_id, title, slug, type, content, position, admin_only, system)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const tabs = [
    ['Mural de Notícias', 'mural', 'posts', 'Fique por dentro do que acontece no CAEB e no curso de Ciências Biológicas.', 1],
    ['Eventos', 'eventos', 'events', 'Eventos organizados ou divulgados pelo CAEB.', 0],
    ['Mobilizações', 'mobilizacoes', 'posts', 'Pautas, assembleias e mobilizações estudantis.', 0],
    ['Calendário Acadêmico', 'calendario', 'calendar', 'Datas importantes do semestre. Os eventos da aba Eventos também aparecem aqui.', 0],
    ['Jornal Locus', 'locus', 'posts', 'O jornal dos estudantes de Biologia da UFPR.', 0],
    ['Cardápio do RU', 'cardapio-ru', 'cardapio', 'Cardápio do Restaurante Universitário. Consulte também o site oficial: https://pra.ufpr.br/ru/', 0],
    ['Transmissões', 'transmissoes', 'videos', 'Lives, gravações de assembleias e outros vídeos do CAEB.', 0],
    ['Blog do CAEB', 'blog', 'blog', 'Espaço aberto para qualquer estudante com conta no site publicar. Seja respeitoso(a)!', 1],
    ['Memorial', 'memorial', 'memorial', 'A história das gestões do CAEB. Escolha uma chapa para ver o que foi feito.', 1],
    ['Denúncia', 'denuncia', 'denuncia', '', 1],
  ];
  tabs.forEach((t, i) => ins.run(null, t[0], t[1], t[2], t[3], i + 1, 0, t[4]));

  const manual = ins.run(null, 'Manual', 'manual', 'page',
    'Bem-vindo(a) ao manual da administração do site do CAEB. Escolha um tópico abaixo. Só contas administrativas conseguem ver esta aba.',
    99, 1, 1);
  MANUAL_PAGES.forEach((p, i) => ins.run(manual.lastInsertRowid, p.title, p.slug, 'page', p.content, i + 1, 1, 0));

  setSetting.run('home_tab', 'mural');
}
seed();

// ---------- Funções auxiliares ----------
const settingsCache = { data: null };
function getSettings() {
  if (!settingsCache.data) {
    settingsCache.data = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));
  }
  return settingsCache.data;
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)').run(key, value);
  settingsCache.data = null;
}
function currentChapa() {
  return db.prepare('SELECT * FROM chapas WHERE is_current = 1 ORDER BY id DESC LIMIT 1').get();
}

module.exports = { db, DATA_DIR, getSettings, setSetting, currentChapa };
