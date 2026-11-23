// Ligacao entre um jogo e o launcher. Todo jogo usa esta funcao para receber
// os eventos da live (comentarios, presentes...) e o status da conexao.
//
// Uso:
//   import { conectarPlataforma } from '/_sdk/plataforma.js';
//   const info = await conectarPlataforma({
//     aoEvento: (evento) => { ... },   // formato em src/live/eventos.js
//     aoStatus: (status) => { ... }    // { status, mensagem, simulador }
//   });
//   // info = { arroba, status, jogo: { id, nome, versao }, config }
//
// "config" e a configuracao salva deste jogo (vazia por enquanto; na Fase 4
// guarda qual presente faz qual acao).

export async function conectarPlataforma({ aoEvento, aoStatus } = {}) {
  if (!window.live) {
    throw new Error('Este jogo precisa ser aberto pelo launcher (botao JOGAR).');
  }
  // Os ouvintes entram antes de avisar que o jogo esta pronto. O launcher so liga a
  // live depois desta chamada (ou depois de 10 s, se o jogo nunca chamar), entao
  // nenhum evento se perde, mesmo que o jogo carregue imagens ou sons antes.
  if (aoStatus) window.live.aoMudarStatus(aoStatus);
  if (aoEvento) window.live.aoReceberEvento(aoEvento);
  return window.live.pronto();
}
