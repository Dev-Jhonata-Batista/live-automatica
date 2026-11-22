// Arte dos veiculos, desenhada em codigo (vista de cima, com a frente para CIMA).
//
// Cada funcao recebe (ctx, largura, altura, cor) e desenha o veiculo dentro do
// retangulo [0, 0, largura, altura], pintado com a cor do jogador. A cena guarda
// o resultado numa imagem pronta, entao desenhar aqui pode ser detalhado sem
// pesar na live.
//
// Para criar um modelo novo em codigo: copie uma funcao, mude o formato e
// registre o modelo em catalogo.js. Para usar uma imagem PNG, veja catalogo.js.

const PNEU = '#15171c';
const PNEU_RISCO = '#2c3038';
const VIDRO = '#1b2a3c';
const BRILHO = 'rgba(255, 255, 255, 0.22)';
const CONTORNO = 'rgba(0, 0, 0, 0.5)';
const FAROL = '#fff4c2';
const LANTERNA = '#ff4b4b';
const METAL = '#2b2f37';

// ------------------------------------------------------------------ utilitarios

/** Clareia (quanto > 0) ou escurece (quanto < 0) uma cor "#rrggbb". */
export function ajustarCor(hex, quanto) {
  const n = parseInt(String(hex).slice(1, 7), 16) || 0;
  const alvo = quanto > 0 ? 255 : 0;
  const f = Math.min(1, Math.abs(quanto));
  const canal = (c) => Math.round(c + (alvo - c) * f);
  return `rgb(${canal((n >> 16) & 255)}, ${canal((n >> 8) & 255)}, ${canal(n & 255)})`;
}

function retangulo(ctx, x, y, w, h, raio) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(raio, w / 2, h / 2)));
}

function preencher(ctx, estilo, contorno = false) {
  ctx.fillStyle = estilo;
  ctx.fill();
  if (contorno) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = CONTORNO;
    ctx.stroke();
  }
}

function circulo(ctx, x, y, r, estilo) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  preencher(ctx, estilo);
}

function elipse(ctx, x, y, rx, ry, estilo) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  preencher(ctx, estilo);
}

// Degrade de lado a lado: bordas mais escuras e meio mais claro (da volume).
function lataria(ctx, w, cor) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, ajustarCor(cor, -0.4));
  g.addColorStop(0.5, ajustarCor(cor, 0.12));
  g.addColorStop(1, ajustarCor(cor, -0.4));
  return g;
}

function roda(ctx, x, y, w, h, cravos = false) {
  retangulo(ctx, x, y, w, h, Math.min(w, h) * 0.3);
  preencher(ctx, PNEU);
  ctx.fillStyle = PNEU_RISCO;
  const passo = cravos ? h / 6 : h / 4;
  for (let yy = y + passo / 2; yy < y + h - 1; yy += passo) {
    ctx.fillRect(x + w * 0.2, yy, w * 0.6, cravos ? 2.5 : 1.5);
  }
}

// Piloto de moto visto de cima: bracos ate o guidao, tronco e capacete.
function piloto(ctx, w, h, cor, { capaceteY, troncoY, guidaoY, aberturaGuidao = 0.82, viseira = true }) {
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.13;
  ctx.strokeStyle = '#23262e';
  ctx.beginPath();
  ctx.moveTo(w * 0.22, troncoY);
  ctx.lineTo(w * (0.5 - aberturaGuidao / 2) + w * 0.06, guidaoY);
  ctx.moveTo(w * 0.78, troncoY);
  ctx.lineTo(w * (0.5 + aberturaGuidao / 2) - w * 0.06, guidaoY);
  ctx.stroke();

  elipse(ctx, w * 0.5, troncoY, w * 0.38, h * 0.11, ajustarCor(cor, -0.55));
  elipse(ctx, w * 0.5, troncoY, w * 0.1, h * 0.1, ajustarCor(cor, -0.2));

  const r = w * 0.27;
  const capacete = ctx.createRadialGradient(w * 0.42, capaceteY - r * 0.3, r * 0.2, w * 0.5, capaceteY, r);
  capacete.addColorStop(0, ajustarCor(cor, 0.45));
  capacete.addColorStop(1, ajustarCor(cor, -0.15));
  circulo(ctx, w * 0.5, capaceteY, r, capacete);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CONTORNO;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(w * 0.47, capaceteY - r * 0.9, w * 0.06, r * 1.8);
  if (viseira) elipse(ctx, w * 0.5, capaceteY - r * 0.62, r * 0.68, r * 0.26, VIDRO);
}

// ------------------------------------------------------------------ carros

/** Cometa: esportivo baixo, com faixas no capo e aerofolio. */
export function desenharCometa(ctx, w, h, cor) {
  roda(ctx, 0, h * 0.16, w * 0.18, h * 0.15);
  roda(ctx, w * 0.82, h * 0.16, w * 0.18, h * 0.15);
  roda(ctx, 0, h * 0.64, w * 0.2, h * 0.17);
  roda(ctx, w * 0.8, h * 0.64, w * 0.2, h * 0.17);

  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.01);
  ctx.bezierCurveTo(w * 0.78, h * 0.01, w * 0.88, h * 0.07, w * 0.9, h * 0.2);
  ctx.lineTo(w * 0.94, h * 0.6);
  ctx.lineTo(w * 0.92, h * 0.9);
  ctx.quadraticCurveTo(w * 0.9, h * 0.97, w * 0.8, h * 0.97);
  ctx.lineTo(w * 0.2, h * 0.97);
  ctx.quadraticCurveTo(w * 0.1, h * 0.97, w * 0.08, h * 0.9);
  ctx.lineTo(w * 0.06, h * 0.6);
  ctx.lineTo(w * 0.1, h * 0.2);
  ctx.bezierCurveTo(w * 0.12, h * 0.07, w * 0.22, h * 0.01, w * 0.5, h * 0.01);
  ctx.closePath();
  preencher(ctx, lataria(ctx, w, cor), true);

  // faixas no capo e na traseira
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  for (const x of [0.37, 0.55]) {
    ctx.fillRect(w * x, h * 0.03, w * 0.08, h * 0.31);
    ctx.fillRect(w * x, h * 0.73, w * 0.08, h * 0.12);
  }

  // para-brisa, teto e vidro traseiro
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.35);
  ctx.lineTo(w * 0.75, h * 0.35);
  ctx.lineTo(w * 0.83, h * 0.49);
  ctx.lineTo(w * 0.17, h * 0.49);
  ctx.closePath();
  preencher(ctx, VIDRO);
  ctx.fillStyle = BRILHO;
  ctx.fillRect(w * 0.3, h * 0.37, w * 0.4, h * 0.02);

  retangulo(ctx, w * 0.19, h * 0.49, w * 0.62, h * 0.16, 6);
  preencher(ctx, ajustarCor(cor, 0.08));

  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.65);
  ctx.lineTo(w * 0.8, h * 0.65);
  ctx.lineTo(w * 0.74, h * 0.72);
  ctx.lineTo(w * 0.26, h * 0.72);
  ctx.closePath();
  preencher(ctx, VIDRO);

  // aerofolio
  retangulo(ctx, w * 0.02, h * 0.86, w * 0.96, h * 0.075, 3);
  preencher(ctx, METAL, true);
  ctx.fillStyle = ajustarCor(cor, -0.2);
  ctx.fillRect(w * 0.02, h * 0.86, w * 0.06, h * 0.075);
  ctx.fillRect(w * 0.92, h * 0.86, w * 0.06, h * 0.075);

  elipse(ctx, w * 0.27, h * 0.065, w * 0.09, h * 0.022, FAROL);
  elipse(ctx, w * 0.73, h * 0.065, w * 0.09, h * 0.022, FAROL);
}

/** Tatu: jipe quadradao, com rodas grandes, bagageiro e estepe atras. */
export function desenharTatu(ctx, w, h, cor) {
  roda(ctx, 0, h * 0.12, w * 0.21, h * 0.18, true);
  roda(ctx, w * 0.79, h * 0.12, w * 0.21, h * 0.18, true);
  roda(ctx, 0, h * 0.66, w * 0.21, h * 0.18, true);
  roda(ctx, w * 0.79, h * 0.66, w * 0.21, h * 0.18, true);

  retangulo(ctx, w * 0.1, h * 0.04, w * 0.8, h * 0.86, w * 0.1);
  preencher(ctx, lataria(ctx, w, cor), true);

  // capo com entradas de ar
  retangulo(ctx, w * 0.15, h * 0.08, w * 0.7, h * 0.23, 5);
  preencher(ctx, ajustarCor(cor, -0.12));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (const y of [0.14, 0.19, 0.24]) ctx.fillRect(w * 0.32, h * y, w * 0.36, h * 0.015);

  // para-choque de impulsao e farois redondos
  retangulo(ctx, w * 0.12, 0, w * 0.76, h * 0.045, 3);
  preencher(ctx, METAL);
  circulo(ctx, w * 0.25, h * 0.065, w * 0.07, FAROL);
  circulo(ctx, w * 0.75, h * 0.065, w * 0.07, FAROL);

  retangulo(ctx, w * 0.16, h * 0.32, w * 0.68, h * 0.09, 3);
  preencher(ctx, VIDRO);
  ctx.fillStyle = BRILHO;
  ctx.fillRect(w * 0.22, h * 0.335, w * 0.56, h * 0.015);

  // teto com bagageiro
  retangulo(ctx, w * 0.15, h * 0.42, w * 0.7, h * 0.4, 6);
  preencher(ctx, ajustarCor(cor, 0.1));
  ctx.fillStyle = METAL;
  ctx.fillRect(w * 0.2, h * 0.45, w * 0.05, h * 0.34);
  ctx.fillRect(w * 0.75, h * 0.45, w * 0.05, h * 0.34);
  for (const y of [0.5, 0.6, 0.7]) ctx.fillRect(w * 0.2, h * y, w * 0.6, h * 0.018);

  // estepe e lanternas
  circulo(ctx, w * 0.5, h * 0.9, w * 0.16, PNEU);
  circulo(ctx, w * 0.5, h * 0.9, w * 0.07, '#8b919c');
  ctx.fillStyle = LANTERNA;
  ctx.fillRect(w * 0.14, h * 0.86, w * 0.1, h * 0.03);
  ctx.fillRect(w * 0.76, h * 0.86, w * 0.1, h * 0.03);
}

/** Bolinha: compacto redondinho, com teto solar. */
export function desenharBolinha(ctx, w, h, cor) {
  roda(ctx, w * 0.02, h * 0.17, w * 0.17, h * 0.14);
  roda(ctx, w * 0.81, h * 0.17, w * 0.17, h * 0.14);
  roda(ctx, w * 0.02, h * 0.67, w * 0.17, h * 0.14);
  roda(ctx, w * 0.81, h * 0.67, w * 0.17, h * 0.14);

  retangulo(ctx, w * 0.06, h * 0.02, w * 0.88, h * 0.95, w * 0.42);
  preencher(ctx, lataria(ctx, w, cor), true);

  circulo(ctx, w * 0.27, h * 0.1, w * 0.1, '#ffffff');
  circulo(ctx, w * 0.73, h * 0.1, w * 0.1, '#ffffff');
  circulo(ctx, w * 0.27, h * 0.1, w * 0.05, FAROL);
  circulo(ctx, w * 0.73, h * 0.1, w * 0.05, FAROL);

  retangulo(ctx, w * 0.17, h * 0.24, w * 0.66, h * 0.19, w * 0.2);
  preencher(ctx, VIDRO);
  ctx.fillStyle = BRILHO;
  ctx.fillRect(w * 0.26, h * 0.27, w * 0.48, h * 0.02);

  elipse(ctx, w * 0.5, h * 0.59, w * 0.37, h * 0.17, ajustarCor(cor, 0.15));
  retangulo(ctx, w * 0.31, h * 0.5, w * 0.38, h * 0.15, 7);
  preencher(ctx, VIDRO);

  retangulo(ctx, w * 0.23, h * 0.78, w * 0.54, h * 0.08, 6);
  preencher(ctx, VIDRO);
  ctx.fillStyle = LANTERNA;
  ctx.fillRect(w * 0.16, h * 0.9, w * 0.12, h * 0.025);
  ctx.fillRect(w * 0.72, h * 0.9, w * 0.12, h * 0.025);
}

// ------------------------------------------------------------------ motos

/** Faisca: moto esportiva com carenagem pontuda. */
export function desenharFaisca(ctx, w, h, cor) {
  roda(ctx, w * 0.37, h * 0.02, w * 0.26, h * 0.25);
  roda(ctx, w * 0.35, h * 0.7, w * 0.3, h * 0.28);

  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.07);
  ctx.quadraticCurveTo(w * 0.9, h * 0.16, w * 0.8, h * 0.42);
  ctx.lineTo(w * 0.66, h * 0.76);
  ctx.lineTo(w * 0.34, h * 0.76);
  ctx.lineTo(w * 0.2, h * 0.42);
  ctx.quadraticCurveTo(w * 0.1, h * 0.16, w * 0.5, h * 0.07);
  ctx.closePath();
  preencher(ctx, lataria(ctx, w, cor), true);
  elipse(ctx, w * 0.5, h * 0.19, w * 0.17, h * 0.045, VIDRO);
  elipse(ctx, w * 0.5, h * 0.09, w * 0.1, h * 0.018, FAROL);

  retangulo(ctx, w * 0.38, h * 0.74, w * 0.24, h * 0.15, 5);
  preencher(ctx, ajustarCor(cor, -0.15), true);
  ctx.fillStyle = LANTERNA;
  ctx.fillRect(w * 0.42, h * 0.87, w * 0.16, h * 0.02);

  piloto(ctx, w, h, cor, { capaceteY: h * 0.42, troncoY: h * 0.56, guidaoY: h * 0.3, aberturaGuidao: 0.8 });
}

/** Pipoca: scooter com escudo na frente e bauzinho atras. */
export function desenharPipoca(ctx, w, h, cor) {
  roda(ctx, w * 0.39, h * 0.02, w * 0.22, h * 0.17);
  roda(ctx, w * 0.39, h * 0.8, w * 0.22, h * 0.17);

  retangulo(ctx, w * 0.12, h * 0.07, w * 0.76, h * 0.23, w * 0.3);
  preencher(ctx, lataria(ctx, w, cor), true);
  circulo(ctx, w * 0.5, h * 0.11, w * 0.08, FAROL);

  retangulo(ctx, w * 0.24, h * 0.3, w * 0.52, h * 0.22, 5);
  preencher(ctx, '#3a3f49');

  retangulo(ctx, w * 0.18, h * 0.5, w * 0.64, h * 0.34, w * 0.26);
  preencher(ctx, lataria(ctx, w, cor), true);
  retangulo(ctx, w * 0.3, h * 0.56, w * 0.4, h * 0.22, 6);
  preencher(ctx, '#2a2d34');

  retangulo(ctx, w * 0.3, h * 0.85, w * 0.4, h * 0.11, 4);
  preencher(ctx, ajustarCor(cor, 0.35), true);

  retangulo(ctx, w * 0.04, h * 0.28, w * 0.92, h * 0.04, 3);
  preencher(ctx, METAL);
  circulo(ctx, w * 0.07, h * 0.27, w * 0.07, METAL);
  circulo(ctx, w * 0.93, h * 0.27, w * 0.07, METAL);

  piloto(ctx, w, h, cor, { capaceteY: h * 0.5, troncoY: h * 0.6, guidaoY: h * 0.3, aberturaGuidao: 0.88 });
}

/** Cabrita: moto de trilha fininha, com pneus de cravo e guidao largo. */
export function desenharCabrita(ctx, w, h, cor) {
  roda(ctx, w * 0.38, 0, w * 0.24, h * 0.26, true);
  roda(ctx, w * 0.36, h * 0.72, w * 0.28, h * 0.28, true);

  retangulo(ctx, w * 0.36, h * 0.03, w * 0.28, h * 0.2, w * 0.14);
  preencher(ctx, ajustarCor(cor, 0.2), true);
  elipse(ctx, w * 0.5, h * 0.255, w * 0.24, h * 0.045, '#f5f5f5');

  retangulo(ctx, w * 0.31, h * 0.32, w * 0.38, h * 0.36, w * 0.15);
  preencher(ctx, lataria(ctx, w, cor), true);
  retangulo(ctx, w * 0.39, h * 0.5, w * 0.22, h * 0.32, 5);
  preencher(ctx, '#2a2d34');
  retangulo(ctx, w * 0.41, h * 0.8, w * 0.18, h * 0.16, 5);
  preencher(ctx, ajustarCor(cor, 0.2), true);

  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.07;
  ctx.strokeStyle = METAL;
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.3);
  ctx.lineTo(w * 0.97, h * 0.3);
  ctx.stroke();

  piloto(ctx, w, h, cor, { capaceteY: h * 0.43, troncoY: h * 0.56, guidaoY: h * 0.3, aberturaGuidao: 0.94, viseira: false });
  // pala do capacete e oculos
  retangulo(ctx, w * 0.3, h * 0.31, w * 0.4, h * 0.06, 4);
  preencher(ctx, ajustarCor(cor, -0.35));
  retangulo(ctx, w * 0.32, h * 0.37, w * 0.36, h * 0.035, 3);
  preencher(ctx, '#ffb020');
}
