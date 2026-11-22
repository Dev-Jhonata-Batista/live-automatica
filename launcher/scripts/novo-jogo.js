// Cria um jogo novo a partir do modelo (pasta modelo-jogo).
//
// Uso (PowerShell, dentro da pasta launcher):
//   npm run novo-jogo -- quiz "Quiz da Live"
//
// Resultado: pasta jogos/quiz/ pronta para editar. Abra o launcher e o jogo
// ja aparece na lista.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = path.join(RAIZ, 'modelo-jogo');
// Mesma regra de src/main/jogos.js: comeca com letra; depois letras minusculas, numeros e hifen.
const ID_VALIDO = /^[a-z][a-z0-9-]{0,39}$/;

const [id, ...partesDoNome] = process.argv.slice(2);
const nome = partesDoNome.join(' ').trim();

if (!id || !ID_VALIDO.test(id)) {
  console.log('Uso:  npm run novo-jogo -- id-do-jogo "Nome do Jogo"');
  console.log('O id comeca com uma letra e usa so letras minusculas, numeros e hifen. Exemplo: quiz-da-live');
  process.exit(1);
}

const destino = path.join(RAIZ, 'jogos', id);
if (fs.existsSync(destino)) {
  console.log(`Ja existe um jogo em jogos/${id}. Escolha outro id.`);
  process.exit(1);
}

fs.cpSync(MODELO, destino, { recursive: true });

const arquivoManifesto = path.join(destino, 'jogo.json');
const manifesto = JSON.parse(fs.readFileSync(arquivoManifesto, 'utf8'));
manifesto.id = id;
manifesto.nome = (nome || id).slice(0, 40);
fs.writeFileSync(arquivoManifesto, `${JSON.stringify(manifesto, null, 2)}\n`, 'utf8');

console.log(`Jogo criado em jogos/${id}/`);
console.log('Proximos passos:');
console.log(`  1. Edite jogos/${id}/jogo.js (a logica) e jogos/${id}/jogo.css (o visual).`);
console.log('  2. Rode "npm start", escolha o jogo na lista e clique em JOGAR.');
