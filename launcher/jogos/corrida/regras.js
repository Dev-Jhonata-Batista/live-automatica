// Numeros da corrida. Para ajustar o jogo, mude aqui e clique em PARAR e JOGAR
// no launcher para recarregar.
//
// Dica para testar rapido: troque distanciaM para 1500 (corrida de ~1 minuto)
// e esperaS para 10. Lembre de voltar os valores antes de usar na live.

export const REGRAS = Object.freeze({
  // ---------------------------------------------------------------- pista
  distanciaM: 6000, // da largada ate a chegada, em metros
  faixas: 6, // quantas faixas a pista tem

  // ---------------------------------------------------------------- velocidade
  // 22 m/s = 79 km/h. Com 6.000 m, a corrida dura uns 4 min e 30 s.
  velocidadeBase: 22,
  // Cada corredor acelera e alivia sozinho, ate 5% acima ou abaixo da base,
  // e o ritmo muda de tempos em tempos (sorteado entre 3 e 7 segundos).
  variacaoRitmo: 0.05,
  trocaRitmoS: [3, 7],
  // Vacuo: quem esta atras do primeiro ganha velocidade extra (0,15% por metro
  // de distancia, ate 10%). Mantem o pelotao junto e visivel na tela; na Fase 4
  // os presentes (nitro, oleo...) e que vao decidir quem ganha.
  vacuoPorM: 0.0015,
  vacuoMax: 0.1,

  // ---------------------------------------------------------------- tempos (segundos)
  esperaS: 40, // tempo para entrar antes da largada (conta a partir do 1o corredor)
  esperaLotadaS: 8, // se a largada encher, a contagem cai para isso
  largadaS: 3, // contagem 3, 2, 1
  chegadaMaxS: 25, // depois que o 1o chega, espera os outros no maximo isso
  resultadoS: 12, // tempo da tela do vencedor antes da proxima corrida

  // ---------------------------------------------------------------- entrada
  maxCorredores: 30, // vagas por corrida
  maxFila: 60, // quem comenta com a corrida cheia entra na fila da proxima
  entrarComCorridaAndando: true, // da para entrar no meio da corrida (larga atras do ultimo)
  atrasoEntradaM: 12, // quantos metros atras do ultimo entra quem chega no meio
  fechaEntradaFaltandoM: 800, // perto do fim, quem comenta vai para a proxima corrida

  // ---------------------------------------------------------------- grid de largada
  espacoGridM: 6.5, // distancia entre as fileiras do grid (no minimo 6.5: o maior veiculo tem ate 6 m)
  recuoGridM: 1 // a 1a fileira fica 1 m antes da linha de largada
});
