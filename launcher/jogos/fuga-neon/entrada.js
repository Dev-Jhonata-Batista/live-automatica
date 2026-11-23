// Entende se um comentário é um pedido para entrar numa equipe.
//
// Ladrões: "ladrão", "ladrao", "ladroes", "ladra", "bandido", "L" (sozinho) ou 💰 🦹 🥷
// Polícia: "polícia", "policia", "policial", "pm", "P" (sozinho) ou 🚓 👮 🚔 🚨
// Vale em qualquer parte da frase, com ou sem acento e maiúscula. Se tiver os dois,
// vale o que aparece primeiro. Menções (@fulano) não contam.

export const EQUIPES = Object.freeze({ LADROES: 'ladroes', POLICIA: 'policia' });

const PALAVRAS = new Map([
  ['ladrao', EQUIPES.LADROES],
  ['ladroes', EQUIPES.LADROES],
  ['ladra', EQUIPES.LADROES],
  ['ladrona', EQUIPES.LADROES],
  ['bandido', EQUIPES.LADROES],
  ['bandida', EQUIPES.LADROES],
  ['policia', EQUIPES.POLICIA],
  ['policial', EQUIPES.POLICIA],
  ['policiais', EQUIPES.POLICIA],
  ['pm', EQUIPES.POLICIA],
  ['tira', EQUIPES.POLICIA]
]);

const EMOJIS = [
  ['\u{1F4B0}', EQUIPES.LADROES], // saco de dinheiro
  ['\u{1F9B9}', EQUIPES.LADROES], // vilão
  ['\u{1F977}', EQUIPES.LADROES], // ninja
  ['\u{1F693}', EQUIPES.POLICIA], // viatura
  ['\u{1F694}', EQUIPES.POLICIA], // viatura de frente
  ['\u{1F46E}', EQUIPES.POLICIA], // policial
  ['\u{1F6A8}', EQUIPES.POLICIA] // sirene
];

const TAMANHO_MAXIMO = 300;

/**
 * @param {string} texto comentário da live
 * @returns {'ladroes'|'policia'|null}
 */
export function lerEquipe(texto) {
  const normal = String(texto ?? '')
    .slice(0, TAMANHO_MAXIMO)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@[\p{L}\p{N}_.]+/gu, ' ')
    .trim();

  if (normal === 'l') return EQUIPES.LADROES;
  if (normal === 'p') return EQUIPES.POLICIA;

  let equipe = null;
  let posicao = Infinity;

  for (const palavra of normal.matchAll(/[a-z]+/g)) {
    const achado = PALAVRAS.get(palavra[0]);
    if (achado) {
      equipe = achado;
      posicao = palavra.index;
      break;
    }
  }

  for (const [emoji, achado] of EMOJIS) {
    const i = normal.indexOf(emoji);
    if (i >= 0 && i < posicao) {
      equipe = achado;
      posicao = i;
    }
  }

  return equipe;
}
