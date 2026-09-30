// Génère des questions (qcm) sans IA à partir des faits Wikidata d'un ensemble de sujets.
// Les mauvaises réponses sont prises parmi les autres sujets du même ensemble : plus
// l'ensemble est homogène (mangas d'un même magazine, studios…), plus les leurres sont crédibles.
//   node tools/quiz-wikidata.js <sortie.json> "Titre 1" "Titre 2" …   (au moins 5 sujets)
//   node tools/quiz-wikidata.js <sortie.json> --liste fichier.txt
// Les dossiers manquants sont construits (tools/dossier.js). Les questions sont à relire
// (champ _auto) avant fusion ; leur explication est construite à partir des faits.
const fs = require('fs');
const path = require('path');
const { dossier, DOSSIERS, nomFichier } = require('./dossier');

const melanger = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const annee = v => { const m = /(-?\d{3,4})$/.exec(v || ''); return m ? m[1] : null; };
const premier = (f, ...cles) => { for (const c of cles) if (f[c]?.length) return f[c][0]; return null; };

// Modèles de questions : clé de fait, formulation, ce qu'on retient pour l'explication.
const MODELES = [
  { cle: ['auteur', 'créateur'], q: s => `Qui est l'auteur de ${s} ?` },
  { cle: ['publié dans'], q: s => `Dans quel magazine ${s} a-t-il d'abord été publié ?` },
  { cle: ['réalisateur'], q: s => `Qui a réalisé ${s} ?` },
  { cle: ['société de production', 'développeur'], q: s => `Quel studio est à l'origine de ${s} ?` },
  { cle: ['fondateur'], q: s => `Qui a fondé ${s} ?` },
  { cle: ['œuvre notable'], q: s => `Quelle œuvre doit-on à ${s} ?` },
];
const MODELES_ANNEE = [
  { cle: ['date de début', 'date de publication'], q: s => `En quelle année commence ${s} ?` },
  { cle: ['date de fondation'], q: s => `En quelle année ${s} a-t-il été fondé ?` },
  { cle: ['date de naissance'], q: s => `En quelle année est né(e) ${s} ?` },
];

// Explication construite uniquement à partir des faits (pas de texte recopié).
function explication(nom, f, desc) {
  const bouts = [];
  if (desc) bouts.push(`${nom} : ${desc}.`);
  const qui = premier(f, 'auteur', 'créateur', 'réalisateur');
  const ou = premier(f, 'publié dans');
  const deb = annee(premier(f, 'date de début', 'date de publication', 'date de fondation'));
  const fin = annee(premier(f, 'date de fin'));
  if (qui && !(desc || '').includes(qui)) bouts.push(`Œuvre de ${qui}.`);
  if (ou) bouts.push(`Publié dans le ${ou}${deb ? (fin ? ` de ${deb} à ${fin}` : ` à partir de ${deb}`) : ''}.`);
  else if (deb && !(desc || '').includes(deb)) bouts.push(`Date de départ : ${deb}.`);
  if (f['nombre de volumes']) bouts.push(`La série compte ${f['nombre de volumes'][0]} volumes.`);
  if (f['nombre d\'épisodes']) bouts.push(`${f['nombre d\'épisodes'][0]} épisodes.`);
  if (f['genre']) bouts.push(`Genre : ${f['genre'].slice(0, 2).join(', ')}.`);
  if (f['œuvre dérivée']) bouts.push(`Adaptations : ${f['œuvre dérivée'].slice(0, 2).join(', ')}.`);
  return bouts.join(' ');
}

async function main() {
  let [sortie, ...titres] = process.argv.slice(2);
  if (titres[0] === '--liste') titres = fs.readFileSync(titres[1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!sortie || titres.length < 5) { console.log('Usage : node tools/quiz-wikidata.js <sortie.json> "Titre" … (au moins 5 sujets)'); return; }

  const sujets = [];
  for (const t of titres) {
    let p = path.join(DOSSIERS, nomFichier(t) + '.json');
    if (!fs.existsSync(p)) { const r = await dossier(t); if (r.introuvable || r.homonymie) continue; p = path.join(DOSSIERS, nomFichier(r.titre) + '.json'); }
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (d.wikidata) sujets.push(d);
  }

  const quiz = [];
  for (const d of sujets) {
    const f = d.wikidata.faits;
    const nom = d.wikidata.libelle;
    const autres = sujets.filter(x => x !== d).map(x => x.wikidata.faits);
    const expl = explication(nom, f, d.wikidata.description);
    if (expl.length < 120) continue; // trop peu de faits pour une explication utile
    const cite = d.anglais ? { wikipediaEn: d.titre } : { wikipedia: d.titre };

    for (const m of MODELES) {
      const cle = m.cle.find(c => f[c]?.length);
      if (!cle) continue;
      const bonnes = new Set(f[cle]);
      const leurres = melanger([...new Set(autres.flatMap(a => a[cle] || []))].filter(v => !bonnes.has(v))).slice(0, 3);
      if (leurres.length < 3) continue;
      quiz.push({ format: 'qcm', question: m.q(nom), choix: [f[cle][0], ...leurres], bonneReponse: 0, explication: expl, ...cite, _auto: cle });
      break; // une question « qui / quoi » par sujet suffit
    }
    for (const m of MODELES_ANNEE) {
      const cle = m.cle.find(c => f[c]?.length);
      const a = cle && annee(f[cle][0]);
      if (!a) continue;
      const n = +a;
      const leurres = melanger([n - 7, n - 4, n - 2, n + 2, n + 3, n + 6].filter(x => x !== n && x <= new Date().getFullYear())).slice(0, 3);
      quiz.push({ format: 'qcm', question: m.q(nom), choix: [a, ...leurres.map(String)], bonneReponse: 0, explication: expl, ...cite, _auto: cle });
      break;
    }
  }
  fs.writeFileSync(sortie, JSON.stringify({ quiz }, null, 1));
  console.log(`${sujets.length} sujets avec Wikidata → ${quiz.length} questions dans ${sortie}`);
  for (const q of quiz) console.log(`- ${q.question}  → ${q.choix[0]}   [leurres : ${q.choix.slice(1).join(' / ')}]\n    ${q.explication}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
