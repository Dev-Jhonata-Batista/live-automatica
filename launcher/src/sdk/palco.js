// Palco de resolucao fixa (padrao 1080x1920, formato 9:16) que escala para caber
// na janela, mantendo a proporcao. O jogo desenha sempre nas mesmas medidas,
// nao importa o tamanho da janela.
//
// Uso:
//   import { criarPalco } from '/_sdk/palco.js';
//   const palco = criarPalco(document.getElementById('palco'));

export function criarPalco(elemento, { largura = 1080, altura = 1920 } = {}) {
  Object.assign(elemento.style, {
    position: 'absolute',
    width: `${largura}px`,
    height: `${altura}px`,
    transformOrigin: 'top left'
  });

  function ajustar() {
    const escala = Math.min(window.innerWidth / largura, window.innerHeight / altura);
    elemento.style.transform = `scale(${escala})`;
    elemento.style.left = `${(window.innerWidth - largura * escala) / 2}px`;
    elemento.style.top = `${(window.innerHeight - altura * escala) / 2}px`;
  }

  window.addEventListener('resize', ajustar);
  ajustar();

  return { largura, altura, ajustar };
}
