// Adaptador do TikTok: conecta na live de um @ usando a biblioteca nao oficial
// tiktok-live-connector e converte tudo para o formato padrao de src/eventos.js.
//
// Emite:
//   'evento' -> objeto no formato padrao (comentario, presente, curtida...)
//   'status' -> { status: STATUS.*, mensagem, tentativa, proximaTentativaEmMs }
//   'bruto'  -> (nomeDoEvento, dadosOriginais)   so quando debug = true

import { EventEmitter } from 'node:events';
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
  UserOfflineError,
  SignatureRateLimitError,
  InvalidUniqueIdError
} from 'tiktok-live-connector';
import { TIPOS, STATUS, criarEvento, criarUsuario } from './eventos.js';

const PLATAFORMA = 'tiktok';

// Tempo de espera entre tentativas de reconexao (ms): 5s, 10s, 20s, 40s, depois 60s fixo.
const ESPERAS_RECONEXAO = [5000, 10000, 20000, 40000, 60000];
// Quando a live esta offline, verifica de novo a cada 30s.
const ESPERA_LIVE_OFFLINE = 30000;

export class FonteTikTok extends EventEmitter {
  /**
   * @param {string} arroba  @ do streamer (com ou sem @, ou link da live)
   * @param {object} [opcoes]
   * @param {string} [opcoes.chaveEuler]  chave opcional do Euler Stream (aumenta limites)
   * @param {boolean} [opcoes.debug]      emite os dados originais no evento 'bruto'
   */
  constructor(arroba, opcoes = {}) {
    super();
    this.arroba = String(arroba || '').trim().replace(/^@/, '');
    this.chaveEuler = opcoes.chaveEuler || undefined;
    this.debug = Boolean(opcoes.debug);

    this.conexao = null;
    this.ativo = false;        // true entre iniciar() e parar()
    this.tentativa = 0;
    this.timerReconexao = null;
    this.conectando = false;
  }

  iniciar() {
    if (this.ativo) return;
    this.ativo = true;
    this.tentativa = 0;
    this.#conectar();
  }

  async parar() {
    this.ativo = false;
    clearTimeout(this.timerReconexao);
    this.timerReconexao = null;
    await this.#descartarConexao();
    this.#status(STATUS.PARADO, 'Conexao encerrada.');
  }

  // ---------------------------------------------------------------- interno

  async #conectar() {
    if (!this.ativo || this.conectando) return;
    this.conectando = true;
    this.tentativa += 1;

    await this.#descartarConexao();
    // O PARAR pode ter chegado enquanto a conexao antiga fechava.
    if (!this.ativo) {
      this.conectando = false;
      return;
    }

    this.#status(
      this.tentativa === 1 ? STATUS.CONECTANDO : STATUS.RECONECTANDO,
      `Conectando na live de @${this.arroba}...`
    );

    // Cria uma conexao nova a cada tentativa (evita estado velho da anterior).
    // Obs.: o objeto de opcoes precisa ser passado, mesmo vazio (na v2.5.0 o construtor
    // quebra com "reading 'processInitialData'" se ele for omitido).
    const opcoes = { processInitialData: false };
    if (this.chaveEuler) opcoes.signApiKey = this.chaveEuler;

    const conexao = new TikTokLiveConnection(this.arroba, opcoes);
    this.conexao = conexao;
    this.#registrarEventos(conexao);

    try {
      const estado = await conexao.connect();
      if (!this.ativo || this.conexao !== conexao) {
        fecharSemAvisar(conexao); // parou durante a conexao: nao deixa uma conexao solta
        return;
      }
      this.tentativa = 0;
      this.#status(STATUS.CONECTADO, `Conectado na live de @${this.arroba} (sala ${estado.roomId}).`);
    } catch (erro) {
      if (this.conexao !== conexao) return;
      this.#tratarFalhaDeConexao(erro);
    } finally {
      this.conectando = false;
    }
  }

  #tratarFalhaDeConexao(erro) {
    if (erro instanceof InvalidUniqueIdError) {
      this.ativo = false;
      this.#status(STATUS.ERRO, `@ invalido: "${this.arroba}". Confira o nome de usuario.`);
      return;
    }

    if (erro instanceof UserOfflineError) {
      this.#status(STATUS.OFFLINE, `@${this.arroba} nao esta ao vivo agora.`, ESPERA_LIVE_OFFLINE);
      this.#agendarReconexao(ESPERA_LIVE_OFFLINE);
      return;
    }

    const espera = this.#proximaEspera();
    let mensagem = `Falha ao conectar: ${descreverErro(erro)}`;
    if (erro instanceof SignatureRateLimitError) {
      mensagem = 'Limite gratuito do servidor de assinatura (Euler Stream) atingido. ' +
        'Espere um pouco ou configure uma chave em EULER_API_KEY.';
    }
    this.#status(STATUS.ERRO, mensagem, espera);
    this.#agendarReconexao(espera);
  }

  #proximaEspera() {
    const indice = Math.min(this.tentativa - 1, ESPERAS_RECONEXAO.length - 1);
    return ESPERAS_RECONEXAO[Math.max(indice, 0)];
  }

  #agendarReconexao(esperaMs) {
    if (!this.ativo) return;
    clearTimeout(this.timerReconexao);
    this.timerReconexao = setTimeout(() => this.#conectar(), esperaMs);
  }

  async #descartarConexao() {
    const antiga = this.conexao;
    this.conexao = null;
    if (!antiga) return;
    antiga.removeAllListeners();
    // Mantem um ouvinte de erro para nenhum erro tardio derrubar o processo.
    antiga.on(ControlEvent.ERROR, () => {});
    try {
      await antiga.disconnect();
    } catch {
      // ignorado: a conexao antiga ja pode estar fechada
    }
  }

  #registrarEventos(conexao) {
    const daConexaoAtual = (fn) => (...args) => {
      if (this.conexao === conexao) fn(...args);
    };

    // ---- controle
    conexao.on(ControlEvent.DISCONNECTED, daConexaoAtual(({ code, reason } = {}) => {
      if (!this.ativo) return;
      const espera = this.#proximaEspera();
      this.#status(
        STATUS.RECONECTANDO,
        `Desconectado (${code ?? '?'}${reason ? `: ${reason}` : ''}). Reconectando...`,
        espera
      );
      this.#agendarReconexao(espera);
    }));

    conexao.on(ControlEvent.ERROR, daConexaoAtual(({ info, exception } = {}) => {
      // Erros de leitura de uma mensagem isolada nao derrubam a conexao: so registramos.
      if (this.debug) {
        this.emit('bruto', 'erro', { info, mensagem: descreverErro(exception) });
      }
    }));

    conexao.on(WebcastEvent.STREAM_END, daConexaoAtual(() => {
      this.#emitir(TIPOS.LIVE_ENCERRADA, null, {});
      this.#status(STATUS.OFFLINE, `A live de @${this.arroba} terminou.`, ESPERA_LIVE_OFFLINE);
      this.#agendarReconexao(ESPERA_LIVE_OFFLINE);
    }));

    // ---- mensagens da live
    conexao.on(WebcastEvent.CHAT, daConexaoAtual((dados) => {
      this.#bruto('chat', dados);
      const texto = (dados.content ?? dados.comment ?? '').toString();
      this.#emitir(TIPOS.COMENTARIO, converterUsuario(dados.user), { texto });
    }));

    conexao.on(WebcastEvent.GIFT, daConexaoAtual((dados) => {
      this.#bruto('gift', dados);
      this.#emitir(TIPOS.PRESENTE, converterUsuario(dados.user), converterPresente(dados));
    }));

    conexao.on(WebcastEvent.LIKE, daConexaoAtual((dados) => {
      this.#bruto('like', dados);
      this.#emitir(TIPOS.CURTIDA, converterUsuario(dados.user), {
        quantidade: Number(dados.count ?? dados.likeCount ?? 0),
        totalDaLive: Number(dados.total ?? dados.totalLikeCount ?? 0)
      });
    }));

    conexao.on(WebcastEvent.FOLLOW, daConexaoAtual((dados) => {
      this.#bruto('follow', dados);
      this.#emitir(TIPOS.SEGUIU, converterUsuario(dados.user), {});
    }));

    conexao.on(WebcastEvent.SHARE, daConexaoAtual((dados) => {
      this.#bruto('share', dados);
      this.#emitir(TIPOS.COMPARTILHOU, converterUsuario(dados.user), {});
    }));

    conexao.on(WebcastEvent.MEMBER, daConexaoAtual((dados) => {
      this.#bruto('member', dados);
      this.#emitir(TIPOS.ENTROU, converterUsuario(dados.user), {});
    }));

    conexao.on(WebcastEvent.ROOM_USER, daConexaoAtual((dados) => {
      this.#bruto('roomUser', dados);
      const total = Number(dados.total ?? dados.viewerCount ?? 0);
      this.#emitir(TIPOS.ESPECTADORES, null, { total });
    }));
  }

  #emitir(tipo, usuario, dados) {
    this.emit('evento', criarEvento({ tipo, plataforma: PLATAFORMA, usuario, dados }));
  }

  #bruto(nome, dados) {
    if (this.debug) this.emit('bruto', nome, dados);
  }

  #status(status, mensagem, proximaTentativaEmMs = null) {
    this.emit('status', { status, mensagem, tentativa: this.tentativa, proximaTentativaEmMs });
  }
}

// ------------------------------------------------------------------ conversores
// A biblioteca v2.5.0 usa os campos do "tiktok-live-proto/v3" (ex.: user.displayId,
// content, gift.name). O README dela ainda mostra nomes antigos (uniqueId, comment,
// giftDetails.giftName). Lemos os dois para continuar funcionando se mudar de novo.

export function converterUsuario(user) {
  if (!user) return null;
  const foto =
    user.avatarThumb?.urlList?.[0] ??
    user.profilePicture?.urlList?.[0] ??
    user.profilePictureUrl ??
    null;
  return criarUsuario({
    id: user.id ?? user.userId,
    arroba: user.displayId ?? user.uniqueId ?? '',
    nome: user.nickname,
    foto
  });
}

export function converterPresente(dados) {
  const presente = dados.gift ?? dados.giftDetails ?? {};
  const extra = dados.extendedGiftInfo ?? {};

  const tipoPresente = Number(presente.type ?? presente.giftType ?? 0);
  const repeteEmCombo = tipoPresente === 1;
  // repeatEnd vem como numero (0/1) no proto v3 e como boolean em versoes antigas.
  const fimDoCombo = Boolean(Number(dados.repeatEnd ?? 0));

  return {
    presenteId: String(dados.giftId ?? presente.id ?? ''),
    nome: presente.name ?? presente.giftName ?? extra.name ?? 'Presente',
    moedas: Number(presente.diamondCount ?? extra.diamond_count ?? 0),
    quantidade: Math.max(1, Number(dados.repeatCount ?? 1)),
    // Presente com combo: chegam varios eventos com repeatCount subindo, e um ultimo com
    // repeatEnd = 1. Presente sem combo: chega um evento so, que ja e o final.
    final: !repeteEmCombo || fimDoCombo,
    comboId: `${dados.user?.id ?? dados.user?.userId ?? ''}:${dados.groupId ?? ''}:${dados.giftId ?? ''}`,
    imagem: presente.image?.urlList?.[0] ?? null
  };
}

function fecharSemAvisar(conexao) {
  conexao.removeAllListeners();
  conexao.on(ControlEvent.ERROR, () => {});
  conexao.disconnect().catch(() => {});
}

function descreverErro(erro) {
  if (!erro) return 'erro desconhecido';
  const nome = erro.constructor?.name && erro.constructor.name !== 'Error' ? `${erro.constructor.name}: ` : '';
  return `${nome}${erro.message ?? String(erro)}`;
}
