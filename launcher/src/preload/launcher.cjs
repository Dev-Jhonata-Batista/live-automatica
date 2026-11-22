// Ponte segura entre a tela do launcher e o processo principal.
// A pagina so enxerga as funcoes abaixo (window.launcher), nunca o Node.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  carregar: () => ipcRenderer.invoke('launcher:carregar'),
  jogar: (dados) => ipcRenderer.invoke('launcher:jogar', dados),
  parar: () => ipcRenderer.invoke('launcher:parar'),
  aoMudarStatus: (fn) => ipcRenderer.on('live:status', (_e, status) => fn(status)),
  aoMudarJogo: (fn) => ipcRenderer.on('launcher:jogando', (_e, jogando) => fn(jogando)),
  aoAtualizarContadores: (fn) => ipcRenderer.on('live:contadores', (_e, contadores) => fn(contadores))
});
