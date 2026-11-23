// Entende se um comentario e um pedido para entrar na corrida.
//
// Vale a palavra em qualquer parte do comentario, com ou sem acento e maiuscula:
// "carro", "CARRO!!", "quero moto", "moto pfv". Tambem valem os emojis de carro
// e de moto. Se o comentario tiver os dois, vale o que aparece primeiro.
// Palavras que so comecam igual nao contam: "motorista" e "carrossel" nao entram.
// Mencoes nao contam: "oi @carros_do_ze" nao e pedido para entrar.

const PALAVRAS = new Map([
  ['carro', 'carro'],
  ['carros', 'carro'],
  ['carrinho', 'carro'],
  ['moto', 'moto'],
  ['motos', 'moto'],
  ['motinha', 'moto'],
  ['motoca', 'moto']
]);

const EMOJIS = [
  ['\u{1F697}', 'carro'], // carro
  ['\u{1F698}', 'carro'], // carro de frente
  ['\u{1F699}', 'carro'], // utilitario
  ['\u{1F3CE}', 'carro'], // carro de corrida
  ['\u{1F3CD}', 'moto'], // moto
  ['\u{1F6F5}', 'moto'] // scooter
];

const TAMANHO_MAXIMO = 300;

/**
 * @param {string} texto comentario da live
 * @returns {'carro'|'moto'|null}
 */
export function lerPedidoDeEntrada(texto) {
  const normal = String(texto ?? '')
    .slice(0, TAMANHO_MAXIMO)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/@[\p{L}\p{N}_.]+/gu, ' '); // tira mencoes (@fulano)

  let tipo = null;
  let posicao = Infinity;

  for (const palavra of normal.matchAll(/[a-z]+/g)) {
    const achado = PALAVRAS.get(palavra[0]);
    if (achado) {
      tipo = achado;
      posicao = palavra.index;
      break;
    }
  }

  for (const [emoji, achado] of EMOJIS) {
    const i = normal.indexOf(emoji);
    if (i >= 0 && i < posicao) {
      tipo = achado;
      posicao = i;
    }
  }

  return tipo;
}
