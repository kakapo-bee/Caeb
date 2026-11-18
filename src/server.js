// Ponto de entrada do site do CAEB
require('dotenv').config({ quiet: true });
process.env.TZ = 'America/Sao_Paulo';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { db, getSettings, currentChapa } = require('./db');
const util = require('./util');
const { SqliteStore, sameOrigin, UPLOAD_DIR } = require('./middleware');
const { navTree } = require('./tabs-helper');

const app = express();
const PROD = process.env.NODE_ENV === 'production';
if (process.env.TRUST_PROXY !== 'false') app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'"],
      frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com', 'https://drive.google.com', "'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: PROD,
}));

app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: PROD ? '7d' : 0 }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: PROD ? '30d' : 0, setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
app.get('/favicon.ico', (req, res) => res.redirect('/static/img/favicon.png'));

app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.json({ limit: '100kb' }));

let secret = process.env.SESSION_SECRET;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[aviso] SESSION_SECRET não definido no .env — todos serão deslogados quando o servidor reiniciar.');
}
app.use(session({
  store: new SqliteStore(),
  secret,
  name: 'caeb.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PROD && process.env.COOKIE_SECURE !== 'false', maxAge: 30 * 86400e3 },
}));
app.use(sameOrigin);

// Carrega o usuário logado e as informações usadas em todas as páginas
app.use((req, res, next) => {
  req.user = null;
  if (req.session.userId) {
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId) || null;
    if (!req.user) delete req.session.userId;
  }
  const L = res.locals;
  L.user = req.user;
  L.isAdmin = util.isAdmin(req.user);
  L.settings = getSettings();
  L.chapa = currentChapa();
  L.nav = navTree(req.user);
  L.path = req.path;
  L.query = req.query;
  L.flash = req.session.flash || null;
  delete req.session.flash;
  L.u = util;
  L.title = '';
  L.newReports = req.user && req.user.role === 'acolhimento'
    ? db.prepare("SELECT COUNT(*) c FROM reports WHERE status = 'nova'").get().c : 0;
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/account'));
app.use(require('./routes/blog'));
app.use(require('./routes/reports'));
app.use(require('./routes/admin'));
app.use(require('./routes/tabs'));

app.use((req, res) => res.status(404).render('error', { title: 'Página não encontrada', message: 'A página que você procurou não existe ou foi removida.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  const L = res.locals;
  if (!L.settings) Object.assign(L, { user: null, isAdmin: false, settings: getSettings(), chapa: currentChapa(), nav: [], path: req.path, flash: null, u: util, newReports: 0 });
  res.status(500).render('error', { title: 'Erro', message: 'Algo deu errado. Tente novamente em instantes.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Site do CAEB rodando em http://localhost:${PORT}`));
