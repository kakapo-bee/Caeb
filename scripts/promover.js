// Uso: npm run promover -- email@ufpr.br [presidente|acolhimento|geral|discente]
// Serve principalmente para criar a PRIMEIRA conta administrativa do site.
require('dotenv').config({ quiet: true });
const { db } = require('../src/db');
const { ROLES } = require('../src/util');

const [email, role = 'presidente'] = process.argv.slice(2);
if (!email || !ROLES[role]) {
  console.log('Uso: npm run promover -- email@ufpr.br [presidente|acolhimento|geral|discente]');
  process.exit(1);
}
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.log(`Nenhuma conta com o e-mail ${email}. A pessoa precisa criar a conta (e confirmar pelo e-mail) primeiro.`);
  process.exit(1);
}
db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
console.log(`Pronto! ${user.username} (${user.email}) agora é: ${ROLES[role]}`);
