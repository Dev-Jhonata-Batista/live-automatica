// Fase 1: mostra no terminal os comentarios e presentes de uma live do TikTok.
//
// Uso (PowerShell, dentro da pasta fase1-conector):
//   npm start -- usuario            conecta na live real
//   npm start -- usuario --debug    tambem mostra os dados originais do TikTok
//   npm run simular                  live falsa, para testar sem ninguem ao vivo
//
// Chave opcional do Euler Stream (aumenta o limite de conexoes):
//   $env:EULER_API_KEY = "sua-chave"; npm start -- usuario

import { FonteTikTok } from './tiktok.js';
import { FonteSimulada } from './simulador.js';
import { TIPOS, STATUS } from './eventos.js';

// ------------------------------------------------------------------ cores (ANSI)
const cor = {
  cinza: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  amarelo: (t) => `\x1b[33m${t}\x1b[0m`,
  vermelho: (t) => `\x1b[31m${t}\x1b[0m`,
  ciano: (t) => `\x1b[36m${t}\x1b[0m`,
  magenta: (t) => `\x1b[35m${t}\x1b[0m`,
  negrito: (t) => `\x1b[1m${t}\x1b[0m`
};

// ------------------------------------------------------------------ argumentos
const args = process.argv.slice(2);
const simular = args.includes('--simular');
const debug = args.includes('--debug');
const mostrarTudo = args.includes('--tudo'); // mostra tambem entradas e contagem de espectadores
const arroba = args.find((a) => !a.startsWith('--'));

if (!simular && !arroba) {
  console.log(cor.vermelho('Faltou o @ da live.'));
  console.log('Exemplo:  npm start -- nomedostreamer');
  console.log('Teste sem live:  npm run simular');
  process.exit(1);
}

const fonte = simular
  ? new FonteSimulada(arroba || 'simulador')
  : new FonteTikTok(arroba, { chaveEuler: process.env.EULER_API_KEY, debug });

// ------------------------------------------------------------------ saida
const hora = () => cor.cinza(new Date().toLocaleTimeString('pt-BR'));
const quem = (u) => (u ? cor.negrito(`@${u.arroba || u.nome || '?'}`) : '');

// Palavras que, na Fase 3, vao colocar o espectador na corrida.
function palavraDeEntrada(texto) {
  const t = texto.toLowerCase();
  if (/\bcarro\b/.test(t)) return 'carro';
  if (/\bmoto\b/.test(t)) return 'moto';
  return null;
}

fonte.on('status', ({ status, mensagem, proximaTentativaEmMs }) => {
  const sufixo = proximaTentativaEmMs ? cor.cinza(` (nova tentativa em ${Math.round(proximaTentativaEmMs / 1000)}s)`) : '';
  const pintar = {
    [STATUS.CONECTADO]: cor.verde,
    [STATUS.CONECTANDO]: cor.amarelo,
    [STATUS.RECONECTANDO]: cor.amarelo,
    [STATUS.OFFLINE]: cor.amarelo,
    [STATUS.ERRO]: cor.vermelho,
    [STATUS.PARADO]: cor.cinza
  }[status] ?? ((t) => t);
  console.log(`${hora()} ${pintar(`[${status.toUpperCase()}]`)} ${mensagem}${sufixo}`);
});

fonte.on('evento', (ev) => {
  const { tipo, usuario, dados } = ev;

  switch (tipo) {
    case TIPOS.COMENTARIO: {
      const entrada = palavraDeEntrada(dados.texto);
      const marca = entrada ? cor.verde(` <- quer entrar de ${entrada.toUpperCase()}`) : '';
      console.log(`${hora()} ${cor.ciano('COMENTARIO')} ${quem(usuario)}: ${dados.texto}${marca}`);
      break;
    }
    case TIPOS.PRESENTE: {
      const qtd = `x${dados.quantidade}`;
      const moedas = cor.cinza(`(${dados.moedas} moeda${dados.moedas === 1 ? '' : 's'} cada)`);
      if (dados.final) {
        console.log(`${hora()} ${cor.magenta('PRESENTE  ')} ${quem(usuario)} enviou ${cor.negrito(dados.nome)} ${cor.negrito(qtd)} ${moedas}`);
      } else {
        console.log(cor.cinza(`${new Date().toLocaleTimeString('pt-BR')}   combo em andamento: @${usuario?.arroba} ${dados.nome} ${qtd}`));
      }
      break;
    }
    case TIPOS.CURTIDA:
      console.log(`${hora()} ${cor.vermelho('CURTIDA   ')} ${quem(usuario)} curtiu x${dados.quantidade}`);
      break;
    case TIPOS.SEGUIU:
      console.log(`${hora()} ${cor.verde('SEGUIU    ')} ${quem(usuario)} comecou a seguir`);
      break;
    case TIPOS.COMPARTILHOU:
      console.log(`${hora()} ${cor.verde('COMPARTILH')} ${quem(usuario)} compartilhou a live`);
      break;
    case TIPOS.ENTROU:
      if (mostrarTudo) console.log(`${hora()} ${cor.cinza('ENTROU    ')} ${quem(usuario)}`);
      break;
    case TIPOS.ESPECTADORES:
      if (mostrarTudo) console.log(`${hora()} ${cor.cinza(`ESPECTADORES: ${dados.total}`)}`);
      break;
    case TIPOS.LIVE_ENCERRADA:
      console.log(`${hora()} ${cor.amarelo('A LIVE TERMINOU')}`);
      break;
    default:
      break;
  }
});

if (debug) {
  fonte.on('bruto', (nome, dados) => {
    console.log(cor.cinza(`--- bruto: ${nome} ---`));
    console.log(cor.cinza(JSON.stringify(dados, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2).slice(0, 3000)));
  });
}

// ------------------------------------------------------------------ ciclo de vida
console.log(cor.negrito('Pista Viva - Fase 1 (leitor de live)'));
console.log(cor.cinza('Ctrl+C para sair.\n'));
fonte.iniciar();

let saindo = false;
process.on('SIGINT', async () => {
  if (saindo) process.exit(0);
  saindo = true;
  await fonte.parar();
  process.exit(0);
});
