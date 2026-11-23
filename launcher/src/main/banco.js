// Banco local SQLite com TODOS os eventos da live, para as métricas.
// Arquivo: %APPDATA%\Pista Viva\eventos.sqlite (no Windows).
//
// Usa o SQLite que já vem dentro do Node/Electron (node:sqlite): nada para instalar
// nem compilar. Se o SQLite não estiver disponível, grava os mesmos dados num
// arquivo de texto (eventos.jsonl, uma linha por evento) e o relatório lê esse.
// Se nada funcionar, o launcher continua normalmente; só para de gravar.
//
// Tabelas:
//   sessoes  uma linha por JOGAR..PARAR (plataforma, @, modo teste, início e fim)
//   eventos  um evento por linha (comentário, curtida, follow, compartilhamento,
//            presente com moedas, espectadores, troca de jogo)
//
// Presentes: grava só o evento final do combo (quantidade total), para não contar em dobro.
// "moedas" é o valor do presente em moedas que a biblioteca informa (diamond_count).
// O número oficial de diamantes é o do TikTok Studio.

import fs from 'node:fs';
import path from 'node:path';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inicio INTEGER NOT NULL,
  fim INTEGER,
  plataforma TEXT NOT NULL,
  arroba TEXT,
  simulador INTEGER NOT NULL DEFAULT 0,
  versao TEXT
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER NOT NULL REFERENCES sessoes(id),
  horario INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  jogo TEXT,
  usuario_id TEXT,
  arroba TEXT,
  texto TEXT,
  presente TEXT,
  quantidade INTEGER,
  moedas_unidade INTEGER,
  moedas_total INTEGER,
  total INTEGER
);
CREATE INDEX IF NOT EXISTS eventos_sessao ON eventos(sessao_id, horario);
CREATE INDEX IF NOT EXISTS eventos_tipo ON eventos(tipo);
`;

// Plano B sem SQLite: mesmas operações, gravando JSON por linha.
function bancoDeTexto(arquivo) {
  let proximaSessao = Date.now();
  const linha = (obj) => fs.appendFileSync(arquivo, `${JSON.stringify(obj)}\n`, 'utf8');
  return {
    exec() {},
    close() {},
    prepare(sql) {
      return {
        run: (...valores) => {
          if (sql.startsWith('INSERT INTO sessoes')) {
            const [inicio, plataforma, arroba, simulador, versao] = valores;
            proximaSessao += 1;
            linha({ t: 'sessao', id: proximaSessao, inicio, plataforma, arroba, simulador, versao });
            return { lastInsertRowid: proximaSessao };
          }
          if (sql.startsWith('UPDATE sessoes')) {
            linha({ t: 'fim', fim: valores[0], id: valores[1] });
            return {};
          }
          const [sessao_id, horario, tipo, jogo, usuario_id, arroba, texto, presente, quantidade, moedas_unidade, moedas_total, total] = valores;
          linha({ t: 'evento', sessao_id, horario, tipo, jogo, usuario_id, arroba, texto, presente, quantidade, moedas_unidade, moedas_total, total });
          return {};
        }
      };
    }
  };
}

export async function abrirBanco(pasta) {
  let db = null;
  let inserir = null;
  let sessaoAtual = null;
  let jogoAtual = null;
  let avisou = false;
  const recentes = []; // horários das últimas interações (para a rotação automática)

  try {
    fs.mkdirSync(pasta, { recursive: true });
  } catch {
    // a pasta já existe ou não pode ser criada; o erro aparece abaixo
  }
  try {
    const { DatabaseSync } = await import('node:sqlite');
    db = new DatabaseSync(path.join(pasta, 'eventos.sqlite'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(ESQUEMA);
    inserir = db.prepare(`INSERT INTO eventos
      (sessao_id, horario, tipo, jogo, usuario_id, arroba, texto, presente, quantidade, moedas_unidade, moedas_total, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    // Sessões que ficaram abertas (PC desligou, launcher travou) ganham um fim aproximado.
    db.exec(`UPDATE sessoes SET fim = COALESCE((SELECT MAX(horario) FROM eventos WHERE sessao_id = sessoes.id), inicio)
             WHERE fim IS NULL`);
  } catch (erro) {
    console.warn('[banco] SQLite indisponível, gravando em eventos.jsonl:', erro.message);
    try {
      db = bancoDeTexto(path.join(pasta, 'eventos.jsonl'));
      inserir = db.prepare('INSERT INTO eventos');
    } catch (erro2) {
      console.error('[banco] não consegui gravar eventos; o launcher segue sem métricas:', erro2.message);
      db = null;
    }
  }

  function falhou(erro) {
    if (!avisou) console.error('[banco] erro ao gravar (próximos erros iguais não aparecem):', erro.message);
    avisou = true;
  }

  function iniciarSessao({ plataforma, arroba, simulador, versao, jogo }) {
    if (!db) return;
    try {
      encerrarSessao();
      const r = db.prepare('INSERT INTO sessoes (inicio, plataforma, arroba, simulador, versao) VALUES (?, ?, ?, ?, ?)')
        .run(Date.now(), plataforma, arroba || '', simulador ? 1 : 0, versao || '');
      sessaoAtual = Number(r.lastInsertRowid);
      trocarJogo(jogo);
    } catch (erro) {
      falhou(erro);
    }
  }

  function trocarJogo(jogo) {
    jogoAtual = jogo || null;
    if (!db || !sessaoAtual) return;
    try {
      inserir.run(sessaoAtual, Date.now(), 'jogo', jogoAtual, null, null, null, null, null, null, null, null);
    } catch (erro) {
      falhou(erro);
    }
  }

  function encerrarSessao() {
    if (!db || !sessaoAtual) return;
    try {
      db.prepare('UPDATE sessoes SET fim = ? WHERE id = ?').run(Date.now(), sessaoAtual);
    } catch (erro) {
      falhou(erro);
    }
    sessaoAtual = null;
  }

  function gravar(evento) {
    if (!evento) return;
    if (['comentario', 'presente', 'curtida', 'seguiu', 'compartilhou'].includes(evento.tipo)) {
      if (evento.tipo !== 'presente' || evento.dados?.final) {
        recentes.push(Date.now());
        if (recentes.length > 20000) recentes.splice(0, recentes.length - 20000);
      }
    }
    if (!db || !sessaoAtual) return;
    const d = evento.dados || {};
    const u = evento.usuario || {};
    let texto = null;
    let presente = null;
    let quantidade = null;
    let moedasUnidade = null;
    let moedasTotal = null;
    let total = null;

    switch (evento.tipo) {
      case 'comentario':
        texto = String(d.texto ?? '').slice(0, 500);
        break;
      case 'presente':
        if (!d.final) return; // só o fim do combo
        presente = String(d.nome ?? '').slice(0, 80);
        quantidade = Number(d.quantidade) || 1;
        moedasUnidade = Number(d.moedas) || 0;
        moedasTotal = moedasUnidade * quantidade;
        break;
      case 'curtida':
        quantidade = Number(d.quantidade) || 0;
        total = Number(d.totalDaLive) || null;
        break;
      case 'espectadores':
        total = Number(d.total) || 0;
        break;
      case 'entrou':
        return; // muito volume e pouco valor para as métricas
      default:
        break;
    }

    try {
      inserir.run(
        sessaoAtual,
        Number(evento.horario) || Date.now(),
        evento.tipo,
        jogoAtual,
        u.id ? String(u.id) : null,
        u.arroba ? String(u.arroba) : null,
        texto,
        presente,
        quantidade,
        moedasUnidade,
        moedasTotal,
        total
      );
    } catch (erro) {
      falhou(erro);
    }
  }

  /** Interações por minuto nos últimos N minutos (conta em memória, sem ler o banco). */
  function interacoesPorMinuto(minutos, ate = Date.now()) {
    const desde = ate - minutos * 60000;
    let n = 0;
    for (let i = recentes.length - 1; i >= 0 && recentes[i] >= desde; i -= 1) if (recentes[i] <= ate) n += 1;
    return n / minutos;
  }

  /** Presentes já recebidos (nome e moedas), para sugerir na tela de configuração. */
  function presentesVistos() {
    if (!db || typeof db.prepare('SELECT 1').all !== 'function') return [];
    try {
      return db.prepare(`SELECT presente AS nome, MAX(moedas_unidade) AS moedas, SUM(quantidade) AS vezes
        FROM eventos WHERE tipo = 'presente' AND presente <> '' GROUP BY presente ORDER BY vezes DESC LIMIT 60`)
        .all()
        .map((r) => ({ nome: r.nome, moedas: Number(r.moedas) || 0 }));
    } catch (erro) {
      falhou(erro);
      return [];
    }
  }

  function fechar() {
    encerrarSessao();
    try {
      db?.close();
    } catch {
      // nada
    }
    db = null;
  }

  return { iniciarSessao, trocarJogo, encerrarSessao, gravar, interacoesPorMinuto, presentesVistos, fechar, get ativo() { return Boolean(db); } };
}
