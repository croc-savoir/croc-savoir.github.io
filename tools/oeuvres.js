// Œuvres principales d'un créateur (personne, studio, groupe…) d'après Wikidata :
// ses « œuvres notables » (P800), puis les œuvres qui le citent comme auteur, créateur,
// réalisateur, compositeur, studio, développeur, interprète…, classées par notoriété
// (nombre de Wikipédias qui ont un article sur l'œuvre).
//   node tools/oeuvres.js <domaine> [--tous] [--max 8]  → propositions pour les fiches du thème
//   node tools/oeuvres.js --qid Q123                    → test sur un élément
// Écrit tools/propositions/oeuvres-<domaine>.json au format « enrich » de fusion.js, à relire.
const fs = require('fs');
const path = require('path');
const S = require('./sources');
const { chargerTout, titreWikipedia } = require('./lib');

// Rôles par lesquels une œuvre renvoie à son créateur.
const ROLES = ['P50', 'P170', 'P57', 'P58', 'P86', 'P175', 'P272', 'P178', 'P287', 'P84', 'P943', 'P110', 'P98', 'P676'];
// P50 auteur, P170 créateur, P57 réalisateur, P58 scénariste, P86 compositeur, P175 interprète,
// (P162 producteur exclu : il fausse les listes), P272 société de production, P178 développeur, P287 concepteur, P84 architecte,
// P943 programmeur, P110 illustrateur, P98 éditeur scientifique, P676 parolier

const MIN_LANGUES = 3; // une œuvre présente dans moins de 3 Wikipédias est trop confidentielle

const WD = params => 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });

// Éléments qui ont l'un des rôles vers qid (recherche intégrée de Wikidata, rapide).
async function candidats(qid) {
  const requete = 'haswbstatement:' + ROLES.map(p => `${p}=${qid}`).join('|');
  const ids = [];
  let offset = 0;
  do {
    const j = await S.getJSON(WD({ action: 'query', list: 'search', srsearch: requete, srlimit: '500', sroffset: String(offset) }));
    ids.push(...(j?.query?.search || []).map(r => r.title));
    offset = j?.continue?.sroffset || 0;
  } while (offset && ids.length < 1500);
  return ids;
}

async function entites(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const j = await S.getJSON(WD({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|sitelinks|claims', languages: 'fr|en' }));
    Object.assign(out, j?.entities || {});
  }
  return out;
}

// Natures écartées : article scientifique, épisode de série, single
const EXCLURE = new Set(['Q13442814', 'Q21191270', 'Q134556']);

function anneeDe(e) {
  for (const p of ['P577', 'P580', 'P571', 'P1191']) {
    for (const c of e.claims?.[p] || []) {
      const m = /^([+-])(\d+)-/.exec(c.mainsnak?.datavalue?.value?.time || '');
      if (m) return (m[1] === '-' ? '-' : '') + String(+m[2]);
    }
  }
  return null;
}

async function oeuvresDe(qid, max = 8) {
  const moi = (await entites([qid]))[qid];
  const notables = (moi?.claims?.P800 || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const ids = [...new Set([...notables, ...await candidats(qid)])];
  const ents = await entites(ids);
  const liste = [];
  for (const id of ids) {
    const e = ents[id];
    if (!e || e.missing !== undefined) continue;
    const natures = (e.claims?.P31 || []).map(c => c.mainsnak?.datavalue?.value?.id);
    if (natures.some(n => EXCLURE.has(n))) continue;
    if (e.claims?.P1441 || e.claims?.P1080) continue; // personnage de fiction (« présent dans l'œuvre »)
    const langues = Object.keys(e.sitelinks || {}).filter(k => k.endsWith('wiki') && k !== 'commonswiki').length;
    const notable = notables.includes(id);
    if (!notable && langues < MIN_LANGUES) continue;
    const titre = e.labels?.fr?.value || e.labels?.en?.value;
    if (!titre) continue;
    liste.push({ titre, annee: anneeDe(e), langues, notable });
  }
  liste.sort((a, b) => (b.notable - a.notable) || (b.langues - a.langues));
  const vus = new Set();
  const out = [];
  for (const o of liste) {
    const cle = o.titre.toLowerCase().replace(/\s*\(.*\)$/, '');
    if (vus.has(cle)) continue; // le manga et son anime portent souvent le même nom
    vus.add(cle);
    out.push({ titre: o.titre, ...(o.annee ? { annee: o.annee } : {}) });
    if (out.length >= max) break;
  }
  // Ordre d'affichage : chronologique (les œuvres sans date à la fin)
  return out.sort((x, y) => (x.annee ? +x.annee : 1e5) - (y.annee ? +y.annee : 1e5));
}

async function main() {
  const args = process.argv.slice(2);
  const iMax = args.indexOf('--max');
  const max = iMax >= 0 ? +args[iMax + 1] : 8;
  if (args[0] === '--qid') { console.log(await oeuvresDe(args[1], max)); return; }
  const dom = args[0];
  if (!dom) { console.log('Usage : node tools/oeuvres.js <domaine> [--tous] [--max 8] | --qid Q123'); return; }
  const tous = args.includes('--tous'); // sinon : seulement les fiches sans liste d'œuvres

  const enrich = {};
  for (const f of chargerTout()[dom].fiches) {
    if (!['personnage', 'classique'].includes(f.type)) continue;
    if (!tous && f.details?.oeuvres) continue;
    const t = titreWikipedia(f);
    const a = t ? await S.article(t, 'fr') : f.details?.wikipediaEn ? await S.article(f.details.wikipediaEn, 'en') : null;
    if (!a?.qid) continue;
    const o = await oeuvresDe(a.qid, max);
    if (o.length < 3) continue; // pas un créateur, ou trop peu d'œuvres connues
    enrich[f.title] = { oeuvres: o };
    console.log(`${f.title} : ${o.map(x => x.titre + (x.annee ? ` (${x.annee})` : '')).join(' · ')}`);
  }
  const sortie = path.join(__dirname, 'propositions', `oeuvres-${dom}.json`);
  fs.writeFileSync(sortie, JSON.stringify({ enrich }, null, 1));
  console.log(`\n${Object.keys(enrich).length} fiches → ${path.relative(process.cwd(), sortie)}`);
}

module.exports = { oeuvresDe };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
