// Propose des questions « frise » à partir des frises chronologiques des fiches « date ».
//   node tools/quiz-auto.js <domaine>
// Écrit les propositions dans tools/propositions/<domaine>-frises.json, au format d'un lot
// pour tools/fusion.js. À RELIRE avant fusion : libellés, explication, pertinence.
const fs = require('fs');
const path = require('path');
const { DATA, lireJSON, ecrireJSON, norm, titreWikipedia } = require('./lib');

const dom = process.argv[2];
if (!dom) { console.log('Usage : node tools/quiz-auto.js <domaine>'); process.exit(1); }

const fiches = lireJSON(path.join(DATA, 'fiches', dom + '.json'));
const quiz = lireJSON(path.join(DATA, 'quiz', dom + '.json'));

// Événements déjà utilisés dans des frises existantes : on évite les doublons.
const dejaVus = new Set(quiz.filter(q => q.format === 'frise').flatMap(q => q.evenements.map(e => norm(e.label))));

const propositions = [];
for (const f of fiches) {
  const frise = f.details?.frise;
  if (f.type !== 'date' || !Array.isArray(frise)) continue;
  // Années lisibles et toutes différentes (la frise se joue sur l'ordre).
  const ev = [];
  const annees = new Set();
  for (const e of frise) {
    const a = parseFloat(e.annee);
    if (isNaN(a) || annees.has(a) || !/^-?\d+$/.test(String(e.annee).trim())) continue;
    annees.add(a);
    ev.push({ label: e.evenement, annee: String(e.annee).trim() });
  }
  if (ev.length < 4) continue;
  const choisis = ev.slice(0, 6);
  if (choisis.every(e => dejaVus.has(norm(e.label)))) continue;
  propositions.push({
    format: 'frise',
    question: `Remets dans l'ordre ces étapes liées à : ${f.title.replace(/^[-\d\s]+:\s*/, '')}.`,
    evenements: choisis,
    explication: choisis.map(e => `${e.annee.startsWith('-') ? e.annee.slice(1) + ' av. J.-C.' : e.annee} : ${e.label}.`).join(' '),
    wikipedia: titreWikipedia(f) || undefined,
    _depuis: f.id,
  });
}

const dir = path.join(__dirname, 'propositions');
fs.mkdirSync(dir, { recursive: true });
const sortie = path.join(dir, `${dom}-frises.json`);
ecrireJSON(sortie, { quiz: propositions });
console.log(`${propositions.length} frise(s) proposée(s) → ${path.relative(process.cwd(), sortie)}`);
console.log('Relis-les, retire le champ « _depuis », puis : node tools/fusion.js ' + dom + ' ' + path.relative(process.cwd(), sortie));
