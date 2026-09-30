// Fonctions communes aux outils de contenu (Node 18+, sans dépendance).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// Règle absolue du contenu : aucune araignée ni arachnide (voir CONTENU.md).
const INTERDIT = /araign|arachn|scorpion|(?<!\p{L})tiques?(?!\p{L})|acarien|tarentule|mygale|opilion/iu;

const TYPES_FICHE = ['personnage', 'date', 'animal-rare', 'vocabulaire', 'classique'];
const FORMATS_QUIZ = ['qcm', 'difference', 'vrai-faux', 'associer', 'frise', 'qui-suis-je'];

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function lireJSON(fichier) { return JSON.parse(fs.readFileSync(fichier, 'utf8')); }
function ecrireJSON(fichier, data) { fs.writeFileSync(fichier, JSON.stringify(data, null, 2) + '\n'); }

function domaines() { return lireJSON(path.join(DATA, 'domains.json')); }

// { domaineId: { fiches: [...], quiz: [...] } }
function chargerTout() {
  const out = {};
  for (const d of domaines()) {
    const f = path.join(DATA, 'fiches', d.id + '.json');
    const q = path.join(DATA, 'quiz', d.id + '.json');
    out[d.id] = {
      fiches: fs.existsSync(f) ? lireJSON(f) : [],
      quiz: fs.existsSync(q) ? lireJSON(q) : [],
    };
  }
  return out;
}

// Titre d'article Wikipédia cité par une fiche ou une question (champ dédié ou source « D'après Wikipédia — X »).
function titreWikipedia(obj) {
  if (obj.details && obj.details.wikipedia) return obj.details.wikipedia;
  if (obj.wikipedia) return obj.wikipedia;
  const m = /^D'après Wikipédia — (.+)$/.exec(obj.source || '');
  return m ? m[1] : null;
}

module.exports = { ROOT, DATA, INTERDIT, TYPES_FICHE, FORMATS_QUIZ, norm, lireJSON, ecrireJSON, domaines, chargerTout, titreWikipedia };
