// Intègre un lot de contenu dans les données de l'appli.
//   node tools/fusion.js <domaine> <lot.json> [--essai]
// Format du lot (tous les champs sont facultatifs) :
// {
//   "fiches":  [ { subtheme, type, title, subtitle?, summary, details: { ..., wikipedia } } ],
//   "enrich":  { "Titre exact d'une fiche existante": { sections?, chiffres?, anecdotes?, wikipedia? } },
//   "quiz":    [ { format, ..., explication, wikipedia? } ],
//   "quizMaj": { "q-id-existant": { explication?, wikipedia?, ... } }   ← corrige des questions existantes
// }
// Les id, le domaine et la source (« D'après Wikipédia — X ») sont ajoutés automatiquement.
// --essai : vérifie tout sans rien écrire. Rien n'est écrit s'il y a une erreur.
const path = require('path');
const { DATA, INTERDIT, TYPES_FICHE, FORMATS_QUIZ, norm, lireJSON, ecrireJSON } = require('./lib');

const [dom, lotFichier, ...opts] = process.argv.slice(2);
if (!dom || !lotFichier) { console.log('Usage : node tools/fusion.js <domaine> <lot.json> [--essai]'); process.exit(1); }
const essai = opts.includes('--essai');

const lot = lireJSON(lotFichier);
const fP = path.join(DATA, 'fiches', dom + '.json');
const qP = path.join(DATA, 'quiz', dom + '.json');
const fiches = lireJSON(fP);
const quiz = lireJSON(qP);
const erreurs = [];
const sourceWiki = w => (w ? `D'après Wikipédia — ${w}` : 'À vérifier');
const prochain = arr => Math.max(0, ...arr.map(x => +(/-(\d+)$/.exec(x.id)?.[1] || 0))) + 1;
const num = n => String(n).padStart(3, '0');

// Enrichissement de fiches existantes
let nEnr = 0;
for (const [titre, extra] of Object.entries(lot.enrich || {})) {
  const f = fiches.find(x => x.title === titre);
  if (!f) { erreurs.push(`enrich : fiche introuvable « ${titre} »`); continue; }
  f.details = f.details || {};
  for (const [k, v] of Object.entries(extra)) {
    if (k === 'sections' && f.details.sections) f.details.sections = f.details.sections.concat(v);
    else f.details[k] = v;
  }
  if (extra.wikipedia && (!f.source || /^à vérifier$/i.test(f.source.trim()))) f.source = sourceWiki(extra.wikipedia);
  nEnr++;
}

// Nouvelles fiches
let n = prochain(fiches), nF = 0;
const titres = new Set(fiches.map(f => norm(f.title)));
for (const f of lot.fiches || []) {
  if (titres.has(norm(f.title))) { erreurs.push(`fiche en double : « ${f.title} »`); continue; }
  if (!TYPES_FICHE.includes(f.type)) erreurs.push(`type invalide pour « ${f.title} » : ${f.type}`);
  if (!f.summary) erreurs.push(`résumé manquant pour « ${f.title} »`);
  titres.add(norm(f.title));
  fiches.push({
    id: `${dom}-${num(n++)}`, domain: dom, subtheme: f.subtheme, type: f.type,
    title: f.title, ...(f.subtitle ? { subtitle: f.subtitle } : {}), summary: f.summary, details: f.details,
    source: f.source || sourceWiki(f.details?.wikipedia),
  });
  nF++;
}

// Nouvelles questions
function valider(q, ou) {
  switch (q.format) {
    case 'qcm': case 'difference':
      if (!q.question || !Array.isArray(q.choix) || !(q.bonneReponse >= 0 && q.bonneReponse < q.choix.length)) erreurs.push('QCM invalide : ' + ou); break;
    case 'vrai-faux': if (!q.affirmation || typeof q.reponse !== 'boolean') erreurs.push('vrai-faux invalide : ' + ou); break;
    case 'associer': if (!(q.paires?.length >= 3 && q.paires.length <= 6)) erreurs.push('associer invalide : ' + ou); break;
    case 'frise': {
      const ev = q.evenements || [];
      if (ev.length < 4 || ev.length > 6 || ev.some(e => isNaN(parseFloat(e.annee)))) erreurs.push('frise invalide : ' + ou);
      else if (new Set(ev.map(e => parseFloat(e.annee))).size !== ev.length) erreurs.push('frise avec deux années égales : ' + ou);
      break;
    }
    case 'qui-suis-je': if (!(q.indices?.length >= 4) || !q.reponse) erreurs.push('qui-suis-je invalide : ' + ou); break;
    default: if (!FORMATS_QUIZ.includes(q.format)) erreurs.push('format inconnu : ' + ou);
  }
}
let qn = prochain(quiz), nQ = 0;
for (const q of lot.quiz || []) {
  const ou = JSON.stringify(q).slice(0, 70);
  valider(q, ou);
  const { wikipedia, ...rest } = q;
  for (const k of Object.keys(rest)) if (k.startsWith('_')) delete rest[k]; // champs de travail
  quiz.push({ id: `q-${dom}-${num(qn++)}`, domain: dom, ...rest, source: rest.source || sourceWiki(wikipedia) });
  nQ++;
}

// Corrections de questions existantes
let nMaj = 0;
for (const [id, maj] of Object.entries(lot.quizMaj || {})) {
  const q = quiz.find(x => x.id === id);
  if (!q) { erreurs.push(`quizMaj : question introuvable ${id}`); continue; }
  const { wikipedia, ...rest } = maj;
  Object.assign(q, rest);
  if (wikipedia) q.source = sourceWiki(wikipedia);
  valider(q, id);
  nMaj++;
}

// Règle absolue
const texte = JSON.stringify(fiches) + JSON.stringify(quiz);
const m = texte.match(new RegExp('.{0,40}(' + INTERDIT.source + ').{0,20}', 'iu'));
if (m) erreurs.push('RÈGLE ARAIGNÉES : …' + m[0] + '…');

if (erreurs.length) {
  console.log('❌ Rien n’a été écrit :\n' + erreurs.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
const bilan = `${dom} : +${nF} fiches (total ${fiches.length}), ${nEnr} enrichies, +${nQ} questions, ${nMaj} corrigées (total ${quiz.length})`;
if (essai) { console.log('✅ Essai OK, rien d’écrit. ' + bilan); process.exit(0); }
ecrireJSON(fP, fiches);
ecrireJSON(qP, quiz);
console.log('✅ ' + bilan);
