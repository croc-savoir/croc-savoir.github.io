// Résumé compact du contenu existant d'un thème, à donner aux agents à la place
// des gros fichiers JSON (une ligne par fiche, une ligne par question).
//   node tools/existant.js <domaine>   → tools/propositions/existant-<domaine>.md
const fs = require('fs');
const path = require('path');
const { chargerTout } = require('./lib');

const dom = process.argv[2];
if (!dom) { console.log('Usage : node tools/existant.js <domaine>'); process.exit(1); }
const { fiches, quiz } = chargerTout()[dom];

const enonce = q => {
  if (q.format === 'qui-suis-je') return `Qui suis-je → ${q.reponse}`;
  if (q.format === 'associer') return `${q.question} (${q.paires.map(p => p.gauche).join(', ')})`;
  if (q.format === 'frise') return `${q.question} (${q.evenements.map(e => e.annee).join(', ')})`;
  return q.question || q.affirmation;
};

const lignes = [`# Contenu existant du thème « ${dom} » : ${fiches.length} fiches, ${quiz.length} questions`, '',
  '## Fiches (sous-thème | type | titre)'];
for (const f of fiches) lignes.push(`- ${f.subtheme} | ${f.type} | ${f.title}`);
lignes.push('', '## Questions (format | énoncé)');
for (const q of quiz) lignes.push(`- ${q.format} | ${enonce(q)}`);

const sortie = path.join(__dirname, 'propositions', `existant-${dom}.md`);
fs.writeFileSync(sortie, lignes.join('\n') + '\n');
console.log(`→ ${path.relative(process.cwd(), sortie)} (${fs.statSync(sortie).size} octets, au lieu de ` +
  `${fs.statSync(path.join(__dirname, '..', 'data', 'fiches', dom + '.json')).size + fs.statSync(path.join(__dirname, '..', 'data', 'quiz', dom + '.json')).size} pour les JSON)`);
