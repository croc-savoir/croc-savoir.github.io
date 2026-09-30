// Liste les questions d'un thème à l'explication courte ou à la source « À vérifier ».
//   node tools/a-enrichir.js <domaine> [longueurMin=120]
const path = require('path');
const { DATA, lireJSON } = require('./lib');
const [dom, minArg] = process.argv.slice(2);
const MIN = +(minArg || 120);
const quiz = lireJSON(path.join(DATA, 'quiz', dom + '.json'));
for (const q of quiz) {
  const court = (q.explication || '').length < MIN;
  const aVerifier = /vérifier/i.test(q.source || '');
  if (!court && !aVerifier) continue;
  let enonce = q.question || q.affirmation || '';
  let rep = '';
  if (q.format === 'qcm' || q.format === 'difference') rep = q.choix[q.bonneReponse];
  if (q.format === 'vrai-faux') rep = q.reponse ? 'VRAI' : 'FAUX';
  if (q.format === 'qui-suis-je') { rep = q.reponse; enonce = 'Qui suis-je ? ' + q.indices.join(' / '); }
  if (q.format === 'frise') rep = q.evenements.map(e => e.annee + ' ' + e.label).join(' ; ');
  if (q.format === 'associer') rep = q.paires.map(p => p.gauche + '=' + p.droite).join(' ; ');
  console.log(`${q.id} [${q.format}]${aVerifier ? ' [À VÉRIFIER]' : ''}${court ? '' : ' [explication OK]'}\n  Q: ${enonce}\n  R: ${rep}\n  E: ${q.explication || ''}`);
}
