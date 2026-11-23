// Regras da partida do "Fuga Neon", sem nada de desenho (dá para testar no Node).
//
// Uma RODADA: PREPARAÇÃO -> ASSALTO -> FUGA -> RESULTADO -> (próxima rodada, outro bairro)
//
// O estado principal é a VANTAGEM: quantos metros o carro da fuga está à frente da
// polícia. A polícia encosta sozinha; comentários, curtidas, follows, compartilhamentos
// e presentes empurram a vantagem para um lado ou para o outro.
//   vantagem chegou a 0        -> PRESOS   (polícia vence)
//   tempo da fuga acabou       -> FUGIRAM  (ladrões vencem)
//
// Quem usa: jogo.js chama aoEvento() com os eventos da live, atualizar(dt) a cada
// 1/60 s e retirarAcontecimentos() para mostrar na tela o que aconteceu.

import { EQUIPES, lerEquipe } from './entrada.js';
import { ACOES, lerTabelaDePresentes, nivelDoPresente, pesoDaUnidade } from './acoes.js';

export const FASES = Object.freeze({
  PREPARACAO: 'preparacao',
  ASSALTO: 'assalto',
  FUGA: 'fuga',
  RESULTADO: 'resultado'
});

export const SURPRESAS = Object.freeze([
  { id: 'chuva', nome: 'CHUVA FORTE', texto: 'Pista molhada: a polícia anda mais devagar' },
  { id: 'apagao', nome: 'APAGÃO', texto: 'No escuro, toda ação vale o dobro' },
  { id: 'transito', nome: 'ENGARRAFAMENTO', texto: 'Ninguém sai do lugar: só as ações movem' }
]);

const LIMITE_COMBOS = 2000;

function limitar(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class Partida {
  /**
   * @param {object} opcoes
   * @param {object} opcoes.regras    REGRAS de regras.js
   * @param {object[]} opcoes.bairros BAIRROS de regras.js
   * @param {object} [opcoes.config]  config do jogo vinda do launcher ({ presentes, meta })
   * @param {object} [opcoes.recordes] { maiorFuga: {m, arrobas}, capturaRapida: {s, arrobas} }
   * @param {() => number} [opcoes.sortear] Math.random (trocável nos testes)
   */
  constructor({ regras, bairros, config = {}, recordes = {}, sortear = Math.random }) {
    this.regras = regras;
    this.bairros = bairros;
    this.sortear = sortear;
    this.tabelaPresentes = lerTabelaDePresentes(config);
    this.meta = lerMeta(config);
    this.recordes = {
      maiorFuga: recordes.maiorFuga ?? null,
      capturaRapida: recordes.capturaRapida ?? null
    };

    this.jogadores = new Map(); // id -> { usuario, equipe, pontosRodada, pontosNoite, moedasNoite, ultimoComentario }
    this.placarNoite = { [EQUIPES.LADROES]: 0, [EQUIPES.POLICIA]: 0 };
    this.combos = new Map(); // comboId -> unidades já aplicadas
    this.acontecimentos = [];
    this.relogio = 0; // segundos desde que o jogo abriu

    this.rodada = 0;
    this.bairroIndice = -1;
    this.#novaRodada();
  }

  // ---------------------------------------------------------------- leitura (para a tela)

  get bairro() {
    return this.bairros[this.bairroIndice % this.bairros.length];
  }

  get tempoRestante() {
    const r = this.regras;
    const duracao = {
      [FASES.PREPARACAO]: r.preparacaoS,
      [FASES.ASSALTO]: r.assaltoS,
      [FASES.FUGA]: r.fugaS,
      [FASES.RESULTADO]: r.resultadoS
    }[this.fase];
    return Math.max(0, duracao - this.tempoNaFase);
  }

  get retaFinal() {
    return this.fase === FASES.FUGA && this.tempoRestante <= this.regras.retaFinalS;
  }

  get escudoAtivo() {
    return this.escudoRestante > 0;
  }

  contarEquipe(equipe) {
    let n = 0;
    for (const j of this.jogadores.values()) if (j.equipe === equipe) n += 1;
    return n;
  }

  /** Os N com mais pontos na rodada, de uma equipe. */
  rankingRodada(equipe, n = 3) {
    return [...this.jogadores.values()]
      .filter((j) => j.equipe === equipe && j.pontosRodada > 0)
      .sort((a, b) => b.pontosRodada - a.pontosRodada)
      .slice(0, n);
  }

  /** Destaques da noite: quem mais ajudou com presentes, depois com pontos. */
  destaquesDaNoite(n = 3) {
    return [...this.jogadores.values()]
      .filter((j) => j.pontosNoite > 0)
      .sort((a, b) => b.moedasNoite - a.moedasNoite || b.pontosNoite - a.pontosNoite)
      .slice(0, n);
  }

  retirarAcontecimentos() {
    const lista = this.acontecimentos;
    this.acontecimentos = [];
    return lista;
  }

  // ---------------------------------------------------------------- entrada da live

  aoEvento(evento) {
    if (!evento || !evento.usuario) return;
    const dados = evento.dados || {};
    switch (evento.tipo) {
      case 'comentario':
        this.#comentario(evento.usuario, dados.texto);
        break;
      case 'curtida':
        this.#gratis(evento.usuario, 'curtida', Math.min(this.regras.curtidaMaximaM, (Number(dados.quantidade) || 1) * this.regras.curtidaM), (Number(dados.quantidade) || 1) * this.regras.pontosCurtida);
        break;
      case 'seguiu':
        this.#gratis(evento.usuario, 'seguiu', this.regras.seguiuM, this.regras.pontosSeguiu, true);
        break;
      case 'compartilhou':
        this.#gratis(evento.usuario, 'compartilhou', this.regras.compartilhouM, this.regras.pontosCompartilhou, true);
        break;
      case 'presente':
        this.#presente(evento.usuario, dados);
        break;
      default:
        break;
    }
  }

  #jogador(usuario) {
    return this.jogadores.get(String(usuario.id || usuario.arroba));
  }

  #entrar(usuario, equipe, motivo = 'comentou') {
    const id = String(usuario.id || usuario.arroba);
    if (!id) return null;
    let jogador = this.jogadores.get(id);
    if (jogador) {
      jogador.usuario = usuario; // foto e nome podem mudar
      if (jogador.equipe === equipe) return jogador;
      // Trocar de lado só antes do assalto, para ninguém virar a casaca no meio da fuga.
      if (this.fase !== FASES.PREPARACAO && this.fase !== FASES.RESULTADO) return jogador;
      jogador.equipe = equipe;
      this.#acontecer({ tipo: 'entrou', usuario, equipe, trocou: true });
      return jogador;
    }
    if (this.contarEquipe(equipe) >= this.regras.maxPorEquipe) return null;
    jogador = { usuario, equipe, pontosRodada: 0, pontosNoite: 0, moedasNoite: 0, ultimoComentario: -Infinity };
    this.jogadores.set(id, jogador);
    this.#acontecer({ tipo: 'entrou', usuario, equipe, trocou: false, motivo });
    return jogador;
  }

  #comentario(usuario, texto) {
    const pedido = lerEquipe(texto);
    let jogador = this.#jogador(usuario);
    if (pedido) {
      jogador = this.#entrar(usuario, pedido) ?? jogador;
    }
    if (!jogador) return;
    // Todo comentário de quem está numa equipe empurra um pouco (com intervalo por pessoa).
    if (this.relogio - jogador.ultimoComentario < this.regras.intervaloComentarioS) return;
    jogador.ultimoComentario = this.relogio;
    this.#pontuar(jogador, this.regras.pontosComentario);
    this.#empurrar(jogador, this.regras.comentarioM, { tipo: 'empurrao', fonte: 'comentario' });
  }

  #gratis(usuario, fonte, metros, pontos, destaque = false) {
    const jogador = this.#jogador(usuario);
    if (!jogador) return;
    this.#pontuar(jogador, pontos);
    this.#empurrar(jogador, metros, { tipo: destaque ? 'gratis' : 'empurrao', fonte });
  }

  #presente(usuario, dados) {
    let jogador = this.#jogador(usuario);
    if (!jogador && this.regras.entrarAoPresentear) {
      const menor = this.contarEquipe(EQUIPES.LADROES) <= this.contarEquipe(EQUIPES.POLICIA) ? EQUIPES.LADROES : EQUIPES.POLICIA;
      jogador = this.#entrar(usuario, menor, 'presente');
    }
    if (!jogador) return;
    jogador.usuario = usuario;

    // Combo: aplica só as unidades novas desde o último aviso deste combo.
    const total = Math.max(1, Math.floor(Number(dados.quantidade) || 1));
    const chave = dados.comboId ? String(dados.comboId) : null;
    const jaAplicadas = chave ? this.combos.get(chave) || 0 : 0;
    const novas = total - jaAplicadas;
    if (chave) {
      if (dados.final) this.combos.delete(chave);
      else {
        this.combos.set(chave, Math.max(total, jaAplicadas));
        if (this.combos.size > LIMITE_COMBOS) this.combos.delete(this.combos.keys().next().value);
      }
    }
    if (novas <= 0) return;

    const moedas = Math.max(0, Number(dados.moedas) || 0) * novas;
    jogador.moedasNoite += moedas;
    this.#pontuar(jogador, Math.max(1, moedas) * this.regras.pontosPorMoeda);
    this.#contarMeta(dados.nome, novas, usuario);

    const nivel = nivelDoPresente(dados, this.tabelaPresentes);
    const acao = ACOES[jogador.equipe][nivel];
    let peso = 0;
    for (let u = jaAplicadas + 1; u <= total; u += 1) peso += pesoDaUnidade(u);

    if (acao.estrelas && this.fase === FASES.FUGA) {
      this.estrelas = Math.min(this.regras.maxEstrelas, this.estrelas + acao.estrelas);
    }
    if (acao.efeito === 'escudo' && this.fase === FASES.FUGA) {
      this.escudoRestante = Math.max(this.escudoRestante, acao.s);
    }
    this.#empurrar(jogador, Math.abs(acao.m) * peso, {
      tipo: 'acao',
      nivel,
      acao,
      unidades: total,
      presente: String(dados.nome || ''),
      fonte: 'presente'
    });
  }

  #pontuar(jogador, pontos) {
    jogador.pontosRodada += pontos;
    jogador.pontosNoite += pontos;
  }

  // metros sempre positivos aqui; o sinal vem da equipe.
  #empurrar(jogador, metros, info) {
    const equipe = jogador.equipe;
    const base = { ...info, usuario: jogador.usuario, equipe };

    if (this.fase !== FASES.FUGA) {
      // Fora da fuga, tudo enche o cofre (ladrões) ou o alarme (polícia) da próxima fuga.
      if (equipe === EQUIPES.LADROES) this.cofre += metros;
      else this.alarme += metros;
      this.#acontecer({ ...base, m: 0, preparo: true });
      return;
    }

    let m = metros * (this.retaFinal ? this.regras.multiplicadorRetaFinal : 1);
    if (this.surpresa?.id === 'apagao') m *= 2;
    if (this.surpresa?.id === 'festa') m *= 2;
    // Chance de virada: quanto mais perto do fim (prisão ou fuga livre), mais difícil
    // empurrar ainda mais para aquele lado. A rodada fica disputada até o fim.
    const r = this.regras;
    if (equipe === EQUIPES.POLICIA) m *= limitar(this.vantagem / r.resistenciaPertoM, r.resistenciaMinima, 1);
    else m *= limitar((r.vantagemMaximaM - this.vantagem) / r.resistenciaLongeM, r.resistenciaMinima, 1);
    if (equipe === EQUIPES.POLICIA) {
      if (this.escudoAtivo) {
        this.#acontecer({ ...base, tipo: info.tipo === 'acao' ? 'bloqueado' : info.tipo, m: 0, bloqueado: true });
        return;
      }
      m = -m;
    }

    this.vantagem = Math.min(this.regras.vantagemMaximaM, this.vantagem + m);
    this.maiorVantagem = Math.max(this.maiorVantagem, this.vantagem);
    this.#acontecer({ ...base, m });
    this.#conferirCaptura(jogador);
  }

  // ---------------------------------------------------------------- meta da live

  #contarMeta(nomePresente, unidades, usuario) {
    const meta = this.meta;
    if (!meta) return;
    if (String(nomePresente || '').trim().toLowerCase() !== meta.presente.toLowerCase()) return;
    meta.atual += unidades;
    if (meta.atual < meta.quantidade) return;
    meta.atual = 0;
    meta.vezes += 1;
    this.#acontecer({ tipo: 'meta', meta: { ...meta }, usuario });
    // Recompensa: FESTA NEON (toda ação vale o dobro) agora ou na próxima fuga.
    if (this.fase === FASES.FUGA) this.#iniciarSurpresa({ id: 'festa', nome: meta.recompensa, texto: 'Meta batida! Toda ação vale o dobro' });
    else this.festaPendente = true;
  }

  // ---------------------------------------------------------------- tempo

  atualizar(dt) {
    this.relogio += dt;
    this.tempoNaFase += dt;

    switch (this.fase) {
      case FASES.PREPARACAO:
        if (this.tempoNaFase >= this.regras.preparacaoS) this.#irPara(FASES.ASSALTO);
        break;
      case FASES.ASSALTO:
        if (this.tempoNaFase >= this.regras.assaltoS) this.#comecarFuga();
        break;
      case FASES.FUGA:
        this.#atualizarFuga(dt);
        break;
      case FASES.RESULTADO:
        if (this.tempoNaFase >= this.regras.resultadoS) this.#novaRodada();
        break;
      default:
        break;
    }
  }

  #atualizarFuga(dt) {
    const r = this.regras;
    this.escudoRestante = Math.max(0, this.escudoRestante - dt);

    if (this.surpresa) {
      this.surpresa.restante -= dt;
      if (this.surpresa.restante <= 0) {
        this.#acontecer({ tipo: 'surpresa_fim', surpresa: this.surpresa });
        this.surpresa = null;
      }
    } else if (this.surpresaEm !== null && this.tempoNaFase >= this.surpresaEm) {
      this.surpresaEm = null;
      const s = SURPRESAS[Math.floor(this.sortear() * SURPRESAS.length)];
      this.#iniciarSurpresa(s);
    }

    let avanco = this.avancoPolicia * (1 + (this.estrelas - 1) * r.porEstrela);
    if (this.vantagem > r.longeM) avanco += r.ajudaPoliciaLonge;
    if (this.vantagem < r.pertoM) avanco -= r.ajudaLadroesPerto;
    if (this.surpresa?.id === 'chuva') avanco *= 0.55;
    if (this.surpresa?.id === 'transito') avanco = 0;

    this.vantagem -= avanco * dt;

    if (!this.avisouQuase && this.vantagem < 10 && this.tempoNaFase > 5) {
      this.avisouQuase = true;
      this.#acontecer({ tipo: 'quase' });
    }
    if (this.avisouQuase && this.vantagem > 25) this.avisouQuase = false;

    if (!this.avisouRetaFinal && this.retaFinal) {
      this.avisouRetaFinal = true;
      this.#acontecer({ tipo: 'reta_final' });
    }

    if (this.#conferirCaptura(null)) return;
    // Vantagem enorme depois do início da fuga: os ladrões somem no esconderijo.
    if (this.tempoNaFase >= r.capturaLiberadaS && this.vantagem >= r.vantagemEsconderijoM) {
      this.escondeu = true;
      this.#terminar(EQUIPES.LADROES);
      return;
    }
    if (this.tempoNaFase >= r.fugaS) this.#terminar(EQUIPES.LADROES);
  }

  #conferirCaptura(jogador) {
    if (this.fase !== FASES.FUGA || this.vantagem > 0) return false;
    // No começo da fuga a polícia ainda não consegue prender: a rodada sempre tem perseguição.
    if (this.tempoNaFase < this.regras.capturaLiberadaS) {
      this.vantagem = this.regras.vantagemMinimaAntesDaCapturaM;
      return false;
    }
    this.vantagem = 0;
    this.capturadoPor = jogador?.equipe === EQUIPES.POLICIA ? jogador.usuario : null;
    this.#terminar(EQUIPES.POLICIA);
    return true;
  }

  #iniciarSurpresa(s) {
    this.surpresa = { ...s, restante: this.regras.surpresaDuracaoS };
    this.#acontecer({ tipo: 'surpresa', surpresa: this.surpresa });
  }

  #irPara(fase) {
    this.fase = fase;
    this.tempoNaFase = 0;
    this.#acontecer({ tipo: 'fase', fase });
  }

  #novaRodada() {
    this.rodada += 1;
    this.bairroIndice += 1;
    for (const j of this.jogadores.values()) j.pontosRodada = 0;
    this.vantagem = this.regras.vantagemInicialM;
    this.maiorVantagem = this.vantagem;
    this.estrelas = 1;
    this.escudoRestante = 0;
    this.surpresa = null;
    this.surpresaEm = null;
    this.avisouQuase = false;
    this.avisouRetaFinal = false;
    this.capturadoPor = null;
    this.escondeu = false;
    this.resultado = null;
    if (this.rodada === 1) {
      this.cofre = 0;
      this.alarme = 0;
    }
    this.#irPara(FASES.PREPARACAO);
  }

  #comecarFuga() {
    const r = this.regras;
    const diferenca = this.cofre - this.alarme;
    const total = this.cofre + this.alarme;
    this.vantagem = limitar(
      r.vantagemInicialM + (r.vantagemAssaltoM * diferenca) / (total + 20),
      r.vantagemMinimaInicialM,
      r.vantagemMaximaM
    );
    this.vantagemInicial = this.vantagem;
    this.maiorVantagem = this.vantagem;
    this.cofre = 0;
    this.alarme = 0;
    this.avancoPolicia = r.avancoPoliciaMin + this.sortear() * (r.avancoPoliciaMax - r.avancoPoliciaMin);

    // Evento surpresa a cada N rodadas, num momento sorteado antes da reta final.
    if (this.rodada % r.rodadasEntreSurpresas === 0) {
      const inicio = 30;
      const fim = Math.max(inicio + 1, r.fugaS - r.retaFinalS - r.surpresaDuracaoS);
      this.surpresaEm = inicio + this.sortear() * (fim - inicio);
    }

    this.#irPara(FASES.FUGA);
    if (this.festaPendente) {
      this.festaPendente = false;
      this.#iniciarSurpresa({ id: 'festa', nome: this.meta?.recompensa || 'FESTA NEON', texto: 'Meta batida! Toda ação vale o dobro' });
    }
  }

  #terminar(vencedor) {
    const tempo = this.tempoNaFase;
    this.placarNoite[vencedor] += 1;
    const mvpLadroes = this.rankingRodada(EQUIPES.LADROES, 1)[0]?.usuario ?? null;
    const mvpPolicia = this.rankingRodada(EQUIPES.POLICIA, 1)[0]?.usuario ?? null;

    let recorde = null;
    if (vencedor === EQUIPES.LADROES) {
      const m = Math.round(this.vantagem);
      if (this.contarEquipe(EQUIPES.LADROES) > 0 && (!this.recordes.maiorFuga || m > this.recordes.maiorFuga.m)) {
        this.recordes.maiorFuga = { m, arroba: mvpLadroes?.arroba || '', quando: Date.now() };
        recorde = { tipo: 'maiorFuga', ...this.recordes.maiorFuga };
      }
    } else {
      const s = Math.round(tempo);
      if (this.contarEquipe(EQUIPES.POLICIA) > 0 && (!this.recordes.capturaRapida || s < this.recordes.capturaRapida.s)) {
        this.recordes.capturaRapida = { s, arroba: mvpPolicia?.arroba || '', quando: Date.now() };
        recorde = { tipo: 'capturaRapida', ...this.recordes.capturaRapida };
      }
    }

    this.resultado = {
      vencedor,
      vantagemFinal: Math.round(this.vantagem),
      tempoS: Math.round(tempo),
      capturadoPor: this.capturadoPor,
      escondeu: Boolean(this.escondeu),
      mvpLadroes,
      mvpPolicia,
      recorde,
      placarNoite: { ...this.placarNoite }
    };
    this.surpresa = null;
    this.escudoRestante = 0;
    this.#irPara(FASES.RESULTADO);
    this.#acontecer({ tipo: 'resultado', resultado: this.resultado });
  }

  #acontecer(a) {
    this.acontecimentos.push({ ...a, quando: this.relogio });
  }
}

function lerMeta(config) {
  const m = config?.meta;
  if (!m || typeof m !== 'object' || !m.ativa) return null;
  const presente = String(m.presente || '').trim();
  const quantidade = Math.floor(Number(m.quantidade));
  if (!presente || !(quantidade > 0)) return null;
  return {
    presente,
    quantidade,
    recompensa: String(m.recompensa || 'FESTA NEON').trim().slice(0, 30).toUpperCase(),
    atual: 0,
    vezes: 0
  };
}
