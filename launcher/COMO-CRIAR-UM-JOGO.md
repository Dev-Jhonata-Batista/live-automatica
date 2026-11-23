# Como criar um jogo novo

O launcher é uma plataforma: cada jogo é uma pasta dentro de `launcher/jogos/`. O launcher lê essas pastas quando abre, quando você volta para a janela dele e a cada JOGAR. Ele mostra os jogos na lista "Escolha o jogo" e abre o escolhido na janela **Pista Viva - Jogo** (9:16), já recebendo os eventos da live.

## 1. Criar a pasta do jogo

No PowerShell, dentro da pasta `launcher`:

```powershell
npm run novo-jogo -- quiz "Quiz da Live"
```

- `quiz` é o **id**: começa com uma letra e usa só letras minúsculas, números e hífen (ex.: `jogo-2048`). Ele vira o nome da pasta.
- `"Quiz da Live"` é o **nome** que aparece na lista do launcher.

Isso copia a pasta `modelo-jogo` para `jogos/quiz/`. Rode `npm start` (ou, se o launcher já estiver aberto, clique na janela dele) e o jogo aparece na lista. O modelo só mostra os últimos eventos da live; a partir daí, você troca pela lógica do seu jogo.

## 2. O que tem na pasta

```
jogos/quiz/
├── jogo.json     <- ficha do jogo (obrigatório)
├── index.html    <- página do jogo
├── jogo.js       <- lógica do jogo
└── jogo.css      <- visual
```

Imagens, sons e fontes podem ficar em subpastas (ex.: `jogos/quiz/imagens/carro.png`) e são usados com caminho relativo: `imagens/carro.png`.

## 3. O arquivo jogo.json

```json
{
  "id": "quiz",
  "nome": "Quiz da Live",
  "versao": "0.1.0",
  "descricao": "Uma frase que aparece embaixo do nome na lista.",
  "entrada": "index.html",
  "cor": "#38bdf8",
  "ordem": 50
}
```

| Campo | Obrigatório | O que é |
|---|---|---|
| `id` | sim | Igual ao nome da pasta. Começa com letra; depois letras minúsculas, números e hífen, até 40 caracteres. |
| `nome` | sim | Nome mostrado no launcher (até 40 caracteres). |
| `versao` | não | Texto da versão, mostrado ao lado do nome. |
| `descricao` | não | Uma frase curta (até 140 caracteres). |
| `entrada` | não | Página inicial do jogo. Padrão: `index.html`. |
| `cor` | não | Cor do quadradinho na lista, no formato `#RRGGBB`. |
| `ordem` | não | Posição na lista (menor aparece primeiro). Padrão: 100. |
| `presentes` | não | Liga o quadro **Presentes → ações** no launcher. Formato: `{ "niveis": [ { "id": "pequeno", "nome": "Pequeno: NITRO" } ], "padrao": "texto de ajuda" }`. O jogo recebe a escolha do streamer em `info.config.presentes` (`{ "Rose": "pequeno" }`). Exemplo completo em `jogos/fuga-neon/jogo.json`. |
| `meta` | não | `true` liga os campos **Meta da live** no launcher. O jogo recebe em `info.config.meta` (`{ ativa, presente, quantidade, recompensa }`). |

O watchdog do launcher funciona sozinho para qualquer jogo: se a página travar, ela é reaberta. Para o jogo não perder estado importante numa reabertura, guarde no `localStorage` (o Fuga Neon guarda os recordes assim).

Se o `jogo.json` tiver erro, o jogo não aparece na lista e o launcher mostra o motivo em amarelo, logo abaixo dela.

## 4. O SDK (funções que todo jogo pode usar)

Todo jogo importa o SDK pelo caminho `/_sdk/...`, que o launcher entrega para qualquer jogo. O `<script>` do jogo precisa ser `type="module"`:

```html
<script type="module" src="jogo.js"></script>
```

```js
import { conectarPlataforma } from '/_sdk/plataforma.js';
import { criarPalco } from '/_sdk/palco.js';
import { TIPOS, STATUS } from '/_sdk/tipos.js';

// Palco fixo de 1080x1920 que se ajusta ao tamanho da janela.
criarPalco(document.getElementById('palco'));

const info = await conectarPlataforma({
  aoEvento(evento) { /* comentários, presentes... */ },
  aoStatus(status) { /* conectado, offline, erro... */ }
});
// info = { arroba, status, jogo: { id, nome, versao, descricao, cor }, config }
```

- **`conectarPlataforma`** liga o jogo à live e devolve os dados da partida. O launcher só começa a mandar eventos depois que o jogo chama essa função, então nenhum comentário ou presente se perde enquanto o jogo carrega imagens e sons. Chame ela uma vez, no início do jogo; se o jogo não chamar em 10 segundos, a live liga mesmo assim. `config` é a configuração salva deste jogo: por enquanto vem vazia, e na Fase 4 vai guardar qual presente faz qual ação.
- **`criarPalco`** desenha tudo numa área de 1080x1920 e escala para a janela. Use sempre medidas em px pensando em 1080 de largura.
- **`TIPOS` e `STATUS`** são os nomes dos eventos e dos status (abaixo).

## 5. Eventos que o jogo recebe

Todo evento tem o mesmo formato, venha do TikTok ou do modo teste:

```js
{
  id: 'b1c2...',            // único
  tipo: 'comentario',       // um dos TIPOS abaixo
  plataforma: 'tiktok',     // ou 'simulador'
  horario: 1760000000000,
  usuario: { id, arroba, nome, foto },  // null em espectadores/live_encerrada
  dados: { ... }            // depende do tipo
}
```

| `tipo` | `dados` |
|---|---|
| `comentario` | `{ texto }` |
| `presente` | `{ presenteId, nome, moedas, quantidade, final, comboId, imagem }` |
| `curtida` | `{ quantidade, totalDaLive }` |
| `seguiu` | `{}` |
| `compartilhou` | `{}` |
| `entrou` | `{}` |
| `espectadores` | `{ total }` |
| `live_encerrada` | `{}` |

Presentes em combo chegam várias vezes com o mesmo `comboId` e a `quantidade` subindo (`final: false`), e uma última vez com `final: true`. Para contar cada presente uma vez só, use apenas os eventos com `final: true`.

Status (`aoStatus`): `{ status, mensagem, simulador }`, onde `status` é `conectando`, `conectado`, `offline`, `reconectando`, `erro` ou `parado`.

## 6. Regras de segurança (já aplicadas pelo launcher)

- O jogo só carrega arquivos da própria pasta e do SDK. Scripts da internet (CDN) são bloqueados; copie as bibliotecas para dentro da pasta do jogo.
- Imagens da internet (`https://`) são permitidas, para mostrar a foto de perfil de quem comentou.
- Um jogo não consegue ler os arquivos de outro jogo nem sair da própria página.
- Câmera, microfone, notificações e área de transferência ficam bloqueados.
- O PARAR sempre fecha o jogo, mesmo que ele tente perguntar "deseja sair da página?".
- Áudio e vídeo (`.mp3`, `.ogg`, `.wav`, `.mp4`, `.webm`) tocam normalmente a partir da pasta do jogo.
- Escreva nomes e comentários sempre com `textContent`, nunca com `innerHTML`: eles vêm de estranhos e poderiam conter código.

## 7. Instalar um jogo sem mexer no launcher

Além de `launcher/jogos/`, o launcher também lê `%APPDATA%\Pista Viva\jogos\`. Uma pasta de jogo copiada para lá aparece na lista sem reinstalar o launcher, e ela tem prioridade se tiver o mesmo `id` de um jogo que já vem com ele. Nas Fases 5 e 8, é por essa pasta que jogos novos vão chegar pelo servidor e pela atualização automática.

Para abrir essa pasta: aperte `Windows + R`, digite `%APPDATA%\Pista Viva` e dê Enter (crie a pasta `jogos` se não existir).

## 8. Testar

- `npm start`, escolha o jogo, marque **Modo teste** e clique em **JOGAR**.
- `npm run dev` abre as ferramentas de desenvolvedor nas janelas; os erros do seu jogo aparecem na aba **Console** da janela do jogo.
- Depois de editar os arquivos do jogo, clique em **PARAR** e em **JOGAR** de novo para recarregar.
