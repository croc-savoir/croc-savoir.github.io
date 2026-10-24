// Prépare les lots de relecture (agents Opus) : fiches + questions lisibles, avec chemin du dossier source.
//   node tools/relecture.js <domaine> [taille=17] [fichesDeBase] [questionsDeBase]
// Par défaut, la base (fiches/questions déjà relues) vient de tools/relecture-base.json (sinon 31/30).
// → tools/propositions/relecture-niches/<domaine>-R<n>.md ; les fiches/questions de base (déjà relues) sont ignorées.
const fs = require('fs');
const path = require('path');
const { chargerTout } = require('./lib');

const [dom, taille = 17, bF, bQ] = process.argv.slice(2);
const bases = JSON.parse(fs.readFileSync(path.join(__dirname, 'relecture-base.json'), 'utf8'))[dom] || [31, 30];
const baseF = bF === undefined ? bases[0] : bF, baseQ = bQ === undefined ? bases[1] : bQ;
if (!dom) { console.log('Usage : node tools/relecture.js <domaine> [taille] [fichesDeBase] [questionsDeBase]'); process.exit(1); }
const { fiches, quiz } = chargerTout()[dom];
const nF = fiches.slice(+baseF), nQ = quiz.slice(+baseQ);
const nb = Math.ceil(nF.length / +taille), out = path.join(__dirname, 'propositions', 'relecture-niches');
fs.mkdirSync(out, { recursive: true });
const dossier = t => {
  const p = path.join('tools', 'dossiers', t + '.md');
  return t && fs.existsSync(path.join(__dirname, '..', p)) ? p.split(path.sep).join('/') : '(pas de dossier)';
};
const wiki = x => (/—\s*(.+)$/.exec(x.source || '') || [])[1];
for (let i = 0; i < nb; i++) {
  const fs_ = nF.slice(i * taille, (i + 1) * taille);
  const qs = nQ.slice(Math.round(i * nQ.length / nb), Math.round((i + 1) * nQ.length / nb));
  const L = [`# Relecture ${dom} — lot R${i + 1} : ${fs_.length} fiches, ${qs.length} questions`, '', '## FICHES', ''];
  for (const f of fs_) {
    const d = f.details || {};
    L.push(`### ${f.title}  [${f.subtheme} | ${f.type}]`, `dossier : ${dossier(d.wikipedia || wiki(f))}`, `sous-titre : ${f.subtitle || ''}`, `résumé : ${f.summary}`);
    for (const s of d.sections || []) L.push(`section « ${s.titre} » : ${s.texte}`);
    if (d.chiffres) L.push('chiffres : ' + JSON.stringify(d.chiffres));
    if (d.oeuvres) L.push('œuvres : ' + JSON.stringify(d.oeuvres));
    (d.anecdotes || []).forEach(a => L.push('anecdote : ' + a));
    L.push('');
  }
  L.push('## QUESTIONS (id = clé pour quizMaj)', '');
  for (const q of qs) { const { id, domain, ...r } = q; L.push(`### ${id}  (dossier : ${dossier(wiki(q))})`, JSON.stringify(r), ''); }
  fs.writeFileSync(path.join(out, `${dom}-R${i + 1}.md`), L.join('\n'));
}
console.log(`${dom} : ${nF.length} fiches + ${nQ.length} questions → ${nb} lots dans tools/propositions/relecture-niches/`);
