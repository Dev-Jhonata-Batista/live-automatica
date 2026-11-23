// Liga e desliga a conexao com a live (real ou simulada) e repassa
// os eventos no formato padrao para quem estiver ouvindo (o main.js).
//
// Emite:
//   'status' -> { status, mensagem, proximaTentativaEmMs, simulador }
//   'evento' -> evento no formato de src/live/eventos.js

import { EventEmitter } from 'node:events';
import { FonteTikTok } from '../live/tiktok.js';
import { FonteSimulada } from '../live/simulador.js';
import { STATUS } from '../live/eventos.js';

const LIMITE_PARA_PARAR_MS = 3000;

export class SessaoLive extends EventEmitter {
  constructor() {
    super();
    this.fonte = null;
    this.simulador = false;
  }

  get ativa() {
    return this.fonte !== null;
  }

  async iniciar({ arroba, simulador, chaveEuler }) {
    await this.parar();

    this.simulador = Boolean(simulador);
    const fonte = this.simulador
      ? new FonteSimulada(arroba || 'teste')
      : new FonteTikTok(arroba, { chaveEuler });
    this.fonte = fonte;

    // So repassa o que vier da fonte atual (uma fonte antiga pode emitir algo atrasado).
    fonte.on('status', (s) => {
      if (this.fonte === fonte) this.emit('status', { ...s, simulador: this.simulador });
    });
    fonte.on('evento', (ev) => {
      if (this.fonte === fonte) this.emit('evento', ev);
    });

    fonte.iniciar();
  }

  async parar() {
    const fonte = this.fonte;
    if (!fonte) return;
    this.fonte = null;

    // Nao deixa o launcher travar se o TikTok demorar para fechar a conexao.
    await Promise.race([
      fonte.parar().catch(() => {}),
      new Promise((resolver) => setTimeout(resolver, LIMITE_PARA_PARAR_MS))
    ]);
    fonte.removeAllListeners();

    if (!this.fonte) {
      this.emit('status', { status: STATUS.PARADO, mensagem: 'Desligado.', simulador: this.simulador });
    }
  }
}
