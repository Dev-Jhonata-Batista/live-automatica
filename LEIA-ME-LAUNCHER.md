# Pista Viva (nome provisório) — Live interativa para TikTok

> "Pista Viva" é só um nome de trabalho. Troque quando escolher o nome e a marca definitivos.

Estrutura atual:

```
live-automatica/
├── LEIA-ME.md                  <- este arquivo
├── fase1-conector/             <- Fase 1: leitor de live no terminal (ferramenta de teste)
│   ├── package.json
│   └── src/
│       ├── eventos.js          <- formato de evento padrão (TikTok hoje, YouTube depois)
│       ├── tiktok.js           <- adaptador do TikTok + reconexão automática
│       ├── simulador.js        <- live falsa para testar sem ninguém ao vivo
│       └── index.js            <- mostra tudo no terminal
└── launcher/                   <- Fases 2 e 3: o programa que o streamer abre (Electron)
    ├── package.json
    ├── COMO-CRIAR-UM-JOGO.md   <- guia para criar e adicionar jogos novos
    ├── jogos/                  <- cada pasta aqui é um jogo que aparece na lista
    │   ├── fuga-neon/          <- 0.4: ladrões x polícia (veja a seção 7)
    │   └── corrida/            <- Fase 3: a corrida (veja a seção 6)
    │       ├── jogo.json       <- ficha do jogo
    │       ├── index.html      <- tela: canvas da pista + placar
    │       ├── jogo.css        <- visual do placar, painel e pódio
    │       ├── jogo.js         <- liga tudo: live, corrida, desenho e placar
    │       ├── regras.js       <- NÚMEROS DO JOGO: distância, tempos, vagas (mude aqui)
    │       ├── entrada.js      <- entende "carro"/"moto" nos comentários
    │       ├── corrida.js      <- fases, movimento e posições (sem desenho)
    │       ├── cena.js         <- desenha pista, veículos, nomes e efeitos
    │       ├── placar.js       <- topo, chamada, painel e pódio
    │       ├── fotos.js        <- fotos de perfil
    │       ├── aviso-de-erro.js <- mostra na tela um erro que impeça o jogo de abrir
    │       └── veiculos/
    │           ├── catalogo.js <- MODELOS DE VEÍCULO (adicione novos aqui)
    │           └── desenhos.js <- arte de cada modelo, feita em código
    ├── modelo-jogo/            <- ponto de partida copiado pelo "npm run novo-jogo"
    ├── scripts/
    │   ├── novo-jogo.js        <- cria jogos/<id> a partir do modelo
    │   └── relatorio.js        <- 0.4: relatório da live a partir do banco de eventos
    └── src/
        ├── main/
        │   ├── main.js         <- abre as janelas, liga a live, repassa os eventos
        │   ├── jogos.js        <- catálogo: lê e valida as pastas de jogos
        │   ├── protocolo.js    <- jogo://: entrega os arquivos de cada jogo com segurança
        │   ├── sessaoLive.js   <- liga/desliga a conexão (real ou modo teste)
        │   ├── config.js       <- salva o último @, o jogo escolhido, a config de cada jogo e a rotação
        │   ├── banco.js        <- 0.4: grava todo evento no SQLite local (métricas)
        │   └── licenca.js      <- validação do plano (vazio até a Fase 5)
        ├── live/               <- eventos.js, tiktok.js e simulador.js (vieram da Fase 1)
        ├── sdk/                <- funções comuns a todos os jogos (/_sdk/...)
        │   ├── plataforma.js   <- liga o jogo à live
        │   ├── palco.js        <- palco 1080x1920 que escala para a janela
        │   └── tipos.js        <- nomes dos eventos e status
        ├── preload/
        │   ├── launcher.cjs    <- ponte segura launcher <-> processo principal
        │   └── jogo.cjs        <- ponte segura jogo <-> processo principal
        └── renderer/
            └── launcher/       <- tela do launcher (index.html, launcher.css, launcher.js)
```

---

## 1. O que instalar no Windows

Abra o VS Code, menu **Terminal > New Terminal** (é um PowerShell). Para cada item: rode o comando de conferir; se der erro ou versão menor que a pedida, instale e **feche e abra o terminal de novo** antes de conferir outra vez.

| Item | Precisa para | Versão | Instalar (PowerShell) | Conferir |
|---|---|---|---|---|
| Node.js (já vem com npm) | Fases 1 a 4, 6, 8 | 22.12 ou maior (use a LTS) | `winget install OpenJS.NodeJS.LTS` | `node -v` e `npm -v` |
| Git | Todas | qualquer recente | `winget install Git.Git` | `git --version` |
| Python | Fases 5 a 8 (Django) | 3.12 ou 3.13 | `winget install Python.Python.3.13` | `py --version` e `py -m pip --version` |
| PostgreSQL | Fases 5 a 8 | 16 ou maior | instalador em https://www.postgresql.org/download/windows/ | `psql --version` |

Observações:

- **Para a Fase 1 você só precisa de Node.js e Git.** Python e PostgreSQL podem esperar a Fase 5.
- Se `winget` não existir, baixe pelo site oficial: https://nodejs.org (botão LTS), https://git-scm.com/download/win, https://www.python.org/downloads/windows/ (marque **"Add python.exe to PATH"**).
- No Windows, use `py` em vez de `python`: o `python` às vezes abre a Microsoft Store.
- O instalador do PostgreSQL pede uma senha para o usuário `postgres`. **Anote**, vamos usar na Fase 5. Se `psql --version` não for encontrado, adicione ao PATH a pasta `C:\Program Files\PostgreSQL\<versão>\bin` (Configurações > Sistema > Sobre > Configurações avançadas do sistema > Variáveis de Ambiente > Path > Novo) e reabra o terminal.
- Se o `npm` der o erro **"a execução de scripts foi desabilitada neste sistema"**, rode uma vez:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
  e responda `S`. Isso libera scripts locais só para o seu usuário.

---

## 2. Fase 1 — Ler comentários e presentes da live no terminal

### Instalar

1. Extraia o `.zip` em uma pasta sem acentos, por exemplo `C:\projetos\live-automatica`.
2. No VS Code: **File > Open Folder** e abra `C:\projetos\live-automatica`.
3. No terminal do VS Code:

```powershell
cd fase1-conector
npm install
```

### Testar sem live (simulador)

```powershell
npm run simular
```

Deve aparecer comentários ("carro", "moto"...), combos de presente subindo (`x1, x2, x3...`) e a linha final do presente. `Ctrl+C` para sair.

### Ligar numa live de verdade

Escolha alguém que esteja **ao vivo agora** (pode ser você mesmo) e rode:

```powershell
npm start -- nomedostreamer
```

O `--` é obrigatório: é ele que passa o nome para o script. Digite o nome **sem o @**: no PowerShell o `@` é um símbolo especial e dá erro (ou use aspas: `"@nome"`).

Outras opções:

```powershell
npm start -- nomedostreamer --tudo     # mostra também quem entrou e o número de espectadores
npm start -- nomedostreamer --debug    # mostra os dados originais que o TikTok mandou
```

Com chave do Euler Stream (opcional, só se aparecer erro de limite):

```powershell
$env:EULER_API_KEY = "sua-chave"
npm start -- nomedostreamer
```

### O que você deve ver

```
20:01:10 [CONECTANDO] Conectando na live de @nomedostreamer...
20:01:13 [CONECTADO] Conectado na live de @nomedostreamer (sala 7412...).
20:01:15 COMENTARIO @fulano: carro <- quer entrar de CARRO
20:01:18   combo em andamento: @ciclano Rose x3
20:01:19 PRESENTE   @ciclano enviou Rose x5 (1 moeda cada)
```

Se o @ não estiver ao vivo, aparece `[OFFLINE]` e o script tenta de novo a cada 30 s sozinho. Se cair, ele reconecta (5 s, 10 s, 20 s, 40 s e depois a cada 60 s).

---

## 3. Decisões técnicas da Fase 1

- **Biblioteca `tiktok-live-connector` 2.5.0, versão fixa:** é a mais usada em Node.js e não existe API pública oficial do TikTok para ler eventos da live (o próprio README da biblioteca diz isso). Versão fixa para uma atualização do npm não quebrar o projeto sem você saber.
- **Formato de evento padrão (`src/eventos.js`):** o jogo só vai conhecer `comentario`, `presente`, `curtida` etc., nunca os campos do TikTok; para aceitar YouTube depois, basta criar outro adaptador.
- **Combo de presente:** o TikTok manda um evento a cada presente do combo e um último com o combo fechado. Mandamos todos com `final: false/true` e `quantidade`; o jogo decide se age a cada um ou só no final (decisão da Fase 4).
- **Reconexão automática no próprio adaptador:** o launcher da Fase 2 só vai ler o status (conectado, offline, erro), sem lógica extra.
- **Simulador no mesmo formato:** dá para construir o jogo nas Fases 3 e 4 sem precisar de alguém ao vivo.
- **JavaScript puro com módulos ES (sem TypeScript):** menos ferramentas para instalar; o launcher em Electron vai reaproveitar estes arquivos como estão.

Dois detalhes que conferi na biblioteca instalada (e não no README dela, que está desatualizado):

- os campos reais vêm do `tiktok-live-proto/v3`: o @ está em `user.displayId`, o texto em `content` e o presente em `gift.name`. O código lê os nomes novos e os antigos, por segurança;
- o construtor quebra se for chamado sem o objeto de opções; o código sempre passa um.

Para conferir se algum campo mudou: rode com `--debug` numa live real e compare com `node_modules/tiktok-live-connector/README.md` e `node_modules/tiktok-live-proto/dist/node/v3.d.ts`.

---

## 4. Riscos da conexão com a live (leia antes de vender)

- **Não é oficial.** A biblioteca imita o site do TikTok. Os Termos de Uso do TikTok restringem coletar dados da plataforma por meios automatizados. A leitura é anônima (não usa a conta do streamer), mas o risco de bloqueio e jurídico existe. Confira em https://www.tiktok.com/legal/page/global/terms-of-service/pt-BR.
- **Pode quebrar sem aviso** quando o TikTok muda o protocolo. A correção depende de os mantenedores atualizarem a biblioteca, e você vai precisar mandar uma atualização do launcher (por isso a atualização automática da Fase 8 é importante).
- **Depende de um serviço de terceiros (Euler Stream)** para assinar a conexão. O uso gratuito tem limite de conexões; com muitos clientes simultâneos provavelmente será preciso uma chave paga. Preços e limites: https://www.eulerstream.com.  Não confirmei se o limite gratuito conta por IP ou no total; isso muda o custo quando houver muitos clientes.
- **Licença:** a biblioteca é AGPL-3.0 com exceções. A seção 18 libera explicitamente "TikTok LIVE games" sem obrigar você a abrir o código, mas a seção 19 retira essa liberação para uso "comercial, closed-source ou SaaS", especialmente servidores que repassam os eventos. Rodar no PC do streamer (nossa arquitetura) é o caso mais seguro; **passar os eventos pelo seu servidor (uma opção para o Android) cairia na seção 19**. Como você vai cobrar assinatura, recomendo confirmar com os autores antes do lançamento: texto completo em `node_modules/tiktok-live-connector/LICENSE`.

---

## 5. Fase 2 — Launcher com vários jogos, @, JOGAR e janela do jogo

O launcher é uma plataforma de jogos: cada jogo é uma pasta em `launcher/jogos/`, e o streamer escolhe qual jogar numa lista. A Corrida é o primeiro jogo. Para criar outros, veja [COMO-CRIAR-UM-JOGO.md](launcher/COMO-CRIAR-UM-JOGO.md).

### Instalar

Extraia o zip **fora do OneDrive**, em `C:\projetos`: o Electron ocupa uns 250 MB em `node_modules` e o OneDrive tenta sincronizar tudo, o que deixa a instalação lenta e pode travar arquivos.

```powershell
New-Item -ItemType Directory -Force C:\projetos
Expand-Archive -Path "$env:USERPROFILE\Downloads\live-automatica-fase2-jogos.zip" -DestinationPath C:\projetos -Force
cd C:\projetos\live-automatica\launcher
npm install
```

O `npm install` baixa o Electron (cerca de 120 MB), então demora um pouco. Se o zip não estiver em Downloads, troque o caminho no segundo comando. Se você já tinha extraído a versão anterior, o `-Force` substitui os arquivos; rode o `npm install` de novo mesmo assim. A pasta antiga `launcher\src\renderer\jogo` pode ser apagada: ela não é mais usada.

### Rodar

```powershell
npm start
```

Abre a janela do launcher. Para testar:

1. Em **Escolha o jogo**, deixe **Corrida** selecionado. Marque **Modo teste** e clique em **JOGAR**. Abre a janela **Pista Viva - Jogo** (9:16) com a corrida (o que ela mostra está na seção 6). No launcher, o status fica verde e os contadores sobem.
2. Clique em **PARAR** (ou feche a janela do jogo). A conexão desliga e o botão volta para JOGAR.
3. Crie um segundo jogo de teste. Feche o launcher e rode:
   ```powershell
   npm run novo-jogo -- teste "Jogo de Teste"
   npm start
   ```
   O **Jogo de Teste** aparece na lista. Escolha ele, clique em **JOGAR** e veja os eventos chegando. Para apagar depois, delete a pasta `jogos\teste`.
4. Desmarque **Modo teste**, escolha a Corrida, digite o @ de alguém que está ao vivo agora e clique em **JOGAR**.
5. Se o @ não estiver ao vivo, o status fica "Live offline" e o launcher tenta de novo a cada 30 s sozinho.

Para ver erros do código: `npm run dev` (abre as ferramentas de desenvolvedor nas duas janelas).

### Capturar no TikTok LIVE Studio

Com a janela do jogo aberta, adicione no LIVE Studio uma fonte de captura de janela e escolha **Pista Viva - Jogo**. Não confirmei o nome exato do botão no LIVE Studio em português; procure algo como "Captura de janela" ou "Janela" na lista de fontes. A janela pode ser redimensionada, mas mantém sempre 9:16. O título é o mesmo para todos os jogos, então a captura continua funcionando quando você troca de jogo.

### Decisões técnicas da Fase 2

- **Electron em vez de Tauri:** a biblioteca de live é Node.js; o Electron roda ela direto no processo principal, enquanto o Tauri exigiria Rust e um processo Node separado.
- **Cada jogo é uma pasta com um `jogo.json`:** adicionar um jogo é colocar a pasta em `launcher/jogos/`, sem mexer no código do launcher. Pasta com erro não derruba o launcher: ela é ignorada e o motivo aparece embaixo da lista.
- **Protocolo próprio `jogo://` em vez de abrir o arquivo direto:** cada jogo só lê a própria pasta e o SDK, não enxerga os outros jogos, não carrega scripts da internet e não navega para fora. Isso importa porque, no futuro, jogos vão chegar pelo servidor.
- **SDK comum em `/_sdk/`:** ligação com a live, palco 9:16 e nomes dos eventos ficam num lugar só; todo jogo usa as mesmas funções e o mesmo formato de evento.
- **Segunda pasta de jogos em `%APPDATA%\Pista Viva\jogos`:** permite instalar ou atualizar um jogo sem reinstalar o launcher. É por ela que as Fases 5 e 8 vão entregar jogos novos.
- **Configuração separada por jogo (`configJogos`):** cada jogo vai ter o próprio menu de presente → ação na Fase 4, sem um interferir no outro.
- **Eventos por IPC (comunicação interna do Electron):** a conexão roda no processo principal e manda os eventos para a janela do jogo, sem servidor local nem porta aberta.
- **Segurança das páginas:** não têm acesso ao Node (`contextIsolation` + `sandbox`); só enxergam `window.launcher` e `window.live`. Nomes e comentários são escritos sempre como texto, então um comentário malicioso não executa código.
- **Título fixo "Pista Viva - Jogo" e proporção travada em 9:16:** o LIVE Studio acha a janela pelo título. O jogo é desenhado num palco fixo de 1080x1920 que é redimensionado para caber na janela.
- **Pasta `src/live` copiada da Fase 1:** o launcher precisa ser independente para virar instalador na Fase 8. A pasta `fase1-conector` continua como ferramenta de teste no terminal.
- **`licenca.js` sempre libera por enquanto:** na Fase 5 ele passa a consultar o servidor antes do JOGAR.
- **Configuração em `%APPDATA%\Pista Viva\config.json`:** guarda o último @, o modo teste e o último jogo, que já aparecem preenchidos ao abrir.
- **Electron 44.5.1 fixo:** versão estável recente; fixar evita que uma atualização mude o comportamento sem aviso.

---

## 6. Fase 3 — Corrida: quem comenta CARRO ou MOTO entra na pista

### O que esta fase entrega

- **Entrada pelo comentário:** quem comenta `carro` ou `moto` (com ou sem acento e maiúscula, em qualquer parte da frase, ou o emoji 🚗/🏍️) entra na pista com um veículo, o @ e a posição em cima. Comentar o outro tipo antes da largada troca o veículo. Menções não contam: "oi @carros_do_ze" não coloca ninguém na pista.
- **6 modelos com arte própria**, desenhados em código e pintados com a cor de cada jogador: carros **Cometa**, **Tatu** e **Bolinha**; motos **Faísca**, **Pipoca** e **Cabrita**. O modelo e a cor saem do @, então a pessoa costuma correr sempre com o mesmo.
- **Corridas automáticas, sem você clicar em nada:**

| Fase na tela | O que acontece |
|---|---|
| AGUARDANDO | Quem comenta entra no grid. A contagem "LARGADA EM" começa no 1º piloto e vai até o JÁ!: 40 s de espera mais o 3, 2, 1 (a espera cai para 8 s se as 30 vagas encherem). Sem ninguém, aparece "Pista vazia!" com os modelos. |
| LARGADA | 3, 2, 1, JÁ! Ainda dá para entrar no grid. |
| EM CORRIDA | 6.000 m, uns 4 min e 30 s. A câmera segue o líder (coroa e brilho dourado). Quem comenta entra 12 m atrás do último, até faltarem 800 m; se o veículo nascer fora da tela, aparece "@fulano ENTROU!" na beirada de baixo da pista. |
| CHEGADA | O 1º cruzou a linha. O jogo espera os outros até 25 s. |
| RESULTADO | Pódio por 12 s: os 3 primeiros, o tempo do 1º e quanto o 2º e o 3º chegaram depois (ex.: +0,08 s). Depois começa a próxima corrida sozinha. |

- **Fila:** quem comenta com a corrida cheia ou perto do fim entra sozinho na próxima corrida, na ordem em que pediu (até 60 pessoas na fila). Vale também para quem acabou de correr e quer correr de novo.
- **Topo da tela:** número da corrida, fase, cronômetro (ou contagem para a largada), líder e metros que faltam.
- **Painel de baixo:** quem entrou, quem assumiu a liderança, quem chegou. Pedidos de fila em sequência viram uma linha só ("@fulano e mais 7 estão na fila").
- **Modo teste com 40 espectadores falsos** comentando carro/moto, para ver o grid enchendo e gente entrando no meio da corrida.
- **Presentes ainda não fazem nada na corrida:** isso é a Fase 4.

### Instalar

O `npm install` é o mesmo da Fase 2 (não entrou nenhuma biblioteca nova), mas rode de novo por garantia.

```powershell
New-Item -ItemType Directory -Force C:\projetos
Expand-Archive -Path "$env:USERPROFILE\Downloads\live-automatica-fase3.zip" -DestinationPath C:\projetos -Force
cd C:\projetos\live-automatica\launcher
npm install
npm start
```

O `-Force` substitui os arquivos da versão anterior. Se você criou jogos de teste em `launcher\jogos`, eles continuam lá.

### Testar

1. **Modo teste:** escolha **Corrida**, marque **Modo teste** e clique em **JOGAR**. Você deve ver, em ordem: "Pista vazia!" por um instante; o grid enchendo com carros e motos e a contagem "LARGADA EM" no topo; 3, 2, 1, JÁ!; a corrida com a câmera seguindo o líder; a chegada com confete; o pódio; e a próxima corrida começando com quem estava na fila.
2. **Ver uma corrida inteira rápido:** no VS Code, abra `launcher\jogos\corrida\regras.js`, troque `distanciaM: 6000` por `distanciaM: 1500` e `esperaS: 40` por `esperaS: 10`, salve e clique em **PARAR** e **JOGAR**. A corrida passa a durar uns 70 s. **Volte para 6000 e 40 antes de usar na live.**
3. **Live de verdade:** desmarque **Modo teste**, digite o seu @ (sem o @), comece uma live e clique em **JOGAR**. Comente `carro` pelo celular: o seu @ entra no grid. Peça para alguém comentar `moto`.
4. **Capturar no LIVE Studio:** igual à seção 5 (captura da janela **Pista Viva - Jogo**).

Para ver erros: `npm run dev` e a aba **Console** da janela do jogo. No Console, `corrida` mostra o estado da corrida (fase, pilotos, fila).

### Como a tela está dividida (1080 x 1920)

| Altura | O que tem |
|---|---|
| 0 a 100 | Marca, @ do streamer e aviso de conexão (some quando está conectado; no modo teste mostra "MODO TESTE") |
| 100 a 320 | Placar e a chamada "Comente CARRO ou MOTO..." |
| 330 a 1530 | Pista (é aqui que a corrida acontece) |
| 1540 a 1900 | Painel com os últimos acontecimentos |

No celular de quem assiste, o TikTok coloca comentários e botões por cima do vídeo, principalmente embaixo e no topo. Por isso o que importa (a pista e os nomes) fica no meio, e o painel de baixo só repete o que já aparece na pista. Não encontrei medidas oficiais dessas áreas para LIVE; confira numa live real se algo importante ficou coberto e me mande um print.

### Adicionar um modelo de veículo

Tudo fica em `launcher\jogos\corrida\veiculos\catalogo.js`, que explica os campos no começo do arquivo. Duas formas:

- **Com uma imagem PNG** (o jeito mais fácil): coloque a imagem em `launcher\jogos\corrida\veiculos\imagens\` (crie a pasta), vista de cima, com a frente para **cima**, fundo transparente e nome do arquivo sem espaços nem acentos (ex.: `foguete.png`). Depois acrescente uma linha na lista `CATALOGO`:
  ```js
  { id: 'foguete', tipo: 'carro', nome: 'Foguete', larguraM: 2.6, comprimentoM: 4.8, velocidade: 1, aceleracao: 5, imagem: 'veiculos/imagens/foguete.png' },
  ```
  A imagem não muda de cor por jogador (os modelos desenhados em código mudam).
- **Desenhado em código:** copie uma das funções de `veiculos\desenhos.js`, mude o desenho e use `desenho: suaFuncao` no lugar de `imagem`.

Clique em **PARAR** e **JOGAR** para ver (a tela "Pista vazia!" mostra os 9 primeiros modelos da lista). Se algum campo estiver errado (por exemplo, `comprimentoM` acima de 6, que não cabe no grid), o modelo é ignorado e o motivo aparece no Console (`npm run dev`); se a imagem não existir, o veículo aparece com a arte de um modelo do mesmo tipo. Se o arquivo ficar com erro de digitação (uma vírgula ou chave faltando), o jogo não abre e a janela do jogo mostra o erro, o arquivo e a linha; corrija, salve e clique em **PARAR** e **JOGAR**. O mesmo vale para `regras.js`.

### Mudar as regras

Os números da corrida estão em `launcher\jogos\corrida\regras.js`, com um comentário em cada um. Os mais úteis:

| Campo | Padrão | O que muda |
|---|---|---|
| `distanciaM` | 6000 | Tamanho da pista. Com a velocidade padrão, 6.000 m dá uns 4 min e 30 s. |
| `esperaS` | 40 | Segundos para entrar antes da largada. |
| `maxCorredores` | 30 | Vagas por corrida. Mais que isso fica difícil de ler no celular. |
| `entrarComCorridaAndando` | true | `false` manda quem comenta durante a corrida para a fila da próxima. |
| `resultadoS` | 12 | Tempo do pódio na tela. |

### Decisões técnicas da Fase 3

- **Canvas 2D puro em vez do Phaser:** a corrida é uma pista e veículos subindo; o canvas resolve sem baixar biblioteca nenhuma, e scripts de fora seriam bloqueados pela segurança do launcher de qualquer jeito.
- **Pista vertical com câmera seguindo o líder:** aproveita o formato 9:16 e deixa os veículos e os nomes grandes o bastante para ler no celular.
- **Arte dos veículos feita em código:** é original, pinta cada veículo com a cor do jogador e não precisa de arquivos de imagem. PNG também é aceito, para quando houver arte de um designer.
- **Vácuo:** quem está atrás do 1º anda até 10% mais rápido. Sem isso o pelotão se espalha por centenas de metros e a maioria some da tela; com isso a corrida fica parelha e quem vai decidir são os presentes da Fase 4.
- **Regras separadas do desenho (`corrida.js` não desenha nada):** testei corridas inteiras no Node sem abrir janela, e a Fase 4 só acrescenta as ações em cima.
- **A corrida anda em passos fixos de 1/60 s:** o resultado é o mesmo num PC rápido ou lento.
- **Fila para a próxima corrida:** ninguém que comentou é ignorado, e quem pediu primeiro larga mais na frente.
- **Nome que não cabe vira só o número da posição:** com 30 pilotos juntos, evita um nome em cima do outro. O líder escolhe o lugar primeiro, depois os 6 primeiros, na ordem da corrida; entre os outros, quem já está com o nome na tela mantém o lugar, para os nomes não piscarem.
- **Ninguém atravessa ninguém:** quem alcança alguém mais lento na mesma faixa troca de faixa ou segue atrás.
- **Quem cruza a chegada sai da pista em 2 segundos:** segue no embalo (sem frear na frente de quem vem atrás) e some, para não travar quem ainda está correndo.
- **Placar e painel em HTML por cima do canvas:** texto nítido e fácil de ajustar no `jogo.css`.

### O que fica para a Fase 4

Presentes viram ações (nitro, óleo, míssil, escudo, bomba, empurrão), combos que fortalecem a ação, ranking dos 6 primeiros com a diferença em metros, barra de progresso da largada à chegada, feed de presentes e de ataques, avisos como "RODOU!" em cima do veículo e o menu presente → ação no launcher.

---

## 7. Versão 0.4 — Fuga Neon, banco de eventos, watchdog, presente → ação e rotação

### O que tem de novo

- **Jogo Fuga Neon** (primeiro da lista): ladrões x polícia numa cidade neon tropical, com nome, arte e cidade originais.
  - Quem comenta **LADRÃO** (ou `L`, 💰) ou **POLÍCIA** (ou `P`, `PM`, 🚓) entra numa equipe. A equipe vale a noite toda; dá para trocar antes do assalto.
  - Rodada de 3 a 4 minutos: **ESCOLHA SEU LADO** (25 s) → **ASSALTO** (20 s, cofre x alarme decide a vantagem inicial) → **FUGA** (até 2 min 30 s) → **RESULTADO** (12 s). A próxima começa sozinha, em outro bairro.
  - Na fuga, a polícia encosta sozinha. Comentário, curtida, follow e compartilhamento de quem está numa equipe empurram a distância; aparece o @ da pessoa na tela na hora.
  - Presentes viram ações pelo nível: pequeno = NITRO / SIRENE, médio = BOMBA DE FUMAÇA / BLOQUEIO, grande = ATALHO SECRETO / HELICÓPTERO, mega = ESCUDO NEON / PROCURADO MÁXIMO. Quem manda presente sem ter escolhido lado entra na equipe menor.
  - Chance de virada até o fim: ninguém é preso no primeiro minuto da fuga, as ações rendem menos perto do fim, reta final com ações valendo 1,5x, eventos surpresa a cada 3 rodadas (chuva, apagão, engarrafamento).
  - Placar da noite entre equipes, destaque de cada equipe na rodada, **destaques da noite** com o @, recordes (maior fuga e captura mais rápida) que ficam salvos de uma noite para outra.
  - **Meta da live** opcional (desligada por padrão): ex.: 100 Rose liberam a FESTA NEON (toda ação vale o dobro por 18 s).
- **Banco de eventos**: todo comentário, curtida, follow, compartilhamento, presente (com moedas) e o número de espectadores vão para `%APPDATA%\Pista Viva\eventos.sqlite`. O modo teste também grava, marcado como teste.
- **Relatório**: `npm run relatorio` monta o relatório da última live (duração, espectadores, presentes e moedas por jogo e por hora, top doadores).
- **Watchdog**: se o jogo travar ou cair, o launcher reabre o jogo **na mesma janela** (a captura não perde a fonte). Se a live ficar 5 minutos "conectada" sem nenhum evento, religa a conexão. A reconexão automática da Fase 1 continua. Tudo fica anotado em `%APPDATA%\Pista Viva\launcher.log`.
- **Presentes → ações** no launcher: escolha qual presente é qual nível, para cada jogo.
- **Rotação automática**: troca de jogo sozinho a cada X minutos ou quando o engajamento cair (ex.: 50% abaixo do melhor momento daquele jogo). Com a live rodando, clicar em outro jogo na lista troca na hora.
- **PARAR** desliga o watchdog primeiro, depois a conexão, depois fecha o jogo e fecha a sessão no banco.

### Instalar (pelo repositório)

O código agora está no seu repositório. No VS Code, **Terminal > New Terminal** e rode, uma linha por vez:

```powershell
cd $HOME\live-automatica
git fetch origin
git switch gerente/inicio
git pull
cd launcher
npm install
npm start
```

`git switch gerente/inicio` pega a versão nova (que ainda está no pull request). Depois do merge do PR, troque por `git switch main` e `git pull`. O `npm install` baixa o Electron de novo nesta pasta (uns 120 MB).

Precisa do Node 22.13 ou maior (`node -v`). Se aparecer `No such built-in module: node:sqlite`, atualize o Node: `winget upgrade OpenJS.NodeJS.LTS`.

### Testar (modo teste)

1. Em **Escolha o jogo**, deixe **Fuga Neon**. Marque **Modo teste** e clique em **JOGAR**.
2. Você deve ver: "ESCOLHA SEU LADO" com a contagem; @ entrando na gangue ou na polícia; "ASSALTO!" com a barra cofre x alarme; "FUGA!" com o carro roxo na frente e as viaturas atrás; textos com @ e ações (NITRO, HELICÓPTERO...) aparecendo em cima dos carros; o resultado (FUGIRAM! ou PRESOS!) e a próxima rodada em outro bairro.
3. Abra **Presentes → ações**, coloque `Rose` = Pequeno e `Galaxy` = Mega, clique em **Salvar**, depois **PARAR** e **JOGAR**. A legenda no canto de baixo passa a mostrar esses nomes.
4. Abra **Rotação automática**, marque os dois jogos e ponha 5 minutos. Depois de 5 minutos jogando, a janela troca sozinha para a Corrida (o aviso aparece no launcher).
5. Clique em **PARAR** e rode `npm run relatorio -- --teste`. Aparece o relatório da sessão de teste e o arquivo fica em `launcher\relatorios\`.

Para ver uma rodada inteira mais rápido: em `launcher\jogos\fuga-neon\regras.js`, troque `fugaS: 150` por `fugaS: 70` e `capturaLiberadaS: 60` por `capturaLiberadaS: 20`. **Volte os números antes da live.**

### Decisões técnicas da 0.4

- **SQLite embutido do Node (`node:sqlite`) em vez de uma biblioteca:** não precisa instalar nem compilar nada no Windows; se não estiver disponível, grava em `eventos.jsonl` e o relatório lê do mesmo jeito.
- **Só o fim do combo vai para o banco:** o TikTok manda um aviso a cada presente do combo; gravar só o último evita contar em dobro.
- **Moedas, não diamantes:** a biblioteca informa o valor do presente em moedas. O número oficial de diamantes é o do TikTok Studio; o relatório deixa um campo para anotar.
- **Watchdog reabre na mesma janela:** fechar e abrir outra janela faria o LIVE Studio perder a fonte de captura.
- **Limite de 5 reaberturas em 10 minutos:** se o jogo quebra sempre, ficar reabrindo esconde o problema; o launcher avisa.
- **Rotação por queda compara com o melhor momento do próprio jogo:** comparar com um número fixo não funcionaria com 10 ou com 1.000 espectadores.
- **Escolher o lado é grátis (comentário) e os presentes só dão ações:** as Diretrizes de Monetização de LIVE do TikTok tiram a monetização de quem só apresenta dois lados e pede presentes. Nada na tela diz "mande presente para o seu lado ganhar".
- **Níveis de presente por moedas quando não configurado:** o jogo funciona com qualquer presente, inclusive os que ainda não conhecemos.
- **Sem armas, sangue ou violência realista:** perseguição de desenho animado com fumaça, bloqueio e helicóptero. Cidade, bairros, banco e letreiros são inventados.
