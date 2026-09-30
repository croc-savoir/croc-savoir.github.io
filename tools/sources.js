// Accès aux sources pour la « nouvelle méthode » : articles complets (fr, en),
// Wikidata, catégories et popularité. Tout est mis en cache dans tools/cache/sources/.
// En module : const S = require('./sources');
//   S.article(titre, 'fr')      → { titre, texte, qid, en } (en = titre de l'article anglais)
//   S.wikidata(qid)             → { libelle, description, faits: { propriété: [valeurs] } }
//   S.membres(categorie, prof)  → titres d'articles de la catégorie (et sous-catégories)
//   S.vues(titre, 'fr')         → nombre de vues sur les 12 derniers mois
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE = path.join(__dirname, 'cache', 'sources');
const UA = 'CrocSavoir-outils/1.0 (https://croc-savoir.github.io ; contenu éducatif)';
const PAUSE_MS = 150;

let derniere = 0;
async function politesse() {
  const attente = derniere + PAUSE_MS - Date.now();
  if (attente > 0) await new Promise(r => setTimeout(r, attente));
  derniere = Date.now();
}

// GET JSON avec cache disque (clé = empreinte de l'URL) et nouvelles tentatives.
async function getJSON(url, { cache = true } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const fc = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex') + '.json');
  if (cache && fs.existsSync(fc)) return JSON.parse(fs.readFileSync(fc, 'utf8'));
  let res;
  for (let essai = 0; essai < 4; essai++) {
    await politesse();
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) { res = null; }
    await new Promise(r => setTimeout(r, 3000 * (essai + 1)));
  }
  if (!res) throw new Error('Réseau indisponible : ' + url);
  const j = res.status === 404 ? null : (res.ok ? await res.json() : null);
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status} : ${url}`);
  if (cache) fs.writeFileSync(fc, JSON.stringify(j));
  return j;
}

const api = (lang, params) => `https://${lang}.wikipedia.org/w/api.php?` +
  new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();

// Article complet en texte brut (sections comprises), avec son identifiant Wikidata.
async function article(titre, lang = 'fr') {
  const j = await getJSON(api(lang, {
    action: 'query', prop: 'extracts|pageprops|langlinks', explaintext: '1', redirects: '1',
    lllang: lang === 'fr' ? 'en' : 'fr', titles: titre,
  }));
  const p = j?.query?.pages?.[0];
  if (!p || p.missing) return { titre, introuvable: true };
  return {
    titre: p.title,
    texte: nettoyer(p.extract || ''),
    qid: p.pageprops?.wikibase_item || null,
    homonymie: p.pageprops && 'disambiguation' in p.pageprops,
    [lang === 'fr' ? 'en' : 'fr']: p.langlinks?.[0]?.title || null,
  };
}

// Retire les sections sans intérêt pour écrire une fiche.
function nettoyer(t) {
  const couper = /\n==+ *(Notes et références|Références|Notes|Voir aussi|Liens externes|Bibliographie|Articles connexes|References|See also|External links|Further reading|Notes and references) *==+[\s\S]*$/i;
  return t.replace(couper, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Propriétés Wikidata utiles pour des fiches et des questions (libellé en français).
const PROPS = {
  P31: 'nature', P50: 'auteur', P170: 'créateur', P57: 'réalisateur', P58: 'scénariste',
  P86: 'compositeur', P272: 'société de production', P123: 'éditeur', P1433: 'publié dans',
  P136: 'genre', P495: 'pays d\'origine', P577: 'date de publication', P580: 'date de début',
  P582: 'date de fin', P571: 'date de fondation', P569: 'date de naissance', P570: 'date de mort',
  P19: 'lieu de naissance', P20: 'lieu de mort', P27: 'nationalité', P106: 'métier',
  P800: 'œuvre notable', P166: 'distinction', P159: 'siège', P112: 'fondateur', P178: 'développeur',
  P449: 'diffuseur original', P1113: 'nombre d\'épisodes', P2437: 'nombre de saisons',
  P1104: 'nombre de pages', P2635: 'nombre de volumes', P400: 'plateforme', P404: 'mode de jeu',
  P179: 'série', P144: 'adapté de', P4969: 'œuvre dérivée', P17: 'pays', P276: 'lieu',
  P585: 'date', P710: 'participant', P61: 'découvreur ou inventeur', P575: 'date de découverte',
  P2046: 'superficie', P1082: 'population', P2048: 'hauteur', P2067: 'masse', P36: 'capitale',
  P140: 'religion', P39: 'fonction', P26: 'conjoint', P22: 'père', P25: 'mère', P737: 'influencé par',
};

function valeurBrute(dv) {
  if (!dv) return null;
  const v = dv.value;
  switch (dv.type) {
    case 'wikibase-entityid': return { id: v.id };
    case 'time': {
      const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(v.time);
      if (!m) return v.time;
      const an = (m[1] === '-' ? '-' : '') + String(+m[2]);
      if (v.precision >= 11) return `${+m[4]}/${+m[3]}/${an}`;
      if (v.precision === 10) return `${+m[3]}/${an}`;
      return an;
    }
    case 'quantity': return String(+v.amount);
    case 'monolingualtext': return v.text;
    case 'string': return v;
    default: return null;
  }
}

async function libelles(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const lot = ids.slice(i, i + 50);
    const j = await getJSON('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
      action: 'wbgetentities', ids: lot.join('|'), props: 'labels', languages: 'fr|en', format: 'json',
    }));
    for (const [id, e] of Object.entries(j?.entities || {})) {
      out[id] = e.labels?.fr?.value || e.labels?.en?.value || id;
    }
  }
  return out;
}

// Faits Wikidata d'un élément, avec les valeurs traduites en libellés français.
async function wikidata(qid) {
  if (!qid) return null;
  const j = await getJSON(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const e = j?.entities?.[qid];
  if (!e) return null;
  const brut = {};
  const aResoudre = new Set();
  for (const [p, nom] of Object.entries(PROPS)) {
    const vals = (e.claims?.[p] || []).filter(c => c.rank !== 'deprecated')
      .map(c => valeurBrute(c.mainsnak?.datavalue)).filter(Boolean);
    if (!vals.length) continue;
    brut[nom] = vals;
    vals.forEach(v => { if (v.id) aResoudre.add(v.id); });
  }
  const lib = await libelles([...aResoudre]);
  const faits = {};
  for (const [nom, vals] of Object.entries(brut)) {
    faits[nom] = [...new Set(vals.map(v => (v.id ? lib[v.id] : v)))].slice(0, 12);
  }
  return {
    qid,
    libelle: e.labels?.fr?.value || e.labels?.en?.value || qid,
    description: e.descriptions?.fr?.value || e.descriptions?.en?.value || '',
    faits,
  };
}

// Titres des articles d'une catégorie (sans le préfixe), en descendant dans les sous-catégories.
async function membres(categorie, profondeur = 0, lang = 'fr', vus = new Set()) {
  const prefixe = lang === 'fr' ? 'Catégorie:' : 'Category:';
  const cat = categorie.startsWith(prefixe) ? categorie : prefixe + categorie;
  if (vus.has(cat)) return [];
  vus.add(cat);
  const pages = [];
  const souscats = [];
  let suite = {};
  do {
    const j = await getJSON(api(lang, {
      action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'page|subcat', ...suite,
    }));
    for (const m of j?.query?.categorymembers || []) {
      if (m.ns === 0) pages.push(m.title);
      else if (m.ns === 14) souscats.push(m.title);
    }
    suite = j?.continue ? { cmcontinue: j.continue.cmcontinue } : null;
  } while (suite);
  if (profondeur > 0) {
    for (const sc of souscats) pages.push(...await membres(sc, profondeur - 1, lang, vus));
  }
  return [...new Set(pages)];
}

// Vues de l'article sur les 12 derniers mois complets (indicateur de notoriété).
async function vues(titre, lang = 'fr') {
  const fin = new Date();
  fin.setUTCDate(1);
  const debut = new Date(fin);
  debut.setUTCFullYear(debut.getUTCFullYear() - 1);
  const f = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/` +
    `${encodeURIComponent(titre.replace(/ /g, '_'))}/monthly/${f(debut)}/${f(fin)}`;
  try {
    const j = await getJSON(url);
    return (j?.items || []).reduce((s, it) => s + it.views, 0);
  } catch (e) { return 0; }
}

module.exports = { article, wikidata, membres, vues, getJSON };
