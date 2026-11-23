// Parte em HTML da tela: placar das equipes, fase e tempo, medidor de vantagem,
// chamada para entrar, meta, faixa de eventos grandes, painel e resultado.
// Nomes e comentários sempre entram como texto (textContent), nunca como HTML.

import { FASES } from './partida.js';
import { EQUIPES } from './entrada.js';
import { ACOES, NIVEIS, MOEDAS_POR_NIVEL } from './acoes.js';

const TEXTO_DA_FASE = {
  [FASES.PREPARACAO]: 'ESCOLHA SEU LADO',
  [FASES.ASSALTO]: 'ASSALTO EM ANDAMENTO',
  [FASES.FUGA]: 'FUGA!',
  [FASES.RESULTADO]: 'RESULTADO'
};

const TEXTO_DA_CONEXAO = {
  conectando: 'Conectando à live…',
  offline: 'Live offline',
  reconectando: 'Reconectando…',
  erro: 'Sem conexão com a live',
  parado: 'Conectando à live…'
};

const MAX_LINHAS = 5;

const $ = (id) => document.getElementById(id);

function minutos(segundos) {
  const t = Math.max(0, Math.ceil(segundos));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function arrobaDe(usuario) {
  return `@${usuario?.arroba || usuario?.nome || '?'}`;
}

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function nomeEquipe(equipe) {
  return equipe === EQUIPES.LADROES ? 'LADRÕES' : 'POLÍCIA';
}

export function criarPlacar({ config }) {
  const el = {
    streamer: $('streamer'),
    conexao: $('conexao'),
    vitL: $('vitL'),
    vitP: $('vitP'),
    qtdL: $('qtdL'),
    qtdP: $('qtdP'),
    rodada: $('rodada'),
    bairro: $('bairro'),
    fase: $('fase'),
    tempo: $('tempo'),
    medidor: $('medidor'),
    medidorRotulo: $('medidorRotulo'),
    medidorValor: $('medidorValor'),
    barraL: $('barraL'),
    estrelas: $('estrelas'),
    escudo: $('escudo'),
    chamada: $('chamada'),
    meta: $('meta'),
    metaTexto: $('metaTexto'),
    metaBarra: $('metaBarra'),
    faixa: $('faixa'),
    surpresa: $('surpresa'),
    resultado: $('resultado'),
    feed: $('feed'),
    destaques: $('destaques'),
    legenda: $('legenda')
  };

  let faixaAte = 0;
  let ultimaFase = null;
  let ultimosDestaques = '';
  let ultimasEstrelas = -1;
  montarLegenda();

  // ---------------------------------------------------------------- legenda das ações

  function montarLegenda() {
    // Mostra os presentes configurados no launcher; sem configuração, mostra por moedas.
    const configurados = config && typeof config.presentes === 'object' ? config.presentes : {};
    el.legenda.replaceChildren();
    for (const nivel of NIVEIS) {
      const nomes = Object.entries(configurados).filter(([, n]) => n === nivel).map(([nome]) => nome);
      let origem;
      if (nomes.length) origem = nomes.slice(0, 2).join(', ');
      else if (nivel === 'pequeno') origem = 'presente pequeno';
      else origem = `${MOEDAS_POR_NIVEL[nivel]}+ moedas`;
      const linha = criar('li', 'legenda-linha');
      linha.append(
        criar('span', 'legenda-origem', origem),
        criar('span', 'legenda-l', ACOES[EQUIPES.LADROES][nivel].nome),
        criar('span', 'legenda-p', ACOES[EQUIPES.POLICIA][nivel].nome)
      );
      el.legenda.append(linha);
    }
  }

  // ---------------------------------------------------------------- todo quadro

  function atualizar(partida) {
    el.vitL.textContent = partida.placarNoite[EQUIPES.LADROES];
    el.vitP.textContent = partida.placarNoite[EQUIPES.POLICIA];
    el.qtdL.textContent = `${partida.contarEquipe(EQUIPES.LADROES)} na gangue`;
    el.qtdP.textContent = `${partida.contarEquipe(EQUIPES.POLICIA)} na polícia`;
    el.rodada.textContent = `RODADA ${partida.rodada}`;
    el.bairro.textContent = partida.bairro.nome;
    el.fase.textContent = partida.retaFinal ? 'RETA FINAL!' : TEXTO_DA_FASE[partida.fase];
    el.fase.dataset.fase = partida.retaFinal ? 'reta' : partida.fase;
    el.tempo.textContent = minutos(partida.tempoRestante);

    if (partida.fase === FASES.FUGA) {
      el.medidorRotulo.textContent = 'VANTAGEM DA FUGA';
      el.medidorValor.textContent = `${Math.max(0, Math.round(partida.vantagem))} m`;
      const pct = Math.max(0, Math.min(100, (partida.vantagem / partida.regras.vantagemEsconderijoM) * 100));
      el.barraL.style.width = `${pct}%`;
      el.medidor.dataset.perigo = partida.vantagem < 15 ? 'sim' : 'nao';
    } else if (partida.fase === FASES.RESULTADO) {
      el.medidorRotulo.textContent = 'PRÓXIMA RODADA';
      el.medidorValor.textContent = partida.bairros[(partida.bairroIndice + 1) % partida.bairros.length].nome;
      el.barraL.style.width = '50%';
      el.medidor.dataset.perigo = 'nao';
    } else {
      el.medidorRotulo.textContent = 'COFRE x ALARME';
      const total = partida.cofre + partida.alarme;
      const pct = total > 0 ? (partida.cofre / total) * 100 : 50;
      el.barraL.style.width = `${pct}%`;
      el.medidorValor.textContent = `${Math.round(partida.cofre)} x ${Math.round(partida.alarme)}`;
      el.medidor.dataset.perigo = 'nao';
    }

    if (partida.estrelas !== ultimasEstrelas) {
      ultimasEstrelas = partida.estrelas;
      el.estrelas.replaceChildren(
        criar('span', 'estrela-cheia', '★'.repeat(partida.estrelas)),
        criar('span', 'estrela-vazia', '★'.repeat(Math.max(0, partida.regras.maxEstrelas - partida.estrelas)))
      );
    }
    el.escudo.hidden = !partida.escudoAtivo;

    // Chamada: sempre visível fora da fuga; na fuga, alterna com a explicação.
    if (partida.fase === FASES.FUGA) {
      el.chamada.textContent = Math.floor(partida.tempoNaFase / 6) % 2 === 0
        ? 'Comente para ajudar seu lado! Curtir também conta.'
        : 'Ainda dá para entrar: comente LADRÃO ou POLÍCIA';
    } else {
      el.chamada.textContent = 'Comente LADRÃO 💰 ou POLÍCIA 🚓 para entrar';
    }

    if (partida.meta) {
      el.meta.hidden = false;
      el.metaTexto.textContent = `META: ${partida.meta.quantidade} ${partida.meta.presente} → ${partida.meta.recompensa}`;
      el.metaBarra.style.width = `${Math.min(100, (partida.meta.atual / partida.meta.quantidade) * 100)}%`;
    } else {
      el.meta.hidden = true;
    }

    if (partida.surpresa) {
      el.surpresa.hidden = false;
      el.surpresa.textContent = `${partida.surpresa.nome}: ${partida.surpresa.texto}`;
    } else {
      el.surpresa.hidden = true;
    }

    if (performance.now() > faixaAte || partida.fase === FASES.RESULTADO) el.faixa.hidden = true;
    if (partida.fase !== FASES.RESULTADO) el.resultado.hidden = true;

    if (partida.fase !== ultimaFase) ultimaFase = partida.fase;

    // Destaques da noite: só redesenha quando muda.
    const destaques = partida.destaquesDaNoite(3);
    const chave = destaques.map((j) => `${j.usuario.arroba}:${j.equipe}`).join('|');
    if (chave !== ultimosDestaques) {
      ultimosDestaques = chave;
      el.destaques.replaceChildren();
      destaques.forEach((j, i) => {
        const li = criar('li', `destaque ${j.equipe}`);
        li.append(criar('span', 'destaque-pos', `${i + 1}º`), criar('span', 'destaque-nome', arrobaDe(j.usuario)));
        el.destaques.append(li);
      });
      if (!destaques.length) el.destaques.append(criar('li', 'destaque vazio', 'Quem ajudar aparece aqui'));
    }
  }

  // ---------------------------------------------------------------- acontecimentos

  function aoAcontecimento(a) {
    switch (a.tipo) {
      case 'entrou':
        if (a.trocou) linha(`${arrobaDe(a.usuario)} trocou para ${nomeEquipe(a.equipe)}`, a.equipe);
        else linha(`${arrobaDe(a.usuario)} entrou: ${nomeEquipe(a.equipe)}${a.motivo === 'presente' ? ' (pelo presente)' : ''}`, a.equipe);
        break;
      case 'acao':
        // Combo: atualiza a mesma linha (x2, x3...) em vez de criar uma linha por presente.
        linha(`${arrobaDe(a.usuario)}: ${a.acao.nome}${a.unidades > 1 ? ` x${a.unidades}` : ''}`, a.equipe, true, `${a.usuario?.id}:${a.presente}`);
        if (a.nivel === 'grande' || a.nivel === 'mega') faixa(`${a.acao.nome}!`, arrobaDe(a.usuario), a.equipe);
        break;
      case 'bloqueado':
        linha(`${arrobaDe(a.usuario)} bateu no ESCUDO NEON`, a.equipe);
        break;
      case 'gratis':
        linha(`${arrobaDe(a.usuario)} ${a.fonte === 'seguiu' ? 'seguiu' : 'compartilhou'}: turbo para ${nomeEquipe(a.equipe)}`, a.equipe);
        break;
      case 'fase':
        if (a.fase === FASES.ASSALTO) faixa('ASSALTO!', 'Ladrões enchem o cofre, polícia enche o alarme', 'neutro');
        if (a.fase === FASES.FUGA) faixa('FUGA!', 'Comente para ajudar seu lado', 'neutro');
        break;
      case 'quase':
        faixa('QUASE PRESOS!', 'Ladrões, comentem para escapar!', EQUIPES.POLICIA);
        break;
      case 'reta_final':
        faixa('RETA FINAL!', 'Cada ação vale mais agora', 'neutro');
        break;
      case 'surpresa':
        faixa(a.surpresa.nome, a.surpresa.texto, 'neutro');
        linha(`Surpresa: ${a.surpresa.nome}`, 'neutro');
        break;
      case 'meta':
        faixa('META BATIDA!', `${a.meta.recompensa}: toda ação vale o dobro`, 'neutro');
        linha(`Meta batida! ${a.usuario ? `Último: ${arrobaDe(a.usuario)}` : ''}`, 'neutro', true);
        break;
      case 'resultado':
        mostrarResultado(a.resultado);
        break;
      default:
        break;
    }
  }

  function linha(texto, equipe, forte = false, chave = '') {
    const primeira = el.feed.firstElementChild;
    if (chave && primeira && primeira.dataset.chave === chave) {
      primeira.textContent = texto;
      return;
    }
    const li = criar('li', `linha ${equipe}${forte ? ' forte' : ''}`, texto);
    if (chave) li.dataset.chave = chave;
    el.feed.prepend(li);
    while (el.feed.children.length > MAX_LINHAS) el.feed.lastElementChild.remove();
  }

  function faixa(titulo, sub, equipe) {
    el.faixa.replaceChildren(criar('strong', '', titulo), criar('span', '', sub));
    el.faixa.dataset.equipe = equipe;
    el.faixa.hidden = false;
    // Reinicia a animação
    el.faixa.classList.remove('entrando');
    void el.faixa.offsetWidth;
    el.faixa.classList.add('entrando');
    faixaAte = performance.now() + 2600;
  }

  function mostrarResultado(r) {
    const ladroes = r.vencedor === EQUIPES.LADROES;
    const titulo = ladroes ? (r.escondeu ? 'CHEGARAM AO ESCONDERIJO!' : 'FUGIRAM!') : 'PRESOS!';
    const sub = ladroes
      ? `Os ladrões escaparam com ${r.vantagemFinal} m de vantagem`
      : `A polícia pegou a gangue em ${minutos(r.tempoS)}${r.capturadoPor ? ` (último empurrão: ${arrobaDe(r.capturadoPor)})` : ''}`;
    const blocos = [criar('span', 'resultado-rotulo', ladroes ? 'VITÓRIA DOS LADRÕES' : 'VITÓRIA DA POLÍCIA'), criar('h2', '', titulo), criar('p', 'resultado-sub', sub)];

    const mvps = criar('div', 'resultado-mvps');
    if (r.mvpLadroes) mvps.append(criar('div', 'mvp ladroes', `Destaque dos ladrões: ${arrobaDe(r.mvpLadroes)}`));
    if (r.mvpPolicia) mvps.append(criar('div', 'mvp policia', `Destaque da polícia: ${arrobaDe(r.mvpPolicia)}`));
    blocos.push(mvps);

    if (r.recorde) {
      const texto = r.recorde.tipo === 'maiorFuga'
        ? `NOVO RECORDE: maior fuga, ${r.recorde.m} m`
        : `NOVO RECORDE: captura mais rápida, ${minutos(r.recorde.s)}`;
      blocos.push(criar('div', 'resultado-recorde', texto));
    }
    blocos.push(criar('p', 'resultado-placar', `Placar da noite: Ladrões ${r.placarNoite[EQUIPES.LADROES]} x ${r.placarNoite[EQUIPES.POLICIA]} Polícia`));
    el.resultado.replaceChildren(...blocos);
    el.resultado.dataset.vencedor = r.vencedor;
    el.resultado.hidden = false;
    el.faixa.hidden = true;
    faixaAte = 0;
  }

  // ---------------------------------------------------------------- conexão

  function mostrarStreamer(arroba) {
    el.streamer.textContent = arroba ? `@${arroba}` : '';
  }

  function mostrarConexao(status) {
    if (!status) return;
    if (status.status === 'conectado') {
      el.conexao.hidden = !status.simulador;
      el.conexao.textContent = 'MODO TESTE';
      el.conexao.dataset.tipo = 'teste';
      return;
    }
    el.conexao.hidden = false;
    el.conexao.textContent = TEXTO_DA_CONEXAO[status.status] || status.status;
    el.conexao.dataset.tipo = 'aviso';
  }

  return { atualizar, aoAcontecimento, mostrarStreamer, mostrarConexao };
}
