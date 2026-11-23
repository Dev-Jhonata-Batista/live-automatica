// Protocolo "jogo://": e por ele que a janela do jogo carrega os arquivos de cada jogo.
//
//   jogo://corrida/index.html   -> launcher/jogos/corrida/index.html
//   jogo://corrida/_sdk/palco.js -> launcher/src/sdk/palco.js   (SDK comum a todos os jogos)
//
// Vantagens sobre abrir o arquivo direto (file://):
//   - cada jogo so consegue ler arquivos da propria pasta (e do SDK);
//   - cada jogo tem a propria "origem" (o que um salva no navegador o outro nao ve);
//   - modulos JavaScript (import/export) funcionam normalmente;
//   - as regras de seguranca (CSP) valem para todo jogo, sem depender do HTML dele.

import { protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const ESQUEMA = 'jogo';
const PREFIXO_SDK = '/_sdk/';

// Jogos so carregam arquivos proprios; imagens externas (https) sao liberadas
// para fotos de perfil do TikTok. Nenhum script de fora e aceito.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const TIPOS_DE_ARQUIVO = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

// Precisa ser chamado antes do app ficar pronto (app.whenReady).
// "stream" e necessario para audio e video tocarem pelo protocolo.
export function registrarEsquemaDeJogos() {
  protocol.registerSchemesAsPrivileged([
    { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ]);
}

export function urlDoJogo(jogo) {
  const caminho = jogo.entrada.split('/').map(encodeURIComponent).join('/');
  return `${ESQUEMA}://${jogo.id}/${caminho}`;
}

/**
 * Comeca a responder os pedidos jogo://.
 * @param {{ obterJogo: (id: string) => object|null, pastaSdk: string }} opcoes
 */
export function atenderEsquemaDeJogos({ obterJogo, pastaSdk }) {
  protocol.handle(ESQUEMA, async (pedido) => {
    try {
      const url = new URL(pedido.url);
      const caminho = decodeURIComponent(url.pathname);

      let base;
      let relativo;
      if (caminho.startsWith(PREFIXO_SDK)) {
        base = pastaSdk;
        relativo = caminho.slice(PREFIXO_SDK.length);
      } else {
        const jogo = obterJogo(url.hostname);
        if (!jogo) return naoEncontrado();
        base = jogo.pasta;
        relativo = caminho.replace(/^\/+/, '');
      }

      const alvo = caminhoSeguro(base, relativo);
      if (!alvo) return naoEncontrado();

      const info = fs.statSync(alvo, { throwIfNoEntry: false });
      if (!info?.isFile()) return naoEncontrado();

      return responderArquivo(alvo, info.size, pedido.headers.get('range'));
    } catch {
      return naoEncontrado();
    }
  });
}

// Entrega o arquivo com tamanho (Content-Length) e aceita pedidos de "pedaco"
// (Range), que e como o navegador toca e avanca audio e video.
function responderArquivo(alvo, tamanho, cabecalhoRange) {
  const cabecalhos = {
    'Content-Type': TIPOS_DE_ARQUIVO[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes'
  };

  const faixa = lerFaixa(cabecalhoRange, tamanho);
  if (faixa === 'invalida') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${tamanho}` } });
  }
  if (faixa) {
    const { inicio, fim } = faixa;
    return new Response(lerArquivo(alvo, { start: inicio, end: fim }), {
      status: 206,
      headers: {
        ...cabecalhos,
        'Content-Range': `bytes ${inicio}-${fim}/${tamanho}`,
        'Content-Length': String(fim - inicio + 1)
      }
    });
  }

  return new Response(tamanho ? lerArquivo(alvo) : null, {
    status: 200,
    headers: { ...cabecalhos, 'Content-Length': String(tamanho) }
  });
}

function lerArquivo(alvo, opcoes) {
  return Readable.toWeb(fs.createReadStream(alvo, opcoes));
}

// "bytes=100-199", "bytes=100-" ou "bytes=-500". Outros formatos: arquivo inteiro.
function lerFaixa(valor, tamanho) {
  const partes = /^bytes=(\d*)-(\d*)$/.exec(String(valor || '').trim());
  if (!partes || (partes[1] === '' && partes[2] === '')) return null;

  let inicio;
  let fim;
  if (partes[1] === '') {
    const ultimos = Number(partes[2]);
    if (ultimos === 0) return 'invalida';
    inicio = Math.max(0, tamanho - ultimos);
    fim = tamanho - 1;
  } else {
    inicio = Number(partes[1]);
    fim = partes[2] === '' ? tamanho - 1 : Math.min(Number(partes[2]), tamanho - 1);
  }
  if (inicio > fim || inicio >= tamanho) return 'invalida';
  return { inicio, fim };
}

// Garante que o arquivo pedido esta DENTRO da pasta base (bloqueia "../") e que
// nenhum atalho (symlink/junction) dentro da pasta aponta para fora dela.
function caminhoSeguro(base, relativo) {
  const raiz = path.resolve(base);
  const alvo = path.resolve(raiz, relativo);
  if (!estaDentro(raiz, alvo)) return null;
  try {
    if (!estaDentro(fs.realpathSync(raiz), fs.realpathSync(alvo))) return null;
  } catch {
    return null; // o arquivo nao existe
  }
  return alvo;
}

// path.relative compara caminhos do Windows sem diferenciar maiusculas/minusculas.
function estaDentro(raiz, alvo) {
  const dentro = path.relative(raiz, alvo);
  return Boolean(dentro) && !dentro.startsWith('..') && !path.isAbsolute(dentro);
}

function naoEncontrado() {
  return new Response('Arquivo nao encontrado', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
