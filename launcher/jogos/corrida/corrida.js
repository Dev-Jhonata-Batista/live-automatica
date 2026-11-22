// Regras da corrida, sem nada de desenho: quem esta na pista, onde cada um esta,
// em que fase a corrida esta e o que acabou de acontecer. A tela (cena.js e
// placar.js) so le este estado. Assim a corrida pode ser testada sem janela.
//
// Fases de cada corrida:
//   aguardando -> quem comenta CARRO/MOTO entra no grid; a contagem comeca no 1o
//   largada    -> 3, 2, 1 (ainda da para entrar no grid)
//   correndo   -> todos aceleram; quem comenta entra atras do ultimo
//   chegada    -> o 1o cruzou a linha; espera os outros por um tempo
//   resultado  -> tela do vencedor; depois comeca a proxima corrida sozinha
//
// Distancias em metros (d = posicao da frente do veiculo; 0 = linha de largada).
// Faixas: x = 0 e a faixa da esquerda, x = faixas - 1 a da direita.

import { REGRAS } from './regras.js';

export const FASES = Object.freeze({
  AGUARDANDO: 'aguardando',
  LARGADA: 'largada',
  CORRENDO: 'correndo',
  CHEGADA: 'chegada',
  RESULTADO: 'resultado'
});

const LIMITE_ACONTECIMENTOS = 300;
const FREIO = 4; // m/s2 depois de cruzar a chegada (e no podio)
const INTERVALO_DESVIO_S = 0.2; // de quanto em quanto tempo cada um olha se precisa trocar de faixa
const TROCA_DE_FAIXA_POR_S = 2.2; // faixas por segundo
const MESMA_FAIXA = 0.7; // diferenca de faixa abaixo da qual um veiculo esta atras do outro
const ESPACO_M = 1; // espaco que quem vem atras deixa para o da frente na mesma faixa
const RECUO_POR_S = 6; // m/s: rapidez com que um veiculo encostado demais volta para tras do outro
const LIDER_CONFIRMA_S = 1.2; // so anuncia novo lider se ele ficar na frente esse tempo
const LIDER_INTERVALO_S = 5; // e no maximo um anuncio de lider a cada 5 s

/** Quem cruzou a chegada continua na pista (e atrapalha quem vem atras) por esse tempo; depois sai. */
export const NA_PISTA_DEPOIS_DA_CHEGADA_S = 2.2;

/** Numero de 32 bits a partir de um texto (sempre o mesmo para o mesmo texto). */
export function hashTexto(texto) {
  let h = 0x811c9dc5;
  const s = String(texto);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Identifica a pessoa: id da plataforma ou, sem ele, o @. */
export function chaveDoUsuario(usuario) {
  const chave = usuario?.id || usuario?.arroba;
  return chave ? String(chave).slice(0, 80) : '';
}

function limparUsuario(u) {
  return {
    id: String(u?.id ?? '').slice(0, 80),
    arroba: String(u?.arroba ?? '').replace(/^@+/, '').slice(0, 40),
    nome: String(u?.nome ?? '').slice(0, 60),
    foto: typeof u?.foto === 'string' ? u.foto.slice(0, 2000) : null
  };
}

/** Ordem em que as faixas do grid enchem: do meio para as bordas. */
export function ordemDasFaixas(faixas) {
  const meio = (faixas - 1) / 2;
  return [...Array(faixas).keys()].sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio) || a - b);
}

/** Onde fica a vaga numero "vaga" (0 = pole position) do grid de largada. */
export function posicaoNoGrid(vaga, regras = REGRAS) {
  const ordem = ordemDasFaixas(regras.faixas);
  const fileira = Math.floor(vaga / regras.faixas);
  const indice = vaga % regras.faixas;
  // Grid escalonado: metade das vagas de cada fileira fica meia fileira atras.
  const escalonado = (indice % 2) * (regras.espacoGridM / 2);
  return { faixa: ordem[indice], d: -regras.recuoGridM - fileira * regras.espacoGridM - escalonado };
}

export class Corrida {
  #acontecimentos = [];
  #desvioAcumulado = 0;
  #liderCandidato = null;
  #liderDesde = 0;
  #liderAnunciado = null;
  #ultimoAnuncioLider = -Infinity;
  #contadorEntradas = 0;
  #modelosPorTipo;

  /**
   * @param {object} opcoes
   * @param {object} [opcoes.regras]  numeros do jogo (padrao: regras.js)
   * @param {object[]} opcoes.modelos modelos validos de veiculos/catalogo.js
   * @param {string[]} [opcoes.cores] cores dos jogadores
   * @param {() => number} [opcoes.aleatorio] sorteio (os testes usam um fixo)
   */
  constructor({ regras = REGRAS, modelos, cores = ['#ffc21a'], aleatorio = Math.random } = {}) {
    if (!Array.isArray(modelos) || !modelos.length) {
      throw new Error('A corrida precisa de pelo menos um modelo de veiculo.');
    }
    this.regras = regras;
    this.modelos = modelos;
    this.cores = cores.length ? cores : ['#ffc21a'];
    this.aleatorio = aleatorio;
    this.#modelosPorTipo = {
      carro: modelos.filter((m) => m.tipo === 'carro'),
      moto: modelos.filter((m) => m.tipo === 'moto')
    };

    this.numero = 0;
    this.relogio = 0; // segundos desde que o jogo abriu
    this.fila = []; // { id, usuario, tipo } esperando a proxima corrida
    this.#novaCorrida();
  }

  // ---------------------------------------------------------------- leitura

  /** true quando um comentario agora coloca a pessoa NESTA corrida. */
  get aceitaEntrada() {
    if (this.corredores.length >= this.regras.maxCorredores) return false;
    if (this.fase === FASES.AGUARDANDO || this.fase === FASES.LARGADA) return true;
    if (this.fase === FASES.CORRENDO) {
      return this.regras.entrarComCorridaAndando && this.faltaM > this.regras.fechaEntradaFaltandoM;
    }
    return false;
  }

  /** Metros que faltam para o lider chegar. */
  get faltaM() {
    const frente = this.lider ? Math.max(0, this.lider.d) : 0;
    return Math.max(0, this.regras.distanciaM - frente);
  }

  /** Segundos ate o JA!, contando a espera e o 3, 2, 1 (null se ainda ninguem entrou). */
  get segundosParaLargada() {
    const r = this.regras;
    if (this.fase === FASES.LARGADA) return Math.max(0, r.largadaS - this.tempoFase);
    if (this.fase !== FASES.AGUARDANDO || !this.corredores.length) return null;
    // Mesma conta de atualizar(): a espera so comeca a correr no proximo passo.
    let espera = this.espera ?? r.esperaS;
    if (this.corredores.length >= r.maxCorredores) espera = Math.min(espera, r.esperaLotadaS);
    return espera + r.largadaS;
  }

  /** Segundos ate a proxima corrida (so na tela de resultado). */
  get segundosParaProxima() {
    return this.fase === FASES.RESULTADO ? Math.max(0, this.regras.resultadoS - this.tempoFase) : null;
  }

  /** Entrega o que aconteceu desde a ultima chamada (entradas, lider, chegada...). */
  retirarAcontecimentos() {
    const lista = this.#acontecimentos;
    this.#acontecimentos = [];
    return lista;
  }

  // ---------------------------------------------------------------- entrada

  /**
   * Alguem comentou CARRO ou MOTO.
   * @returns {'entrou'|'trocou'|'ja-esta'|'fila'|'na-fila'|'lotado'|'invalido'}
   */
  pedirEntrada(usuario, tipo) {
    const id = chaveDoUsuario(usuario);
    if (!id || (tipo !== 'carro' && tipo !== 'moto')) return 'invalido';

    const atual = this.porId.get(id);
    if (atual) {
      if (this.fase === FASES.AGUARDANDO || this.fase === FASES.LARGADA) {
        if (atual.tipo === tipo) return 'ja-esta';
        this.#trocar(atual, tipo);
        return 'trocou';
      }
      // Correndo com a entrada aberta: ja esta nesta corrida. Com a entrada
      // fechada (perto do fim, na chegada ou no podio), a tela pede o comentario
      // para a proxima corrida, entao quem correu tambem vai para a fila.
      if (this.aceitaEntrada) return 'ja-esta';
    }

    const naFila = this.fila.find((p) => p.id === id);
    if (naFila) {
      naFila.tipo = tipo;
      return 'na-fila';
    }

    if (this.aceitaEntrada) {
      if (this.fase === FASES.CORRENDO) this.#entrarNoPelotao(usuario, tipo);
      else this.#entrarNoGrid(usuario, tipo, false);
      return 'entrou';
    }

    if (this.fila.length >= this.regras.maxFila) return 'lotado';
    const pedido = { id, usuario: limparUsuario(usuario), tipo };
    this.fila.push(pedido);
    this.#avisar({ tipo: 'fila', usuario: pedido.usuario, veiculo: tipo, posicao: this.fila.length });
    return 'fila';
  }

  #entrarNoGrid(usuario, tipo, daFila) {
    const vaga = this.corredores.length;
    const { faixa, d } = posicaoNoGrid(vaga, this.regras);
    return this.#adicionar(usuario, tipo, { d, x: faixa, v: 0, vaga, daFila });
  }

  // Com a corrida andando: entra alguns metros atras do ultimo, na faixa mais vazia.
  #entrarNoPelotao(usuario, tipo) {
    let ultimo = null;
    for (const c of this.corredores) if (!c.chegou && (!ultimo || c.d < ultimo.d)) ultimo = c;
    const d = (ultimo ? ultimo.d : 0) - this.regras.atrasoEntradaM;
    const v = ultimo ? ultimo.v * 0.9 : 0;
    return this.#adicionar(usuario, tipo, { d, x: this.#faixaMaisLivre(d), v, vaga: null, daFila: false });
  }

  #faixaMaisLivre(d) {
    let melhores = [];
    let maiorFolga = -1;
    for (let faixa = 0; faixa < this.regras.faixas; faixa++) {
      let folga = 1e6;
      for (const c of this.corredores) {
        if (!c.chegou && Math.abs(c.alvoX - faixa) < 0.5) folga = Math.min(folga, Math.abs(c.d - d));
      }
      if (folga > maiorFolga + 0.01) {
        maiorFolga = folga;
        melhores = [faixa];
      } else if (Math.abs(folga - maiorFolga) <= 0.01) {
        melhores.push(faixa);
      }
    }
    return melhores[Math.floor(this.aleatorio() * melhores.length)] ?? 0;
  }

  #adicionar(usuario, tipo, { d, x, v, vaga, daFila }) {
    const id = chaveDoUsuario(usuario);
    const corredor = {
      id,
      usuario: limparUsuario(usuario),
      tipo,
      modelo: this.#modeloPara(id, tipo),
      cor: this.cores[hashTexto(id) % this.cores.length],
      d,
      x,
      alvoX: x,
      v,
      ritmo: 1,
      alvoRitmo: 1,
      proximoRitmo: this.#sortearEntre(this.regras.trocaRitmoS),
      bloqueadoPor: null,
      vaga,
      chegou: false,
      colocacao: 0,
      tempo: null,
      posicao: this.corredores.length + 1,
      entrouEm: this.relogio,
      trocouEm: null,
      chegouEm: null,
      numeroEntrada: ++this.#contadorEntradas,
      entrouAndando: this.fase === FASES.CORRENDO
    };
    this.corredores.push(corredor);
    this.porId.set(id, corredor);
    this.#ordenar();
    this.#avisar({ tipo: 'entrou', corredor, daFila, comCorridaAndando: corredor.entrouAndando });
    return corredor;
  }

  #trocar(corredor, tipo) {
    corredor.tipo = tipo;
    corredor.modelo = this.#modeloPara(corredor.id, tipo);
    corredor.trocouEm = this.relogio;
    this.#avisar({ tipo: 'trocou', corredor });
  }

  // O modelo sai do @ da pessoa: ela costuma correr sempre com o mesmo.
  #modeloPara(id, tipo) {
    const lista = this.#modelosPorTipo[tipo]?.length ? this.#modelosPorTipo[tipo] : this.modelos;
    return lista[hashTexto(`${id}:${tipo}`) % lista.length];
  }

  // ---------------------------------------------------------------- tempo

  /** Avanca a corrida em dt segundos (o jogo chama 60 vezes por segundo). */
  atualizar(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.relogio += dt;
    this.tempoFase += dt;
    const r = this.regras;

    switch (this.fase) {
      case FASES.AGUARDANDO:
        if (this.corredores.length) {
          if (this.espera === null) this.espera = r.esperaS;
          if (this.corredores.length >= r.maxCorredores) this.espera = Math.min(this.espera, r.esperaLotadaS);
          this.espera = Math.max(0, this.espera - dt);
          if (this.espera <= 0) {
            this.#mudarFase(FASES.LARGADA);
            this.#avisar({ tipo: 'largada', numero: this.numero });
          }
        }
        break;

      case FASES.LARGADA:
        if (this.tempoFase >= r.largadaS) {
          this.#mudarFase(FASES.CORRENDO);
          this.#avisar({ tipo: 'valendo', numero: this.numero, total: this.corredores.length });
        }
        break;

      case FASES.CORRENDO:
        this.tempoCorrida += dt;
        this.#mover(dt, false);
        if (this.chegada.length) this.#mudarFase(FASES.CHEGADA);
        break;

      case FASES.CHEGADA:
        this.tempoCorrida += dt;
        this.#mover(dt, false);
        if (this.corredores.every((c) => c.chegou) || this.tempoFase >= r.chegadaMaxS) this.#encerrar();
        break;

      case FASES.RESULTADO:
        this.#mover(dt, true);
        if (this.tempoFase >= r.resultadoS) this.#novaCorrida();
        break;
    }
  }

  #mudarFase(fase) {
    this.fase = fase;
    this.tempoFase = 0;
  }

  #encerrar() {
    this.classificacao = this.ordem.slice();
    this.#mudarFase(FASES.RESULTADO);
    this.#avisar({ tipo: 'resultado', numero: this.numero, classificacao: this.classificacao });
  }

  #novaCorrida() {
    this.numero += 1;
    this.fase = FASES.AGUARDANDO;
    this.tempoFase = 0;
    this.tempoCorrida = 0;
    this.espera = null;
    this.corredores = [];
    this.porId = new Map();
    this.chegada = [];
    this.ordem = [];
    this.lider = null;
    this.classificacao = null;
    this.#liderCandidato = null;
    this.#liderAnunciado = null;
    this.#ultimoAnuncioLider = -Infinity;
    this.#avisar({ tipo: 'nova', numero: this.numero });

    // Quem estava na fila entra primeiro, na ordem em que pediu.
    const fila = this.fila;
    this.fila = [];
    for (const pedido of fila) {
      if (this.corredores.length < this.regras.maxCorredores) this.#entrarNoGrid(pedido.usuario, pedido.tipo, true);
      else this.fila.push(pedido);
    }
  }

  // ---------------------------------------------------------------- movimento

  #mover(dt, parando) {
    const r = this.regras;
    let frente = -Infinity;
    for (const c of this.corredores) frente = Math.max(frente, Math.min(c.d, r.distanciaM));

    const cruzaram = [];
    for (const c of this.corredores) {
      if (c.chegou || parando) {
        // Quem cruzou segue no embalo enquanto ainda esta na pista (nao freia na cara
        // de quem vem atras) e so freia depois de sair dela. No podio todos freiam.
        if (parando || !this.#ocupaPista(c)) c.v = Math.max(0, c.v - FREIO * dt);
        c.d += c.v * dt;
        continue;
      }

      c.proximoRitmo -= dt;
      if (c.proximoRitmo <= 0) {
        c.alvoRitmo = 1 + (this.aleatorio() * 2 - 1) * r.variacaoRitmo;
        c.proximoRitmo = this.#sortearEntre(r.trocaRitmoS);
      }
      c.ritmo += (c.alvoRitmo - c.ritmo) * Math.min(1, dt * 0.7);

      const vacuo = Math.min(r.vacuoMax, Math.max(0, frente - c.d) * r.vacuoPorM);
      let alvo = r.velocidadeBase * c.modelo.velocidade * c.ritmo * (1 + vacuo);
      const b = c.bloqueadoPor;
      if (b && this.#ocupaPista(b)) {
        // Segue o da frente deixando ESPACO_M; se encostou demais, tira o pe e abre espaco.
        const folga = b.d - b.modelo.comprimentoM - c.d;
        alvo = Math.min(alvo, Math.max(0, b.v + (folga - ESPACO_M) * 2));
      }

      const a = c.modelo.aceleracao;
      c.v += Math.max(-a * 2 * dt, Math.min(a * dt, alvo - c.v));
      c.d += c.v * dt;
      c.x += Math.max(-TROCA_DE_FAIXA_POR_S * dt, Math.min(TROCA_DE_FAIXA_POR_S * dt, c.alvoX - c.x));

      if (c.d >= r.distanciaM) {
        // Hora exata em que a frente cruzou a linha (dentro deste passo).
        const passou = c.v > 0 ? (c.d - r.distanciaM) / c.v : 0;
        cruzaram.push({ c, tempo: Math.max(0, this.tempoCorrida - passou) });
      }
    }

    cruzaram.sort((a, b) => a.tempo - b.tempo);
    for (const { c, tempo } of cruzaram) this.#cruzouAChegada(c, tempo);

    this.#desvioAcumulado += dt;
    if (this.#desvioAcumulado >= INTERVALO_DESVIO_S) {
      this.#desvioAcumulado = 0;
      this.#desviar();
    }
    this.#separar(dt);
    this.#ordenar();
    this.#acompanharLider();
  }

  // Quem cruzou a chegada continua sendo um obstaculo por NA_PISTA_DEPOIS_DA_CHEGADA_S
  // (a tela o apaga nesse tempo); depois sai da pista e nao trava mais ninguem.
  #ocupaPista(c) {
    return !c.chegou || this.relogio - c.chegouEm < NA_PISTA_DEPOIS_DA_CHEGADA_S;
  }

  // Garantia final de que ninguem atravessa o veiculo da frente na mesma faixa,
  // nem logo depois da chegada.
  #separar(dt) {
    const lista = this.corredores.filter((c) => this.#ocupaPista(c)).sort((a, b) => b.d - a.d);
    for (let i = 1; i < lista.length; i++) {
      const c = lista[i];
      let limite = Infinity;
      let frente = null;
      for (let j = 0; j < i; j++) {
        const o = lista[j];
        if (Math.abs(o.x - c.x) >= MESMA_FAIXA) continue;
        const traseira = o.d - o.modelo.comprimentoM - 0.2;
        if (traseira < limite) {
          limite = traseira;
          frente = o;
        }
      }
      if (frente && c.d > limite) {
        c.d = Math.max(limite, c.d - RECUO_POR_S * dt);
        c.v = Math.min(c.v, frente.v);
      }
    }
  }

  #cruzouAChegada(c, tempo) {
    c.chegou = true;
    c.tempo = tempo;
    c.chegouEm = this.relogio;
    c.bloqueadoPor = null;
    this.chegada.push(c);
    c.colocacao = this.chegada.length;
    this.#avisar({ tipo: 'chegou', corredor: c, colocacao: c.colocacao });
    if (c.colocacao === 1) this.#avisar({ tipo: 'vencedor', corredor: c, numero: this.numero });
  }

  // Quem chega perto de alguem mais lento na mesma faixa tenta ir para uma faixa
  // vizinha livre. Sem faixa livre, segue atras dele (sem atravessar o outro).
  // Quem ja cruzou a chegada nao decide mais nada, mas continua na pista por um tempo.
  #desviar() {
    const todos = this.corredores;
    const ultimaFaixa = this.regras.faixas - 1;

    for (const c of todos) {
      if (c.chegou) continue;
      c.bloqueadoPor = null;
      const frente = this.#quemEstaNaFrente(c, todos);
      if (!frente) continue;
      const folga = frente.d - frente.modelo.comprimentoM - c.d;
      // Quanto mais rapido se aproxima, mais cedo reage.
      const perto = 3 + Math.max(0, c.v - frente.v) * 0.8;
      if (folga > perto || (frente.v > c.v + 0.3 && folga > ESPACO_M)) continue;

      let trocou = false;
      if (Math.abs(c.x - c.alvoX) < 0.05) {
        const lados = this.aleatorio() < 0.5 ? [-1, 1] : [1, -1];
        for (const lado of lados) {
          const faixa = c.alvoX + lado;
          if (faixa >= 0 && faixa <= ultimaFaixa && this.#faixaLivre(faixa, c, todos)) {
            c.alvoX = faixa;
            trocou = true;
            break;
          }
        }
      }
      if (!trocou) c.bloqueadoPor = frente;
    }
  }

  #quemEstaNaFrente(c, todos) {
    let maisPerto = null;
    for (const o of todos) {
      if (o === c || Math.abs(o.x - c.x) >= MESMA_FAIXA || o.d <= c.d || !this.#ocupaPista(o)) continue;
      if (!maisPerto || o.d < maisPerto.d) maisPerto = o;
    }
    return maisPerto;
  }

  #faixaLivre(faixa, c, todos) {
    for (const o of todos) {
      if (o === c || !this.#ocupaPista(o)) continue;
      const mesmaFaixa = Math.abs(o.x - faixa) < 0.75 || Math.abs(o.alvoX - faixa) < 0.5;
      const lado = o.d > c.d - c.modelo.comprimentoM - 4 && o.d - o.modelo.comprimentoM < c.d + 5;
      if (mesmaFaixa && lado) return false;
    }
    return true;
  }

  // Posicoes: primeiro quem ja chegou (na ordem de chegada), depois pela distancia.
  #ordenar() {
    const naPista = this.corredores
      .filter((c) => !c.chegou)
      .sort((a, b) => b.d - a.d || a.numeroEntrada - b.numeroEntrada);
    this.ordem = this.chegada.concat(naPista);
    this.ordem.forEach((c, i) => {
      c.posicao = i + 1;
    });
    this.lider = this.ordem[0] ?? null;
  }

  #acompanharLider() {
    if (this.fase !== FASES.CORRENDO) return;
    const atual = this.ordem[0] ?? null;
    if (atual !== this.#liderCandidato) {
      this.#liderCandidato = atual;
      this.#liderDesde = this.relogio;
    }
    if (
      atual &&
      atual !== this.#liderAnunciado &&
      this.relogio - this.#liderDesde >= LIDER_CONFIRMA_S &&
      this.relogio - this.#ultimoAnuncioLider >= LIDER_INTERVALO_S
    ) {
      const primeiro = this.#liderAnunciado === null;
      this.#liderAnunciado = atual;
      this.#ultimoAnuncioLider = this.relogio;
      this.#avisar({ tipo: 'lider', corredor: atual, primeiro });
    }
  }

  // ---------------------------------------------------------------- utilitarios

  #sortearEntre([min, max]) {
    return min + this.aleatorio() * (max - min);
  }

  #avisar(acontecimento) {
    this.#acontecimentos.push(acontecimento);
    if (this.#acontecimentos.length > LIMITE_ACONTECIMENTOS) this.#acontecimentos.shift();
  }
}
