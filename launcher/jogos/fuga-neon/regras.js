// NÚMEROS DO JOGO "Fuga Neon". Mude aqui para deixar a rodada mais curta,
// a polícia mais rápida, as ações mais fortes etc. Depois clique em PARAR e JOGAR.
//
// Como funciona a rodada:
//   PREPARAÇÃO -> quem comenta LADRÃO ou POLÍCIA entra numa equipe
//   ASSALTO    -> ladrões enchem o cofre, polícia enche o alarme (define a vantagem inicial)
//   FUGA       -> a polícia vai encostando sozinha; cada interação empurra a distância
//   RESULTADO  -> distância chegou a 0 = PRESOS (polícia vence); tempo acabou = FUGIRAM (ladrões vencem)

export const REGRAS = {
  // ---------------------------------------------------------------- tempos (segundos)
  preparacaoS: 25,        // tempo para entrar antes do assalto
  assaltoS: 20,           // cofre x alarme
  fugaS: 150,             // perseguição (a rodada inteira fica perto de 3 min e meio)
  resultadoS: 12,         // tela do resultado
  retaFinalS: 30,         // nos últimos 30 s da fuga as ações valem mais
  multiplicadorRetaFinal: 1.5,

  // ---------------------------------------------------------------- distância (metros)
  vantagemInicialM: 55,   // vantagem dos ladrões quando cofre e alarme empatam
  vantagemAssaltoM: 35,   // quanto o resultado do assalto pode somar ou tirar
  vantagemMinimaInicialM: 20,
  vantagemMaximaM: 150,   // acima disso a tela não mostra mais distância
  vantagemEsconderijoM: 140, // depois dos 60 s, chegar a essa vantagem = ladrões chegam ao esconderijo e vencem
  capturaLiberadaS: 60,   // nos primeiros 60 s da fuga ninguém é preso (a rodada sempre tem perseguição)
  vantagemMinimaAntesDaCapturaM: 3,

  // A polícia encosta sozinha X metros por segundo (sorteado entre min e máx a cada rodada).
  // Com 0,40 m/s e 55 m, sem ninguém interagindo os ladrões são presos em uns 2 min 20 s.
  avancoPoliciaMin: 0.32,
  avancoPoliciaMax: 0.46,
  porEstrela: 0.07,       // cada estrela de PROCURADO deixa a polícia mais rápida
  maxEstrelas: 5,
  // Chance de virada: quem está muito atrás recebe uma ajudinha.
  longeM: 95,             // acima disso a polícia acelera um pouco
  ajudaPoliciaLonge: 0.3,
  pertoM: 12,             // abaixo disso os ladrões ganham "adrenalina"
  ajudaLadroesPerto: 0.18,
  // Resistência: perto da prisão, as ações da polícia rendem menos; perto da fuga livre,
  // as dos ladrões rendem menos (nunca menos que resistenciaMinima).
  resistenciaPertoM: 35,
  resistenciaLongeM: 60,
  resistenciaMinima: 0.3,

  // ---------------------------------------------------------------- ações grátis
  comentarioM: 0.6,       // cada comentário de quem está numa equipe
  intervaloComentarioS: 2,// a mesma pessoa só empurra de novo depois disso
  curtidaM: 0.06,         // por curtida
  curtidaMaximaM: 1.5,    // por pacote de curtidas
  seguiuM: 4,
  compartilhouM: 6,

  // ---------------------------------------------------------------- equipes
  maxPorEquipe: 500,
  // Quem manda presente sem ter escolhido lado entra na equipe com menos gente.
  entrarAoPresentear: true,

  // ---------------------------------------------------------------- surpresas
  rodadasEntreSurpresas: 3, // a cada 3 rodadas acontece um evento surpresa na fuga
  surpresaDuracaoS: 18,

  // ---------------------------------------------------------------- pontos (ranking)
  pontosComentario: 1,
  pontosCurtida: 0.1,
  pontosSeguiu: 5,
  pontosCompartilhou: 8,
  pontosPorMoeda: 10
};

// Bairros: a cidade muda a cada rodada para a tela não ficar igual por horas.
export const BAIRROS = [
  { id: 'orla', nome: 'ORLA NEON', ceu: '#1a0b2e', asfalto: '#26203a', calcada: '#3a2f52', neon: ['#ff3fa4', '#29e7ff', '#ffd23f'], palmeiras: true },
  { id: 'centro', nome: 'CENTRO', ceu: '#0b1630', asfalto: '#1d2438', calcada: '#2f3a57', neon: ['#3dfcff', '#9b5cff', '#ff5d73'], palmeiras: false },
  { id: 'porto', nome: 'PORTO VELHO', ceu: '#08201f', asfalto: '#1c2a2a', calcada: '#2c4040', neon: ['#3dffa8', '#ffb53d', '#ff3d6e'], palmeiras: false },
  { id: 'palmeiras', nome: 'AV. DAS PALMEIRAS', ceu: '#2a0b1c', asfalto: '#2b1f2a', calcada: '#463047', neon: ['#ff8a3d', '#ff3fd2', '#5cf2ff'], palmeiras: true }
];
