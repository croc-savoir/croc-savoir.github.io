// Prépare le dossier source d'un ou plusieurs sujets : article Wikipédia complet (fr),
// article anglais, faits Wikidata. Les agents rédigent les fiches À PARTIR de ces dossiers.
//   node tools/dossier.js "Magi (manga)" "Shinobu Ohtaka" …
//   node tools/dossier.js --liste fichier.txt          (un titre par ligne)
// Écrit tools/dossiers/<titre>.md (lisible) et .json (utilisé par tools/controle.js).
const fs = require('fs');
const path = require('path');
const S = require('./sources');

const DOSSIERS = path.join(__dirname, 'dossiers');
const MAX_FR = 14000; // caractères gardés par article : assez pour une fiche, pas trop pour l'agent
const MAX_EN = 9000;

// Proposition d'« Œuvres principales » (Wikidata), à trier par l'agent.
async function blocOeuvres(qid) {
  if (!qid) return '';
  try {
    const o = await require('./oeuvres').oeuvresDe(qid, 12);
    if (o.length < 3) return '';
    const lignes = o.map(x => `- ${x.titre}${x.annee ? ` (${x.annee})` : ''}`).join('\n');
    return `## Œuvres (proposition Wikidata, à trier)\n${lignes}\n\n`;
  } catch (e) { return ''; }
}

const nomFichier = t => t.normalize('NFC').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);

// Titre préfixé par « en: » : sujet sans article français, on part de l'article anglais.
async function dossier(titre) {
  if (titre.startsWith('en:')) return dossierAnglais(titre.slice(3));
  const fr = await S.article(titre, 'fr');
  if (fr.introuvable) return { titre, introuvable: true };
  if (fr.homonymie) return { titre: fr.titre, homonymie: true };
  const en = fr.en ? await S.article(fr.en, 'en') : null;
  const wd = await S.wikidata(fr.qid);
  const d = {
    titre: fr.titre,
    url: 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(fr.titre.replace(/ /g, '_')),
    wikidata: wd,
    fr: fr.texte.slice(0, MAX_FR),
    en: en && !en.introuvable ? en.texte.slice(0, MAX_EN) : '',
    enTitre: en && !en.introuvable ? en.titre : null,
  };
  fs.mkdirSync(DOSSIERS, { recursive: true });
  const base = path.join(DOSSIERS, nomFichier(d.titre));
  fs.writeFileSync(base + '.json', JSON.stringify(d));
  const faits = wd ? Object.entries(wd.faits).map(([k, v]) => `- ${k} : ${v.join(', ')}`).join('\n') : '(aucun)';
  fs.writeFileSync(base + '.md',
    `# ${d.titre}\n\nTitre Wikipédia exact à citer : « ${d.titre} »\n\n` +
    `## Faits Wikidata\n${wd ? wd.description + '\n' : ''}${faits}\n\n` +
    await blocOeuvres(fr.qid) +
    `## Article Wikipédia (français)\n\n${d.fr}\n\n` +
    (d.en ? `## Article Wikipédia (anglais) — « ${d.enTitre} »\n\n${d.en}\n` : '## Article anglais : aucun\n'));
  return { titre: d.titre, fr: d.fr.length, en: d.en.length, faits: wd ? Object.keys(wd.faits).length : 0, fichier: base + '.md' };
}

async function dossierAnglais(titreEn) {
  const en = await S.article(titreEn, 'en');
  if (en.introuvable) return { titre: 'en:' + titreEn, introuvable: true };
  if (en.fr) return dossier(en.fr); // il existe finalement un article français
  const wd = await S.wikidata(en.qid);
  const d = {
    titre: en.titre, anglais: true,
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(en.titre.replace(/ /g, '_')),
    wikidata: wd, fr: '', en: en.texte.slice(0, MAX_FR), enTitre: en.titre,
  };
  fs.mkdirSync(DOSSIERS, { recursive: true });
  const base = path.join(DOSSIERS, nomFichier(d.titre));
  fs.writeFileSync(base + '.json', JSON.stringify(d));
  const faits = wd ? Object.entries(wd.faits).map(([k, v]) => `- ${k} : ${v.join(', ')}`).join('\n') : '(aucun)';
  fs.writeFileSync(base + '.md',
    `# ${d.titre}\n\n⚠️ Pas d'article en français : la fiche cite « ${d.titre} » dans le champ wikipediaEn (pas wikipedia).\n\n` +
    `## Faits Wikidata\n${wd ? wd.description + '\n' : ''}${faits}\n\n` +
    await blocOeuvres(en.qid) + `## Article Wikipédia (anglais)\n\n${d.en}\n`);
  return { titre: d.titre, fr: 0, en: d.en.length, faits: wd ? Object.keys(wd.faits).length : 0, fichier: base + '.md' };
}

async function main() {
  let titres = process.argv.slice(2);
  if (titres[0] === '--liste') titres = fs.readFileSync(titres[1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!titres.length) { console.log('Usage : node tools/dossier.js "Titre" … | --liste fichier.txt'); return; }
  for (const t of titres) {
    const r = await dossier(t);
    if (r.introuvable) console.log(`❌ ${t} : article introuvable`);
    else if (r.homonymie) console.log(`⚠️ ${t} : page d'homonymie, précise le titre`);
    else console.log(`✅ ${r.titre} : ${r.fr} car. fr, ${r.en} car. en, ${r.faits} faits → ${path.relative(process.cwd(), r.fichier)}`);
  }
}

module.exports = { dossier, DOSSIERS, nomFichier };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
