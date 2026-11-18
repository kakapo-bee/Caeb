# Site do CAEB — Centro Acadêmico de Estudos Biológicos (UFPR)

Site completo do CAEB, com abas editáveis, blog dos estudantes, memorial das chapas, canal de denúncias sigiloso e painel de administração.

Feito com **Node.js + Express + SQLite** (um único arquivo de banco de dados, sem precisar instalar servidor de banco).

## O que tem no site

| Aba | O que faz |
|---|---|
| **Mural de Notícias** (página inicial) | Notícias e avisos da gestão. |
| **Eventos** | Eventos com data, local e horário; separa próximos e anteriores. |
| **Mobilizações** | Pautas, assembleias, mobilizações. |
| **Calendário Acadêmico** | Grade mensal com datas (os Eventos também aparecem nele). |
| **Jornal Locus** | Edições do jornal (com PDF anexo, que abre direto no site). |
| **Cardápio do RU** | Refeições organizadas por dia da semana. |
| **Transmissões** | Vídeos do YouTube/Vimeo/Drive ou enviados direto (mp4). |
| **Blog do CAEB** | Qualquer estudante com conta posta; todos curtem. |
| **Memorial** | Escolhe uma chapa e vê texto, fotos e tudo que foi publicado na gestão dela. |
| **Denúncia** | Denúncias anônimas ou identificadas, lidas **somente** pelo Acolhimento. |
| **Manual** 🔒 | Só para contas administrativas: ensina a mexer em tudo (textos editáveis). |

Todas as abas podem ser renomeadas, reordenadas, ocultadas e ganhar sub-abas. Novas abas podem ser criadas pelo painel.

### Contas
- **Administrativa — Presidência / Acolhimento / Geral**: editam o site. Só o **Acolhimento** lê denúncias.
- **Discente**: posta no blog, curte, envia denúncias, edita o próprio perfil.
- Cadastro só com e-mail **@ufpr.br**, confirmado por um e-mail com o botão **Confirmar**.
- Só uma conta administrativa promove/rebaixa outra (ninguém muda o próprio cargo).

---

## 1. Rodar no seu computador (para testar)

Precisa do [Node.js](https://nodejs.org) versão 20 ou mais nova.

```bash
npm install
cp .env.example .env        # no Windows: copy .env.example .env
npm start
```

Abra http://localhost:3000.

> Se o `SMTP_PASS` estiver vazio no `.env`, o site **não envia e-mail**: o link de confirmação aparece no terminal onde você rodou `npm start`. Bom para testar.

### Criar a primeira conta administrativa
1. Crie uma conta normalmente pelo site (`Criar conta`) e confirme pelo link.
2. No terminal, na pasta do projeto:
   ```bash
   npm run promover -- seuemail@ufpr.br presidente
   ```
3. Pronto: essa conta já pode promover as outras pelo próprio site (**⚙️ Admin → Usuários**).

---

## 2. Configurar o e-mail botsitecaeb@gmail.com

O Gmail **não aceita a senha normal da conta** para enviar e-mails por programas. É preciso criar uma **Senha de app**:

1. Entre em https://myaccount.google.com com a conta `botsitecaeb@gmail.com`.
2. **Segurança → Verificação em duas etapas** → ative (é obrigatório para ter senha de app).
3. Acesse https://myaccount.google.com/apppasswords, crie uma senha com o nome "Site CAEB".
4. O Google mostra 16 letras (ex.: `abcd efgh ijkl mnop`). Coloque no `.env`:
   ```
   SMTP_USER=botsitecaeb@gmail.com
   SMTP_PASS=abcdefghijklmnop
   ```
5. Reinicie o site.

> ⚠️ **Nunca** coloque o `.env` no GitHub (ele já está no `.gitignore`). Como a senha da conta do Gmail foi compartilhada em conversa, é recomendável **trocá-la** ao ativar a verificação em duas etapas.

---

## 3. Colocar o site no ar

O site precisa de um servidor que **guarde arquivos permanentemente** (a pasta `data/`, onde ficam o banco e as imagens). Opções:

### Opção A — Railway (mais fácil)
1. Crie uma conta em https://railway.app e escolha **New Project → Deploy from GitHub repo** com este repositório.
2. Em **Variables**, adicione as variáveis do `.env.example` (com `NODE_ENV=production`, `BASE_URL=https://seu-endereco`, `DATA_DIR=/data`, `SESSION_SECRET`, `SMTP_PASS`...).
3. Em **Settings → Volumes**, crie um volume montado em `/data`.
4. Em **Settings → Networking**, gere um domínio. Coloque esse endereço em `BASE_URL`.

### Opção B — Render
1. https://render.com → **New → Web Service** → conecte o repositório.
2. Build command: `npm install` · Start command: `npm start`.
3. Adicione um **Disk** montado em `/data` (plano pago) e a variável `DATA_DIR=/data`, mais as do `.env.example`.

### Opção C — Servidor próprio / VPS / servidor da UFPR (com Docker)
```bash
docker build -t site-caeb .
docker run -d --name caeb -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data --restart unless-stopped site-caeb
```
Use um proxy (Nginx/Caddy) com HTTPS na frente, apontando para a porta 3000.

### Domínio próprio
Depois de no ar, dá para usar um domínio como `caeb.com.br` configurando o DNS no painel do serviço escolhido. Lembre de atualizar `BASE_URL`.

---

## 4. Backup
Tudo fica na pasta `data/` (`caeb.db` + `uploads/`). Copie essa pasta regularmente. Para restaurar, é só colocar a pasta de volta.

## 5. Estrutura do código

```
src/
  server.js          configuração principal
  db.js              banco de dados (tabelas e dados iniciais)
  manual-seed.js     textos iniciais do Manual
  mailer.js          envio de e-mails
  middleware.js      login, permissões, uploads
  tabs-helper.js     menu de abas e sub-abas
  util.js            funções auxiliares (datas, markdown, cargos)
  routes/            páginas (auth, conta, blog, denúncias, admin, abas)
  views/             telas (templates EJS)
public/              CSS, JavaScript e logo
scripts/promover.js  promove uma conta pelo terminal
```

## Segurança e privacidade
- Senhas guardadas com bcrypt (ninguém vê a senha).
- Links de confirmação e de senha guardados só como hash e com validade.
- Proteção contra envio de formulários de outros sites, limite de tentativas de login e cabeçalhos de segurança.
- Denúncias anônimas não guardam a conta de quem enviou nem a hora exata. O site não grava logs de acesso.
- A rota das denúncias responde "página não encontrada" para qualquer conta que não seja Acolhimento.
