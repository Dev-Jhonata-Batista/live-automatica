// Parte em HTML da tela: placar do topo, chamada "comente CARRO ou MOTO",
// painel de acontecimentos, contagem da largada, tela de espera e podio.
// Nomes e comentarios sempre entram como texto (textContent), nunca como HTML.

import { FASES } from './corrida.js';

const TEXTO_DA_FASE = {
  [FASES.AGUARDANDO]: 'AGUARDANDO',
  [FASES.LARGADA]: 'LARGADA',
  [FASES.CORRENDO]: 'EM CORRIDA',
  [FASES.CHEGADA]: 'CHEGADA',
  [FASES.RESULTADO]: 'RESULTADO'
};

const TEXTO_DA_CONEXAO = {
  conectando: 'Conectando à live…',
  offline: 'Live offline',
  reconectando: 'Reconectando…',
  erro: 'Sem conexão com a live',
  parado: 'Conectando à live…' // so aparece no instante em que o jogo abre
};

const MAX_LINHAS = 6;

function minutos(segundos) {
  const t = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 04:31,24 (tempo do vencedor, com centesimos)
function minutosComCentesimo(segundos) {
  const centesimos = Math.floor(Math.max(0, segundos) * 100);
  const m = Math.floor(centesimos / 6000);
  const s = Math.floor((centesimos % 6000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(centesimos % 100).padStart(2, '0')}`;
}

// +0,08 s (quanto o 2o e o 3o chegaram depois do vencedor). Quem chega quase
// junto ganha uma casa a mais, para nao aparecer "+0,00 s"; menos de 1 milesimo
// vira "+<0,001 s" (o tempo nunca e igual: a ordem de chegada ja foi decidida).
function diferenca(segundos) {
  const d = Math.max(0, segundos);
  if (d < 0.0005) return '+<0,001 s';
  return `+${d.toFixed(d < 0.01 ? 3 : 2).replace('.', ',')} s`;
}

function metros(m) {
  return `${Math.round(Math.max(0, m)).toLocaleString('pt-BR')} m`;
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

function etiquetaDoVeiculo(tipo) {
  return criar('span', `tag ${tipo}`, tipo === 'moto' ? 'MOTO' : 'CARRO');
}

/**
 * @param {{ regras: object, modelos: object[], cores: string[], miniatura: Function }} opcoes
 */
export function criarPlacar({ regras, modelos, cores, miniatura }) {
  const $ = (id) => document.getElementById(id);
  const el = {
    streamer: $('streamer'),
    conexao: $('conexao'),
    numero: $('numero'),
    fase: $('fase'),
    rotuloTempo: $('rotuloTempo'),
    tempo: $('tempo'),
    rotuloLider: $('rotuloLider'),
    lider: $('lider'),
    falta: $('falta'),
    chamadaFim: $('chamadaFim'),
    vagas: $('vagas'),
    fila: $('fila'),
    feed: $('feed'),
    contagem: $('contagem'),
    vazio: $('vazio'),
    garagem: $('garagem'),
    podio: $('podio'),
    podioTitulo: $('podioTitulo'),
    podioLista: $('podioLista'),
    podioProxima: $('podioProxima')
  };

  // So mexe no HTML quando o valor muda (o placar e atualizado 60x por segundo).
  const valores = new Map();
  function escrever(no, valor) {
    if (valores.get(no) === valor) return;
    valores.set(no, valor);
    no.textContent = valor;
  }
  function mostrar(no, visivel) {
    if (no.hidden === !visivel) return;
    no.hidden = !visivel;
  }

  // ---------------------------------------------------------------- garagem (tela de espera)
  // No maximo 3 fileiras de 3: com mais, a caixa passaria por baixo do painel de baixo.
  modelos.slice(0, 9).forEach((modelo, i) => {
    const item = criar('div', 'modelo');
    item.append(miniatura(modelo, cores[(i * 5) % cores.length], 96), criar('span', 'nome-modelo', modelo.nome));
    item.append(etiquetaDoVeiculo(modelo.tipo));
    el.garagem.append(item);
  });

  // ---------------------------------------------------------------- a cada quadro
  let ultimaContagem = null;

  function atualizar(corrida) {
    const { fase } = corrida;
    const total = corrida.corredores.length;

    escrever(el.numero, String(corrida.numero));
    escrever(el.fase, TEXTO_DA_FASE[fase]);
    if (el.fase.dataset.fase !== fase) el.fase.dataset.fase = fase;

    // tempo
    if (fase === FASES.AGUARDANDO) {
      escrever(el.rotuloTempo, total ? 'LARGADA EM' : 'LARGADA');
      escrever(el.tempo, total ? minutos(Math.ceil(corrida.segundosParaLargada ?? 0)) : '--:--');
    } else if (fase === FASES.LARGADA) {
      escrever(el.rotuloTempo, 'LARGADA EM');
      escrever(el.tempo, minutos(Math.ceil(corrida.segundosParaLargada ?? 0)));
    } else if (fase === FASES.RESULTADO) {
      escrever(el.rotuloTempo, 'PRÓXIMA EM');
      escrever(el.tempo, minutos(Math.ceil(corrida.segundosParaProxima ?? 0)));
    } else {
      escrever(el.rotuloTempo, 'TEMPO');
      escrever(el.tempo, minutos(corrida.tempoCorrida));
    }

    // lider
    if (fase === FASES.AGUARDANDO || fase === FASES.LARGADA) {
      escrever(el.rotuloLider, 'PILOTOS');
      escrever(el.lider, `${total}/${regras.maxCorredores}`);
      escrever(el.falta, `pista de ${metros(regras.distanciaM)}`);
    } else if (fase === FASES.RESULTADO) {
      const vencedor = corrida.classificacao?.[0];
      escrever(el.rotuloLider, 'VENCEDOR');
      escrever(el.lider, vencedor ? arrobaDe(vencedor.usuario) : '—');
      escrever(el.falta, vencedor?.tempo != null ? `em ${minutosComCentesimo(vencedor.tempo)}` : '');
    } else {
      const lider = corrida.lider;
      escrever(el.rotuloLider, 'LÍDER');
      escrever(el.lider, lider ? arrobaDe(lider.usuario) : '—');
      escrever(el.falta, lider?.chegou ? 'CHEGOU!' : `faltam ${metros(corrida.faltaM)}`);
    }

    // chamada (mesma regra de corrida.aceitaEntrada: grid lotado ou fim da corrida vai para a fila)
    let fim;
    if (!corrida.aceitaEntrada) fim = 'para entrar na próxima corrida';
    else if (fase === FASES.CORRENDO) fim = 'e entre agora, atrás do pelotão';
    else fim = 'para entrar na corrida';
    escrever(el.chamadaFim, fim);

    // painel
    escrever(el.vagas, `${total}/${regras.maxCorredores} na pista`);
    escrever(el.fila, corrida.fila.length ? `${corrida.fila.length} na fila da próxima` : '');

    // contagem 3, 2, 1, JA!
    let contagem = null;
    if (fase === FASES.LARGADA) contagem = String(Math.max(1, Math.ceil(corrida.segundosParaLargada)));
    else if (fase === FASES.CORRENDO && corrida.tempoCorrida < 1) contagem = 'JÁ!';
    if (contagem !== ultimaContagem) {
      ultimaContagem = contagem;
      mostrar(el.contagem, contagem !== null);
      if (contagem !== null) {
        el.contagem.textContent = contagem;
        el.contagem.classList.toggle('ja', contagem === 'JÁ!');
        el.contagem.classList.remove('pulo');
        void el.contagem.offsetWidth; // reinicia a animacao
        el.contagem.classList.add('pulo');
      }
    }

    mostrar(el.vazio, fase === FASES.AGUARDANDO && total === 0);
    mostrar(el.podio, fase === FASES.RESULTADO);
    if (fase === FASES.RESULTADO) {
      escrever(el.podioProxima, `Próxima corrida em ${Math.ceil(corrida.segundosParaProxima ?? 0)} s`);
    }
  }

  // ---------------------------------------------------------------- acontecimentos
  function linha(classe, ...partes) {
    const item = criar('li', classe);
    item.append(...partes);
    el.feed.prepend(item);
    while (el.feed.children.length > MAX_LINHAS) el.feed.lastElementChild.remove();
    return item;
  }

  // Acontecimentos iguais em sequencia (ex.: muita gente indo para a fila)
  // viram uma linha so, que vai sendo atualizada: "@fulano e mais 7 ...".
  let grupo = null;
  function linhaAgrupada(chave, classe, montar) {
    if (grupo && grupo.chave === chave && el.feed.firstElementChild === grupo.item) {
      grupo.quantidade += 1;
      grupo.item.replaceChildren(...montar(grupo.quantidade));
      return;
    }
    grupo = { chave, quantidade: 1, item: linha(classe, ...montar(1)) };
  }

  function nome(corredorOuUsuario, cor) {
    const usuario = corredorOuUsuario.usuario ?? corredorOuUsuario;
    const no = criar('span', 'nome', arrobaDe(usuario));
    if (cor) no.style.color = cor;
    return no;
  }

  function aoAcontecimento(a) {
    const c = a.corredor;
    switch (a.tipo) {
      case 'entrou':
        if (a.daFila) {
          linhaAgrupada('da-fila', '', (n) =>
            n === 1
              ? [nome(c, c.cor), ' saiu da fila e entrou de ', etiquetaDoVeiculo(c.tipo), ` ${c.modelo.nome}`]
              : [nome(c, c.cor), ` e mais ${n - 1} saíram da fila direto para o grid`]
          );
        } else if (a.comCorridaAndando) linha('', nome(c, c.cor), ' entrou na corrida de ', etiquetaDoVeiculo(c.tipo), ` ${c.modelo.nome}`);
        else linha('', nome(c, c.cor), ' entrou de ', etiquetaDoVeiculo(c.tipo), ` ${c.modelo.nome}`);
        break;
      case 'trocou':
        linha('', nome(c, c.cor), ' trocou para ', etiquetaDoVeiculo(c.tipo), ` ${c.modelo.nome}`);
        break;
      case 'fila':
        linhaAgrupada('fila', 'suave', (n) =>
          n === 1
            ? [nome(a.usuario), ' está na fila da próxima corrida']
            : [nome(a.usuario), ` e mais ${n - 1} estão na fila da próxima corrida`]
        );
        break;
      case 'valendo':
        linha('destaque', `Valendo! Corrida ${a.numero} com ${a.total} ${a.total === 1 ? 'piloto' : 'pilotos'}`);
        break;
      case 'lider':
        linha('', nome(c, c.cor), a.primeiro ? ' saiu na frente!' : ' assumiu a liderança!');
        break;
      case 'chegou':
        if (a.colocacao === 2 || a.colocacao === 3) linha('', nome(c, c.cor), ` cruzou a linha em ${a.colocacao}º`);
        break;
      case 'vencedor':
        linha('destaque', nome(c), ` venceu a corrida ${a.numero}!`);
        break;
      case 'resultado':
        montarPodio(a.numero, a.classificacao);
        break;
      default:
        break;
    }
  }

  function avatar(usuario, cor) {
    const caixa = criar('div', 'avatar');
    caixa.style.borderColor = cor;
    const inicial = criar('span', '', [...(usuario.arroba || usuario.nome || '?')][0].toUpperCase());
    caixa.append(inicial);
    if (typeof usuario.foto === 'string' && /^https:\/\//i.test(usuario.foto)) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => inicial.remove());
      img.addEventListener('error', () => img.remove());
      img.src = usuario.foto;
      caixa.append(img);
    }
    return caixa;
  }

  function montarPodio(numero, classificacao) {
    el.podioTitulo.textContent = `Corrida ${numero}`;
    el.podioLista.replaceChildren();
    const top = (classificacao || []).slice(0, 3);
    if (!top.length) {
      el.podioLista.append(criar('p', 'sem-podio', 'Ninguém correu desta vez.'));
      return;
    }
    const vencedor = top[0];
    top.forEach((c, i) => {
      const item = criar('div', `lugar lugar-${i + 1}`);
      let detalhe;
      if (!c.chegou) detalhe = `faltaram ${metros(regras.distanciaM - c.d)}`;
      else if (i === 0 || !vencedor.chegou) detalhe = minutosComCentesimo(c.tempo);
      else detalhe = diferenca(c.tempo - vencedor.tempo);
      item.append(
        criar('span', 'colocacao', `${i + 1}º`),
        avatar(c.usuario, c.cor),
        criar('span', 'quem', arrobaDe(c.usuario)),
        criar('span', 'detalhe', `${c.modelo.nome} · ${detalhe}`)
      );
      el.podioLista.append(item);
    });
  }

  // ---------------------------------------------------------------- live
  function mostrarConexao(info) {
    const status = info?.status;
    if (status === 'conectado') {
      el.conexao.dataset.tipo = 'teste';
      escrever(el.conexao, 'MODO TESTE');
      mostrar(el.conexao, Boolean(info.simulador));
      return;
    }
    el.conexao.dataset.tipo = 'erro';
    escrever(el.conexao, TEXTO_DA_CONEXAO[status] || 'Sem conexão com a live');
    mostrar(el.conexao, true);
  }

  function mostrarStreamer(arroba) {
    const texto = String(arroba || '').replace(/^@+/, '');
    escrever(el.streamer, texto ? `@${texto}` : '');
  }

  function mostrarErro(texto) {
    linha('erro', texto);
  }

  return { atualizar, aoAcontecimento, mostrarConexao, mostrarStreamer, mostrarErro };
}
