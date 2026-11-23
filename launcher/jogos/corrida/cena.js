// Desenha a corrida no canvas: grama, pista, grid, chegada, veiculos, nomes,
// efeitos e a camera que acompanha o lider. Nao muda nada na corrida: so le
// o estado de corrida.js e transforma em imagem, 60 vezes por segundo.
//
// Coordenadas: o canvas tem 1080x1920 (o palco). A pista e vertical e os
// veiculos sobem; d (metros) vira altura na tela pela funcao y(d).

import { FASES, posicaoNoGrid, hashTexto, NA_PISTA_DEPOIS_DA_CHEGADA_S } from './corrida.js';

const LARGURA = 1080;
const ALTURA = 1920;
export const PX_POR_M = 26;
// Faixa da tela que fica livre entre o placar de cima e o painel de baixo.
export const VISTA = Object.freeze({ topo: 330, base: 1530 });
const LARGURA_FAIXA = 116;
const FONTE = '"Segoe UI", Arial, sans-serif';
const DOURADO = '#ffc21a';
const CORES_CONFETE = ['#ffc21a', '#ff4d4d', '#27b6f5', '#7bdc4b', '#e05cff', '#ffffff'];
const ESPERA_NOME_S = 1; // quem perdeu o nome na tela espera isso antes de tentar de novo (nao pisca)
const NOME_PRIMEIRO_ATE = 6; // os 6 primeiros escolhem lugar para o nome antes dos outros
const FOLGA_NOME_NOVO = 8; // px livres em volta para um nome aparecer (evita aparecer e sumir)

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const suave = (t) => 1 - Math.pow(1 - limitar(t, 0, 1), 3);

function novoCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function encurtar(texto, maximo) {
  const letras = [...String(texto)];
  return letras.length > maximo ? `${letras.slice(0, maximo - 1).join('')}…` : letras.join('');
}

// Texto escuro em cores claras e branco em cores escuras.
function corDoTexto(hex) {
  const n = parseInt(String(hex).slice(1, 7), 16) || 0;
  const luz = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luz > 150 ? '#14161c' : '#ffffff';
}

function sobrepoe(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function areaEmComum(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * @param {HTMLCanvasElement} canvas canvas de 1080x1920
 * @param {object} opcoes
 * @param {object} opcoes.regras numeros do jogo
 * @param {{ obter: (url: string) => HTMLImageElement|null }} opcoes.fotos fotos de perfil
 * @param {(tipo: string) => object|undefined} [opcoes.reservaPara] modelo desenhado em codigo
 *        usado quando a imagem PNG de um modelo nao existe
 */
export function criarCena(canvas, { regras, fotos, reservaPara = () => undefined }) {
  const ctx = canvas.getContext('2d');
  const D = regras.distanciaM;
  const pista = {
    esquerda: (LARGURA - regras.faixas * LARGURA_FAIXA) / 2,
    largura: regras.faixas * LARGURA_FAIXA
  };
  pista.direita = pista.esquerda + pista.largura;

  const camera = { d: 0, foco: VISTA.topo + 0.12 * (VISTA.base - VISTA.topo) };
  const sprites = new Map(); // "modelo|cor" -> { canvas, margem, w, h }
  const imagensDeModelo = new Map(); // caminho -> { img, estado }
  const rotulos = new Map(); // id do corredor -> { chave, canvas, w, h }
  const estadosDeRotulo = new Map(); // id do corredor -> { nome, candidato, desde }
  const avisosDeDesenho = new Set();
  const flutuantes = []; // textos que sobem em cima do veiculo ("ENTROU!")
  let confetes = [];
  let relogio = 0;
  let numeroAtual = null;

  const y = (d) => camera.foco - (d - camera.d) * PX_POR_M;
  const dNaTela = (yy) => camera.d + (camera.foco - yy) / PX_POR_M;
  const xDaFaixa = (x) => pista.esquerda + (x + 0.5) * LARGURA_FAIXA;

  // ---------------------------------------------------------------- enfeites prontos
  const enfeites = criarEnfeites();

  // ---------------------------------------------------------------- camera
  function moverCamera(corrida, dt) {
    const altura = VISTA.base - VISTA.topo;
    let alvoD;
    let alvoFoco;
    if (corrida.fase === FASES.AGUARDANDO || corrida.fase === FASES.LARGADA) {
      alvoD = 0;
      alvoFoco = VISTA.topo + 0.12 * altura;
    } else if (corrida.fase === FASES.CORRENDO && corrida.lider) {
      // Mira um pouco a frente do lider para compensar o atraso da suavizacao.
      alvoD = corrida.lider.d + corrida.lider.v * 0.2;
      alvoFoco = VISTA.topo + 0.3 * altura;
    } else {
      alvoD = D;
      alvoFoco = VISTA.topo + 0.3 * altura;
    }
    if (Math.abs(alvoD - camera.d) > 150) camera.d = alvoD; // corrida nova: pula direto
    camera.d += (alvoD - camera.d) * (1 - Math.exp(-dt * 5));
    camera.foco += (alvoFoco - camera.foco) * (1 - Math.exp(-dt * 2));
  }

  // ---------------------------------------------------------------- cenario
  function faixasDoMundo(passoM, desenhar) {
    const inicio = Math.floor(dNaTela(ALTURA + 40) / passoM);
    const fim = Math.ceil(dNaTela(-40) / passoM);
    for (let i = inicio; i <= fim; i++) desenhar(i, y((i + 1) * passoM), y(i * passoM));
  }

  function desenharGrama() {
    ctx.fillStyle = '#3d8f45';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.fillStyle = '#378340';
    faixasDoMundo(5, (i, ya, yb) => {
      if (i & 1) ctx.fillRect(0, ya, LARGURA, yb - ya);
    });
  }

  function desenharEnfeites() {
    const passo = 7;
    const margens = [
      [18, pista.esquerda - 44],
      [pista.direita + 44, LARGURA - 18]
    ];
    const inicio = Math.floor(dNaTela(ALTURA + 160) / passo);
    const fim = Math.ceil(dNaTela(-160) / passo);
    for (let i = inicio; i <= fim; i++) {
      const dSegmento = i * passo;
      // Arquibancadas na largada e na chegada; no resto, arvores e pedras.
      const temArquibancada = (dSegmento >= -14 && dSegmento <= 0) || (dSegmento >= D - 10 && dSegmento <= D + 7);
      for (const lado of [0, 1]) {
        if (temArquibancada) {
          const s = enfeites.arquibancada[lado];
          const xx = lado === 0 ? pista.esquerda - 30 - s.width : pista.direita + 30;
          ctx.drawImage(s, xx, y(dSegmento + passo));
          continue;
        }
        const h = hashTexto(`${i}:${lado}`);
        if (h % 100 >= 58) continue;
        const [min, max] = margens[lado];
        const s = enfeites.lista[(h >>> 20) % enfeites.lista.length];
        const xx = min + (((h >>> 8) % 1000) / 1000) * (max - min);
        const yy = y(dSegmento + ((h >>> 4) % 7));
        ctx.drawImage(s, xx - s.width / 2, yy - s.height / 2);
      }
    }
  }

  function desenharPista() {
    const { esquerda, largura, direita } = pista;
    ctx.fillStyle = '#2c3039';
    ctx.fillRect(esquerda, 0, largura, ALTURA);

    // marcas de pneu no meio de cada faixa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
    for (let f = 0; f < regras.faixas; f++) {
      const cx = xDaFaixa(f);
      ctx.fillRect(cx - 28, 0, 11, ALTURA);
      ctx.fillRect(cx + 17, 0, 11, ALTURA);
    }

    // zebras vermelho e branco nas bordas
    faixasDoMundo(2, (i, ya, yb) => {
      ctx.fillStyle = i & 1 ? '#f2f2f2' : '#e03a3a';
      ctx.fillRect(esquerda - 18, ya, 18, yb - ya);
      ctx.fillRect(direita, ya, 18, yb - ya);
    });

    // linhas brancas das bordas e tracejado entre as faixas
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(esquerda + 6, 0, 5, ALTURA);
    ctx.fillRect(direita - 11, 0, 5, ALTURA);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    faixasDoMundo(8, (i, ya, yb) => {
      const altura = (yb - ya) * 0.45;
      for (let f = 1; f < regras.faixas; f++) ctx.fillRect(esquerda + f * LARGURA_FAIXA - 3, yb - altura, 6, altura);
    });
  }

  function quadriculado(dLinha, fileiras) {
    const lado = LARGURA_FAIXA / 4;
    const base = y(dLinha);
    if (base < -10 || base - fileiras * lado > ALTURA + 10) return;
    const colunas = Math.round(pista.largura / lado);
    for (let r = 0; r < fileiras; r++) {
      for (let c = 0; c < colunas; c++) {
        ctx.fillStyle = (r + c) & 1 ? '#15161a' : '#f4f4f4';
        ctx.fillRect(pista.esquerda + c * lado, base - (r + 1) * lado, lado, lado);
      }
    }
  }

  function textoNoAsfalto(texto, d) {
    const yy = y(d);
    if (yy < -80 || yy > ALTURA + 80) return;
    ctx.font = `900 64px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText(texto, LARGURA / 2, yy);
  }

  function marcasDoGrid() {
    if (y(0) > ALTURA + 50 || y(-60) < -50) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.font = `800 22px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let vaga = 0; vaga < regras.maxCorredores; vaga++) {
      const { faixa, d } = posicaoNoGrid(vaga, regras);
      const yy = y(d) - 6;
      if (yy < -40 || yy > ALTURA + 40) continue;
      const cx = xDaFaixa(faixa);
      ctx.beginPath();
      ctx.moveTo(cx - 44, yy + 18);
      ctx.lineTo(cx - 44, yy);
      ctx.lineTo(cx + 44, yy);
      ctx.lineTo(cx + 44, yy + 18);
      ctx.stroke();
      ctx.fillText(String(vaga + 1), cx, yy - 4);
    }
  }

  function placas() {
    const marcas = [];
    for (let km = 1; km * 1000 < D; km++) marcas.push({ d: D - km * 1000, texto: `${km} km` });
    if (D > 500) marcas.push({ d: D - 500, texto: '500 m' });
    for (const m of marcas) {
      const yy = y(m.d);
      if (yy < -100 || yy > ALTURA + 100) continue;
      const s = enfeites.placa;
      const xx = pista.direita + 36;
      ctx.drawImage(s, xx, yy - s.height);
      ctx.fillStyle = '#14161c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 20px ${FONTE}`;
      ctx.fillText('FALTAM', xx + s.width / 2, yy - s.height + 26);
      ctx.font = `900 30px ${FONTE}`;
      ctx.fillText(m.texto, xx + s.width / 2, yy - s.height + 58);
    }
  }

  function bandeirasDaChegada() {
    const yy = y(D);
    if (yy < -150 || yy > ALTURA + 150) return;
    const s = enfeites.bandeira;
    ctx.drawImage(s, pista.esquerda - 18 - s.width + 8, yy - s.height);
    ctx.save();
    ctx.translate(pista.direita + 18 + s.width - 8, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s, 0, yy - s.height);
    ctx.restore();
  }

  // ---------------------------------------------------------------- veiculos
  function imagemDoModelo(caminho) {
    let item = imagensDeModelo.get(caminho);
    if (!item) {
      const img = new Image();
      item = { img, estado: 'carregando', aoTerminar: [] };
      const terminar = (estado) => {
        item.estado = estado;
        for (const funcao of item.aoTerminar.splice(0)) {
          try {
            funcao();
          } catch (erro) {
            console.error(erro);
          }
        }
      };
      img.onload = () => terminar('ok');
      img.onerror = () => {
        avisar(`Imagem de veiculo nao encontrada: ${caminho}`);
        terminar('erro');
      };
      img.src = caminho;
      imagensDeModelo.set(caminho, item);
    }
    return item;
  }

  function avisar(texto) {
    if (avisosDeDesenho.has(texto)) return;
    avisosDeDesenho.add(texto);
    console.warn(texto);
  }

  function arteDoModelo(modelo, cor, w, h) {
    let desenho = modelo.desenho;
    const imagem = modelo.imagem ? imagemDoModelo(modelo.imagem) : null;
    if (imagem?.estado === 'carregando') return null;
    const arte = novoCanvas(w, h);
    const c = arte.getContext('2d');
    if (imagem?.estado === 'ok') {
      c.drawImage(imagem.img, 0, 0, w, h);
      return arte;
    }
    // Imagem nao encontrada: usa um modelo desenhado em codigo do mesmo tipo.
    if (imagem) desenho = reservaPara(modelo.tipo)?.desenho;
    try {
      if (typeof desenho !== 'function') throw new Error('sem desenho');
      desenho(c, w, h, cor);
    } catch (erro) {
      avisar(`Erro no desenho do modelo "${modelo.id}": ${erro.message}`);
      c.fillStyle = cor;
      c.fillRect(0, 0, w, h);
    }
    return arte;
  }

  // Imagem pronta do veiculo (com sombra), feita uma vez por modelo e cor.
  function spriteDe(modelo, cor) {
    const chave = `${modelo.id}|${cor}`;
    const pronto = sprites.get(chave);
    if (pronto) return pronto;

    const w = Math.round(modelo.larguraM * PX_POR_M);
    const h = Math.round(modelo.comprimentoM * PX_POR_M);
    const margem = 16;
    const arte = arteDoModelo(modelo, cor, w, h);
    if (!arte) {
      // Imagem ainda carregando: um retangulo na cor do jogador, sem guardar.
      return { canvas: null, margem: 0, w, h };
    }
    const canvasSprite = novoCanvas(w + margem * 2, h + margem * 2);
    const c = canvasSprite.getContext('2d');
    c.shadowColor = 'rgba(0, 0, 0, 0.45)';
    c.shadowBlur = 8;
    c.shadowOffsetX = 5;
    c.shadowOffsetY = 9;
    c.drawImage(arte, margem, margem);
    const sprite = { canvas: canvasSprite, margem, w, h };
    sprites.set(chave, sprite);
    return sprite;
  }

  function desenharVeiculo(c, corrida) {
    const s = spriteDe(c.modelo, c.cor);
    const desdeEntrada = corrida.relogio - c.entrouEm;
    let dDesenho = c.d;
    let alfa = 1;
    let escala = 1;

    if (!c.entrouAndando && desdeEntrada < 0.9) {
      dDesenho -= (1 - suave(desdeEntrada / 0.9)) * 22; // chega ao grid vindo de tras
    } else if (c.entrouAndando && desdeEntrada < 0.6) {
      alfa = desdeEntrada / 0.6;
      escala = 0.7 + 0.3 * suave(desdeEntrada / 0.6);
    }
    if (c.trocouEm !== null && corrida.relogio - c.trocouEm < 0.4) {
      escala *= 1 + 0.25 * Math.sin(((corrida.relogio - c.trocouEm) / 0.4) * Math.PI);
    }
    if (c.chegou) {
      // Some no ultimo segundo antes de sair da pista (corrida.js tira o obstaculo nessa hora).
      alfa *= 1 - limitar(corrida.relogio - c.chegouEm - (NA_PISTA_DEPOIS_DA_CHEGADA_S - 1), 0, 1);
      if (alfa <= 0) return null;
    }

    const cx = xDaFaixa(c.x);
    const topo = y(dDesenho);
    if (topo > ALTURA + 40 || topo + s.h < -40) return null;

    const inclinacao = limitar((c.alvoX - c.x) * 0.35, -0.3, 0.3);
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(cx, topo + s.h / 2);
    if (inclinacao) ctx.rotate(inclinacao);
    if (escala !== 1) ctx.scale(escala, escala);
    if (s.canvas) {
      ctx.drawImage(s.canvas, -s.w / 2 - s.margem, -s.h / 2 - s.margem);
    } else {
      ctx.fillStyle = c.cor;
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    }
    ctx.restore();
    return { c, cx, topo, base: topo + s.h, meiaLargura: s.w / 2, alfa };
  }

  function brilho(cx, cy, raio, intensidade) {
    const g = ctx.createRadialGradient(cx, cy, raio * 0.2, cx, cy, raio);
    g.addColorStop(0, `rgba(255, 194, 26, ${0.55 * intensidade})`);
    g.addColorStop(1, 'rgba(255, 194, 26, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, raio * 0.8, raio, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function liderEmDestaque(corrida) {
    if (corrida.fase === FASES.CORRENDO || corrida.fase === FASES.CHEGADA) return corrida.lider;
    if (corrida.fase === FASES.RESULTADO) return corrida.classificacao?.[0] ?? null;
    return null;
  }

  // ---------------------------------------------------------------- nomes
  function rotuloDe(c, ehLider) {
    const foto = fotos.obter(c.usuario.foto);
    const chave = `${c.posicao}|${ehLider ? 1 : 0}|${foto ? 1 : 0}`;
    const guardado = rotulos.get(c.id);
    if (guardado && guardado.chave === chave) return guardado;

    const nome = `@${encurtar(c.usuario.arroba || c.usuario.nome || '?', 14)}`;
    const posicao = `${c.posicao}º`;
    const medir = ctx;
    medir.font = `800 24px ${FONTE}`;
    const larguraNome = medir.measureText(nome).width;
    medir.font = `900 22px ${FONTE}`;
    const larguraPosicao = Math.max(30, medir.measureText(posicao).width + 16);

    const coroa = ehLider ? 24 : 0;
    const alturaPilula = 40;
    const w = Math.ceil(6 + larguraPosicao + 6 + 30 + 8 + larguraNome + 14);
    const h = alturaPilula + coroa;
    // Reaproveita o canvas do rotulo anterior desta pessoa (mudar o tamanho limpa).
    const tela = guardado?.canvas ?? novoCanvas(w, h);
    tela.width = w;
    tela.height = h;
    const g = tela.getContext('2d');
    const topo = coroa;

    g.beginPath();
    g.roundRect(1.5, topo + 1.5, w - 3, alturaPilula - 3, 19);
    g.fillStyle = ehLider ? DOURADO : 'rgba(10, 15, 30, 0.88)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = ehLider ? '#fff3c4' : c.cor;
    g.stroke();

    // posicao
    const xPos = 6;
    g.beginPath();
    g.roundRect(xPos, topo + 6, larguraPosicao, alturaPilula - 12, 9);
    g.fillStyle = ehLider ? '#16130a' : c.cor;
    g.fill();
    g.font = `900 22px ${FONTE}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = ehLider ? DOURADO : corDoTexto(c.cor);
    g.fillText(posicao, xPos + larguraPosicao / 2, topo + alturaPilula / 2 + 1);

    // foto (ou inicial)
    const xFoto = xPos + larguraPosicao + 6 + 15;
    const yFoto = topo + alturaPilula / 2;
    g.save();
    g.beginPath();
    g.arc(xFoto, yFoto, 15, 0, Math.PI * 2);
    g.clip();
    if (foto) {
      g.drawImage(foto, xFoto - 15, yFoto - 15, 30, 30);
    } else {
      g.fillStyle = '#3a4566';
      g.fillRect(xFoto - 15, yFoto - 15, 30, 30);
      g.fillStyle = '#ffffff';
      g.font = `800 17px ${FONTE}`;
      g.fillText([...(c.usuario.arroba || c.usuario.nome || '?')][0].toUpperCase(), xFoto, yFoto + 1);
    }
    g.restore();

    // @
    g.font = `800 24px ${FONTE}`;
    g.textAlign = 'left';
    g.fillStyle = ehLider ? '#1b1500' : '#ffffff';
    g.fillText(nome, xFoto + 15 + 8, topo + alturaPilula / 2 + 1);

    if (ehLider) desenharCoroa(g, xPos + larguraPosicao / 2, coroa - 1);

    const rotulo = { chave, canvas: tela, w, h };
    rotulos.set(c.id, rotulo);
    return rotulo;
  }

  function desenharCoroa(g, cx, base) {
    g.beginPath();
    g.moveTo(cx - 17, base);
    g.lineTo(cx - 19, base - 17);
    g.lineTo(cx - 8, base - 8);
    g.lineTo(cx, base - 21);
    g.lineTo(cx + 8, base - 8);
    g.lineTo(cx + 19, base - 17);
    g.lineTo(cx + 17, base);
    g.closePath();
    g.fillStyle = DOURADO;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#7a5a00';
    g.stroke();
  }

  // Coloca os nomes sem um cobrir o outro. O lider escolhe primeiro; depois os
  // NOME_PRIMEIRO_ATE primeiros; depois os outros. Em cada grupo, quem ja estava
  // com o nome na tela vem antes (e fica no mesmo lugar, se ainda couber); o resto
  // vai pela posicao. Quem nao acha espaco mostra so a posicao numa bolinha e so
  // tenta o nome de novo depois de ESPERA_NOME_S: assim os nomes nao piscam.
  // As bolinhas sao desenhadas antes dos nomes, entao nunca cobrem um @.
  function desenharRotulos(desenhados, lider, aviso) {
    const reservados = aviso ? [aviso] : [];
    const ocupados = [...reservados];
    const nomes = [];
    // Escondido atras do placar, do painel de baixo ou do aviso "mais atras": sem nome.
    const visiveis = desenhados.filter(
      (item) => item.topo <= VISTA.base - 30 && item.base >= VISTA.topo && !aviso?.escondidos.has(item.c.id)
    );
    const naTela = new Set(visiveis.map((item) => item.c.id));
    for (const id of [...estadosDeRotulo.keys()]) if (!naTela.has(id)) estadosDeRotulo.delete(id);

    const prioridade = (item) => {
      if (item.c === lider) return 0;
      if (item.c.posicao <= NOME_PRIMEIRO_ATE) return 1;
      return estadosDeRotulo.get(item.c.id)?.nome ? 2 : 3;
    };
    const desempate = (item) => {
      if (item.c.posicao <= NOME_PRIMEIRO_ATE) return item.c.posicao;
      const estado = estadosDeRotulo.get(item.c.id);
      return estado?.nome ? estado.desde : item.c.posicao;
    };
    visiveis.sort((a, b) => prioridade(a) - prioridade(b) || desempate(a) - desempate(b) || a.c.posicao - b.c.posicao);

    const semNome = [];
    for (const item of visiveis) {
      const estado = estadosDeRotulo.get(item.c.id);
      const ehLider = item.c === lider;
      const podeTentar = ehLider || !estado || estado.nome || relogio - estado.desde >= ESPERA_NOME_S;
      const lugar = podeTentar ? lugarDoNome(item, ehLider, estado, ocupados) : null;
      if (lugar) {
        ocupados.push(lugar.caixa);
        nomes.push({ item, lugar });
        if (estado?.nome) estado.candidato = lugar.indice;
        else estadosDeRotulo.set(item.c.id, { nome: true, candidato: lugar.indice, desde: relogio });
      } else {
        if (!estado || estado.nome) estadosDeRotulo.set(item.c.id, { nome: false, candidato: -1, desde: relogio });
        semNome.push(item);
      }
    }
    const bolinhas = [...reservados];
    for (const item of semNome) posicaoCompacta(item, ocupados, bolinhas);
    for (const { item, lugar } of nomes) {
      ctx.globalAlpha = item.alfa;
      ctx.drawImage(lugar.rotulo.canvas, lugar.caixa.x, lugar.caixa.y);
    }
    ctx.globalAlpha = 1;
  }

  function lugarDoNome(item, ehLider, estado, ocupados) {
    const r = rotuloDe(item.c, ehLider);
    const meio = (item.topo + item.base) / 2 - r.h / 2;
    const candidatos = [
      [item.cx - r.w / 2, item.topo - r.h - 6],
      [item.cx - r.w * 0.2, item.topo - r.h - 6],
      [item.cx - r.w * 0.8, item.topo - r.h - 6],
      [item.cx - r.w / 2, item.topo - r.h * 2 - 8],
      [item.cx - r.w / 2, item.base + 4],
      [item.cx + item.meiaLargura + 6, meio], // ao lado, a direita
      [item.cx - item.meiaLargura - 6 - r.w, meio] // ao lado, a esquerda
    ];
    const proprio = { x: item.cx - item.meiaLargura, y: item.topo, w: item.meiaLargura * 2, h: item.base - item.topo };
    // Primeiro o lugar do quadro anterior: o nome so muda de lugar se precisar.
    // O lider sempre tenta primeiro em cima do veiculo.
    const ordem = [0, 1, 2, 3, 4, 5, 6];
    if (!ehLider && estado?.nome && estado.candidato > 0) {
      ordem.splice(estado.candidato, 1);
      ordem.unshift(estado.candidato);
    }
    // Quem ainda nao tem nome so ganha com folga em volta: se coubesse no limite,
    // o nome sumiria no quadro seguinte.
    const f = ehLider || estado?.nome ? 0 : FOLGA_NOME_NOVO;
    for (const indice of ordem) {
      const [x0, y0] = candidatos[indice];
      const caixa = { x: limitar(x0, 6, LARGURA - r.w - 6), y: y0, w: r.w, h: r.h };
      if (sobrepoe(caixa, proprio)) continue; // ao lado, sem espaco ate a borda da tela
      const comFolga = { x: caixa.x - f, y: caixa.y - f, w: caixa.w + f * 2, h: caixa.h + f * 2 };
      const dentroDaVista = comFolga.y >= VISTA.topo - 10 && comFolga.y + comFolga.h <= VISTA.base;
      if (dentroDaVista && !ocupados.some((o) => sobrepoe(o, comFolga))) return { rotulo: r, caixa, indice };
    }
    return null;
  }

  // Bolinha com a posicao: em cima do veiculo, embaixo, ao lado ou, sem outro
  // jeito, em cima do proprio veiculo. De preferencia num lugar sem nome; senao no
  // lugar que o nome menos cobre (a bolinha fica por baixo do nome). Nunca cobre o
  // numero de outra bolinha (no maximo encosta na beirada).
  function posicaoCompacta(item, ocupados, bolinhas) {
    const meio = (Math.max(item.topo, VISTA.topo + 17) + Math.min(item.base, VISTA.base - 17)) / 2;
    const lado = item.meiaLargura + 20;
    const lugares = [
      [item.cx, item.topo - 18],
      [item.cx, item.base + 18],
      [item.cx + lado, meio],
      [item.cx - lado, meio],
      [item.cx, meio]
    ]
      .map(([cx, cy]) => ({ x: cx - 17, y: cy - 17, w: 34, h: 34 }))
      .filter((caixa) => caixa.y >= VISTA.topo && caixa.y + caixa.h <= VISTA.base)
      .filter((caixa) => caixa.x >= 0 && caixa.x + caixa.w <= LARGURA);
    const livres = lugares.filter((caixa) => !bolinhas.some((o) => sobrepoe(o, caixa)));
    // Ultimo recurso: encosta numa bolinha vizinha, mas longe do numero dela (e nunca no aviso de baixo).
    const longe = (caixa) =>
      bolinhas.every((o) => (o.w > 34 ? !sobrepoe(o, caixa) : Math.hypot(o.x - caixa.x, o.y - caixa.y) >= 26));
    const coberto = (l) => ocupados.reduce((soma, o) => soma + areaEmComum(o, l), 0);
    const caixa = livres.length ? livres.reduce((melhor, l) => (coberto(l) < coberto(melhor) ? l : melhor)) : lugares.find(longe);
    if (caixa) {
      const cx = caixa.x + 17;
      const cy = caixa.y + 17;
      bolinhas.push(caixa);
      ocupados.push(caixa);
      ctx.globalAlpha = item.alfa;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fillStyle = item.c.cor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.stroke();
      ctx.fillStyle = corDoTexto(item.c.cor);
      ctx.font = `900 18px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.c.posicao), cx, cy + 1);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- efeitos
  function flutuar(corredor, texto, cor) {
    flutuantes.push({ corredor, texto, cor, t: 0, duracao: 1.4, vaga: null });
    if (flutuantes.length > 8) flutuantes.shift(); // muitos ao mesmo tempo viram borrao
  }

  // Texto que sobe em cima do veiculo. Se o veiculo estiver escondido embaixo do
  // painel (quem entra com a corrida andando costuma nascer ali), o aviso aparece
  // na beirada de baixo da pista, com o @, empilhado com os outros avisos.
  function desenharFlutuantes(corrida, posicoes, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const vagasUsadas = new Set(flutuantes.filter((f) => f.vaga !== null).map((f) => f.vaga));
    for (let i = flutuantes.length - 1; i >= 0; i--) {
      const f = flutuantes[i];
      f.t += dt;
      if (f.t >= f.duracao) {
        if (f.vaga !== null) vagasUsadas.delete(f.vaga);
        flutuantes.splice(i, 1);
        continue;
      }
      const c = f.corredor;
      if (corrida.porId.get(c.id) !== c) continue;
      const p = posicoes.get(c.id);
      const topo = p ? p.topo : y(c.d);
      let texto = f.texto;
      let xx = p ? p.cx : xDaFaixa(c.x);
      let yy;
      if (topo > VISTA.base - 40) {
        if (f.vaga === null) {
          let vaga = 0;
          while (vagasUsadas.has(vaga)) vaga++;
          f.vaga = vaga;
          vagasUsadas.add(vaga);
        }
        texto = `@${encurtar(c.usuario.arroba || c.usuario.nome || '?', 14)} ${f.texto}`;
        ctx.font = `900 30px ${FONTE}`;
        yy = VISTA.base - 96 - f.vaga * 44 - f.t * 18;
      } else {
        ctx.font = `900 34px ${FONTE}`;
        yy = Math.max(VISTA.topo + 30, topo - 64 - f.t * 70);
      }
      const meiaLargura = ctx.measureText(texto).width / 2 + 10;
      xx = limitar(xx, meiaLargura, LARGURA - meiaLargura);
      ctx.globalAlpha = 1 - Math.pow(f.t / f.duracao, 2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.strokeText(texto, xx, yy);
      ctx.fillStyle = f.cor;
      ctx.fillText(texto, xx, yy);
    }
    ctx.globalAlpha = 1;
  }

  function comemorar() {
    confetes = Array.from({ length: 180 }, (_, i) => ({
      x: Math.random() * LARGURA,
      y: -40 - Math.random() * 700,
      vx: (Math.random() - 0.5) * 220,
      vy: 260 + Math.random() * 360,
      angulo: Math.random() * Math.PI,
      giro: (Math.random() - 0.5) * 10,
      cor: CORES_CONFETE[i % CORES_CONFETE.length],
      w: 14 + Math.random() * 10,
      h: 8 + Math.random() * 6
    }));
  }

  function desenharConfetes(dt) {
    if (!confetes.length) return;
    for (const p of confetes) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.angulo += p.giro * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angulo);
      ctx.fillStyle = p.cor;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    confetes = confetes.filter((p) => p.y < ALTURA + 40);
  }

  // Quantos ainda estao correndo mas ficaram abaixo da parte visivel. Quem fica
  // escondido atras do proprio aviso tambem entra na conta (e nao ganha nome nem bolinha).
  function medirAvisoDeQuemFicouAtras(corrida) {
    if (corrida.fase !== FASES.CORRENDO && corrida.fase !== FASES.CHEGADA) return null;
    const naPista = corrida.corredores.filter((c) => !c.chegou);
    const escondidos = new Set(naPista.filter((c) => y(c.d) > VISTA.base - 30).map((c) => c.id));
    if (!escondidos.size) return null;
    const caixa = (n) => {
      const texto = `${n} ${n === 1 ? 'piloto' : 'pilotos'} mais atrás`;
      ctx.font = `800 26px ${FONTE}`;
      const w = ctx.measureText(texto).width + 70;
      return { texto, x: (LARGURA - w) / 2, y: VISTA.base - 62, w, h: 44, escondidos };
    };
    let aviso = caixa(escondidos.size);
    // A caixa cresce com o numero; repete ate parar de mudar (no maximo umas 2 vezes).
    for (let antes = -1; antes !== escondidos.size; ) {
      antes = escondidos.size;
      for (const c of naPista) {
        const cx = xDaFaixa(c.x);
        // Menos de 40 px aparecendo acima do aviso: conta como escondido atras dele.
        if (y(c.d) > aviso.y - 40 && cx > aviso.x && cx < aviso.x + aviso.w) escondidos.add(c.id);
      }
      aviso = caixa(escondidos.size);
    }
    return aviso;
  }

  function desenharAvisoDeQuemFicouAtras(aviso) {
    if (!aviso) return;
    const { texto, x, y: yy, w } = aviso;
    ctx.font = `800 26px ${FONTE}`;
    ctx.beginPath();
    ctx.roundRect(x, yy, w, 44, 22);
    ctx.fillStyle = 'rgba(10, 15, 30, 0.82)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 22, yy + 15);
    ctx.lineTo(x + 42, yy + 15);
    ctx.lineTo(x + 32, yy + 30);
    ctx.closePath();
    ctx.fillStyle = DOURADO;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + 54, yy + 23);
  }

  // ---------------------------------------------------------------- quadro
  function desenhar(corrida, dt) {
    relogio += dt;
    if (corrida.numero !== numeroAtual) {
      numeroAtual = corrida.numero;
      rotulos.clear();
      estadosDeRotulo.clear();
      flutuantes.length = 0;
    }
    moverCamera(corrida, dt);

    desenharGrama();
    desenharEnfeites();
    desenharPista();
    marcasDoGrid();
    quadriculado(0, 2);
    textoNoAsfalto('LARGADA', 4.5);
    quadriculado(D, 3);
    textoNoAsfalto('CHEGADA', D - 7);
    placas();
    bandeirasDaChegada();

    const lider = liderEmDestaque(corrida);
    if (lider) {
      const s = spriteDe(lider.modelo, lider.cor);
      brilho(xDaFaixa(lider.x), y(lider.d) + s.h / 2, s.h * 0.95, 0.75 + 0.25 * Math.sin(relogio * 5));
    }

    // De cima para baixo: quem esta mais atras e desenhado por ultimo (por cima).
    const ordem = corrida.corredores.slice().sort((a, b) => b.d - a.d);
    const desenhados = [];
    const posicoes = new Map();
    for (const c of ordem) {
      const p = desenharVeiculo(c, corrida);
      if (p) {
        desenhados.push(p);
        posicoes.set(c.id, p);
      }
    }
    const aviso = medirAvisoDeQuemFicouAtras(corrida);
    desenharRotulos(desenhados, lider, aviso);
    desenharFlutuantes(corrida, posicoes, dt);
    desenharAvisoDeQuemFicouAtras(aviso);
    desenharConfetes(dt);
  }

  function aoAcontecimento(a) {
    const c = a.corredor;
    // No grid o veiculo ja chega deslizando; o aviso e para quem entra com a corrida andando.
    if (a.tipo === 'entrou' && a.comCorridaAndando) flutuar(c, 'ENTROU!', '#ffffff');
    else if (a.tipo === 'trocou') flutuar(c, 'TROCOU!', '#ffffff');
    else if (a.tipo === 'lider' && !a.primeiro) flutuar(c, 'LÍDER!', DOURADO);
    else if (a.tipo === 'vencedor') {
      flutuar(c, 'VENCEU!', DOURADO);
      comemorar();
    }
  }

  /** Desenho pequeno de um modelo (para a "garagem" da tela de espera). */
  function miniatura(modelo, cor, altura) {
    const w = modelo.larguraM * PX_POR_M;
    const h = modelo.comprimentoM * PX_POR_M;
    const escala = altura / h;
    const tela = novoCanvas(w * escala + 4, altura + 4);
    const pintar = () => {
      const arte = arteDoModelo(modelo, cor, Math.round(w), Math.round(h));
      if (arte) tela.getContext('2d').drawImage(arte, 2, 2, w * escala, altura);
      return Boolean(arte);
    };
    // Imagem PNG ainda carregando: pinta quando ela chegar (ou com a reserva, se faltar).
    if (!pintar() && modelo.imagem) imagemDoModelo(modelo.imagem).aoTerminar.push(pintar);
    return tela;
  }

  return { desenhar, aoAcontecimento, miniatura };
}

// ------------------------------------------------------------------ enfeites
// Arvores, arbustos, pedras, arquibancadas, placa e bandeira: desenhados uma
// vez so, quando o jogo abre.

function criarEnfeites() {
  const arvore = (raio, cor) => {
    const s = novoCanvas(raio * 2 + 24, raio * 2 + 24);
    const g = s.getContext('2d');
    const c = raio + 10;
    g.fillStyle = 'rgba(0, 0, 0, 0.25)';
    g.beginPath();
    g.arc(c + 8, c + 10, raio, 0, Math.PI * 2);
    g.fill();
    const grad = g.createRadialGradient(c - raio * 0.35, c - raio * 0.35, raio * 0.1, c, c, raio);
    grad.addColorStop(0, cor[0]);
    grad.addColorStop(1, cor[1]);
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = raio * (i % 2 ? 0.88 : 1);
      g.arc(c + Math.cos(a) * r * 0.25, c + Math.sin(a) * r * 0.25, r * 0.78, 0, Math.PI * 2);
    }
    g.fill();
    return s;
  };

  const pedra = () => {
    const s = novoCanvas(60, 46);
    const g = s.getContext('2d');
    g.fillStyle = 'rgba(0, 0, 0, 0.22)';
    g.beginPath();
    g.ellipse(34, 28, 24, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8f96a3';
    g.beginPath();
    g.ellipse(28, 22, 22, 15, -0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b4bac4';
    g.beginPath();
    g.ellipse(22, 17, 10, 6, -0.2, 0, Math.PI * 2);
    g.fill();
    return s;
  };

  // Arquibancada vista de cima: 4 degraus de concreto com torcedores enfileirados.
  const arquibancada = (espelhar) => {
    const w = 112;
    const h = Math.round(7 * PX_POR_M);
    const s = novoCanvas(w, h);
    const g = s.getContext('2d');
    const degrau = w / 4;
    for (let i = 0; i < 4; i++) {
      // o degrau mais perto da pista e o mais claro
      const pertoDaPista = espelhar ? 3 - i : i;
      g.fillStyle = ['#59606e', '#646b7a', '#6f7686', '#7a8292'][pertoDaPista];
      g.fillRect(i * degrau, 0, degrau, h);
    }
    const cores = ['#e8574f', '#f0c33c', '#4aa3df', '#e9e9e9', '#6cc070', '#b07cd8', '#f08a3c', '#2f3440'];
    let n = espelhar ? 11 : 5;
    for (let i = 0; i < 4; i++) {
      for (let yy = 12; yy < h - 6; yy += 21) {
        n = (Math.imul(n, 1103515245) + 12345) & 0x7fffffff;
        if (n % 4 === 0) continue; // lugar vazio
        g.fillStyle = cores[(n >> 4) % cores.length];
        g.beginPath();
        g.arc(i * degrau + degrau / 2, yy, 7, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    return s;
  };

  const placa = (() => {
    const s = novoCanvas(116, 96);
    const g = s.getContext('2d');
    g.fillStyle = '#4b5160';
    g.fillRect(52, 74, 12, 22);
    g.beginPath();
    g.roundRect(4, 4, 108, 76, 12);
    g.fillStyle = '#ffd21f';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#14161c';
    g.stroke();
    return s;
  })();

  const bandeira = (() => {
    const s = novoCanvas(110, 150);
    const g = s.getContext('2d');
    g.fillStyle = '#d9d9d9';
    g.fillRect(96, 10, 8, 140);
    const lado = 16;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        g.fillStyle = (r + c) & 1 ? '#15161a' : '#f4f4f4';
        g.fillRect(96 - (c + 1) * lado, 12 + r * lado, lado, lado);
      }
    }
    return s;
  })();

  return {
    lista: [
      arvore(46, ['#5fbf5a', '#2a6b2e']),
      arvore(38, ['#6ccf62', '#2e7a33']),
      arvore(30, ['#7bd36a', '#357f37']),
      arvore(22, ['#8fdc74', '#3d8a3a']),
      pedra()
    ],
    arquibancada: [arquibancada(false), arquibancada(true)],
    placa,
    bandeira
  };
}
