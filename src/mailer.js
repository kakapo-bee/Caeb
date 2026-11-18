// Envio de e-mails (confirmação de conta e recuperação de senha)
// Usa a conta configurada no arquivo .env (SMTP_USER / SMTP_PASS).
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} else {
  console.warn('[e-mail] SMTP_USER/SMTP_PASS não configurados: os links serão apenas mostrados no terminal.');
}

function layout(title, html) {
  return `<!doctype html><html><body style="margin:0;background:#eef5fb;font-family:Arial,Helvetica,sans-serif;color:#17324d">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d6e4f0">
    <div style="background:linear-gradient(135deg,#1170c6,#167a2e);padding:22px 28px;color:#fff">
      <div style="font-size:20px;font-weight:bold">CAEB UFPR</div>
      <div style="font-size:13px;opacity:.9">Centro Acadêmico de Estudos Biológicos</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 14px;font-size:20px">${title}</h2>
      ${html}
    </div>
  </div></body></html>`;
}

function button(href, label) {
  return `<p style="text-align:center;margin:26px 0"><a href="${href}" style="background:#1170c6;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:bold;display:inline-block">${label}</a></p>`;
}

async function send(to, subject, html, text) {
  if (!transporter) {
    console.log(`\n[e-mail simulado] Para: ${to}\nAssunto: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({
    from: `"CAEB UFPR" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to, subject, html, text,
  });
}

function sendConfirmation(to, username, link) {
  return send(to, 'Confirme a criação da sua conta no site do CAEB',
    layout(`Olá, ${escapeHtml(username)}!`, `
      <p>Recebemos um pedido para criar uma conta no site do <b>Centro Acadêmico de Estudos Biológicos (CAEB) da UFPR</b> com este e-mail.</p>
      <p>Para criar a conta, clique em <b>Confirmar</b>:</p>
      ${button(link, 'Confirmar')}
      <p style="font-size:13px;color:#5b7189">O link vale por 24 horas. Se não foi você quem pediu, é só ignorar este e-mail — nenhuma conta será criada.</p>`),
    `Olá, ${username}! Para confirmar a criação da sua conta no site do CAEB, acesse: ${link}\nSe não foi você, ignore este e-mail.`);
}

function sendReset(to, username, link) {
  return send(to, 'Redefinição de senha — site do CAEB',
    layout(`Olá, ${escapeHtml(username)}!`, `
      <p>Recebemos um pedido para redefinir a senha da sua conta no site do CAEB.</p>
      ${button(link, 'Criar nova senha')}
      <p style="font-size:13px;color:#5b7189">O link vale por 1 hora. Se não foi você, ignore este e-mail.</p>`),
    `Para redefinir sua senha no site do CAEB, acesse: ${link}`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { sendConfirmation, sendReset };
