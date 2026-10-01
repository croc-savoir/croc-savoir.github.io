// Contrôle automatique d'un lot rédigé à partir des dossiers (tools/dossier.js) :
//  1. chaque nombre (année, date, chiffre) d'une fiche ou d'une explication doit figurer
//     dans le dossier source (article fr/en ou faits Wikidata) ;
//  2. aucune phrase ne doit recopier l'article (8 mots consécutifs identiques ou plus).
//   node tools/controle.js tools/propositions/lot.json
// Ne bloque rien : liste ce qu'il faut relire. Code de sortie 1 s'il y a des alertes.
const fs = require('fs');
const path = require('path');
const { DOSSIERS, nomFichier } = require('./dossier');

const lot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const cacheDossiers = {};
function lireDossier(titre) {
  if (!titre) return null;
  if (!(titre in cacheDossiers)) {
    const p = path.join(DOSSIERS, nomFichier(titre) + '.json');
    cacheDossiers[titre] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  }
  return cacheDossiers[titre];
}

// Texte comparable : minuscules, sans accents, espaces des milliers retirés.
const plat = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d)[\s  .,](?=\d{3}\b)/g, '$1');

function sourceDe(d) {
  const faits = d.wikidata ? JSON.stringify(d.wikidata.faits) + ' ' + (d.wikidata.description || '') : '';
  return plat([d.fr, d.en, faits].join(' '));
}

// Nombres à vérifier : années (1000-2099) et nombres d'au moins 2 chiffres.
// Les petits nombres (1 à 9) et les ordinaux courants sont ignorés.
function nombres(texte) {
  const t = plat(texte);
  const out = new Set();
  for (const m of t.matchAll(/\d+(?:,\d+)?/g)) {
    const n = m[0];
    if (n.length < 2) continue;
    // « les années 1960 », « des années 2010 » : une décennie, pas une date précise
    if (/annees\s*$/.test(t.slice(Math.max(0, m.index - 10), m.index))) continue;
    out.add(n);
  }
  return [...out];
}

function presents(n, src) {
  if (new RegExp('(^|[^\\d])' + n.replace(',', '[,.]') + '([^\\d]|$)').test(src)) return true;
  // « 1,5 million » peut apparaître comme 1500000 dans la source
  const m = /^(\d+),(\d)$/.exec(n);
  if (m && src.includes(m[1] + m[2] + '00000')) return true;
  return false;
}

// Plus longue suite de mots identiques entre une phrase et la source.
function recopie(phrase, srcMots) {
  const mots = plat(phrase).split(/[^a-z0-9]+/).filter(Boolean);
  let meilleur = '';
  for (let i = 0; i + 8 <= mots.length; i++) {
    const morceau = mots.slice(i, i + 8).join(' ');
    if (srcMots.includes(' ' + morceau + ' ')) {
      let j = i + 8;
      while (j < mots.length && srcMots.includes(' ' + mots.slice(i, j + 1).join(' ') + ' ')) j++;
      const trouve = mots.slice(i, j);
      // Une liste de titres et d'années n'est pas une phrase recopiée
      const chiffres = trouve.filter(w => /^\d+$/.test(w)).length;
      if (chiffres / trouve.length >= 0.3) continue;
      if (trouve.join(' ').length > meilleur.length) meilleur = trouve.join(' ');
    }
  }
  return meilleur;
}

const texteFiche = f => {
  const d = f.details || {};
  const parts = [f.subtitle, f.summary, d.epoque, d.pourquoiCelebre, d.contexte, d.causes, d.deroulement,
    d.consequences, d.definition, d.exemple, ...(d.ideesClefs || []), ...(d.anecdotes || []),
    ...(d.sections || []).map(s => s.texte), ...(d.frise || []).map(e => e.annee + ' ' + e.evenement),
    ...(d.liens || []).map(l => l.relation), ...(d.confusions || []).map(c => c.explication)];
  return parts.filter(Boolean).join('\n');
};
const texteQuestion = q => [q.question, q.affirmation, ...(q.indices || []), q.explication,
  ...(q.paires || []).map(p => `${p.gauche} ${p.droite} ${p.explication || ''}`),
  ...(q.evenements || []).map(e => e.annee + ' ' + e.label)].filter(Boolean).join('\n');

let alertes = 0;
function controler(nom, texte, titreSource) {
  const d = lireDossier(titreSource);
  if (!d) { console.log(`⚪ ${nom} : pas de dossier pour « ${titreSource} » (contrôle impossible)`); return; }
  const src = sourceDe(d);
  const srcMots = ' ' + src.split(/[^a-z0-9]+/).filter(Boolean).join(' ') + ' ';
  const absents = nombres(texte).filter(n => !presents(n, src));
  const copies = texte.split(/(?<=[.!?])\s+|\n/).map(p => recopie(p, srcMots)).filter(Boolean);
  if (!absents.length && !copies.length) { console.log(`✅ ${nom}`); return; }
  alertes++;
  console.log(`⚠️ ${nom}`);
  if (absents.length) console.log(`   nombres absents de la source : ${absents.join(', ')}`);
  for (const c of copies) console.log(`   recopié : « ${c} »`);
}

for (const f of lot.fiches || []) {
  const t = f.details?.wikipedia || f.details?.wikipediaEn;
  controler(`Fiche « ${f.title} »`, texteFiche(f), t);
}
for (const [titre, extra] of Object.entries(lot.enrich || {})) {
  controler(`Ajout à « ${titre} »`, texteFiche({ details: extra }), extra.wikipedia);
}
for (const q of lot.quiz || []) {
  controler(`Question « ${(q.question || q.affirmation || q.reponse || '').slice(0, 60)} »`, texteQuestion(q), q.wikipedia || q.wikipediaEn);
}
console.log(`\n${alertes ? `⚠️ ${alertes} élément(s) à relire` : '✅ Tout est conforme aux sources.'}`);
process.exit(alertes ? 1 : 0);
