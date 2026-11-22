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
  tituloJogo: document.getElementById('tituloJogo')
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

// ------------------------------------------------------------------ jogos

function criar(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  return no;
}

function mostrarJogos(jogos, preferido) {
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
  if (jogando) return;
  jogoEscolhido = id;
  marcarJogoEscolhido();
}

function marcarJogoEscolhido() {
  for (const botao of el.listaJogos.querySelectorAll('.jogo')) {
    const marcado = botao.dataset.id === jogoEscolhido;
    botao.setAttribute('aria-checked', String(marcado));
    botao.disabled = jogando;
  }
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
