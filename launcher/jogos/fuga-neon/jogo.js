// Jogo "Fuga Neon": ladrões x polícia numa cidade neon tropical (arte e nome originais).
// Quem comenta LADRÃO ou POLÍCIA entra numa equipe. Cada rodada tem assalto, fuga,
// perseguição e resultado, e a próxima começa sozinha em outro bairro.
// Comentários, curtidas, follows e compartilhamentos empurram a perseguição;
// presentes viram ações maiores (nitro, fumaça, helicóptero, bloqueio...).
//
// Arquivos deste jogo:
//   regras.js    NÚMEROS DO JOGO (tempos, distâncias, força das ações)
//   acoes.js     presente -> ação (níveis e efeitos por equipe)
//   entrada.js   entende "ladrão"/"polícia" nos comentários
//   partida.js   regras da rodada (sem desenho; testável no Node)
//   cena.js      desenho da cidade e dos carros
//   placar.js    placar, painel e resultado (HTML)

import { conectarPlataforma } from '/_sdk/plataforma.js';
import { criarPalco } from '/_sdk/palco.js';
import { REGRAS, BAIRROS } from './regras.js';
import { Partida } from './partida.js';
import { criarCena } from './cena.js';
import { criarPlacar } from './placar.js';
import { criarFotos } from './fotos.js';

const PASSO = 1 / 60;
const CHAVE_RECORDES = 'fuga-neon:recordes';

criarPalco(document.getElementById('palco'));

function lerRecordes() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RECORDES) || '{}') || {};
  } catch {
    return {};
  }
}

function salvarRecordes(recordes) {
  try {
    localStorage.setItem(CHAVE_RECORDES, JSON.stringify(recordes));
  } catch {
    // sem armazenamento: os recordes valem só até fechar o jogo
  }
}

// Os eventos que chegarem antes da configuração ficam guardados e entram depois.
const pendentes = [];
let partida = null;
let placar = null;
const fotos = criarFotos();
const cena = criarCena(document.getElementById('cidade'), { fotos });

function aoEvento(evento) {
  if (partida) partida.aoEvento(evento);
  else if (pendentes.length < 500) pendentes.push(evento);
}

let recebeuStatus = null;
function aoStatus(status) {
  recebeuStatus = status;
  if (placar) placar.mostrarConexao(status);
}

const info = await conectarPlataforma({ aoEvento, aoStatus });
const config = info.config || {};

partida = new Partida({ regras: REGRAS, bairros: BAIRROS, config, recordes: lerRecordes() });
window.partida = partida; // para olhar o estado no Console (npm run dev)
placar = criarPlacar({ config });
placar.mostrarStreamer(info.arroba);
placar.mostrarConexao(recebeuStatus || info.status);
for (const evento of pendentes.splice(0)) partida.aoEvento(evento);

// ------------------------------------------------------------------ laço do jogo
let antes = performance.now();
let acumulado = 0;
let ultimoErro = 0;

function quadro(agora) {
  try {
    const dt = Math.min(0.25, Math.max(0, (agora - antes) / 1000));
    antes = agora;
    acumulado += dt;
    while (acumulado >= PASSO) {
      partida.atualizar(PASSO);
      acumulado -= PASSO;
    }
    for (const a of partida.retirarAcontecimentos()) {
      cena.aoAcontecimento(a, partida);
      placar.aoAcontecimento(a);
      if (a.tipo === 'resultado' && a.resultado.recorde) salvarRecordes(partida.recordes);
    }
    cena.desenhar(partida, dt);
    placar.atualizar(partida);
  } catch (erro) {
    // Um erro num quadro não pode congelar a live: registra e segue no próximo.
    if (agora - ultimoErro > 5000) {
      ultimoErro = agora;
      console.error('Erro no quadro do jogo:', erro);
    }
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
document.documentElement.dataset.jogo = 'rodando';
