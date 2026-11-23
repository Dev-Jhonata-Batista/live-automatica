// Configuracao local do launcher: ultimo @, modo teste, jogo escolhido e a
// configuracao de cada jogo. Fica em %APPDATA%\Pista Viva\config.json no Windows.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const PADRAO = {
  arroba: '',
  simulador: false,
  jogo: '',
  configJogos: {}, // { [idDoJogo]: { presentes: { nome: nivel }, meta: {...} } }
  rotacao: null
};

function caminhoConfig() {
  return path.join(app.getPath('userData'), 'config.json');
}

export function lerConfig() {
  try {
    const salvo = JSON.parse(fs.readFileSync(caminhoConfig(), 'utf8'));
    return { ...PADRAO, ...salvo };
  } catch {
    return { ...PADRAO };
  }
}

export function salvarConfig(parcial) {
  const nova = { ...lerConfig(), ...parcial };
  fs.mkdirSync(path.dirname(caminhoConfig()), { recursive: true });
  fs.writeFileSync(caminhoConfig(), JSON.stringify(nova, null, 2), 'utf8');
  return nova;
}

export function configDoJogo(idDoJogo) {
  const todas = lerConfig().configJogos;
  const config = todas && typeof todas === 'object' && Object.hasOwn(todas, idDoJogo) ? todas[idDoJogo] : null;
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

/** Junta (sem apagar o resto) a config de um jogo: { presentes, meta, ... }. */
export function salvarConfigDoJogo(idDoJogo, parcial) {
  const atual = lerConfig();
  const todas = atual.configJogos && typeof atual.configJogos === 'object' ? { ...atual.configJogos } : {};
  todas[idDoJogo] = { ...configDoJogo(idDoJogo), ...limparConfigDoJogo(parcial) };
  return salvarConfig({ configJogos: todas });
}

// Aceita so os campos conhecidos, com tipos e tamanhos seguros.
function limparConfigDoJogo(parcial) {
  const limpo = {};
  if (parcial && typeof parcial.presentes === 'object' && !Array.isArray(parcial.presentes)) {
    limpo.presentes = {};
    for (const [nome, nivel] of Object.entries(parcial.presentes).slice(0, 60)) {
      const n = String(nome).trim().slice(0, 60);
      if (n && typeof nivel === 'string') limpo.presentes[n] = nivel.slice(0, 30);
    }
  }
  if (parcial && typeof parcial.meta === 'object' && parcial.meta) {
    const m = parcial.meta;
    limpo.meta = {
      ativa: Boolean(m.ativa),
      presente: String(m.presente || '').trim().slice(0, 60),
      quantidade: Math.max(1, Math.min(100000, Math.floor(Number(m.quantidade) || 1))),
      recompensa: String(m.recompensa || '').trim().slice(0, 30)
    };
  }
  return limpo;
}

const ROTACAO_PADRAO = {
  ativa: false,
  jogos: [],          // ids na ordem da rotacao
  minutos: 30,        // troca depois de X minutos no mesmo jogo
  trocarSeCair: true, // troca antes se o engajamento cair
  quedaPct: 50,       // queda em relacao ao melhor momento do jogo
  minutosMinimos: 10  // nunca troca por queda antes disso
};

export function lerRotacao() {
  const r = lerConfig().rotacao;
  const base = r && typeof r === 'object' ? r : {};
  return {
    ...ROTACAO_PADRAO,
    ...base,
    jogos: Array.isArray(base.jogos) ? base.jogos.filter((j) => typeof j === 'string').slice(0, 20) : []
  };
}

export function salvarRotacao(dados) {
  const d = dados && typeof dados === 'object' ? dados : {};
  const r = {
    ativa: Boolean(d.ativa),
    jogos: Array.isArray(d.jogos) ? d.jogos.filter((j) => typeof j === 'string').slice(0, 20) : [],
    minutos: Math.max(5, Math.min(240, Math.floor(Number(d.minutos) || ROTACAO_PADRAO.minutos))),
    trocarSeCair: Boolean(d.trocarSeCair),
    quedaPct: Math.max(20, Math.min(90, Math.floor(Number(d.quedaPct) || ROTACAO_PADRAO.quedaPct))),
    minutosMinimos: ROTACAO_PADRAO.minutosMinimos
  };
  return salvarConfig({ rotacao: r });
}
