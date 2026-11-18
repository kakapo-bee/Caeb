// Funções utilitárias usadas em várias partes do site
const crypto = require('crypto');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const ROLES = {
  presidente: 'Administrativa — Presidência',
  acolhimento: 'Administrativa — Acolhimento',
  geral: 'Administrativa — Geral',
  discente: 'Discente',
};
const ADMIN_ROLES = ['presidente', 'acolhimento', 'geral'];
const isAdmin = (u) => !!u && ADMIN_ROLES.includes(u.role);

const TAB_TYPES = {
  posts: 'Publicações (notícias, textos, edições de jornal...)',
  events: 'Eventos (publicações com data, ordenadas por data)',
  calendar: 'Calendário (grade mensal de datas)',
  cardapio: 'Cardápio (refeições por dia)',
  videos: 'Vídeos / transmissões',
  page: 'Página de texto simples',
};
// tipos especiais que só existem uma vez e não podem ser criados de novo
const SPECIAL_TYPES = { blog: 'Blog do CAEB', memorial: 'Memorial', denuncia: 'Denúncia' };

marked.setOptions({ breaks: true, gfm: true });

function md(text) {
  const html = marked.parse(text || '');
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 'del']),
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
    },
  });
}

function plain(text, max = 220) {
  const t = sanitizeHtml(marked.parse(text || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'aba';
}

const TZ = 'America/Sao_Paulo';
// datas do SQLite (datetime('now')) estão em UTC no formato "AAAA-MM-DD HH:MM:SS"
function parseDb(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00Z');
  return new Date(s.replace(' ', 'T') + 'Z');
}
function fmtDateTime(s) {
  const d = parseDb(s); if (!d) return '';
  return d.toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(s) {
  const d = parseDb(s); if (!d) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtLongDate(s) {
  const d = parseDb(s); if (!d) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // AAAA-MM-DD
}

// Converte link do YouTube/Vimeo/Google Drive em endereço "embed"
function videoEmbed(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
}

const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const USERNAME_RE = /^[\p{L}\p{N} ._-]{3,30}$/u;

module.exports = {
  ROLES, ADMIN_ROLES, isAdmin, TAB_TYPES, SPECIAL_TYPES, md, plain, slugify,
  fmtDate, fmtDateTime, fmtLongDate, parseDb, MONTHS, MONTHS_FULL, todayISO, TZ,
  videoEmbed, newToken, hashToken, USERNAME_RE,
};
