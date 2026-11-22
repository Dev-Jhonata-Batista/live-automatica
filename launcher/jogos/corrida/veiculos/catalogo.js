// Modelos de veiculo da corrida. Quem comenta CARRO ganha um dos modelos do tipo
// "carro"; quem comenta MOTO, um do tipo "moto". O modelo e a cor saem do @ da
// pessoa, entao ela costuma correr sempre com o mesmo veiculo.
//
// COMO ADICIONAR UM MODELO
// 1. Copie uma linha da lista CATALOGO e troque o id (unico, minusculo) e o nome.
// 2. Escolha a arte, de um destes dois jeitos:
//    - desenho: uma funcao de desenhos.js (arte em codigo, pintada com a cor do jogador);
//    - imagem: 'veiculos/imagens/meu-carro.png' (PNG visto de cima, frente para CIMA,
//      fundo transparente). A imagem e esticada para larguraM x comprimentoM e
//      nao muda de cor.
// 3. Clique em PARAR e JOGAR no launcher. Se um campo estiver errado, o modelo e
//    ignorado e o motivo aparece no Console (npm run dev). Se o arquivo ficar com
//    erro de digitacao (virgula ou chave faltando), o jogo nao abre e a janela do
//    jogo mostra o erro e a linha.
//
// Campos:
//   tipo          'carro' ou 'moto'
//   larguraM      largura na pista, em metros (carro ~2,6; moto ~1,6)
//   comprimentoM  comprimento, em metros (carro ~4,8; moto ~3,2; no maximo 6, para caber
//                 no grid sem encostar no veiculo da fileira de tras)
//   velocidade    multiplica a velocidade base (1 = normal; 1.02 = 2% mais rapido)
//   aceleracao    em m/s2: quanto mais alto, mais rapido sai da largada

import {
  desenharCometa,
  desenharTatu,
  desenharBolinha,
  desenharFaisca,
  desenharPipoca,
  desenharCabrita
} from './desenhos.js';

export const CATALOGO = [
  { id: 'cometa', tipo: 'carro', nome: 'Cometa', larguraM: 2.6, comprimentoM: 4.8, velocidade: 1, aceleracao: 5, desenho: desenharCometa },
  { id: 'tatu', tipo: 'carro', nome: 'Tatu', larguraM: 2.8, comprimentoM: 4.6, velocidade: 1, aceleracao: 4.6, desenho: desenharTatu },
  { id: 'bolinha', tipo: 'carro', nome: 'Bolinha', larguraM: 2.5, comprimentoM: 3.8, velocidade: 1, aceleracao: 5.4, desenho: desenharBolinha },
  { id: 'faisca', tipo: 'moto', nome: 'Faísca', larguraM: 1.6, comprimentoM: 3.2, velocidade: 1, aceleracao: 7, desenho: desenharFaisca },
  { id: 'pipoca', tipo: 'moto', nome: 'Pipoca', larguraM: 1.7, comprimentoM: 3, velocidade: 1, aceleracao: 6.6, desenho: desenharPipoca },
  { id: 'cabrita', tipo: 'moto', nome: 'Cabrita', larguraM: 1.6, comprimentoM: 3.2, velocidade: 1, aceleracao: 7.4, desenho: desenharCabrita }
];

// Cores dos jogadores (a cor sai do @ de cada um).
export const CORES = [
  '#ff4d4d', '#ff8a1f', '#ffd21f', '#7bdc4b', '#22c7a9', '#27b6f5',
  '#4f7dff', '#9b6bff', '#e05cff', '#ff5fa8', '#f2f2f2', '#c08a5a'
];

const TIPOS = ['carro', 'moto'];
const COR_VALIDA = /^#[0-9a-f]{6}$/i;
const IMAGEM_VALIDA = /^[a-z0-9_\-./]+\.(png|webp)$/i;

function numeroEntre(valor, min, max) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max;
}

/**
 * Confere a lista de modelos e devolve so os que estao certos.
 * @returns {{ modelos: object[], avisos: string[] }}
 */
export function validarCatalogo(lista) {
  const modelos = [];
  const avisos = [];
  const ids = new Set();

  for (const [i, m] of (Array.isArray(lista) ? lista : []).entries()) {
    const nome = m && typeof m === 'object' && m.id ? `"${m.id}"` : `numero ${i + 1}`;
    const erro = (() => {
      if (!m || typeof m !== 'object') return 'nao e um objeto';
      if (typeof m.id !== 'string' || !/^[a-z0-9-]{1,30}$/.test(m.id)) return 'id deve ter so letras minusculas, numeros e hifen';
      if (ids.has(m.id)) return 'id repetido';
      if (!TIPOS.includes(m.tipo)) return 'tipo deve ser "carro" ou "moto"';
      if (typeof m.nome !== 'string' || !m.nome.trim()) return 'falta o nome';
      if (!numeroEntre(m.larguraM, 0.5, 4)) return 'larguraM deve ser um numero entre 0.5 e 4';
      if (!numeroEntre(m.comprimentoM, 1, 6)) return 'comprimentoM deve ser um numero entre 1 e 6';
      if (!numeroEntre(m.velocidade, 0.5, 1.5)) return 'velocidade deve ser um numero entre 0.5 e 1.5';
      if (!numeroEntre(m.aceleracao, 0.5, 20)) return 'aceleracao deve ser um numero entre 0.5 e 20';
      const temDesenho = typeof m.desenho === 'function';
      const temImagem = typeof m.imagem === 'string' && IMAGEM_VALIDA.test(m.imagem) && !m.imagem.includes('..');
      if (!temDesenho && !temImagem) return 'precisa de "desenho" (funcao de desenhos.js) ou "imagem" (.png ou .webp dentro da pasta do jogo)';
      return null;
    })();

    if (erro) {
      avisos.push(`Modelo ${nome} ignorado: ${erro}.`);
      continue;
    }
    ids.add(m.id);
    modelos.push(Object.freeze({ ...m, nome: m.nome.trim().slice(0, 20) }));
  }

  for (const tipo of TIPOS) {
    if (modelos.length && !modelos.some((m) => m.tipo === tipo)) {
      avisos.push(`Nenhum modelo do tipo "${tipo}": quem pedir ${tipo} recebe um modelo do outro tipo.`);
    }
  }
  return { modelos, avisos };
}

export function coresValidas(lista) {
  const cores = (Array.isArray(lista) ? lista : []).filter((c) => typeof c === 'string' && COR_VALIDA.test(c));
  return cores.length ? cores : ['#ffc21a'];
}
