// Formato de evento padrao, independente da plataforma (TikTok hoje, YouTube no futuro).
// O jogo e o launcher so conhecem este formato; cada plataforma tem um "adaptador"
// que converte os dados dela para ca.

import { randomUUID } from 'node:crypto';

export const TIPOS = Object.freeze({
  COMENTARIO: 'comentario',
  PRESENTE: 'presente',
  CURTIDA: 'curtida',
  SEGUIU: 'seguiu',
  COMPARTILHOU: 'compartilhou',
  ENTROU: 'entrou',
  ESPECTADORES: 'espectadores',
  LIVE_ENCERRADA: 'live_encerrada'
});

export const STATUS = Object.freeze({
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
  OFFLINE: 'offline',
  RECONECTANDO: 'reconectando',
  ERRO: 'erro',
  PARADO: 'parado'
});

/**
 * Cria um evento no formato padrao.
 *
 * {
 *   id: string,              // unico por evento
 *   tipo: TIPOS.*,
 *   plataforma: 'tiktok' | 'youtube' | 'simulador',
 *   horario: number,         // Date.now()
 *   usuario: { id, arroba, nome, foto } | null,
 *   dados: { ... }           // depende do tipo (ver abaixo)
 * }
 *
 * dados por tipo:
 *   comentario   -> { texto }
 *   presente     -> { presenteId, nome, moedas, quantidade, final, comboId, imagem }
 *                   quantidade = total do combo ate agora (ex.: 8 para "x8")
 *                   final = true quando o combo terminou (ou presente sem combo)
 *   curtida      -> { quantidade, totalDaLive }
 *   seguiu       -> {}
 *   compartilhou -> {}
 *   entrou       -> {}
 *   espectadores -> { total }
 *   live_encerrada -> {}
 */
export function criarEvento({ tipo, plataforma, usuario = null, dados = {} }) {
  return {
    id: randomUUID(),
    tipo,
    plataforma,
    horario: Date.now(),
    usuario,
    dados
  };
}

export function criarUsuario({ id, arroba, nome, foto }) {
  const arrobaLimpo = String(arroba || '').replace(/^@/, '');
  return {
    id: String(id || arrobaLimpo || ''),
    arroba: arrobaLimpo,
    nome: nome || arrobaLimpo,
    foto: foto || null
  };
}
