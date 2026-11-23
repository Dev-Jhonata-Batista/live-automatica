// Ponte segura entre a tela do launcher e o processo principal.
// A pagina so enxerga as funcoes abaixo (window.launcher), nunca o Node.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  carregar: () => ipcRenderer.invoke('launcher:carregar'),
  jogar: (dados) => ipcRenderer.invoke('launcher:jogar', dados),
  parar: () => ipcRenderer.invoke('launcher:parar'),
  configJogo: (id) => ipcRenderer.invoke('launcher:configJogo', id),
  salvarConfigJogo: (id, parcial) => ipcRenderer.invoke('launcher:salvarConfigJogo', id, parcial),
  rotacao: () => ipcRenderer.invoke('launcher:rotacao'),
  salvarRotacao: (dados) => ipcRenderer.invoke('launcher:salvarRotacao', dados),
  trocarJogo: (id) => ipcRenderer.invoke('launcher:trocarJogo', id),
  aoMudarStatus: (fn) => ipcRenderer.on('live:status', (_e, status) => fn(status)),
  aoMudarJogo: (fn) => ipcRenderer.on('launcher:jogando', (_e, jogando) => fn(jogando)),
  aoTrocarJogoAtual: (fn) => ipcRenderer.on('launcher:jogoAtual', (_e, jogo) => fn(jogo)),
  aoAviso: (fn) => ipcRenderer.on('launcher:aviso', (_e, texto) => fn(texto)),
  aoAtualizarContadores: (fn) => ipcRenderer.on('live:contadores', (_e, contadores) => fn(contadores))
});
