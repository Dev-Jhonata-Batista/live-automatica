// Catalogo de jogos: cada jogo e uma pasta com um arquivo jogo.json.
//
// Pastas lidas, nesta ordem:
//   1. launcher/jogos/                 jogos que vem junto com o launcher
//   2. %APPDATA%\Pista Viva\jogos\     jogos instalados depois (sem reinstalar o launcher)
// Se o mesmo id aparecer nas duas, vale o da pasta 2.
//
// Formato do jogo.json (ver COMO-CRIAR-UM-JOGO.md):
//   { "id": "corrida", "nome": "Corrida", "versao": "0.1.0",
//     "descricao": "...", "entrada": "index.html", "cor": "#ffc21a", "ordem": 1 }

import fs from 'node:fs';
import path from 'node:path';

// Comeca com letra: um id so de numeros (ex.: "2048") vira endereco IP no jogo:// e nao abre.
export const ID_VALIDO = /^[a-z][a-z0-9-]{0,39}$/;
const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;
const COR_PADRAO = '#ffc21a';

let catalogo = new Map();

/**
 * Le todas as pastas de jogos e atualiza o catalogo.
 * @returns {{ jogos: object[], avisos: string[] }}
 */
export function carregarJogos(pastasRaiz) {
  const jogos = new Map();
  const avisos = [];

  for (const pastaRaiz of pastasRaiz) {
    let subpastas;
    try {
      subpastas = fs.readdirSync(pastaRaiz, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue; // a pasta nao existe (normal para a pasta de jogos instalados)
    }

    for (const dir of subpastas) {
      const resultado = lerJogo(path.join(pastaRaiz, dir.name), dir.name);
      if (resultado.erro) avisos.push(`Pasta "${dir.name}" ignorada: ${resultado.erro}`);
      else jogos.set(resultado.jogo.id, resultado.jogo);
    }
  }

  catalogo = jogos;
  return { jogos: listarJogos(), avisos };
}

export function listarJogos() {
  return [...catalogo.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function obterJogo(id) {
  return catalogo.get(id) ?? null;
}

// O que pode ser mostrado nas telas (sem o caminho da pasta no disco).
export function resumoDoJogo(jogo) {
  if (!jogo) return null;
  const { id, nome, versao, descricao, cor, presentes, meta } = jogo;
  return { id, nome, versao, descricao, cor, presentes, meta };
}

function lerJogo(pasta, nomeDaPasta) {
  const arquivo = path.join(pasta, 'jogo.json');
  if (!fs.existsSync(arquivo)) return { erro: 'falta o arquivo jogo.json.' };

  let dados;
  try {
    // Remove o BOM que o Bloco de Notas do Windows as vezes coloca no inicio do arquivo.
    dados = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  } catch (erro) {
    return { erro: `jogo.json com erro de escrita (${erro.message}). Confira vírgulas e aspas.` };
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return { erro: 'jogo.json precisa começar com { e terminar com }.' };
  }

  const { id, nome } = dados;
  if (typeof id !== 'string' || !ID_VALIDO.test(id)) {
    return { erro: '"id" inválido. Comece com uma letra e use só letras minúsculas, números e hífen (ex.: "meu-jogo").' };
  }
  if (id !== nomeDaPasta) {
    return { erro: `o "id" ("${id}") precisa ser igual ao nome da pasta, com as mesmas letras minúsculas.` };
  }
  if (typeof nome !== 'string' || !nome.trim()) {
    return { erro: 'falta o "nome" do jogo.' };
  }

  const entrada = typeof dados.entrada === 'string' && dados.entrada.trim()
    ? dados.entrada.trim().replace(/\\/g, '/')
    : 'index.html';
  const caminhoEntrada = path.resolve(pasta, entrada);
  const relativo = path.relative(pasta, caminhoEntrada);
  if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) {
    return { erro: `"entrada" ("${entrada}") precisa ser um arquivo dentro da pasta do jogo.` };
  }
  if (!fs.statSync(caminhoEntrada, { throwIfNoEntry: false })?.isFile()) {
    return { erro: `não achei o arquivo de entrada "${entrada}".` };
  }

  return {
    jogo: {
      id,
      nome: nome.trim().slice(0, 40),
      versao: typeof dados.versao === 'string' ? dados.versao : '0.0.0',
      descricao: typeof dados.descricao === 'string' ? dados.descricao.trim().slice(0, 140) : '',
      entrada,
      cor: COR_VALIDA.test(dados.cor) ? dados.cor : COR_PADRAO,
      ordem: Number.isFinite(dados.ordem) ? dados.ordem : 100,
      presentes: lerNiveisDePresente(dados.presentes),
      meta: dados.meta === true,
      pasta
    }
  };
}

// "presentes" opcional no jogo.json: niveis de acao que o streamer liga a cada presente.
//   { "niveis": [ { "id": "pequeno", "nome": "Pequeno: NITRO" }, ... ], "padrao": "texto de ajuda" }
function lerNiveisDePresente(bruto) {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray(bruto.niveis)) return null;
  const niveis = bruto.niveis
    .filter((n) => n && typeof n.id === 'string' && /^[a-z0-9-]{1,30}$/.test(n.id))
    .slice(0, 12)
    .map((n) => ({ id: n.id, nome: typeof n.nome === 'string' ? n.nome.slice(0, 60) : n.id }));
  if (!niveis.length) return null;
  return { niveis, padrao: typeof bruto.padrao === 'string' ? bruto.padrao.slice(0, 300) : '' };
}
