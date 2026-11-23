// Relatório de uma live a partir do banco de eventos do launcher.
//
// Uso (na pasta launcher, com o launcher fechado ou aberto):
//   npm run relatorio               -> última live de verdade (ignora o modo teste)
//   npm run relatorio -- --teste    -> última sessão, inclusive modo teste
//   npm run relatorio -- 12         -> sessão número 12
//   npm run relatorio -- --lista    -> lista as últimas 20 sessões
//
// Mostra no terminal e salva em launcher\relatorios\live-<data>-<hora>.md.
// Os valores de presentes estão em MOEDAS (o que a biblioteca informa). O número
// oficial de diamantes é o do TikTok Studio: anote os dois no metricas/ do repositório.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA_DADOS = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'Pista Viva')
  : path.join(os.homedir(), '.config', 'Pista Viva');
const PASTA_SAIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'relatorios');

const args = process.argv.slice(2);
const incluirTeste = args.includes('--teste');
const listar = args.includes('--lista');
const idPedido = Number(args.find((a) => /^\d+$/.test(a)));
const pastaDados = args.find((a) => a.startsWith('--pasta='))?.slice(8) || PASTA_DADOS;

// ------------------------------------------------------------------ leitura

async function carregar() {
  const arqSqlite = path.join(pastaDados, 'eventos.sqlite');
  const arqTexto = path.join(pastaDados, 'eventos.jsonl');
  if (fs.existsSync(arqSqlite)) {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(arqSqlite, { readOnly: true });
    return {
      sessoes: db.prepare('SELECT * FROM sessoes ORDER BY id').all().map((s) => ({ ...s })),
      eventosDa: (id) => db.prepare('SELECT * FROM eventos WHERE sessao_id = ? ORDER BY horario, id').all(id).map((e) => ({ ...e }))
    };
  }
  if (fs.existsSync(arqTexto)) {
    const sessoes = new Map();
    const eventos = [];
    for (const linha of fs.readFileSync(arqTexto, 'utf8').split('\n')) {
      if (!linha.trim()) continue;
      let o;
      try {
        o = JSON.parse(linha);
      } catch {
        continue;
      }
      if (o.t === 'sessao') sessoes.set(o.id, { ...o, simulador: o.simulador ? 1 : 0, fim: null });
      else if (o.t === 'fim' && sessoes.has(o.id)) sessoes.get(o.id).fim = o.fim;
      else if (o.t === 'evento') eventos.push(o);
    }
    return {
      sessoes: [...sessoes.values()].sort((a, b) => a.id - b.id),
      eventosDa: (id) => eventos.filter((e) => e.sessao_id === id)
    };
  }
  throw new Error(`Não achei o banco de eventos em "${pastaDados}". Abra o launcher e clique em JOGAR pelo menos uma vez.`);
}

// ------------------------------------------------------------------ formatação

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const data = (ms) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function duracao(ms) {
  const min = Math.round(ms / 60000);
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

function relatorio(sessao, eventos) {
  const inicio = sessao.inicio;
  const fim = sessao.fim || eventos.at(-1)?.horario || inicio;
  const horas = Math.max(1 / 60, (fim - inicio) / 3600000);
  const conta = (tipo) => eventos.filter((e) => e.tipo === tipo);
  const comentarios = conta('comentario');
  const presentes = conta('presente');
  const curtidas = conta('curtida').reduce((s, e) => s + (e.quantidade || 0), 0);
  const seguidores = conta('seguiu').length;
  const compart = conta('compartilhou').length;
  const moedas = presentes.reduce((s, e) => s + (e.moedas_total || 0), 0);
  const qtdPresentes = presentes.reduce((s, e) => s + (e.quantidade || 0), 0);
  const espect = conta('espectadores').map((e) => e.total || 0);
  const pico = espect.length ? Math.max(...espect) : null;
  const media = espect.length ? espect.reduce((s, v) => s + v, 0) / espect.length : null;
  const interagiram = new Set(eventos.filter((e) => ['comentario', 'presente', 'curtida', 'seguiu', 'compartilhou'].includes(e.tipo) && e.usuario_id).map((e) => e.usuario_id));

  // Por jogo (tempo em cada jogo pelos eventos "jogo")
  const porJogo = new Map();
  const trocas = conta('jogo');
  trocas.forEach((t, i) => {
    const ate = trocas[i + 1]?.horario || fim;
    const j = porJogo.get(t.jogo) || { ms: 0, comentarios: 0, moedas: 0, presentes: 0 };
    j.ms += ate - t.horario;
    porJogo.set(t.jogo, j);
  });
  for (const e of eventos) {
    const j = porJogo.get(e.jogo);
    if (!j) continue;
    if (e.tipo === 'comentario') j.comentarios += 1;
    if (e.tipo === 'presente') {
      j.moedas += e.moedas_total || 0;
      j.presentes += e.quantidade || 0;
    }
  }

  // Por hora
  const porHora = new Map();
  for (const e of eventos) {
    const h = new Date(e.horario);
    h.setMinutes(0, 0, 0);
    const k = h.getTime();
    const linha = porHora.get(k) || { jogo: e.jogo, comentarios: 0, presentes: 0, moedas: 0 };
    if (e.tipo === 'comentario') linha.comentarios += 1;
    if (e.tipo === 'presente') {
      linha.presentes += e.quantidade || 0;
      linha.moedas += e.moedas_total || 0;
    }
    porHora.set(k, linha);
  }

  // Top doadores
  const doadores = new Map();
  for (const p of presentes) {
    const k = p.arroba || p.usuario_id || '?';
    doadores.set(k, (doadores.get(k) || 0) + (p.moedas_total || 0));
  }
  const top = [...doadores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const l = [];
  l.push(`# Live ${data(inicio)}${sessao.simulador ? ' (MODO TESTE)' : ''}`);
  l.push('');
  l.push(`Sessão ${sessao.id} · @${sessao.arroba || '?'} · ${sessao.plataforma} · launcher ${sessao.versao || '?'}`);
  l.push('');
  l.push('| Campo | Valor |');
  l.push('|---|---|');
  l.push(`| Início e fim | ${hora(inicio)} a ${hora(fim)} |`);
  l.push(`| Duração | ${duracao(fim - inicio)} |`);
  l.push(`| Pico de espectadores | ${pico ?? 'sem dado'} |`);
  l.push(`| Média de espectadores | ${media === null ? 'sem dado' : fmt(media)} |`);
  l.push(`| Comentários | ${fmt(comentarios.length)} |`);
  l.push(`| Curtidas | ${fmt(curtidas)} |`);
  l.push(`| Compartilhamentos | ${fmt(compart)} |`);
  l.push(`| Novos seguidores (vistos na live) | ${fmt(seguidores)} |`);
  l.push(`| Presentes (quantidade) | ${fmt(qtdPresentes)} |`);
  l.push(`| Moedas em presentes (launcher) | ${fmt(moedas)} |`);
  l.push(`| **Moedas por hora** | **${fmt(moedas / horas)}** |`);
  l.push(`| Pessoas que interagiram | ${fmt(interagiram.size)}${pico ? ` (${fmt((interagiram.size / pico) * 100)}% do pico)` : ''} |`);
  l.push('| Diamantes oficiais (TikTok Studio) | preencher |');
  l.push('');
  l.push('## Por jogo');
  l.push('');
  l.push('| Jogo | Tempo | Comentários | Presentes | Moedas | Moedas/hora |');
  l.push('|---|---|---|---|---|---|');
  for (const [jogo, j] of porJogo) {
    l.push(`| ${jogo} | ${duracao(j.ms)} | ${fmt(j.comentarios)} | ${fmt(j.presentes)} | ${fmt(j.moedas)} | ${fmt(j.moedas / Math.max(1 / 60, j.ms / 3600000))} |`);
  }
  l.push('');
  l.push('## Por hora');
  l.push('');
  l.push('| Hora | Comentários | Presentes | Moedas |');
  l.push('|---|---|---|---|');
  for (const [k, h] of [...porHora.entries()].sort((a, b) => a[0] - b[0])) {
    l.push(`| ${hora(k)} | ${fmt(h.comentarios)} | ${fmt(h.presentes)} | ${fmt(h.moedas)} |`);
  }
  l.push('');
  l.push('## Top doadores');
  l.push('');
  l.push('| # | @ | Moedas |');
  l.push('|---|---|---|');
  top.forEach(([arroba, m], i) => l.push(`| ${i + 1} | @${arroba} | ${fmt(m)} |`));
  if (!top.length) l.push('| - | nenhum presente | - |');
  l.push('');
  return l.join('\n');
}

// ------------------------------------------------------------------ principal

try {
  const banco = await carregar();
  if (listar) {
    for (const s of banco.sessoes.slice(-20)) {
      console.log(`${String(s.id).padStart(4)}  ${data(s.inicio)}  ${s.fim ? duracao(s.fim - s.inicio) : 'aberta'}  @${s.arroba}${s.simulador ? '  (teste)' : ''}`);
    }
    process.exit(0);
  }
  let sessao;
  if (idPedido) sessao = banco.sessoes.find((s) => s.id === idPedido);
  else sessao = banco.sessoes.filter((s) => incluirTeste || !s.simulador).at(-1);
  if (!sessao) {
    console.log(incluirTeste ? 'Nenhuma sessão gravada ainda.' : 'Nenhuma live de verdade gravada ainda. Para ver o modo teste: npm run relatorio -- --teste');
    process.exit(0);
  }
  const texto = relatorio(sessao, banco.eventosDa(sessao.id));
  console.log(texto);
  fs.mkdirSync(PASTA_SAIDA, { recursive: true });
  const d = new Date(sessao.inicio);
  const nome = `live-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${sessao.simulador ? '-teste' : ''}.md`;
  fs.writeFileSync(path.join(PASTA_SAIDA, nome), texto, 'utf8');
  console.log(`\nSalvo em launcher\\relatorios\\${nome}`);
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}
