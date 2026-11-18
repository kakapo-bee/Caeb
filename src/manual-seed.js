// Textos iniciais do Manual (aba visível só para contas administrativas).
// Depois que o site é criado, esses textos ficam no banco de dados e podem ser
// editados pelo próprio site (botão "✎ Editar texto" em cada página do Manual).
const MANUAL_PAGES = [
  {
    title: 'Primeiros passos',
    slug: 'manual-primeiros-passos',
    content: `## Bem-vindo(a) à administração do site do CAEB!

Se você está lendo isto, sua conta é **administrativa**. Isso quer dizer que você pode mudar quase tudo no site.

### Os tipos de conta
| Conta | O que pode fazer |
|---|---|
| **Administrativa — Presidência** | Tudo que a Geral faz. |
| **Administrativa — Acolhimento** | Tudo que a Geral faz **e** é a ÚNICA que lê as denúncias. |
| **Administrativa — Geral** | Publicar e editar em todas as abas, criar/apagar abas, mudar a gestão atual, promover e rebaixar contas, moderar o blog, editar este Manual. |
| **Discente** | Ver o site, publicar e curtir no Blog, mandar denúncias, editar o próprio perfil. |

### Onde ficam as ferramentas
- **Botões dentro de cada aba**: quando você está logado(a) com conta administrativa, cada aba mostra os botões **+ Nova publicação**, **✎ Editar texto** e **⚙ Aba**.
- **Menu "⚙️ Admin"** (no fim da barra de abas, ou clicando na sua foto → Administração): abas, chapas, usuários e configurações.

### Regra de ouro
Tudo que você apaga **some para sempre**. Na dúvida, prefira **ocultar** (abas) ou **editar** em vez de apagar.`,
  },
  {
    title: 'Publicar nas abas',
    slug: 'manual-publicar',
    content: `## Como publicar uma notícia, evento, edição do Locus, vídeo...

1. Clique na aba onde quer publicar (ex.: **Mural de Notícias**).
2. Clique no botão azul **+ Nova publicação** (o nome muda conforme a aba: "Novo evento", "Novo vídeo", "Adicionar refeição"...).
3. Preencha o **título** e o **texto**. Use a barra de formatação para negrito, listas, links etc. O botão **👁 Ver como fica** mostra uma prévia.
4. Se quiser, coloque uma **imagem de capa**, um **arquivo anexo** (PDF do jornal, edital, ata...) ou um **vídeo**.
5. Marque **📌 Fixar no topo** para deixar a publicação sempre em primeiro lugar.
6. Em **Registrar no memorial da chapa**, deixe a chapa atual (já vem marcada). Assim a publicação aparece no Memorial da gestão.
7. Clique em **Publicar**.

### Editar ou apagar uma publicação
Abra a publicação (clique no título) e use os botões **✎ Editar** ou **🗑 Apagar** no fim da página.

### Dicas por aba
- **Eventos**: a data é obrigatória. Eventos futuros aparecem em "Próximos eventos"; quando a data passa, vão sozinhos para "Eventos anteriores". Eles também aparecem automaticamente no Calendário Acadêmico (em verde).
- **Calendário Acadêmico**: cada publicação é uma data (ex.: "Início das aulas"). Para períodos, preencha também "Até". Passe o mouse em um dia e clique no **+** para adicionar uma data nele.
- **Jornal Locus**: crie uma publicação por edição e envie o **PDF como anexo**. O leitor vê o PDF direto no site.
- **Cardápio do RU**: cada publicação é uma refeição de um dia (título "Almoço", "Jantar"...; no texto, os pratos — um por linha ou em lista). Use o **+ refeição** dentro de cada dia.
- **Transmissões**: cole o link do YouTube (também funciona para lives), Vimeo ou Google Drive, **ou** envie o arquivo de vídeo (mp4). Vídeos longos ocupam muito espaço no servidor — prefira o YouTube.

### Texto de apresentação da aba
O botão **✎ Editar texto** muda o texto que aparece no topo da aba (aquele quadro com a borda verde). Em abas do tipo "Página de texto", esse texto É a página inteira.`,
  },
  {
    title: 'Abas e sub-abas',
    slug: 'manual-abas',
    content: `## Criar, mudar e organizar as abas

Vá em **⚙️ Admin → 🗂 Abas**.

### Criar uma aba nova
1. Em **Criar nova aba**, escreva o nome.
2. Escolha o **tipo**:
   - **Publicações**: lista de posts (como o Mural).
   - **Eventos**: publicações com data, separadas em próximos/anteriores.
   - **Calendário**: grade do mês.
   - **Cardápio**: semana com refeições por dia.
   - **Vídeos**: galeria de vídeos.
   - **Página de texto simples**: só um texto (ótimo para "Quem somos", "Contatos", "Estatuto"...).
3. Em **Fica dentro de**, deixe "nenhuma" para ser uma aba do menu principal, ou escolha uma aba para que a nova vire uma **sub-aba** dela.
4. Clique em **+ Criar**. Ela já aparece no menu.

### Sub-abas
Sub-abas aparecem quando você passa o mouse sobre a aba-mãe (no celular, tocando na setinha ▾) e também como botões dentro da aba-mãe.

### Reordenar
Na lista de abas, use as setas **▲ ▼** para subir ou descer uma aba entre as suas irmãs.

### Editar uma aba
Clique em **Editar** ao lado da aba. Você pode mudar:
- **Nome no menu** e **endereço** (o que aparece depois de /t/ no link).
- **Tipo** (menos nas abas do sistema).
- **Fica dentro de** (transformar em sub-aba ou voltar para o menu principal).
- **Visível no menu**: desmarque para **ocultar** a aba de todo mundo que não é administração. Bom para preparar algo antes de lançar.
- **🔒 Só contas administrativas podem ver**: transforma a aba em área interna da gestão.

### Apagar
Abas "do sistema" (Mural, Blog, Memorial, Denúncia e Manual) não podem ser apagadas. As outras podem, mas **tudo que está dentro delas (sub-abas e publicações) é apagado junto**.

### Página inicial
Em **⚙️ Admin → Configurações** você escolhe qual aba aparece ao entrar no site (por padrão, o Mural de Notícias).`,
  },
  {
    title: 'Chapas, gestão atual e Memorial',
    slug: 'manual-chapas',
    content: `## A gestão atual

O selo **"Gestão ..."** no topo do site mostra a chapa que está na gestão do CAEB. Ele vem da chapa marcada como **gestão atual** em **⚙️ Admin → 🌱 Chapas e memorial**.

## Passo a passo da troca de gestão (todo ano)
1. **Cadastre a nova chapa** em Chapas (nome e período, ex.: "2026/2027").
2. Clique em **Tornar gestão atual** na nova chapa. O topo do site muda na hora, e as próximas publicações passam a ir para o memorial dela.
3. Peça para cada membro da nova chapa **criar a conta** no site (com o e-mail @ufpr.br).
4. Vá em **👥 Usuários**, procure cada pessoa e mude o cargo dela para **Administrativa — Presidência / Acolhimento / Geral**.
5. Ainda em Usuários, no quadro **Troca de gestão**, digite REBAIXAR e confirme: **todas** as contas administrativas, menos a sua, viram discentes. (Atenção: faça isso só **depois** de promover a nova chapa — ou promova de novo quem precisar.)
6. Por fim, peça para alguém da nova gestão **rebaixar a sua conta** (ninguém consegue mudar o próprio cargo).

## O Memorial
Na aba **Memorial**, qualquer pessoa escolhe uma chapa e vê:
- o **texto do memorial** (quem fez parte, o que foi feito, conquistas...);
- as **fotos**;
- todas as **publicações do site** feitas durante aquela gestão.

### Chapas de antes do site existir
1. Em Chapas, cadastre a chapa antiga (ex.: "Raízes", "2019/2020"). **Não** clique em "Tornar gestão atual".
2. Clique em **✎ Editar memorial e fotos**, escreva o texto e envie as fotos (dá para escolher várias de uma vez).
3. Se quiser colocar uma publicação antiga em uma chapa, ao criar/editar a publicação escolha a chapa em **Registrar no memorial da chapa**.`,
  },
  {
    title: 'Contas, cargos e moderação do blog',
    slug: 'manual-usuarios',
    content: `## Promover e rebaixar contas
Em **⚙️ Admin → 👥 Usuários**:
- Busque pelo nome ou e-mail.
- Na coluna **Cargo**, escolha o novo cargo — ele é salvo na hora.
- Você **não consegue mudar o seu próprio cargo**. Isso evita que alguém fique sem acesso por engano e garante que só **outra** conta administrativa pode promover/rebaixar.

Também dá para mudar o cargo direto no **perfil** da pessoa (clicando no nome dela em qualquer post).

## Moderação do Blog do CAEB
- **Apagar postagem**: abra a postagem e clique em **🗑 Apagar (moderação)**.
- **Bloquear alguém de postar**: na postagem, clique em **🚫 Bloquear autor(a) no blog**; ou em Usuários, clique em **✅ Pode postar** (vira **🚫 Bloqueado(a)**). A pessoa continua podendo ler, curtir e usar o resto do site.
- **Desbloquear**: em Usuários, clique em **🚫 Bloqueado(a)**; ou no perfil da pessoa, **✅ Desbloquear no blog**.

## Perfis
Cada pessoa edita o próprio perfil em **Minha conta**: nome de usuário, foto redonda, descrição de até 300 caracteres e senha. Ninguém, nem a administração, consegue mudar a descrição de outra pessoa.`,
  },
  {
    title: 'Denúncias (Acolhimento)',
    slug: 'manual-denuncias',
    content: `## Como funciona o canal de denúncias

- Qualquer pessoa **com conta** pode enviar uma denúncia na aba **Denúncia**.
- A pessoa escolhe se envia **de forma anônima** (já vem marcado) ou identificada.
- **Somente contas "Administrativa — Acolhimento"** conseguem ler as denúncias. Presidência e Geral **não** têm acesso — nem por endereço direto.
- Denúncias **anônimas** não guardam nenhuma ligação com a conta de quem enviou (nem a hora exata, só o dia). Ninguém consegue descobrir o autor, nem quem cuida do servidor.

## Para quem é do Acolhimento
- Quando há denúncias novas, aparece um aviso amarelo **"N novas"** no topo do site, ao lado da sua foto.
- Abra **Caixa de denúncias** (clicando no aviso, na sua foto → 💙 Caixa de denúncias, ou na aba Denúncia).
- Em cada denúncia você pode mudar o **status** (Nova → Em andamento → Concluída) e escrever **anotações internas** (só o acolhimento vê).
- Nas denúncias identificadas aparece o nome, o e-mail e o contato preferido da pessoa. Ela vê o status da denúncia na aba Denúncia.
- Trate tudo com **sigilo**. Não tire prints nem compartilhe fora da equipe de acolhimento.`,
  },
  {
    title: 'Configurações e parte técnica',
    slug: 'manual-tecnico',
    content: `## Configurações do site
Em **⚙️ Admin → Configurações** você muda o nome do site no topo, o subtítulo, o texto do rodapé, o Instagram, o e-mail de contato e a página inicial.

## Parte técnica (para quem cuida do servidor)
- O código do site está no repositório do GitHub do CAEB. Leia o arquivo **README.md** para instalar e colocar no ar.
- Todos os dados (contas, publicações, denúncias) ficam no arquivo **data/caeb.db** e os arquivos enviados na pasta **data/uploads**. **Faça backup dessa pasta "data" regularmente!**
- As senhas e configurações secretas ficam no arquivo **.env** do servidor (nunca no GitHub).
- O e-mail de confirmação de conta é enviado pela conta configurada em SMTP_USER / SMTP_PASS no .env. Para Gmail, é preciso usar uma **Senha de app** (veja o README).
- Para promover a primeira conta (quando ainda não existe nenhuma administrativa), rode no servidor:
  \`npm run promover -- email@ufpr.br presidente\``,
  },
];

module.exports = { MANUAL_PAGES };
