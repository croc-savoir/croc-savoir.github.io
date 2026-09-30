// Propose des sujets de fiches à partir de catégories Wikipédia, classés par popularité,
// en retirant ceux qui ont déjà une fiche dans le thème.
//   node tools/candidats.js --chercher "studio animation"        → catégories correspondantes
//   node tools/candidats.js <domaine> "Catégorie A" ["Catégorie B"…] [--prof 1] [--n 60]
// Écrit aussi la liste dans tools/propositions/candidats-<domaine>.json.
const fs = require('fs');
const path = require('path');
const S = require('./sources');
const { chargerTout, norm, titreWikipedia } = require('./lib');

async function chercherCategories(q) {
  const j = await S.getJSON('https://fr.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', list: 'search', srnamespace: '14', srsearch: q, srlimit: '15', format: 'json',
  }));
  return (j?.query?.search || []).map(s => s.title.replace(/^Catégorie:/, ''));
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--chercher') {
    console.log((await chercherCategories(args.slice(1).join(' '))).join('\n'));
    return;
  }
  const opt = (nom, def) => { const i = args.indexOf(nom); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
  const prof = +opt('--prof', 0);
  const n = +opt('--n', 60);
  const [dom, ...cats] = args;
  if (!dom || !cats.length) { console.log('Usage : node tools/candidats.js <domaine> "Catégorie" … [--prof 1] [--n 60]'); return; }

  // Déjà couverts : titres de fiches et articles cités, dans tous les thèmes.
  const deja = new Set();
  for (const d of Object.values(chargerTout())) {
    for (const f of d.fiches) { deja.add(norm(f.title)); const w = titreWikipedia(f); if (w) deja.add(norm(w)); }
  }
  const sansParentheses = t => t.replace(/\s*\(.*\)$/, '');

  let titres = [];
  for (const c of cats) {
    const m = await S.membres(c, prof);
    console.log(`  ${c} : ${m.length} articles`);
    titres.push(...m);
  }
  titres = [...new Set(titres)].filter(t => !/^Liste /.test(t));
  const neufs = titres.filter(t => !deja.has(norm(t)) && !deja.has(norm(sansParentheses(t))));
  console.log(`  ${titres.length} articles, dont ${neufs.length} sans fiche. Mesure de la popularité…`);

  const res = [];
  for (const t of neufs) res.push({ titre: t, vues: await S.vues(t) });
  res.sort((a, b) => b.vues - a.vues);
  const top = res.slice(0, n);
  const sortie = path.join(__dirname, 'propositions', `candidats-${dom}.json`);
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, JSON.stringify({ categories: cats, candidats: top }, null, 1));
  top.forEach((c, i) => console.log(`${String(i + 1).padStart(3)}. ${c.titre}  (${c.vues.toLocaleString('fr-FR')} vues/an)`));
  console.log(`\n→ ${path.relative(process.cwd(), sortie)}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
