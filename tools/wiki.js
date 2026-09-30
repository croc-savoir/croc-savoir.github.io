// Résumés Wikipédia (fr) avec cache local.
//   node tools/wiki.js "Jules César"          → affiche le résumé
//   node tools/wiki.js --chercher "bataille de Waterloo" → titres d'articles correspondants
// En module : const { resume, chercher } = require('./wiki');
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, 'cache', 'wiki');
const UA = 'CrocSavoir-outils/1.0 (https://croc-savoir.github.io ; contenu éducatif)';
const PAUSE_MS = 250; // on reste poli avec les serveurs de Wikipédia

let derniere = 0;
async function politesse() {
  const attente = derniere + PAUSE_MS - Date.now();
  if (attente > 0) await new Promise(r => setTimeout(r, attente));
  derniere = Date.now();
}

// L'empreinte distingue « Namakura Gatana » de « Namakura gatana » : sous Windows,
// les noms de fichiers ignorent la casse, alors que les titres Wikipédia non.
function fichierCache(titre) {
  const t = titre.normalize('NFC');
  const nom = t.replace(/[\\/:*?"<>|]/g, '_').slice(0, 140);
  const empreinte = require('crypto').createHash('sha1').update(t).digest('hex').slice(0, 8);
  return path.join(CACHE, `${nom}.${empreinte}.json`);
}

// Résumé d'un article : { titre, extrait, url, homonymie, introuvable }
async function resume(titre, { rafraichir = false } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const fc = fichierCache(titre);
  if (!rafraichir && fs.existsSync(fc)) return JSON.parse(fs.readFileSync(fc, 'utf8'));

  await politesse();
  const url = 'https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titre.replace(/ /g, '_'));
  let res;
  for (let essai = 0; essai < 3; essai++) {
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) { /* réseau : on réessaie */ }
    await new Promise(r => setTimeout(r, 4000 * (essai + 1)));
  }
  let out;
  if (!res || res.status === 404) {
    out = { titre, introuvable: true };
  } else if (!res.ok) {
    throw new Error(`Wikipédia a répondu ${res.status} pour « ${titre} »`);
  } else {
    const j = await res.json();
    out = {
      titre: j.titles?.normalized || j.title || titre,
      demande: titre,
      extrait: j.extract || '',
      url: j.content_urls?.desktop?.page || null,
      homonymie: j.type === 'disambiguation',
      introuvable: false,
    };
  }
  fs.writeFileSync(fc, JSON.stringify(out, null, 2));
  return out;
}

// Recherche plein texte : renvoie jusqu'à n titres d'articles.
async function chercher(requete, n = 5) {
  await politesse();
  const url = 'https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=' + n +
    '&srsearch=' + encodeURIComponent(requete);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Recherche Wikipédia : ' + res.status);
  const j = await res.json();
  return (j.query?.search || []).map(r => r.title);
}

module.exports = { resume, chercher };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (!args.length) { console.log('Usage : node tools/wiki.js "Titre" | --chercher "requête"'); return; }
    if (args[0] === '--chercher') {
      console.log((await chercher(args.slice(1).join(' '), 8)).join('\n'));
      return;
    }
    const r = await resume(args.join(' '));
    if (r.introuvable) console.log('Article introuvable.');
    else console.log(`${r.titre}${r.homonymie ? ' (page d’homonymie)' : ''}\n${r.url}\n\n${r.extrait}`);
  })().catch(e => { console.error(e.message); process.exit(1); });
}
