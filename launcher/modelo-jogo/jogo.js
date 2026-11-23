// Modelo de jogo: ponto de partida para criar um jogo novo.
// Ele so mostra os ultimos eventos da live. Troque o conteudo de "aoEvento"
// pela logica do seu jogo. Guia completo: COMO-CRIAR-UM-JOGO.md

import { conectarPlataforma } from '/_sdk/plataforma.js';
import { criarPalco } from '/_sdk/palco.js';
import { TIPOS } from '/_sdk/tipos.js';

const el = {
  palco: document.getElementById('palco'),
  nomeDoJogo: document.getElementById('nomeDoJogo'),
  status: document.getElementById('status'),
  streamer: document.getElementById('streamer'),
  eventos: document.getElementById('eventos')
};

criarPalco(el.palco);

const TEXTOS_STATUS = {
  parado: 'DESLIGADO',
  conectando: 'CONECTANDO',
  conectado: 'AO VIVO',
  offline: 'LIVE OFFLINE',
  reconectando: 'RECONECTANDO',
  erro: 'SEM CONEXÃO'
};

function aoStatus({ status, simulador }) {
  el.status.dataset.status = status;
  el.status.textContent = simulador && status === 'conectado' ? 'MODO TESTE' : (TEXTOS_STATUS[status] || status);
}

// Recebe TODOS os eventos da live, no formato padrao:
//   { tipo, usuario: { arroba, nome, foto }, dados: { ... } }
function aoEvento(evento) {
  const { tipo, usuario, dados } = evento;
  let texto = null;

  if (tipo === TIPOS.COMENTARIO) texto = dados.texto;
  else if (tipo === TIPOS.PRESENTE && dados.final) texto = `${dados.nome} x${dados.quantidade}`;
  else if (tipo === TIPOS.SEGUIU) texto = 'começou a seguir';
  if (texto === null) return;

  // Sempre textContent: nomes e comentarios vem de estranhos.
  const item = document.createElement('li');
  const rotulo = document.createElement('span');
  rotulo.className = 'tipo';
  rotulo.textContent = `@${usuario?.arroba || '?'}`;
  item.append(rotulo, document.createTextNode(texto));
  el.eventos.prepend(item);
  while (el.eventos.children.length > 20) el.eventos.lastElementChild.remove();
}

const info = await conectarPlataforma({ aoEvento, aoStatus });
el.nomeDoJogo.textContent = info.jogo.nome;
el.streamer.textContent = `@${info.arroba}`;
aoStatus(info.status);
