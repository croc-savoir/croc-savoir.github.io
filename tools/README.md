# Outils de contenu

Scripts Node (version 18 ou plus), sans dépendance à installer. À lancer depuis la racine du projet.

| Commande | Rôle |
|---|---|
| `node tools/verifier.js` | Vérifie toutes les fiches et questions : format, doublons, règle des araignées, explications trop courtes, sources « À vérifier ». Code de sortie 1 en cas d'erreur bloquante. |
| `node tools/verifier.js --liens` | Vérifie en plus que chaque article Wikipédia cité existe et n'est pas une page d'homonymie (réseau, avec cache). |
| `node tools/verifier.js --detail` | Liste chaque avertissement au lieu d'un simple total. |
| `node tools/wiki.js "Titre"` | Affiche le résumé Wikipédia d'un article (titre exact, lien, extrait). |
| `node tools/wiki.js --chercher "mots"` | Cherche les articles Wikipédia correspondants. |
| `node tools/fusion.js <domaine> <lot.json> [--essai]` | Intègre un lot de fiches et de questions (format décrit en tête du fichier). N'écrit rien s'il y a la moindre erreur ; `--essai` vérifie sans écrire. |
| `node tools/construire.js` | Génère les fichiers lus par l'appli : `data/app/index.json` (fiches sans détails + questions, chargé au démarrage) et `data/app/details/<domaine>.json` (chargés sur « Approfondir »). Lancé automatiquement par `fusion.js` ; à relancer après toute modification manuelle de `data/fiches` ou `data/quiz` (le vérificateur le signale). |
| `node tools/a-enrichir.js <domaine> [min]` | Liste les questions d'un thème dont l'explication est trop courte ou la source « À vérifier ». |
| `node tools/quiz-auto.js <domaine>` | Propose des questions « frise » à partir des dates des fiches, dans `tools/propositions/`. À relire avant fusion. |

## Méthode pour un nouveau lot

1. Choisir les sujets et, pour chacun, lire son résumé avec `node tools/wiki.js "Sujet"` : les dates et chiffres partent de la source.
2. Rédiger le lot au format de `fusion.js`, en indiquant pour chaque fiche le titre exact de l'article (`details.wikipedia`).
3. `node tools/fusion.js <domaine> lot.json --essai`, puis sans `--essai`.
4. `node tools/verifier.js --liens` avant de publier.

Les sources à modifier sont `data/fiches/` et `data/quiz/` ; ne jamais éditer `data/app/` à la main.

Les dossiers `tools/cache/` (résumés Wikipédia) et `tools/propositions/` ne sont pas versionnés.
