// Jogo "Corrida" (Fase 3): quem comenta CARRO ou MOTO entra na pista com um
// veiculo e o @ em cima. As corridas comecam, terminam e recomecam sozinhas.
// Os presentes viram acoes na Fase 4.
//
// Arquivos deste jogo:
//   regras.js           numeros do jogo (distancia, tempos, vagas)
//   entrada.js          entende "carro"/"moto" nos comentarios
//   corrida.js          fases, movimento e posicoes (sem desenho)
//   cena.js             desenha pista, veiculos e nomes no canvas
//   placar.js           placar, chamada, painel e podio (HTML)
//   fotos.js            fotos de perfil
//   veiculos/           modelos de carro e moto (catalogo.js e desenhos.js)
//   aviso-de-erro.js    mostra na tela um erro que impeca o jogo de abrir
//
// Usa o SDK do launcher: /_sdk/plataforma.js, /_sdk/palco.js e /_sdk/tipos.js.

import { conectarPlataforma } from '/_sdk/plataforma.js';
import { criarPalco } from '/_sdk/palco.js';
import { TIPOS } from '/_sdk/tipos.js';
import { REGRAS } from './regras.js';
import { lerPedidoDeEntrada } from './entrada.js';
import { Corrida } from './corrida.js';
import { CATALOGO, CORES, validarCatalogo, coresValidas } from './veiculos/catalogo.js';
import { criarFotos } from './fotos.js';
import { criarCena } from './cena.js';
import { criarPlacar } from './placar.js';

const PASSO = 1 / 60; // a corrida anda em passos fixos de 1/60 s

criarPalco(document.getElementById('palco'));

const { modelos, avisos } = validarCatalogo(CATALOGO);
for (const aviso of avisos) console.warn(aviso);
const cores = coresValidas(CORES);

const fotos = criarFotos();
const cena = criarCena(document.getElementById('pista'), {
  regras: REGRAS,
  fotos,
  reservaPara: (tipo) => modelos.find((m) => m.tipo === tipo && m.desenho) ?? modelos.find((m) => m.desenho)
});
const placar = criarPlacar({ regras: REGRAS, modelos, cores, miniatura: cena.miniatura });

let corrida = null;
if (modelos.length) {
  corrida = new Corrida({ regras: REGRAS, modelos, cores });
  window.corrida = corrida; // para olhar o estado no Console (npm run dev)
} else {
  placar.mostrarErro('Nenhum modelo de veículo válido em veiculos/catalogo.js. Veja o Console (npm run dev).');
}

function aoEvento(evento) {
  if (!corrida || evento?.tipo !== TIPOS.COMENTARIO || !evento.usuario) return;
  const tipo = lerPedidoDeEntrada(evento.dados?.texto);
  if (tipo) corrida.pedirEntrada(evento.usuario, tipo);
}

// ------------------------------------------------------------------ laco do jogo
let antes = performance.now();
let acumulado = 0;
let ultimoErro = 0;

function quadro(agora) {
  try {
    const dt = Math.min(0.25, Math.max(0, (agora - antes) / 1000));
    antes = agora;
    if (corrida) {
      acumulado += dt;
      while (acumulado >= PASSO) {
        corrida.atualizar(PASSO);
        acumulado -= PASSO;
      }
      for (const a of corrida.retirarAcontecimentos()) {
        placar.aoAcontecimento(a);
        cena.aoAcontecimento(a);
      }
      cena.desenhar(corrida, dt);
      placar.atualizar(corrida);
    }
  } catch (erro) {
    // Um erro num quadro nao pode congelar a live: registra e segue no proximo.
    if (agora - ultimoErro > 5000) {
      ultimoErro = agora;
      console.error('Erro no quadro do jogo:', erro);
    }
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
document.documentElement.dataset.jogo = 'rodando'; // daqui em diante aviso-de-erro.js nao cobre a tela

// ------------------------------------------------------------------ live
let recebeuStatus = false;
function aoStatus(status) {
  recebeuStatus = true;
  placar.mostrarConexao(status);
}

const info = await conectarPlataforma({ aoEvento, aoStatus });
placar.mostrarStreamer(info.arroba);
if (!recebeuStatus) placar.mostrarConexao(info.status);
