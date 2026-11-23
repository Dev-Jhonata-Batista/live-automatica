// Se o jogo nao conseguir abrir (por exemplo, uma virgula faltando em
// veiculos/catalogo.js ou em regras.js), mostra o erro na propria janela do jogo
// em vez de deixar a tela parada sem explicacao. Fica num arquivo separado e
// simples, carregado antes de jogo.js, porque com um erro desses nada de
// jogo.js chega a rodar. Depois que o jogo abriu, os erros so vao para o Console.

(function () {
  function jogoRodando() {
    return document.documentElement.dataset.jogo === 'rodando';
  }

  function nomeDoArquivo(endereco) {
    try {
      return decodeURIComponent(new URL(endereco).pathname.replace(/^\/+/, ''));
    } catch {
      return String(endereco || '');
    }
  }

  function mostrar(titulo, detalhe) {
    if (jogoRodando() || document.getElementById('erroAoAbrir')) return;
    const caixa = document.createElement('div');
    caixa.id = 'erroAoAbrir';
    caixa.className = 'erro-ao-abrir';
    const cabecalho = document.createElement('strong');
    cabecalho.textContent = titulo;
    const codigo = document.createElement('code');
    codigo.textContent = detalhe;
    const dica = document.createElement('span');
    dica.textContent = 'Corrija o arquivo, salve e clique em PARAR e depois em JOGAR. Mais detalhes: npm run dev, aba Console.';
    caixa.append(cabecalho, codigo, dica);
    (document.body || document.documentElement).append(caixa);
  }

  window.addEventListener(
    'error',
    (evento) => {
      if (evento instanceof ErrorEvent) {
        const arquivo = evento.filename ? nomeDoArquivo(evento.filename) : '';
        const onde = arquivo ? `\n(${arquivo}${evento.lineno ? `, linha ${evento.lineno}` : ''})` : '';
        let dica = '';
        if (/does not provide an export named/.test(evento.message)) {
          dica = '\nDica: confira se o nome no import está escrito igual ao do outro arquivo e se lá ele tem "export".';
        } else if (/SyntaxError/.test(evento.message)) {
          dica = '\nDica: confira se falta uma vírgula, chave ou aspas nessa linha ou no fim da linha anterior.';
        }
        mostrar('O jogo não abriu por causa de um erro no código.', `${evento.message}${onde}${dica}`);
      } else if (evento.target instanceof HTMLScriptElement) {
        // Num script type="module", o erro chega aqui tambem quando falta um arquivo
        // que ele importa (e o navegador nao diz qual).
        const arquivo = nomeDoArquivo(evento.target.src);
        const detalhe =
          evento.target.type === 'module'
            ? `${arquivo} ou um arquivo que ele importa.\nConfira o nome e a pasta em cada linha "import ... from" (por exemplo, em veiculos/catalogo.js).`
            : arquivo;
        mostrar('O jogo não abriu: um arquivo do jogo não foi encontrado.', detalhe);
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason;
    mostrar('O jogo não abriu por causa de um erro no código.', String(motivo?.message || motivo));
  });
})();
