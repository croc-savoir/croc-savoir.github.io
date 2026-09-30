// Génère les fichiers lus par l'appli à partir des sources data/fiches et data/quiz :
//   data/app/index.json          → thèmes + fiches SANS détails + questions (chargé au démarrage)
//   data/app/details/<dom>.json  → { idFiche: details } (chargé à la demande, « Approfondir »)
//   node tools/construire.js            → écrit les fichiers
//   node tools/construire.js --verifier → code 1 si les fichiers ne sont pas à jour
// fusion.js le lance automatiquement après chaque lot.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, domaines, chargerTout } = require('./lib');

const APP = path.join(DATA, 'app');
const DETAILS = path.join(APP, 'details');

const empreinte = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

function generer() {
  const doms = domaines();
  const tout = chargerTout();
  const fichiers = {}; // chemin -> contenu
  const hashes = {};
  const fiches = [];
  const quiz = [];

  for (const d of doms) {
    const det = {};
    for (const f of tout[d.id].fiches) {
      const { details, ...leger } = f;
      if (details && Object.keys(details).length) {
        det[f.id] = details;
        leger.hasDetails = true;
      }
      fiches.push(leger);
    }
    quiz.push(...tout[d.id].quiz);
    if (Object.keys(det).length) {
      const contenu = JSON.stringify(det);
      hashes[d.id] = empreinte(contenu);
      fichiers[path.join(DETAILS, d.id + '.json')] = contenu;
    }
  }

  const corps = { domains: doms, fiches, quiz, details: hashes };
  corps.version = empreinte(JSON.stringify(corps));
  fichiers[path.join(APP, 'index.json')] = JSON.stringify(corps);
  return fichiers;
}

function aJour(fichiers) {
  const obsoletes = [];
  for (const [p, c] of Object.entries(fichiers)) {
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c) obsoletes.push(path.relative(DATA, p));
  }
  if (fs.existsSync(DETAILS)) {
    for (const n of fs.readdirSync(DETAILS)) {
      if (!fichiers[path.join(DETAILS, n)]) obsoletes.push('app/details/' + n + ' (en trop)');
    }
  }
  return obsoletes;
}

function construire() {
  const fichiers = generer();
  fs.mkdirSync(DETAILS, { recursive: true });
  for (const n of fs.readdirSync(DETAILS)) {
    if (!fichiers[path.join(DETAILS, n)]) fs.unlinkSync(path.join(DETAILS, n));
  }
  for (const [p, c] of Object.entries(fichiers)) fs.writeFileSync(p, c);
  const idx = fichiers[path.join(APP, 'index.json')];
  const det = Object.entries(fichiers).filter(([p]) => p.startsWith(DETAILS)).reduce((s, [, c]) => s + c.length, 0);
  return `index ${Math.round(idx.length / 1024)} Ko, détails ${Math.round(det / 1024)} Ko`;
}

module.exports = { construire, verifierAJour: () => aJour(generer()) };

if (require.main === module) {
  if (process.argv.includes('--verifier')) {
    const obs = aJour(generer());
    if (obs.length) { console.log('❌ Fichiers de l’appli pas à jour : ' + obs.join(', ') + '\n   → node tools/construire.js'); process.exit(1); }
    console.log('✅ Fichiers de l’appli à jour.');
  } else {
    console.log('✅ Construit : ' + construire());
  }
}
