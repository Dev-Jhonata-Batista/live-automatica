// Fonte falsa para testar sem live: gera comentarios e presentes aleatorios
// no MESMO formato padrao da FonteTikTok. Util para desenvolver o jogo offline.

import { EventEmitter } from 'node:events';
import { TIPOS, STATUS, criarEvento, criarUsuario } from './eventos.js';

// 40 espectadores falsos: da para ver o grid enchendo e gente entrando no meio da corrida.
const NOMES = [
  'ana_lu', 'pedrinho.gg', 'julia_s2', 'marcos77', 'bia.oficial', 'rafa_turbo', 'leo_games', 'duda.r',
  'carol.zz', 'gui_play', 'nanda.m', 'thiago_rx', 'lari.br', 'joao.vitor', 'mel_doce', 'caio.speed',
  'bruna_k', 'davi.z', 'sofia.art', 'igor_tt', 'vivi.luz', 'enzo_pro', 'lua.mari', 'teteu_09',
  'manu.ff', 'rick_br', 'isa.bela', 'fefe_22', 'otavio.x', 'paty.on', 'lucas_7', 'nina.cat',
  'vitor.gg', 'lele_s', 'breno.rs', 'jade.m', 'kaka_10', 'tati.vlog', 'samuca', 'helo.zz'
];
const COMENTARIOS = [
  'carro', 'moto', 'CARRO!!', 'quero moto', 'carro', 'moto', 'eu quero carro', 'moto pfv',
  'vai vai vai', 'kkkkk', 'boa noite', 'acelera!!', 'quem ta ganhando?'
];
// IDs falsos (sim-N): os IDs reais aparecem no modo --debug com uma live de verdade.
const PRESENTES = [
  { presenteId: 'sim-1', nome: 'Rose', moedas: 1, combo: true },
  { presenteId: 'sim-2', nome: 'TikTok', moedas: 1, combo: true },
  { presenteId: 'sim-3', nome: 'Ice Cream Cone', moedas: 1, combo: true },
  { presenteId: 'sim-4', nome: 'GG', moedas: 1, combo: true },
  { presenteId: 'sim-5', nome: 'Heart Me', moedas: 1, combo: false },
  { presenteId: 'sim-6', nome: 'Doughnut', moedas: 30, combo: false }
];

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

export class FonteSimulada extends EventEmitter {
  constructor(arroba = 'simulador') {
    super();
    this.arroba = arroba;
    this.timers = []; // setInterval de comentarios, presentes e curtidas
    this.esperas = new Set(); // setTimeout dos combos (cada um sai daqui quando dispara)
  }

  iniciar() {
    this.emit('status', { status: STATUS.CONECTADO, mensagem: `Modo teste ligado (live falsa de @${this.arroba}).` });
    this.timers.push(setInterval(() => this.#comentario(), 900));
    this.timers.push(setInterval(() => this.#presente(), 2500));
    this.timers.push(setInterval(() => this.#curtida(), 4000));
  }

  async parar() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.esperas.forEach(clearTimeout);
    this.esperas.clear();
    this.emit('status', { status: STATUS.PARADO, mensagem: 'Modo teste desligado.' });
  }

  #usuario() {
    const arroba = sortear(NOMES);
    return criarUsuario({ id: `sim-${arroba}`, arroba, nome: arroba.replace(/[._]/g, ' ') });
  }

  #depois(ms, funcao) {
    const espera = setTimeout(() => {
      this.esperas.delete(espera);
      funcao();
    }, ms);
    this.esperas.add(espera);
  }

  #emitir(tipo, usuario, dados) {
    this.emit('evento', criarEvento({ tipo, plataforma: 'simulador', usuario, dados }));
  }

  #comentario() {
    this.#emitir(TIPOS.COMENTARIO, this.#usuario(), { texto: sortear(COMENTARIOS) });
  }

  #curtida() {
    this.#emitir(TIPOS.CURTIDA, this.#usuario(), { quantidade: 1 + Math.floor(Math.random() * 15), totalDaLive: 0 });
  }

  #presente() {
    const usuario = this.#usuario();
    const p = sortear(PRESENTES);
    const comboId = `${usuario.id}:${Date.now()}:${p.presenteId}`;
    const base = { presenteId: p.presenteId, nome: p.nome, moedas: p.moedas, comboId, imagem: null };

    if (!p.combo) {
      this.#emitir(TIPOS.PRESENTE, usuario, { ...base, quantidade: 1, final: true });
      return;
    }

    // Combo: manda a contagem subindo e depois o evento final, igual ao TikTok.
    const total = 1 + Math.floor(Math.random() * 10);
    for (let i = 1; i <= total; i++) {
      this.#depois(i * 150, () => {
        this.#emitir(TIPOS.PRESENTE, usuario, { ...base, quantidade: i, final: false });
      });
    }
    this.#depois((total + 1) * 150, () => {
      this.#emitir(TIPOS.PRESENTE, usuario, { ...base, quantidade: total, final: true });
    });
  }
}
