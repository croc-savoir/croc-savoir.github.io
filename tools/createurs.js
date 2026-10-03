// Créateur principal de chaque fiche d'œuvre, d'après Wikidata (champ details.createurs : [{nom, role}]).
// Dans l'appli, le nom devient un lien si une fiche porte ce titre (voir Fiches.ficheLink).
//   node tools/createurs.js <domaine> [--appliquer]   → propose (sans --appliquer : affiche seulement)
//   node tools/createurs.js --controle                → liste ce qui manque dans tous les thèmes (règle auteur ↔ œuvre)
const fs = require('fs');
const path = require('path');
const S = require('./sources');
const { chargerTout, titreWikipedia, norm, lireJSON, ecrireJSON } = require('./lib');

// Sous-thèmes qui contiennent des œuvres (à mettre à jour si tools/ranger.js les renomme), et rôles Wikidata à rechercher (dans cet ordre).
const OEUVRES = {
  manga: { sous: ["Shonen d'action", 'Seinen et grands récits', 'Comédie, sport et romance', 'Classiques et animés cultes', 'Films et studios'], roles: [['P50', 'Mangaka'], ['P110', 'Dessinateur'], ['P57', 'Réalisateur']], anime: true },
  cinema: { sous: ['Films cultes', 'Sorties marquantes', 'Animation'], roles: [['P57', 'Réalisateur']], studioSiAnimation: true },
  art: { sous: ['Œuvres célèbres'], roles: [['P170', 'Artiste']], max: 1 },
  litterature: { sous: ['Classiques français', 'Classiques du monde'], roles: [['P50', 'Auteur']], max: 2 },
  'jeux-video': { sous: ['Classiques avant 2000', 'Jeux des années 2000 et 2010', 'Jeux récents'], roles: [['P178', 'Studio'], ['P287', 'Concepteur'], ['P50', 'Créateur']] },
  musique: { sous: ['Œuvres et dates'], roles: [['P86', 'Compositeur'], ['P175', 'Interprète'], ['P676', 'Parolier']] },
};
// Corrections à la main (Wikidata mêle producteurs, chaînes TV, mauvaises adaptations) : titre de la fiche → liste finale.
// "fiche" = titre exact de la fiche à ouvrir quand il diffère du nom affiché.
const CORRECTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'createurs-corrections.json'), 'utf8'));
// Studios d'animation reconnus (les chaînes de télévision et producteurs sont écartés) ; 2 au plus.
const STUDIOS = new Set(['toei animation', 'pierrot', 'ufotable', 'mappa', 'wit studio', 'bones', 'madhouse', 'production i g', 'studio gainax', 'studio voln', 'liden films', 'olm', 'mushi production', 'kyoto animation', 'sunrise']);
// Fiches qui sont elles-mêmes des créateurs (studios, entreprises) ou des événements : pas de « créé par ».
const PAS_UNE_OEUVRE = /^(\d{4}\s*:|Sortie |1re |Le Studio Ghibli$|Studio 4°C$|Le studio 8-Bit$|Toei Animation$|Kyoto Animation$|MAPPA$|Walt Disney$|Pixar Animation Studios$|Aardman Animations$|Nintendo|Valve et Steam$|Ubisoft$|Capcom$)/;
const WD = params => 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });

async function entites(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const j = await S.getJSON(WD({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|claims|sitelinks', languages: 'fr|en' }));
    Object.assign(out, j?.entities || {});
  }
  return out;
}
const valeurs = (e, p) => (e?.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);

// Adaptation animée (ou autre) d'une œuvre : éléments « basé sur » (P144) cette œuvre.
async function adaptations(qid) {
  const j = await S.getJSON(WD({ action: 'query', list: 'search', srsearch: `haswbstatement:P144=${qid}`, srlimit: '10' }));
  return (j?.query?.search || []).map(r => r.title);
}

async function createursDe(conf, qid, parWiki) {
  const moi = (await entites([qid]))[qid];
  const trouves = []; // { id, role }
  for (const [p, role] of conf.roles) {
    for (const id of valeurs(moi, p).slice(0, 2)) if (!trouves.some(t => t.id === id)) trouves.push({ id, role });
    if (trouves.length && !conf.anime) { /* un seul rôle suffit sauf manga/jeux */ if (p !== 'P178') break; }
  }
  if (conf.anime || conf.studioSiAnimation) {
    const adapt = await adaptations(qid);
    const ents = await entites(adapt);
    for (const id of adapt) for (const s of valeurs(ents[id], 'P272').slice(0, 1)) if (!trouves.some(t => t.id === s)) trouves.push({ id: s, role: "Studio d'animation" });
    if (conf.studioSiAnimation) for (const s of valeurs(moi, 'P272').slice(0, 1)) if (!trouves.some(t => t.id === s)) trouves.push({ id: s, role: 'Studio' });
  }
  const labs = await entites(trouves.map(t => t.id));
  // Si une fiche existe pour ce créateur (même article Wikipédia), on reprend EXACTEMENT son titre pour que le lien fonctionne.
  const nom = t => parWiki.get(norm(labs[t.id]?.sitelinks?.frwiki?.title || '')) || labs[t.id]?.labels?.fr?.value || labs[t.id]?.labels?.en?.value;
  return trouves.slice(0, conf.max || 4).map(t => ({ nom: nom(t), role: t.role })).filter(c => c.nom);
}

function oeuvresDuDomaine(dom, fiches) {
  return fiches.filter(f => OEUVRES[dom].sous.includes(f.subtheme) && f.type !== 'date' && !f.details?.oeuvres?.length && !PAS_UNE_OEUVRE.test(f.title));
}

async function proposer(dom, appliquer) {
  const tout = chargerTout();
  const conf = OEUVRES[dom];
  const fichier = path.join(__dirname, '..', 'data', 'fiches', dom + '.json');
  const fiches = lireJSON(fichier);
  const parNom = new Map(fiches.map(f => [norm(f.title), f]));
  const parWiki = new Map(Object.values(tout).flatMap(d => d.fiches).filter(f => f.details?.wikipedia).map(f => [norm(f.details.wikipedia), f.title]));
  let n = 0;
  for (const f of oeuvresDuDomaine(dom, fiches)) {
    if (f.details?.createurs?.length) continue;
    if (CORRECTIONS[f.title]) { f.details = f.details || {}; f.details.createurs = CORRECTIONS[f.title]; console.log(`✏️ ${f.title} (corrigé)`); n++; continue; }
    const t = titreWikipedia(f);
    const a = t ? await S.article(t, 'fr') : f.details?.wikipediaEn ? await S.article(f.details.wikipediaEn, 'en') : null;
    if (!a?.qid) { console.log(`⚪ ${f.title} : pas d'élément Wikidata`); continue; }
    let c = await createursDe(conf, a.qid, parWiki);
    // Règles : studios reconnus seulement ; au cinéma, réalisateurs seulement ; 2 studios au plus
    c = c.filter(x => !/studio/i.test(x.role) || (conf.anime && STUDIOS.has(norm(x.nom)))).filter(x => dom !== 'cinema' || x.role === 'Réalisateur');
    c = c.filter((x, i) => !/studio/i.test(x.role) || c.slice(0, i).filter(y => /studio/i.test(y.role)).length < 2).slice(0, dom === 'cinema' ? 2 : 4);
    if (!c.length) { console.log(`⚪ ${f.title} : aucun créateur trouvé (c'est peut-être un créateur ou une franchise)`); continue; }
    console.log(`${c.some(x => parNom.has(norm(x.nom))) ? '🔗' : '  '} ${f.title} → ${c.map(x => `${x.nom} (${x.role})`).join(', ')}`);
    if (appliquer) { f.details = f.details || {}; f.details.createurs = c; n++; }
  }
  if (appliquer) { ecrireJSON(fichier, fiches); console.log(`\n${n} fiches mises à jour dans ${dom}.json`); }
}

// Règle auteur ↔ œuvre : chaque créateur a des œuvres, chaque œuvre a un créateur, et on dit si la fiche du créateur existe.
function controle() {
  const tout = chargerTout();
  const noms = new Set(Object.values(tout).flatMap(d => d.fiches.map(f => norm(f.title))));
  for (const dom of Object.keys(OEUVRES)) {
    const fiches = tout[dom].fiches;
    const sansOeuvre = fiches.filter(f => f.type === 'personnage' && !f.details?.oeuvres?.length).map(f => f.title);
    const oeuvres = oeuvresDuDomaine(dom, fiches);
    const sansCreateur = oeuvres.filter(f => !f.details?.createurs?.length).map(f => f.title);
    const manquants = new Set();
    for (const f of oeuvres) for (const c of f.details?.createurs || []) if (!noms.has(norm(c.fiche || c.nom))) manquants.add(c.nom);
    console.log(`\n== ${dom}`);
    console.log(`  créateurs sans œuvre (${sansOeuvre.length}) : ${sansOeuvre.join('; ') || '—'}`);
    console.log(`  œuvres sans créateur (${sansCreateur.length}) : ${sansCreateur.join('; ') || '—'}`);
    console.log(`  créateurs cités SANS fiche (${manquants.size}) : ${[...manquants].join('; ') || '—'}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--controle') controle();
else if (OEUVRES[args[0]]) proposer(args[0], args.includes('--appliquer')).catch(e => { console.error(e.message); process.exit(1); });
else console.log('Usage : node tools/createurs.js <domaine> [--appliquer] | --controle\nDomaines : ' + Object.keys(OEUVRES).join(', '));
