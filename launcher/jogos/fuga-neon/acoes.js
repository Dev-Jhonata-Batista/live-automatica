// Ações dos presentes. Cada presente tem um NÍVEL (pequeno, médio, grande, mega) e
// o efeito depende da equipe de quem mandou: o mesmo presente vira NITRO para um
// ladrão e SIRENE para um policial.
//
// Qual presente é qual nível:
//   1. o que estiver configurado no launcher (Presentes → ações) para este jogo;
//   2. se não estiver, pelo valor em moedas do presente (tabela MOEDAS_POR_NIVEL).
//
// Combo (x2, x3...): cada presente do combo aplica a ação de novo; do 6º em
// diante vale metade, para um combo enorme não decidir a rodada sozinho.

import { EQUIPES } from './entrada.js';

export const NIVEIS = Object.freeze(['pequeno', 'medio', 'grande', 'mega']);

export const NOME_DO_NIVEL = Object.freeze({
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
  mega: 'Mega'
});

// Mínimo de moedas de cada nível quando o presente não está configurado.
export const MOEDAS_POR_NIVEL = Object.freeze({ medio: 5, grande: 30, mega: 100 });

// m: metros somados à vantagem dos ladrões (negativo = polícia encosta).
// s: duração do efeito visual/especial em segundos.
export const ACOES = Object.freeze({
  [EQUIPES.LADROES]: {
    pequeno: { nome: 'NITRO', m: 4, efeito: 'nitro', s: 1.5 },
    medio: { nome: 'BOMBA DE FUMAÇA', m: 10, efeito: 'fumaca', s: 5 },
    grande: { nome: 'ATALHO SECRETO', m: 22, efeito: 'atalho', s: 3 },
    mega: { nome: 'ESCUDO NEON', m: 30, efeito: 'escudo', s: 12 }
  },
  [EQUIPES.POLICIA]: {
    pequeno: { nome: 'SIRENE', m: -4, efeito: 'sirene', s: 1.5 },
    medio: { nome: 'BLOQUEIO', m: -10, efeito: 'bloqueio', s: 5 },
    grande: { nome: 'HELICÓPTERO', m: -22, efeito: 'helicoptero', s: 10, estrelas: 1 },
    mega: { nome: 'PROCURADO MÁXIMO', m: -30, efeito: 'procurado', s: 6, estrelas: 2 }
  }
});

const UNIDADES_CHEIAS = 5;

function normalizarNome(nome) {
  return String(nome ?? '').trim().toLowerCase();
}

/**
 * Monta a tabela "nome do presente -> nível" a partir da config do launcher.
 * Aceita { presentes: { "Rose": "pequeno", ... } }; ignora níveis inválidos.
 */
export function lerTabelaDePresentes(config) {
  const tabela = new Map();
  const bruto = config && typeof config.presentes === 'object' && !Array.isArray(config.presentes) ? config.presentes : {};
  for (const [nome, nivel] of Object.entries(bruto)) {
    if (NIVEIS.includes(nivel) && normalizarNome(nome)) tabela.set(normalizarNome(nome), nivel);
  }
  return tabela;
}

export function nivelDoPresente(dados, tabela) {
  const configurado = tabela?.get(normalizarNome(dados?.nome));
  if (configurado) return configurado;
  const moedas = Number(dados?.moedas) || 0;
  if (moedas >= MOEDAS_POR_NIVEL.mega) return 'mega';
  if (moedas >= MOEDAS_POR_NIVEL.grande) return 'grande';
  if (moedas >= MOEDAS_POR_NIVEL.medio) return 'medio';
  return 'pequeno';
}

/** Peso da n-ésima unidade de um combo (1 = primeira). */
export function pesoDaUnidade(n) {
  return n <= UNIDADES_CHEIAS ? 1 : 0.5;
}
