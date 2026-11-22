// Configuracao local do launcher: ultimo @, modo teste, jogo escolhido e a
// configuracao de cada jogo. Fica em %APPDATA%\Pista Viva\config.json no Windows.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const PADRAO = {
  arroba: '',
  simulador: false,
  jogo: '',
  configJogos: {} // { [idDoJogo]: { ... } }  usado a partir da Fase 4 (presente -> acao)
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
