// Processo principal do launcher (Electron).
// - Abre a janela do launcher (campo do @, escolha do jogo e JOGAR).
// - Le o catalogo de jogos (pasta launcher/jogos e jogos instalados depois).
// - Ao clicar em JOGAR: valida a licenca, abre o jogo escolhido numa janela 9:16
//   e liga a conexao com a live.
// - Repassa os eventos da live para a janela do jogo e o status para as duas janelas.

import { app, BrowserWindow, ipcMain, Menu, screen, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerConfig, salvarConfig, configDoJogo } from './config.js';
import { validarLicenca } from './licenca.js';
import { SessaoLive } from './sessaoLive.js';
import { carregarJogos, listarJogos, obterJogo, resumoDoJogo } from './jogos.js';
import { registrarEsquemaDeJogos, atenderEsquemaDeJogos, urlDoJogo, ESQUEMA } from './protocolo.js';
import { TIPOS, STATUS } from '../live/eventos.js';

const PASTA_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Tempo maximo esperando o jogo chamar conectarPlataforma() antes de ligar a live mesmo assim.
const ESPERA_JOGO_PRONTO_MS = 10000;
const PASTA_APP = path.join(PASTA_SRC, '..');
const MODO_DEV = process.argv.includes('--dev');

// Titulo fixo para qualquer jogo: e por ele que o streamer acha a janela no
// TikTok LIVE Studio, entao a captura continua funcionando ao trocar de jogo.
const TITULO_JOGO = 'Pista Viva - Jogo';

let janelaLauncher = null;
let janelaJogo = null;
let jogoAtual = null;
let arrobaAtual = '';
let ultimoStatus = { status: STATUS.PARADO, mensagem: 'Desligado.', simulador: false };
let contadores = novosContadores();
let avisosJogos = [];
let avisarJogoPronto = null; // resolve a espera do JOGAR quando o jogo chama conectarPlataforma()

const sessao = new SessaoLive();

// O esquema jogo:// precisa ser registrado antes do app ficar pronto.
registrarEsquemaDeJogos();

// ------------------------------------------------------------------ uma instancia so
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janelaLauncher) {
      if (janelaLauncher.isMinimized()) janelaLauncher.restore();
      janelaLauncher.focus();
    }
  });
  app.whenReady().then(iniciarApp);
}

function iniciarApp() {
  Menu.setApplicationMenu(null);
  // Nenhuma pagina (launcher ou jogo) recebe camera, microfone, notificacoes,
  // area de transferencia etc. Por padrao o Electron liberaria tudo sem perguntar.
  session.defaultSession.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  atenderEsquemaDeJogos({ obterJogo, pastaSdk: path.join(PASTA_SRC, 'sdk') });
  atualizarCatalogo();
  registrarIpc();
  ligarSessao();
  criarJanelaLauncher();
}

app.on('window-all-closed', () => app.quit());

let saindo = false;
app.on('before-quit', (evento) => {
  if (saindo || !sessao.ativa) return;
  evento.preventDefault();
  saindo = true;
  sessao.parar().finally(() => app.quit());
});

// Nenhuma janela pode abrir popups nem navegar para fora do proprio conteudo.
app.on('web-contents-created', (_e, conteudo) => {
  conteudo.setWindowOpenHandler(() => ({ action: 'deny' }));
  conteudo.on('will-navigate', (evento) => evento.preventDefault());
});

process.on('unhandledRejection', (erro) => {
  console.error('[launcher] erro nao tratado:', erro);
});

// ------------------------------------------------------------------ catalogo de jogos

function pastasDeJogos() {
  return [
    path.join(PASTA_APP, 'jogos'),                 // jogos que vem com o launcher
    path.join(app.getPath('userData'), 'jogos')    // jogos instalados depois
  ];
}

function atualizarCatalogo() {
  const { avisos } = carregarJogos(pastasDeJogos());
  // So mostra no terminal quando os avisos mudam (o catalogo e relido a cada JOGAR).
  if (avisos.join('\n') !== avisosJogos.join('\n')) {
    for (const aviso of avisos) console.warn(`[jogos] ${aviso}`);
  }
  avisosJogos = avisos;
}

// ------------------------------------------------------------------ janelas

function opcoesWeb(preload) {
  return {
    preload: path.join(PASTA_SRC, 'preload', preload),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  };
}

function criarJanelaLauncher() {
  const area = screen.getPrimaryDisplay().workAreaSize;

  janelaLauncher = new BrowserWindow({
    width: 460,
    height: Math.min(760, area.height - 20),
    resizable: false,
    maximizable: false,
    title: 'Pista Viva',
    backgroundColor: '#0f1220',
    show: false,
    webPreferences: opcoesWeb('launcher.cjs')
  });

  janelaLauncher.loadFile(path.join(PASTA_SRC, 'renderer', 'launcher', 'index.html'));
  janelaLauncher.once('ready-to-show', () => janelaLauncher.show());
  if (MODO_DEV) janelaLauncher.webContents.openDevTools({ mode: 'detach' });

  janelaLauncher.on('closed', () => {
    janelaLauncher = null;
    if (janelaJogo) janelaJogo.destroy();
  });
}

function tamanhoJanelaJogo() {
  // 9:16, o maior que couber na tela (limite 540x960).
  const area = screen.getPrimaryDisplay().workAreaSize;
  const altura = Math.min(960, area.height - 40);
  const largura = Math.round((altura * 9) / 16);
  return { largura, altura };
}

function criarJanelaJogo(jogo) {
  return new Promise((resolver, rejeitar) => {
    const { largura, altura } = tamanhoJanelaJogo();

    janelaJogo = new BrowserWindow({
      width: largura,
      height: altura,
      useContentSize: true,
      title: TITULO_JOGO,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: {
        ...opcoesWeb('jogo.cjs'),
        // Continua desenhando mesmo minimizada ou coberta por outra janela:
        // senao a captura no TikTok LIVE Studio congela.
        backgroundThrottling: false
      }
    });

    janelaJogo.setAspectRatio(9 / 16);
    // Mantem o titulo fixo mesmo que a pagina do jogo tente trocar.
    janelaJogo.on('page-title-updated', (e) => e.preventDefault());

    const conteudo = janelaJogo.webContents;
    // Um jogo nao pode impedir o PARAR (ex.: aviso "deseja sair da pagina?").
    conteudo.on('will-prevent-unload', (e) => e.preventDefault());
    conteudo.once('did-finish-load', () => resolver());
    conteudo.on('did-fail-load', (_e, codigo, descricao, _url, framePrincipal) => {
      if (framePrincipal) rejeitar(new Error(`o jogo "${jogo.nome}" não abriu (${descricao || codigo}).`));
    });
    conteudo.once('render-process-gone', (_e, detalhes) => {
      rejeitar(new Error(`o jogo "${jogo.nome}" parou ao abrir (${detalhes.reason}).`));
    });
    if (MODO_DEV) conteudo.openDevTools({ mode: 'detach' });

    janelaJogo.on('closed', () => {
      janelaJogo = null;
      jogoAtual = null;
      if (avisarJogoPronto) avisarJogoPronto(); // nao deixa o JOGAR esperando a toa
      avisarJogoPronto = null;
      sessao.parar();
      enviar(janelaLauncher, 'launcher:jogando', false);
      // Se a janela fechar antes de terminar de abrir, o JOGAR nao fica travado.
      rejeitar(new Error('a janela do jogo foi fechada antes de terminar de abrir.'));
    });

    janelaJogo.loadURL(urlDoJogo(jogo));
  });
}

// Espera o jogo chamar conectarPlataforma() (ou o tempo limite). Assim a live so
// comeca a mandar eventos quando o jogo ja esta ouvindo e nenhum se perde.
function esperarJogoPronto() {
  return new Promise((resolver) => {
    const limite = setTimeout(resolver, ESPERA_JOGO_PRONTO_MS);
    avisarJogoPronto = () => {
      clearTimeout(limite);
      resolver();
    };
  });
}

function enviar(janela, canal, dados) {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dados);
}

// ------------------------------------------------------------------ sessao da live

function ligarSessao() {
  sessao.on('status', (status) => {
    ultimoStatus = status;
    enviar(janelaLauncher, 'live:status', status);
    enviar(janelaJogo, 'live:status', status);
  });

  sessao.on('evento', (evento) => {
    enviar(janelaJogo, 'live:evento', evento);
    if (contar(evento)) enviar(janelaLauncher, 'live:contadores', contadores);
  });
}

function novosContadores() {
  return { comentarios: 0, presentes: 0, curtidas: 0 };
}

function contar(evento) {
  if (evento.tipo === TIPOS.COMENTARIO) contadores.comentarios += 1;
  else if (evento.tipo === TIPOS.PRESENTE && evento.dados.final) contadores.presentes += evento.dados.quantidade;
  else if (evento.tipo === TIPOS.CURTIDA) contadores.curtidas += evento.dados.quantidade;
  else return false;
  return true;
}

// Aceita "nome", "@nome" ou o link do perfil/live.
function normalizarArroba(texto) {
  let valor = String(texto || '').trim();
  const doLink = valor.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (doLink) valor = doLink[1];
  return valor.replace(/^@+/, '').trim();
}

async function jogar({ arroba, simulador, jogo: idDoJogo } = {}) {
  if (janelaJogo) {
    janelaJogo.focus();
    return { ok: true };
  }

  const nome = normalizarArroba(arroba);
  const modoTeste = Boolean(simulador);

  if (!modoTeste) {
    if (!nome) return { ok: false, erro: 'Digite o @ do TikTok.' };
    if (!/^[A-Za-z0-9._]{1,30}$/.test(nome)) {
      return { ok: false, erro: 'Esse @ tem caracteres inválidos. Use só letras, números, ponto e sublinhado.' };
    }
  }

  // Le as pastas de novo: um jogo adicionado ou corrigido com o launcher aberto ja vale.
  atualizarCatalogo();
  const jogo = obterJogo(String(idDoJogo || ''));
  if (!jogo) {
    if (!listarJogos().length) return { ok: false, erro: 'Nenhum jogo instalado.' };
    if (idDoJogo) return { ok: false, erro: 'Esse jogo não pôde ser carregado. Veja o aviso em amarelo e escolha outro.' };
    return { ok: false, erro: 'Escolha um jogo na lista.' };
  }

  const licenca = await validarLicenca();
  if (!licenca.ok) return { ok: false, erro: licenca.mensagem || 'Plano inativo.' };

  salvarConfig({ arroba: nome, simulador: modoTeste, jogo: jogo.id });
  arrobaAtual = modoTeste ? (nome || 'teste') : nome;
  jogoAtual = jogo;
  contadores = novosContadores();
  enviar(janelaLauncher, 'live:contadores', contadores);

  const jogoPronto = esperarJogoPronto();
  try {
    await criarJanelaJogo(jogo);
  } catch (erro) {
    if (janelaJogo) janelaJogo.destroy();
    return { ok: false, erro: `Não foi possível abrir: ${erro.message}` };
  }

  await jogoPronto;
  if (!janelaJogo) return { ok: false, erro: '' }; // fechada (ou PARAR) enquanto abria

  await sessao.iniciar({
    arroba: arrobaAtual,
    simulador: modoTeste,
    chaveEuler: process.env.EULER_API_KEY
  });

  enviar(janelaLauncher, 'launcher:jogando', true);
  return { ok: true };
}

// ------------------------------------------------------------------ IPC

function registrarIpc() {
  ipcMain.handle('launcher:carregar', () => {
    atualizarCatalogo();
    return {
      config: lerConfig(),
      jogos: listarJogos().map(resumoDoJogo),
      avisosJogos,
      jogoAtual: resumoDoJogo(jogoAtual),
      status: ultimoStatus,
      jogando: Boolean(janelaJogo),
      contadores,
      versao: app.getVersion(),
      tituloJogo: TITULO_JOGO
    };
  });

  ipcMain.handle('launcher:jogar', async (_e, dados) => {
    try {
      return await jogar(dados);
    } catch (erro) {
      console.error('[launcher] falha no JOGAR:', erro);
      return { ok: false, erro: `Não foi possível iniciar: ${erro.message}` };
    }
  });

  ipcMain.handle('launcher:parar', () => {
    if (janelaJogo) janelaJogo.destroy();
    return { ok: true };
  });

  // So a janela do jogo, carregada pelo esquema jogo://, recebe os dados da partida.
  ipcMain.handle('jogo:pronto', (evento) => {
    const remetente = evento.senderFrame?.url || '';
    if (!janelaJogo || evento.sender !== janelaJogo.webContents || !remetente.startsWith(`${ESQUEMA}://`)) {
      return null;
    }
    const resposta = {
      arroba: arrobaAtual,
      status: ultimoStatus,
      jogo: resumoDoJogo(jogoAtual),
      config: jogoAtual ? configDoJogo(jogoAtual.id) : {}
    };
    // Libera a live depois desta resposta: os eventos chegam ao jogo depois dos dados da partida.
    if (avisarJogoPronto) setImmediate(avisarJogoPronto);
    avisarJogoPronto = null;
    return resposta;
  });
}
