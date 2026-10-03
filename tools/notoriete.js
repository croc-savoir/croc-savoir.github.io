// Niveau de notoriété de chaque fiche, d'après les vues de son article Wikipédia sur 12 mois.
//   node tools/notoriete.js              → mesure (cache tools/notoriete-vues.json) et affiche la répartition
//   node tools/notoriete.js --appliquer  → écrit le champ `notoriete` dans data/fiches/*.json
// notoriete : 1 = Incontournable (le tiers le plus consulté du thème), 2 = Connaisseur, 3 = Expert (le tiers le moins consulté).
// Le classement se fait à l'intérieur de chaque thème (un classique de la philosophie et un classique du manga ne s'attirent pas la même foule).
const fs = require('fs');
const path = require('path');
const S = require('./sources');
const { chargerTout, titreWikipedia, lireJSON, ecrireJSON } = require('./lib');

const CACHE = path.join(__dirname, 'notoriete-vues.json');
const NOMS = { 1: 'Incontournable', 2: 'Connaisseur', 3: 'Expert' };

// Les vues d'une page de redirection sont minuscules : on mesure la page réelle (suit les redirections).
async function resoudre(titres, lang) {
  const out = {};
  const liste = [...new Set(titres)];
  for (let i = 0; i < liste.length; i += 40) {
    const lot = liste.slice(i, i + 40);
    const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: 'query', format: 'json', redirects: '1', titles: lot.join('|') });
    const j = await S.getJSON(url);
    const norm = Object.fromEntries((j?.query?.normalized || []).map(x => [x.from, x.to]));
    const red = Object.fromEntries((j?.query?.redirects || []).map(x => [x.from, x.to]));
    for (const t of lot) { const a = norm[t] || t; out[t] = red[a] || a; }
  }
  return out;
}

async function mesurer(tout) {
  const vues = fs.existsSync(CACHE) ? lireJSON(CACHE) : {};
  let n = 0;
  const frT = Object.values(tout).flatMap(d => d.fiches.map(f => titreWikipedia(f))).filter(Boolean);
  const enT = Object.values(tout).flatMap(d => d.fiches.filter(f => !titreWikipedia(f)).map(f => f.details?.wikipediaEn)).filter(Boolean);
  const resFr = await resoudre(frT, 'fr');
  const resEn = await resoudre(enT, 'en');
  for (const [dom, d] of Object.entries(tout)) {
    for (const f of d.fiches) {
      if (f.id in vues) continue;
      const fr = titreWikipedia(f);
      const en = f.details?.wikipediaEn;
      let v = null;
      if (fr) v = await S.vues(resFr[fr] || fr, 'fr');
      else if (en) v = await S.vues(resEn[en] || en, 'en');
      vues[f.id] = v;
      if (++n % 100 === 0) { ecrireJSON(CACHE, vues); console.log(`  ${n} fiches mesurées…`); }
    }
  }
  ecrireJSON(CACHE, vues);
  return vues;
}

// Seuils figés par thème (tools/notoriete-seuils.json) : calculés une seule fois sur les fiches de base, puis conservés,
// pour que les fiches de niche (moins consultées) tombent d'elles-mêmes en « Expert ».
// Incontournable : vues ≥ médiane du thème ; Connaisseur : ≥ médiane / 4 ; Expert : en dessous.
const SEUILS = path.join(__dirname, 'notoriete-seuils.json');
// Corrections à la main : titre de la fiche → niveau (1, 2 ou 3), pour les cas où les vues Wikipédia trompent.
const CORR = path.join(__dirname, 'notoriete-corrections.json');

async function main() {
  const tout = chargerTout();
  const vues = await mesurer(tout);
  const seuils = fs.existsSync(SEUILS) ? lireJSON(SEUILS) : {};
  const corr = fs.existsSync(CORR) ? lireJSON(CORR) : {};
  for (const [dom, d] of Object.entries(tout)) {
    const triees = d.fiches.map(f => vues[f.id]).filter(v => v != null).sort((a, b) => b - a);
    if (!seuils[dom]) seuils[dom] = Math.round(triees[Math.floor(triees.length / 2)] || 0);
    const med = seuils[dom];
    const niveau = f => {
      if (corr[f.title]) return corr[f.title];
      if (f.type === 'vocabulaire') return 1; // le vocabulaire de base n'a pas de notoriété mesurable
      const v = vues[f.id];
      if (v == null) return 2; // pas d'article Wikipédia : « Connaisseur » par défaut
      return v >= med ? 1 : v >= med / 4 ? 2 : 3;
    };
    const nb = [1, 2, 3].map(k => d.fiches.filter(f => niveau(f) === k).length);
    console.log(`${dom.padEnd(13)} ${nb.join(' / ')}  (seuil ${med.toLocaleString('fr-FR')} vues/an)`);
    if (process.argv.includes('--appliquer')) {
      for (const f of d.fiches) f.notoriete = niveau(f);
      ecrireJSON(path.join(__dirname, '..', 'data', 'fiches', dom + '.json'), d.fiches);
    }
  }
  if (!fs.existsSync(SEUILS) || process.argv.includes('--appliquer')) ecrireJSON(SEUILS, seuils);
}
main().catch(e => { console.error(e); process.exit(1); });
