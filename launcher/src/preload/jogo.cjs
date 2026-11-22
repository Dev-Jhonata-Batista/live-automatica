// Ponte segura entre a janela do jogo e o processo principal.
// Qualquer jogo recebe eventos da live por window.live e nunca acessa o Node direto.
// Os jogos nao usam isto diretamente: usam o SDK em "/_sdk/plataforma.js".

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('live', {
  // -> { arroba, status, jogo: { id, nome, versao, descricao, cor }, config }
  pronto: () => ipcRenderer.invoke('jogo:pronto'),
  aoReceberEvento: (fn) => ipcRenderer.on('live:evento', (_e, evento) => fn(evento)),
  aoMudarStatus: (fn) => ipcRenderer.on('live:status', (_e, status) => fn(status))
});
