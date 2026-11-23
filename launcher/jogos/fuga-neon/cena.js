// Desenho da cidade, dos carros e dos efeitos no canvas 1080x1920.
// Tudo é desenhado em código (arte original): avenida vertical com prédios neon,
// palmeiras, carro da fuga, viaturas, helicóptero, fumaça, escudo, chuva etc.
//
// A área da cidade vai de y=330 a y=1530; em cima e embaixo ficam o placar e o painel.

import { FASES } from './partida.js';
import { EQUIPES } from './entrada.js';

const L = 1080;
const TOPO = 330;
const BASE = 1530;
const ESTRADA_X = 250;
const ESTRADA_L = 580;
const CALCADA = 80;
const PX_POR_M = 5.2;
const Y_FUGA = 640; // onde fica o carro da fuga durante a perseguição

const LETREIROS = ['AÇAÍ 24H', 'PASTEL', 'HOTEL MAR', 'KARAOKÊ', 'SORVETE', 'BAR DO CAIS', 'FARMÁCIA', 'CINEMA', 'ACADEMIA', 'LAN HOUSE', 'PADARIA', 'BOLICHE'];
const MAX_FLUTUANTES = 14;
const Y_MINIMO_TEXTO = 520; // acima disso ficam a chamada e a meta

export function criarCena(canvas, { fotos }) {
  const ctx = canvas.getContext('2d');
  let rolagem = 0; // quanto a cidade já andou (px)
  let tempo = 0;
  const flutuantes = []; // textos que sobem e somem (@ + ação)
  const efeitos = new Map(); // efeito -> segundos restantes
  const confetes = [];
  let flash = 0;

  // Prédios gerados uma vez (repetem enquanto a cidade rola).
  const predios = [];
  let y = 0;
  let i = 0;
  while (y < 2400) {
    const h = 160 + ((i * 97) % 140);
    predios.push({ y, h, letreiro: LETREIROS[i % LETREIROS.length], cor: i % 3, janelas: (i * 31) % 7 });
    y += h + 18;
    i += 1;
  }
  const ALTURA_CICLO = y;

  // ---------------------------------------------------------------- acontecimentos

  function aoAcontecimento(a, partida) {
    const yFuga = Y_FUGA;
    const yPolicia = posicaoPolicia(partida);
    if (a.usuario && (a.tipo === 'acao' || a.tipo === 'gratis' || a.tipo === 'empurrao' || a.tipo === 'bloqueado' || a.tipo === 'entrou')) {
      const ladrao = a.equipe === EQUIPES.LADROES;
      let texto = `@${a.usuario.arroba || a.usuario.nome}`;
      let tamanho = 30;
      let cor = ladrao ? '#ffd23f' : '#5cc8ff';
      if (a.tipo === 'acao') {
        texto += ` ${a.acao.nome}${a.unidades > 1 ? ` x${a.unidades}` : ''}`;
        tamanho = { pequeno: 38, medio: 46, grande: 56, mega: 66 }[a.nivel] || 40;
        efeitos.set(a.acao.efeito, Math.max(efeitos.get(a.acao.efeito) || 0, a.acao.s || 2));
        if (a.nivel === 'grande' || a.nivel === 'mega') flash = 0.35;
      } else if (a.tipo === 'bloqueado') {
        texto += ' BLOQUEADO PELO ESCUDO';
        cor = '#7ef9ff';
        tamanho = 36;
      } else if (a.tipo === 'gratis') {
        texto += a.fonte === 'seguiu' ? ' SEGUIU! +TURBO' : ' COMPARTILHOU! +TURBO';
        tamanho = 40;
      } else if (a.tipo === 'entrou') {
        texto += a.trocou ? ` mudou para ${ladrao ? 'LADRÕES' : 'POLÍCIA'}` : ` entrou na ${ladrao ? 'gangue' : 'polícia'}`;
        tamanho = 32;
      }
      // Combo do mesmo presente: atualiza o texto que já está na tela (x2, x3...).
      const chave = a.tipo === 'acao' ? `${a.usuario.id}:${a.presente}` : '';
      const existente = chave && flutuantes.find((f) => f.chave === chave);
      if (existente) {
        existente.texto = texto;
        existente.tamanho = Math.min(80, tamanho + Math.min(14, a.unidades));
        existente.vida = existente.total;
        return;
      }
      const yBase = partida.fase === FASES.FUGA ? (ladrao ? yFuga : yPolicia) : ladrao ? 900 : 1300;
      if (flutuantes.length >= MAX_FLUTUANTES) {
        // Sem espaço: tira o menor (comentário simples) para dar lugar.
        const menor = flutuantes.reduce((m, f, idx) => (f.tamanho < flutuantes[m].tamanho ? idx : m), 0);
        if (flutuantes[menor].tamanho > tamanho) return;
        flutuantes.splice(menor, 1);
      }
      // Procura um lugar livre perto do veículo, para os textos não ficarem um em cima do outro.
      const x = 540 + (Math.random() - 0.5) * 260;
      let y = Math.max(Y_MINIMO_TEXTO + 40, yBase + (ladrao && partida.fase === FASES.FUGA ? 150 : -60));
      for (let tentativa = 0; tentativa < 12; tentativa += 1) {
        const ocupado = flutuantes.some((f) => Math.abs(f.y - y) < (f.tamanho + tamanho) * 0.6);
        if (!ocupado) break;
        y += 48;
      }
      if (y > BASE - 40) return; // tela cheia: este (pequeno) fica só no painel
      flutuantes.push({
        texto,
        cor,
        tamanho,
        foto: a.usuario.foto,
        chave,
        x,
        y,
        vida: a.tipo === 'empurrao' ? 1.4 : 2.6,
        total: a.tipo === 'empurrao' ? 1.4 : 2.6
      });
    }
    if (a.tipo === 'resultado' || a.tipo === 'meta') soltarConfete(a.tipo === 'meta' ? 220 : 140);
    if (a.tipo === 'surpresa' && a.surpresa.id === 'festa') soltarConfete(200);
  }

  function soltarConfete(n) {
    const cores = ['#ff3fa4', '#29e7ff', '#ffd23f', '#3dffa8', '#9b5cff'];
    for (let k = 0; k < n; k += 1) {
      confetes.push({
        x: Math.random() * L,
        y: TOPO - Math.random() * 300,
        vx: (Math.random() - 0.5) * 120,
        vy: 200 + Math.random() * 300,
        r: Math.random() * Math.PI,
        cor: cores[k % cores.length],
        vida: 4
      });
    }
  }

  function posicaoPolicia(partida) {
    if (partida.fase !== FASES.FUGA) return 1320;
    return Y_FUGA + 130 + partida.vantagem * PX_POR_M;
  }

  // ---------------------------------------------------------------- desenho

  function desenhar(partida, dt) {
    tempo += dt;
    const fuga = partida.fase === FASES.FUGA;
    const velocidade = fuga ? (partida.surpresa?.id === 'transito' ? 120 : 620) : partida.fase === FASES.RESULTADO ? 120 : 0;
    rolagem = (rolagem + velocidade * dt) % ALTURA_CICLO;
    for (const [k, v] of efeitos) {
      if (v - dt <= 0) efeitos.delete(k);
      else efeitos.set(k, v - dt);
    }
    flash = Math.max(0, flash - dt);

    const bairro = partida.bairro;
    ctx.clearRect(0, 0, L, 1920);
    ctx.fillStyle = bairro.ceu;
    ctx.fillRect(0, 0, L, 1920);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOPO, L, BASE - TOPO);
    ctx.clip();

    desenharCidade(bairro);

    if (fuga) {
      desenharPerseguicao(partida);
    } else {
      desenharBanco(partida, bairro);
    }

    desenharSurpresa(partida);
    desenharFlutuantes(dt);
    desenharConfete(dt);

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
      ctx.fillRect(0, TOPO, L, BASE - TOPO);
    }
    ctx.restore();
  }

  function desenharCidade(bairro) {
    // Calçadas e asfalto
    ctx.fillStyle = bairro.calcada;
    ctx.fillRect(ESTRADA_X - CALCADA, TOPO, ESTRADA_L + CALCADA * 2, BASE - TOPO);
    ctx.fillStyle = bairro.asfalto;
    ctx.fillRect(ESTRADA_X, TOPO, ESTRADA_L, BASE - TOPO);

    // Faixas tracejadas (3 pistas)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const fx of [ESTRADA_X + ESTRADA_L / 3, ESTRADA_X + (2 * ESTRADA_L) / 3]) {
      for (let yy = ((rolagem % 120) - 120) + TOPO; yy < BASE; yy += 120) ctx.fillRect(fx - 4, yy, 8, 60);
    }
    // Meio-fio neon
    ctx.fillStyle = bairro.neon[0];
    ctx.fillRect(ESTRADA_X - 6, TOPO, 6, BASE - TOPO);
    ctx.fillStyle = bairro.neon[1];
    ctx.fillRect(ESTRADA_X + ESTRADA_L, TOPO, 6, BASE - TOPO);

    // Prédios dos dois lados
    for (const lado of [0, 1]) {
      const x0 = lado === 0 ? 0 : ESTRADA_X + ESTRADA_L + CALCADA;
      const largura = lado === 0 ? ESTRADA_X - CALCADA : L - x0;
      for (const p of predios) {
        let yy = p.y + rolagem - ALTURA_CICLO;
        while (yy < BASE) {
          if (yy + p.h > TOPO) desenharPredio(x0, yy, largura, p, bairro, lado);
          yy += ALTURA_CICLO;
        }
      }
    }

    // Palmeiras na calçada
    if (bairro.palmeiras) {
      for (let yy = ((rolagem % 260) - 260) + TOPO; yy < BASE + 100; yy += 260) {
        desenharPalmeira(ESTRADA_X - CALCADA / 2, yy);
        desenharPalmeira(ESTRADA_X + ESTRADA_L + CALCADA / 2, yy + 130);
      }
    }
  }

  function desenharPredio(x, y, largura, p, bairro, lado) {
    ctx.fillStyle = ['#1b1430', '#141c33', '#211527'][p.cor];
    ctx.fillRect(x + 8, y, largura - 16, p.h);
    // Janelas acesas
    ctx.fillStyle = 'rgba(255, 230, 150, 0.35)';
    for (let jy = y + 50; jy < y + p.h - 20; jy += 34) {
      for (let jx = x + 22; jx < x + largura - 30; jx += 34) {
        if ((jx + jy + p.janelas) % 3 !== 0) ctx.fillRect(jx, jy, 16, 18);
      }
    }
    // Letreiro neon
    const cor = bairro.neon[p.cor % bairro.neon.length];
    const piscando = Math.sin(tempo * 3 + p.y) > -0.85;
    ctx.save();
    ctx.translate(lado === 0 ? x + largura - 18 : x + 18, y + p.h / 2);
    ctx.rotate(lado === 0 ? -Math.PI / 2 : Math.PI / 2);
    ctx.font = '800 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (piscando) {
      ctx.shadowColor = cor;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = piscando ? cor : 'rgba(255,255,255,0.15)';
    ctx.fillText(p.letreiro, 0, 0);
    ctx.restore();
  }

  function desenharPalmeira(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5a3b22';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f9d55';
    for (let k = 0; k < 6; k += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(26, 0, 30, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- veículos

  function desenharCarro(x, y, { cor, faixa, policia = false, escala = 1 }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    arredondado(-46, -82, 100, 176, 22);
    ctx.fill();
    // lataria
    ctx.fillStyle = cor;
    arredondado(-50, -90, 100, 180, 24);
    ctx.fill();
    // faixa
    ctx.fillStyle = faixa;
    ctx.fillRect(-10, -90, 20, 180);
    // vidros
    ctx.fillStyle = '#10162a';
    arredondado(-38, -48, 76, 40, 10);
    ctx.fill();
    arredondado(-36, 40, 72, 30, 10);
    ctx.fill();
    // farois
    ctx.fillStyle = '#fff6c2';
    ctx.fillRect(-42, -92, 22, 8);
    ctx.fillRect(20, -92, 22, 8);
    if (policia) {
      const lado = Math.floor(tempo * (efeitos.has('sirene') ? 14 : 6)) % 2;
      ctx.fillStyle = lado ? '#ff2d55' : '#2d7bff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 30;
      arredondado(-40, -6, 38, 14, 5);
      ctx.fill();
      ctx.fillStyle = lado ? '#2d7bff' : '#ff2d55';
      ctx.shadowColor = ctx.fillStyle;
      arredondado(2, -6, 38, 14, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function arredondado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function desenharFuga(x, y) {
    if (efeitos.has('nitro') || efeitos.has('atalho')) {
      // Chamas do nitro
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = ['#ffd23f', '#ff8a3d', '#ff3d6e'][k];
        ctx.beginPath();
        ctx.ellipse(x - 22 + k * 22, y + 105 + Math.random() * 20, 10, 26 + Math.random() * 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    desenharCarro(x, y, { cor: '#7b2cff', faixa: '#ffd23f', escala: 1.05 });
    // Saco de dinheiro no teto
    ctx.fillStyle = '#3dffa8';
    ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', x, y + 14);
    if (efeitos.has('escudo')) {
      ctx.save();
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#7ef9ff';
      ctx.shadowBlur = 30;
      ctx.globalAlpha = 0.6 + Math.sin(tempo * 10) * 0.25;
      ctx.beginPath();
      ctx.ellipse(x, y, 92, 130, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function desenharPerseguicao(partida) {
    const xFuga = 540 + Math.sin(tempo * 1.3) * 120;
    const yPolicia = posicaoPolicia(partida);

    // Régua de distância
    if (yPolicia < BASE + 100) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([14, 12]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ESTRADA_X + ESTRADA_L - 40, Y_FUGA + 95);
      ctx.lineTo(ESTRADA_X + ESTRADA_L - 40, Math.min(BASE - 10, yPolicia - 95));
      ctx.stroke();
      ctx.restore();
    }

    if (efeitos.has('fumaca')) {
      for (let k = 0; k < 14; k += 1) {
        ctx.fillStyle = `rgba(190,190,210,${0.25 + (k % 3) * 0.1})`;
        ctx.beginPath();
        ctx.arc(xFuga + Math.sin(k * 7 + tempo * 2) * 140, Y_FUGA + 140 + k * 26, 60 + (k % 4) * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (efeitos.has('bloqueio')) {
      for (let k = 0; k < 6; k += 1) {
        const cx = ESTRADA_X + 60 + k * 92;
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.moveTo(cx, Y_FUGA - 160);
        ctx.lineTo(cx - 22, Y_FUGA - 112);
        ctx.lineTo(cx + 22, Y_FUGA - 112);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 14, Y_FUGA - 140, 28, 8);
      }
    }

    desenharFuga(xFuga, Y_FUGA);

    // Viaturas (mais viaturas com mais estrelas)
    const viaturas = Math.min(3, 1 + Math.floor((partida.estrelas - 1) / 2) + (partida.contarEquipe(EQUIPES.POLICIA) > 5 ? 1 : 0));
    for (let k = 0; k < viaturas; k += 1) {
      const vx = 540 + (k - (viaturas - 1) / 2) * 170 + Math.sin(tempo * 1.1 + k) * 30;
      const vy = yPolicia + Math.abs(k - (viaturas - 1) / 2) * 90;
      if (vy < BASE + 120) desenharCarro(vx, vy, { cor: '#f4f6ff', faixa: '#1d3b8f', policia: true });
    }
    if (yPolicia >= BASE + 60) {
      // Polícia fora da tela: seta indicando
      ctx.fillStyle = '#5cc8ff';
      ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ POLÍCIA A ${Math.round(partida.vantagem)} m ▼`, 540, BASE - 30);
    }

    if (efeitos.has('helicoptero') || efeitos.has('procurado')) desenharHelicoptero(xFuga, Y_FUGA);
  }

  function desenharHelicoptero(xAlvo, yAlvo) {
    const x = xAlvo + Math.sin(tempo * 0.8) * 40;
    const y = yAlvo - 200;
    // Holofote
    ctx.save();
    const grad = ctx.createRadialGradient(xAlvo, yAlvo, 10, xAlvo, yAlvo, 170);
    grad.addColorStop(0, 'rgba(255,255,220,0.45)');
    grad.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(xAlvo, yAlvo, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Corpo
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#1d3b8f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, 60, 16, 90);
    ctx.fillStyle = '#9fd4ff';
    ctx.beginPath();
    ctx.ellipse(0, -30, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hélice
    ctx.rotate(tempo * 25);
    ctx.fillStyle = 'rgba(220,230,255,0.7)';
    ctx.fillRect(-150, -7, 300, 14);
    ctx.fillRect(-7, -150, 14, 300);
    ctx.restore();
  }

  function desenharBanco(partida, bairro) {
    // Banco fictício no meio da quadra, com o carro da fuga na porta.
    const x = ESTRADA_X + 40;
    const y = 470;
    ctx.save();
    ctx.fillStyle = '#20183a';
    ctx.fillRect(x, y, ESTRADA_L - 80, 230);
    ctx.fillStyle = bairro.neon[1];
    ctx.shadowColor = bairro.neon[1];
    ctx.shadowBlur = 25;
    ctx.font = '900 54px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BANCO DO PORTO', 540, y + 80);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a2f62';
    for (let k = 0; k < 4; k += 1) ctx.fillRect(x + 50 + k * 120, y + 110, 70, 120);
    ctx.restore();

    desenharFuga(540, 900);

    const assalto = partida.fase === FASES.ASSALTO;
    if (assalto && Math.floor(tempo * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,45,85,0.18)';
      ctx.fillRect(0, TOPO, L, BASE - TOPO);
    }
    desenharCarro(400, 1320, { cor: '#f4f6ff', faixa: '#1d3b8f', policia: true });
    desenharCarro(680, 1380, { cor: '#f4f6ff', faixa: '#1d3b8f', policia: true });
  }

  // ---------------------------------------------------------------- surpresas e textos

  function desenharSurpresa(partida) {
    const s = partida.surpresa;
    if (!s) return;
    if (s.id === 'chuva') {
      ctx.strokeStyle = 'rgba(170,200,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 120; k += 1) {
        const x = (k * 97 + tempo * 300) % L;
        const y = TOPO + ((k * 151 + tempo * 1400) % (BASE - TOPO));
        ctx.moveTo(x, y);
        ctx.lineTo(x - 12, y + 40);
      }
      ctx.stroke();
    } else if (s.id === 'apagao') {
      ctx.fillStyle = 'rgba(0,0,10,0.72)';
      ctx.fillRect(0, TOPO, L, BASE - TOPO);
    } else if (s.id === 'transito') {
      for (let k = 0; k < 6; k += 1) {
        const x = ESTRADA_X + 90 + (k % 3) * 200;
        const y = TOPO + 120 + ((k * 260 + tempo * 60) % (BASE - TOPO));
        desenharCarro(x, y, { cor: ['#ff8a3d', '#3dffa8', '#ff3fa4'][k % 3], faixa: '#222', escala: 0.75 });
      }
    }
  }

  function desenharFlutuantes(dt) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = flutuantes.length - 1; k >= 0; k -= 1) {
      const f = flutuantes[k];
      f.vida -= dt;
      if (f.vida <= 0) {
        flutuantes.splice(k, 1);
        continue;
      }
      // Sobe devagar, mas não entra embaixo do placar e da chamada.
      f.y = Math.max(Y_MINIMO_TEXTO + f.tamanho / 2, f.y - 25 * dt);
      const alfa = Math.min(1, f.vida / 0.5) * Math.min(1, (f.total - f.vida) / 0.12 + 0.3);
      ctx.globalAlpha = alfa;
      ctx.font = `900 ${f.tamanho}px "Segoe UI", Arial, sans-serif`;
      const largura = ctx.measureText(f.texto).width;
      const x = Math.max(largura / 2 + 20, Math.min(L - largura / 2 - 20, f.x));
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(f.texto, x, f.y);
      ctx.fillStyle = f.cor;
      ctx.fillText(f.texto, x, f.y);
      const foto = fotos.obter(f.foto);
      if (foto && f.tamanho >= 38) {
        const r = f.tamanho * 0.55;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x - largura / 2 - r - 10, f.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(foto, x - largura / 2 - 2 * r - 10, f.y - r, 2 * r, 2 * r);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function desenharConfete(dt) {
    for (let k = confetes.length - 1; k >= 0; k -= 1) {
      const c = confetes[k];
      c.vida -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += dt * 6;
      if (c.vida <= 0 || c.y > BASE) {
        confetes.splice(k, 1);
        continue;
      }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.cor;
      ctx.fillRect(-8, -4, 16, 8);
      ctx.restore();
    }
  }

  return { desenhar, aoAcontecimento };
}
