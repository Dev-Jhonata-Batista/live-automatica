// Tela do launcher: campo do @, escolha do jogo, modo teste, status da live e botao JOGAR/PARAR.
// Fala com o processo principal so pelo objeto window.launcher (ver preload/launcher.cjs).

const el = {
  versao: document.getElementById('versao'),
  arroba: document.getElementById('arroba'),
  simulador: document.getElementById('simulador'),
  listaJogos: document.getElementById('listaJogos'),
  avisosJogos: document.getElementById('avisosJogos'),
  bolinha: document.getElementById('bolinha'),
  statusTitulo: document.getElementById('statusTitulo'),
  statusMensagem: document.getElementById('statusMensagem'),
  cComentarios: document.getElementById('cComentarios'),
  cPresentes: document.getElementById('cPresentes'),
  cCurtidas: document.getElementById('cCurtidas'),
  erro: document.getElementById('erro'),
  jogar: document.getElementById('jogar'),
  tituloJogo: document.getElementById('tituloJogo'),
  aviso: document.getElementById('aviso'),
  cartaoPresentes: document.getElementById('cartaoPresentes'),
  presentesJogo: document.getElementById('presentesJogo'),
  presentesAjuda: document.getElementById('presentesAjuda'),
  linhasPresentes: document.getElementById('linhasPresentes'),
  presentesVistos: document.getElementById('presentesVistos'),
  addPresente: document.getElementById('addPresente'),
  salvarPresentes: document.getElementById('salvarPresentes'),
  presentesSalvo: document.getElementById('presentesSalvo'),
  blocoMeta: document.getElementById('blocoMeta'),
  metaAtiva: document.getElementById('metaAtiva'),
  metaPresente: document.getElementById('metaPresente'),
  metaQuantidade: document.getElementById('metaQuantidade'),
  metaRecompensa: document.getElementById('metaRecompensa'),
  rotacaoResumo: document.getElementById('rotacaoResumo'),
  rotAtiva: document.getElementById('rotAtiva'),
  rotJogos: document.getElementById('rotJogos'),
  rotMinutos: document.getElementById('rotMinutos'),
  rotCair: document.getElementById('rotCair'),
  rotQueda: document.getElementById('rotQueda')
};

const TITULOS_STATUS = {
  parado: 'Desligado',
  conectando: 'Conectando...',
  conectado: 'Conectado à live',
  offline: 'Live offline',
  reconectando: 'Reconectando...',
  erro: 'Erro na conexão'
};

let jogando = false;
let jogoEscolhido = '';
let jogoRodando = '';   // o que esta na janela agora (muda com a rotacao)
let listaDeJogos = [];
let rotacao = null;

// ------------------------------------------------------------------ jogos

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function mostrarJogos(jogos, preferido) {
  listaDeJogos = jogos;
  el.listaJogos.replaceChildren();

  if (!jogos.length) {
    el.listaJogos.append(criar('p', 'sem-jogos', 'Nenhum jogo encontrado na pasta "jogos".'));
    jogoEscolhido = '';
    return;
  }

  jogoEscolhido = jogos.some((j) => j.id === preferido) ? preferido : jogos[0].id;

  for (const jogo of jogos) {
    const botao = criar('button', 'jogo');
    botao.type = 'button';
    botao.dataset.id = jogo.id;
    botao.setAttribute('role', 'radio');

    const cor = criar('span', 'jogo-cor');
    cor.style.background = jogo.cor;

    const nome = criar('span', 'jogo-nome', jogo.nome);
    nome.append(criar('small', '', `v${jogo.versao}`));

    const textos = criar('span', 'jogo-textos');
    textos.append(nome, criar('span', 'jogo-descricao', jogo.descricao || ''));
    if (jogo.descricao) textos.title = jogo.descricao;

    botao.append(cor, textos);
    botao.addEventListener('click', () => escolherJogo(jogo.id));
    el.listaJogos.append(botao);
  }

  marcarJogoEscolhido();
  carregarPresentes();
  if (!el.rotJogos.contains(document.activeElement)) mostrarRotacao();
}

// Le as pastas de jogos de novo: um jogo criado ou corrigido com o launcher
// aberto aparece ao voltar para esta janela, ao parar um jogo ou ao dar erro.
async function recarregarJogos() {
  if (jogando) return;
  const dados = await window.launcher.carregar();
  el.avisosJogos.textContent = dados.avisosJogos.join('\n');
  mostrarJogos(dados.jogos, jogoEscolhido);
}

function escolherJogo(id) {
  if (jogando) {
    // Com a live rodando, clicar em outro jogo troca na mesma janela.
    if (id !== jogoRodando) window.launcher.trocarJogo(id);
    return;
  }
  jogoEscolhido = id;
  marcarJogoEscolhido();
  carregarPresentes(true);
}

function marcarJogoEscolhido() {
  for (const botao of el.listaJogos.querySelectorAll('.jogo')) {
    const marcado = botao.dataset.id === (jogando && jogoRodando ? jogoRodando : jogoEscolhido);
    botao.setAttribute('aria-checked', String(marcado));
    botao.classList.toggle('atual', jogando && botao.dataset.id === jogoRodando);
    botao.title = jogando ? 'Clique para trocar de jogo agora' : '';
  }
}

// ------------------------------------------------------------------ presentes -> acoes

let presentesCarregadosDe = null;

// Só recarrega a configuração ao trocar de jogo, para não apagar o que está sendo digitado.
async function carregarPresentes(forcar = false) {
  const jogo = listaDeJogos.find((j) => j.id === jogoEscolhido);
  if (!forcar && jogo && presentesCarregadosDe === jogo.id) return;
  presentesCarregadosDe = jogo?.id ?? null;
  el.presentesSalvo.textContent = '';
  if (!jogo || (!jogo.presentes && !jogo.meta)) {
    el.cartaoPresentes.hidden = true;
    return;
  }
  el.cartaoPresentes.hidden = false;
  el.presentesJogo.textContent = jogo.nome;
  const { config, presentesVistos } = await window.launcher.configJogo(jogo.id);

  el.presentesVistos.replaceChildren(
    ...presentesVistos.map((p) => {
      const op = document.createElement('option');
      op.value = p.nome;
      op.label = `${p.moedas} moeda(s)`;
      return op;
    })
  );

  el.linhasPresentes.replaceChildren();
  el.addPresente.hidden = !jogo.presentes;
  el.salvarPresentes.hidden = false;
  if (jogo.presentes) {
    el.presentesAjuda.textContent = `${jogo.presentes.padrao || ''} Vale a partir do próximo JOGAR.`;
    const salvos = config.presentes && typeof config.presentes === 'object' ? config.presentes : {};
    for (const [nome, nivel] of Object.entries(salvos)) adicionarLinhaPresente(jogo, nome, nivel);
    if (!Object.keys(salvos).length) adicionarLinhaPresente(jogo, '', jogo.presentes.niveis[0].id);
  } else {
    el.presentesAjuda.textContent = '';
  }

  el.blocoMeta.hidden = !jogo.meta;
  const meta = config.meta || {};
  el.metaAtiva.checked = Boolean(meta.ativa);
  el.metaPresente.value = meta.presente || '';
  el.metaQuantidade.value = meta.quantidade || '';
  el.metaRecompensa.value = meta.recompensa || '';
}

function adicionarLinhaPresente(jogo, nome = '', nivel = '') {
  const linha = criar('div', 'linha-presente');
  const entrada = criar('input');
  entrada.type = 'text';
  entrada.placeholder = 'Nome do presente (ex.: Rose)';
  entrada.maxLength = 60;
  entrada.value = nome;
  entrada.setAttribute('list', 'presentesVistos');
  const escolha = criar('select');
  for (const n of jogo.presentes.niveis) {
    const op = criar('option', '', n.nome);
    op.value = n.id;
    escolha.append(op);
  }
  escolha.value = nivel || jogo.presentes.niveis[0].id;
  const tirar = criar('button', '', '×');
  tirar.type = 'button';
  tirar.title = 'Remover';
  tirar.addEventListener('click', () => linha.remove());
  linha.append(entrada, escolha, tirar);
  el.linhasPresentes.append(linha);
}

async function salvarPresentes() {
  const jogo = listaDeJogos.find((j) => j.id === jogoEscolhido);
  if (!jogo) return;
  const presentes = {};
  for (const linha of el.linhasPresentes.querySelectorAll('.linha-presente')) {
    const [entrada, escolha] = linha.querySelectorAll('input, select');
    const nome = entrada.value.trim();
    if (nome) presentes[nome] = escolha.value;
  }
  const dados = { presentes };
  if (jogo.meta) {
    dados.meta = {
      ativa: el.metaAtiva.checked,
      presente: el.metaPresente.value,
      quantidade: el.metaQuantidade.value,
      recompensa: el.metaRecompensa.value
    };
  }
  const r = await window.launcher.salvarConfigJogo(jogo.id, dados);
  el.presentesSalvo.textContent = r.ok ? 'Salvo. Vale a partir do próximo JOGAR (ou da próxima troca de jogo).' : r.erro;
}

// ------------------------------------------------------------------ rotacao

function mostrarRotacao() {
  if (!rotacao) return;
  el.rotAtiva.checked = rotacao.ativa;
  el.rotMinutos.value = rotacao.minutos;
  el.rotCair.checked = rotacao.trocarSeCair;
  el.rotQueda.value = rotacao.quedaPct;
  el.rotJogos.replaceChildren();
  for (const jogo of listaDeJogos) {
    const rotulo = criar('label', 'opcao');
    const caixa = criar('input');
    caixa.type = 'checkbox';
    caixa.value = jogo.id;
    caixa.checked = rotacao.jogos.includes(jogo.id);
    caixa.addEventListener('change', salvarRotacao);
    rotulo.append(caixa, criar('span', '', jogo.nome));
    el.rotJogos.append(rotulo);
  }
  resumoRotacao();
}

function resumoRotacao() {
  const n = rotacao.jogos.length;
  el.rotacaoResumo.textContent = !rotacao.ativa ? 'desligada' : n < 2 ? 'escolha 2 jogos ou mais' : `${n} jogos, a cada ${rotacao.minutos} min`;
}

async function salvarRotacao() {
  rotacao = {
    ativa: el.rotAtiva.checked,
    jogos: [...el.rotJogos.querySelectorAll('input:checked')].map((c) => c.value),
    minutos: el.rotMinutos.value,
    trocarSeCair: el.rotCair.checked,
    quedaPct: el.rotQueda.value
  };
  await window.launcher.salvarRotacao(rotacao);
  rotacao = await window.launcher.rotacao();
  resumoRotacao();
}

// ------------------------------------------------------------------ status

function mostrarStatus({ status, mensagem, proximaTentativaEmMs, simulador }) {
  el.bolinha.dataset.status = status;
  let titulo = TITULOS_STATUS[status] || status;
  if (simulador && status === 'conectado') titulo = 'Modo teste ativo';
  el.statusTitulo.textContent = titulo;

  let texto = mensagem || '';
  if (proximaTentativaEmMs) texto += ` Nova tentativa em ${Math.round(proximaTentativaEmMs / 1000)}s.`;
  el.statusMensagem.textContent = texto;
}

function mostrarContadores({ comentarios, presentes, curtidas }) {
  const fmt = (n) => Number(n).toLocaleString('pt-BR');
  el.cComentarios.textContent = fmt(comentarios);
  el.cPresentes.textContent = fmt(presentes);
  el.cCurtidas.textContent = fmt(curtidas);
}

function mostrarJogando(valor) {
  jogando = valor;
  el.jogar.textContent = valor ? 'PARAR' : 'JOGAR';
  el.jogar.classList.toggle('parar', valor);
  el.arroba.disabled = valor;
  el.simulador.disabled = valor;
  if (valor && !jogoRodando) jogoRodando = jogoEscolhido;
  if (!valor) jogoRodando = '';
  marcarJogoEscolhido();
  if (!valor) recarregarJogos();
}

// ------------------------------------------------------------------ JOGAR / PARAR

async function aoClicar() {
  el.erro.textContent = '';
  el.jogar.disabled = true;
  try {
    if (jogando) {
      await window.launcher.parar();
      return;
    }
    const resposta = await window.launcher.jogar({
      arroba: el.arroba.value,
      simulador: el.simulador.checked,
      jogo: jogoEscolhido
    });
    if (!resposta.ok) {
      el.erro.textContent = resposta.erro;
      recarregarJogos();
    }
  } finally {
    el.jogar.disabled = false;
  }
}

async function iniciar() {
  const dados = await window.launcher.carregar();
  rotacao = await window.launcher.rotacao();
  jogoRodando = dados.jogando ? dados.jogoAtual?.id || '' : '';
  el.versao.textContent = `v${dados.versao}`;
  el.tituloJogo.textContent = dados.tituloJogo;
  el.arroba.value = dados.config.arroba || '';
  el.simulador.checked = Boolean(dados.config.simulador);
  el.avisosJogos.textContent = dados.avisosJogos.join('\n');

  mostrarStatus(dados.status);
  mostrarContadores(dados.contadores);
  mostrarJogos(dados.jogos, dados.jogoAtual?.id || dados.config.jogo);
  mostrarJogando(dados.jogando);

  window.launcher.aoMudarStatus(mostrarStatus);
  window.launcher.aoAtualizarContadores(mostrarContadores);
  window.launcher.aoMudarJogo(mostrarJogando);
  window.launcher.aoTrocarJogoAtual((jogo) => {
    jogoRodando = jogo?.id || '';
    marcarJogoEscolhido();
  });
  window.launcher.aoAviso((texto) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    el.aviso.textContent = `${hora} ${texto}`;
  });

  el.addPresente.addEventListener('click', () => {
    const jogo = listaDeJogos.find((j) => j.id === jogoEscolhido);
    if (jogo?.presentes) adicionarLinhaPresente(jogo);
  });
  el.salvarPresentes.addEventListener('click', salvarPresentes);
  for (const campo of [el.rotAtiva, el.rotCair]) campo.addEventListener('change', salvarRotacao);
  for (const campo of [el.rotMinutos, el.rotQueda]) campo.addEventListener('change', salvarRotacao);

  window.addEventListener('focus', recarregarJogos);
  el.jogar.addEventListener('click', aoClicar);
  el.arroba.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aoClicar();
  });
  // Tira o @ se a pessoa digitar ou colar com ele.
  el.arroba.addEventListener('input', () => {
    if (el.arroba.value.startsWith('@')) el.arroba.value = el.arroba.value.replace(/^@+/, '');
  });

  if (!el.arroba.value) el.arroba.focus();
}

iniciar();
