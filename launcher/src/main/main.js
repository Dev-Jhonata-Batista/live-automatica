// Processo principal do launcher (Electron).
// - Abre a janela do launcher (campo do @, escolha do jogo e JOGAR).
// - Le o catalogo de jogos (pasta launcher/jogos e jogos instalados depois).
// - Ao clicar em JOGAR: valida a licenca, abre o jogo escolhido numa janela 9:16
//   e liga a conexao com a live.
// - Repassa os eventos da live para a janela do jogo e o status para as duas janelas.
// - Grava todo evento no banco local (banco.js) para as metricas.
// - Watchdog: reabre o jogo se ele travar ou fechar sozinho, e religa a conexao se
//   ela ficar muda por muito tempo.
// - Rotacao automatica: troca de jogo por tempo ou quando o engajamento cai, na
//   MESMA janela (a captura no LIVE Studio continua funcionando).

import { app, BrowserWindow, ipcMain, Menu, screen, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerConfig, salvarConfig, configDoJogo, salvarConfigDoJogo, lerRotacao, salvarRotacao } from './config.js';
import { abrirBanco } from './banco.js';
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
let banco = null;
let modoTesteAtual = false;

// Watchdog
const WATCHDOG_INTERVALO_MS = 5000;
const SEM_BATIMENTO_MS = 20000;          // jogo visivel sem desenhar por 20 s = travado
const CONEXAO_MUDA_MS = 5 * 60000;       // conectado e nenhum evento por 5 min = religa
const MAX_REINICIOS = 5;                 // no maximo 5 reinicios do jogo em 10 minutos
const JANELA_REINICIOS_MS = 10 * 60000;
let jogando = false;                     // true entre JOGAR e PARAR
let ultimoBatimento = 0;
let ultimoEventoLive = 0;
let reinicios = [];
let timerWatchdog = null;

// Rotacao
let inicioJogoAtual = 0;
let melhorRitmo = 0;                     // melhor media de interacoes/min do jogo atual
let ultimaChecagemRotacao = 0;

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
  abrirBanco(app.getPath('userData')).then((b) => {
    banco = b;
  });
}

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => banco?.fechar());

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
  registrar(`erro nao tratado: ${erro?.message || erro}`);
});
process.on('uncaughtException', (erro) => {
  // Um erro inesperado no processo principal nao pode derrubar a live.
  console.error('[launcher] excecao nao tratada:', erro);
  registrar(`excecao nao tratada: ${erro?.message || erro}`);
});

// Registro do watchdog e de erros em %APPDATA%\Pista Viva\launcher.log
function registrar(texto) {
  try {
    const linha = `${new Date().toISOString()} ${texto}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'launcher.log'), linha, 'utf8');
  } catch {
    // sem log, segue
  }
}

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

    // Watchdog: depois de aberto, se o jogo cair ou travar, reabre na mesma janela.
    conteudo.on('render-process-gone', (_e, detalhes) => {
      if (jogando && detalhes.reason !== 'clean-exit') reabrirJogo(`o jogo parou (${detalhes.reason})`);
    });
    conteudo.on('unresponsive', () => {
      if (jogando) reabrirJogo('o jogo não responde');
    });

    janelaJogo.on('closed', () => {
      janelaJogo = null;
      jogoAtual = null;
      pararTudo();
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

function reabrirJogo(motivo) {
  if (!janelaJogo || !jogoAtual) return;
  const agora = Date.now();
  reinicios = reinicios.filter((t) => agora - t < JANELA_REINICIOS_MS);
  if (reinicios.length >= MAX_REINICIOS) {
    registrar(`watchdog: ${motivo}; limite de reinicios atingido, nao reabri`);
    avisarLauncher(`O jogo travou ${MAX_REINICIOS} vezes em 10 minutos. Clique em PARAR e JOGAR, ou troque de jogo.`);
    return;
  }
  reinicios.push(agora);
  ultimoBatimento = agora;
  registrar(`watchdog: ${motivo}; reabrindo ${jogoAtual.id}`);
  avisarLauncher(`Watchdog: ${motivo}. Reabri o jogo sozinho.`);
  janelaJogo.webContents.loadURL(urlDoJogo(jogoAtual)).catch((erro) => registrar(`watchdog: falha ao reabrir: ${erro.message}`));
}

function avisarLauncher(texto) {
  enviar(janelaLauncher, 'launcher:aviso', texto);
}

function verificarSaude() {
  if (!jogando || !janelaJogo || janelaJogo.isDestroyed()) return;
  const agora = Date.now();

  // 1. Jogo visivel que parou de desenhar (laco travado).
  const visivel = janelaJogo.isVisible() && !janelaJogo.isMinimized();
  if (visivel && ultimoBatimento && agora - ultimoBatimento > SEM_BATIMENTO_MS) {
    reabrirJogo('o jogo parou de desenhar');
  }

  // 2. Conexao "conectada" mas muda ha muito tempo (so na live de verdade).
  if (!modoTesteAtual && ultimoStatus.status === STATUS.CONECTADO && agora - ultimoEventoLive > CONEXAO_MUDA_MS) {
    ultimoEventoLive = agora;
    registrar('watchdog: conexao sem eventos ha 5 min; religando');
    avisarLauncher('Watchdog: nenhum evento da live em 5 minutos. Religuei a conexão.');
    sessao.iniciar({ arroba: arrobaAtual, simulador: false, chaveEuler: process.env.EULER_API_KEY });
  }

  // 3. Rotacao automatica (a cada 30 s).
  if (agora - ultimaChecagemRotacao >= 30000) {
    ultimaChecagemRotacao = agora;
    verificarRotacao(agora);
  }
}

// ------------------------------------------------------------------ rotacao automatica

function verificarRotacao(agora) {
  const rot = lerRotacao();
  if (!rot.ativa || !jogoAtual) return;
  const lista = rot.jogos.filter((id) => obterJogo(id));
  if (lista.length < 2) return;

  const minutosNoJogo = (agora - inicioJogoAtual) / 60000;
  let motivo = null;
  if (minutosNoJogo >= rot.minutos) motivo = `${rot.minutos} min no mesmo jogo`;

  if (!motivo && rot.trocarSeCair && banco && minutosNoJogo >= Math.max(10, rot.minutosMinimos)) {
    const ritmo = banco.interacoesPorMinuto(5, agora);
    melhorRitmo = Math.max(melhorRitmo, ritmo);
    if (melhorRitmo >= 3 && ritmo < melhorRitmo * (1 - rot.quedaPct / 100)) {
      motivo = `engajamento caiu ${Math.round((1 - ritmo / melhorRitmo) * 100)}%`;
    }
  } else if (banco && minutosNoJogo >= 5) {
    melhorRitmo = Math.max(melhorRitmo, banco.interacoesPorMinuto(5, agora));
  }
  if (!motivo) return;

  const posicao = lista.indexOf(jogoAtual.id);
  const proximo = obterJogo(lista[(posicao + 1) % lista.length]);
  if (!proximo || proximo.id === jogoAtual.id) return;
  trocarDeJogo(proximo, `rotação: ${motivo}`);
}

function trocarDeJogo(jogo, motivo) {
  if (!janelaJogo || !jogando) return;
  registrar(`troca de jogo: ${jogoAtual?.id} -> ${jogo.id} (${motivo})`);
  jogoAtual = jogo;
  inicioJogoAtual = Date.now();
  melhorRitmo = 0;
  ultimoBatimento = Date.now();
  banco?.trocarJogo(jogo.id);
  enviar(janelaLauncher, 'launcher:jogoAtual', resumoDoJogo(jogo));
  avisarLauncher(`Troquei para ${jogo.nome} (${motivo}).`);
  janelaJogo.webContents.loadURL(urlDoJogo(jogo)).catch((erro) => registrar(`falha ao trocar de jogo: ${erro.message}`));
}

function pararTudo() {
  jogando = false;
  clearInterval(timerWatchdog);
  timerWatchdog = null;
  banco?.encerrarSessao();
}

function enviar(janela, canal, dados) {
  if (!janela || janela.isDestroyed()) return;
  try {
    janela.webContents.send(canal, dados);
  } catch {
    // a pagina esta recarregando (watchdog ou troca de jogo): o evento se perde, a live segue
  }
}

// ------------------------------------------------------------------ sessao da live

function ligarSessao() {
  sessao.on('status', (status) => {
    ultimoStatus = status;
    enviar(janelaLauncher, 'live:status', status);
    enviar(janelaJogo, 'live:status', status);
  });

  sessao.on('evento', (evento) => {
    ultimoEventoLive = Date.now();
    banco?.gravar(evento);
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
  modoTesteAtual = modoTeste;
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

  banco?.iniciarSessao({
    plataforma: modoTeste ? 'simulador' : 'tiktok',
    arroba: arrobaAtual,
    simulador: modoTeste,
    versao: app.getVersion(),
    jogo: jogo.id
  });
  await sessao.iniciar({
    arroba: arrobaAtual,
    simulador: modoTeste,
    chaveEuler: process.env.EULER_API_KEY
  });

  jogando = true;
  reinicios = [];
  inicioJogoAtual = Date.now();
  melhorRitmo = 0;
  ultimoBatimento = Date.now();
  ultimoEventoLive = Date.now();
  clearInterval(timerWatchdog);
  timerWatchdog = setInterval(verificarSaude, WATCHDOG_INTERVALO_MS);

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
    // PARAR seguro: desliga o watchdog antes, para ele nao reabrir nada.
    pararTudo();
    if (janelaJogo) janelaJogo.destroy();
    return { ok: true };
  });

  // Config de cada jogo (presente -> acao e meta) e da rotacao.
  ipcMain.handle('launcher:configJogo', (_e, id) => ({
    config: configDoJogo(String(id || '')),
    presentesVistos: banco?.presentesVistos() ?? []
  }));
  ipcMain.handle('launcher:salvarConfigJogo', (_e, id, parcial) => {
    if (!obterJogo(String(id || ''))) return { ok: false, erro: 'Jogo não encontrado.' };
    salvarConfigDoJogo(String(id), parcial);
    return { ok: true };
  });
  ipcMain.handle('launcher:rotacao', () => lerRotacao());
  ipcMain.handle('launcher:salvarRotacao', (_e, dados) => {
    salvarRotacao(dados);
    return { ok: true };
  });
  ipcMain.handle('launcher:trocarJogo', (_e, id) => {
    const jogo = obterJogo(String(id || ''));
    if (!jogo || !jogando) return { ok: false };
    if (jogo.id !== jogoAtual?.id) trocarDeJogo(jogo, 'troca manual');
    return { ok: true };
  });

  // Sinal de vida do jogo (o preload manda no maximo 1 por segundo).
  ipcMain.on('jogo:batimento', (evento) => {
    if (janelaJogo && evento.sender === janelaJogo.webContents) ultimoBatimento = Date.now();
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
