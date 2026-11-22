// Nomes dos eventos e dos status da live. Este arquivo e usado pelos dois lados:
// pelo launcher (processo principal) e pelos jogos, que importam de "/_sdk/tipos.js".
// Por isso ele nao pode depender de nada do Node.

export const TIPOS = Object.freeze({
  COMENTARIO: 'comentario',
  PRESENTE: 'presente',
  CURTIDA: 'curtida',
  SEGUIU: 'seguiu',
  COMPARTILHOU: 'compartilhou',
  ENTROU: 'entrou',
  ESPECTADORES: 'espectadores',
  LIVE_ENCERRADA: 'live_encerrada'
});

export const STATUS = Object.freeze({
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
  OFFLINE: 'offline',
  RECONECTANDO: 'reconectando',
  ERRO: 'erro',
  PARADO: 'parado'
});
