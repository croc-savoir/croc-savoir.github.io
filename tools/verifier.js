// Vérifie toutes les fiches et questions.
//   node tools/verifier.js           → contrôles hors-ligne
//   node tools/verifier.js --liens   → vérifie aussi que chaque article Wikipédia cité existe
//   node tools/verifier.js --detail  → liste chaque avertissement au lieu d'un résumé
// Code de sortie 1 s'il y a des ERREURS (les avertissements ne bloquent pas).
const { INTERDIT, TYPES_FICHE, FORMATS_QUIZ, norm, chargerTout, domaines, titreWikipedia } = require('./lib');

const EXPLICATION_MIN = 120; // en dessous, l'explication est jugée trop courte

async function main() {
  const args = process.argv.slice(2);
  const erreurs = [];
  const avert = {}; // catégorie -> [messages]
  const warn = (cat, msg) => { (avert[cat] = avert[cat] || []).push(msg); };

  const tout = chargerTout();
  const ids = new Map();
  const titres = new Map();
  let nbF = 0, nbQ = 0;

  for (const d of domaines()) {
    const { fiches, quiz } = tout[d.id];
    nbF += fiches.length; nbQ += quiz.length;

    for (const f of fiches) {
      const ou = `${f.id || '?'} (${d.id})`;
      if (!f.id) erreurs.push(`Fiche sans id dans ${d.id} : ${f.title}`);
      if (ids.has(f.id)) erreurs.push(`Identifiant en double : ${f.id}`);
      ids.set(f.id, true);
      if (f.domain !== d.id) erreurs.push(`${ou} : domaine « ${f.domain} » ≠ fichier ${d.id}`);
      if (!TYPES_FICHE.includes(f.type)) erreurs.push(`${ou} : type inconnu « ${f.type} »`);
      if (!f.title) erreurs.push(`${ou} : titre manquant`);
      if (!f.summary) erreurs.push(`${ou} : résumé manquant`);
      const t = norm(f.title);
      if (titres.has(t)) warn('Titres identiques entre thèmes', `« ${f.title} » : ${titres.get(t)} et ${f.id}`);
      else titres.set(t, f.id);
      if (!f.details || !Object.keys(f.details).length) warn('Fiches sans « Approfondir »', ou);
      if (!titreWikipedia(f)) warn('Fiches sans article Wikipédia désigné', ou);
      if (/vérifier/i.test(f.source || '')) warn('Fiches à source « À vérifier »', ou);
    }

    for (const q of quiz) {
      const ou = `${q.id || '?'} (${d.id})`;
      if (!q.id) erreurs.push(`Question sans id dans ${d.id}`);
      if (ids.has(q.id)) erreurs.push(`Identifiant en double : ${q.id}`);
      ids.set(q.id, true);
      if (q.domain !== d.id) erreurs.push(`${ou} : domaine « ${q.domain} » ≠ fichier ${d.id}`);
      if (!FORMATS_QUIZ.includes(q.format)) { erreurs.push(`${ou} : format inconnu « ${q.format} »`); continue; }
      switch (q.format) {
        case 'qcm': case 'difference':
          if (!q.question) erreurs.push(`${ou} : question manquante`);
          if (!Array.isArray(q.choix) || q.choix.length < 2) erreurs.push(`${ou} : choix invalides`);
          else if (!(q.bonneReponse >= 0 && q.bonneReponse < q.choix.length)) erreurs.push(`${ou} : bonneReponse hors des choix`);
          else if (new Set(q.choix.map(norm)).size !== q.choix.length) erreurs.push(`${ou} : deux choix identiques`);
          break;
        case 'vrai-faux':
          if (!q.affirmation || typeof q.reponse !== 'boolean') erreurs.push(`${ou} : affirmation ou réponse invalide`);
          break;
        case 'associer':
          if (!(q.paires?.length >= 3 && q.paires.length <= 6)) erreurs.push(`${ou} : il faut 3 à 6 paires`);
          else if (q.paires.some(p => !p.explication)) warn('« Associer » sans explication par paire', ou);
          break;
        case 'frise': {
          const ev = q.evenements || [];
          if (ev.length < 4 || ev.length > 6) erreurs.push(`${ou} : il faut 4 à 6 événements`);
          if (ev.some(e => isNaN(parseFloat(e.annee)))) erreurs.push(`${ou} : année illisible`);
          else if (new Set(ev.map(e => parseFloat(e.annee))).size !== ev.length) erreurs.push(`${ou} : deux événements à la même année`);
          break;
        }
        case 'qui-suis-je':
          if (!(q.indices?.length >= 4) || !q.reponse) erreurs.push(`${ou} : indices (≥ 4) ou réponse manquants`);
          break;
      }
      if (!q.explication) warn('Questions sans explication', ou);
      else if (q.explication.length < EXPLICATION_MIN) warn(`Explications de moins de ${EXPLICATION_MIN} caractères`, ou);
      if (/vérifier/i.test(q.source || '')) warn('Questions à source « À vérifier »', ou);
    }

    const texte = JSON.stringify(fiches) + JSON.stringify(quiz);
    const m = texte.match(new RegExp('.{0,40}(' + INTERDIT.source + ').{0,20}', 'iu'));
    if (m) erreurs.push(`RÈGLE ARAIGNÉES (${d.id}) : …${m[0]}…`);
  }

  // Liens Wikipédia (réseau, avec cache)
  if (args.includes('--liens')) {
    const { resume } = require('./wiki');
    const cites = new Map();
    for (const d of domaines()) for (const o of [...tout[d.id].fiches, ...tout[d.id].quiz]) {
      const t = titreWikipedia(o);
      if (t) (cites.get(t) || cites.set(t, []).get(t)).push(o.id);
    }
    let i = 0;
    for (const [t, qui] of cites) {
      i++;
      if (i % 50 === 0) process.stderr.write(`  liens vérifiés : ${i}/${cites.size}\n`);
      try {
        const r = await resume(t);
        if (r.introuvable) warn('Articles Wikipédia introuvables', `« ${t} » (${qui.join(', ')})`);
        else if (r.homonymie) warn('Liens vers une page d’homonymie', `« ${t} » (${qui.join(', ')})`);
      } catch (e) { warn('Liens non vérifiables (réseau)', `« ${t} » : ${e.message}`); }
    }
  }

  // Rapport
  console.log(`\n${nbF} fiches, ${nbQ} questions, ${domaines().length} thèmes\n`);
  if (erreurs.length) {
    console.log(`❌ ${erreurs.length} ERREUR(S) :`);
    erreurs.forEach(e => console.log('  - ' + e));
  } else console.log('✅ Aucune erreur bloquante.');
  const cats = Object.keys(avert);
  if (cats.length) {
    console.log('\n⚠️  Avertissements :');
    for (const c of cats) {
      console.log(`  ${c} : ${avert[c].length}`);
      if (args.includes('--detail') || avert[c].length <= 5) avert[c].forEach(m => console.log('     · ' + m));
    }
  }
  process.exit(erreurs.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
