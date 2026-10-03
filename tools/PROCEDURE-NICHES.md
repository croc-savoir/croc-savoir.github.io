# Procédure pour ajouter des fiches (100 → 300 et plus)

À relire au début de chaque conversation avant de travailler sur du contenu. Les règles de fond sont aussi dans `CONTENU.md` et dans la mémoire du projet.

## Principe
La qualité ne dépend pas de la conversation mais des fichiers donnés aux agents. Chaque agent démarre à zéro : il ne connaît que son prompt, `tools/propositions/consignes-lot.md` (et la consigne spécifique du domaine) et ses dossiers source. Tout ce qui doit être respecté doit donc être écrit là.

## Règles non négociables
- Qualité avant économie : dossiers lus en entier (français ET anglais), 2 sections bien remplies, 1 anecdote vérifiée dans le dossier dès que possible. Jamais raccourcir les fiches pour aller plus vite.
- Faits uniquement tirés du dossier : pas d'anecdote ajoutée de mémoire (mieux vaut pas d'anecdote).
- Aucune araignée ni arachnide, nulle part (voir CONTENU.md ; attention aux mythes, aux dossiers d'animaux, aux titres d'œuvres).
- Rien de sexuel ni de scabreux ; vie privée, drogues, suicides : une mention neutre au plus. Rien après 2025 : pas de record ni de chiffre présentés comme actuels. Personnes décédées : au passé.
- Sujets sensibles : religions (neutre, croyances présentées comme croyances), politique (aucun jugement partisan, critiques présentées), tech (jamais de mode d'emploi d'attaque), sport (pas de drames ni de scandales détaillés).
- Un seul niveau de navigation, plus de sous-thèmes (décision de l'utilisateur) ; la cuisine aura plus tard son propre bouton, on n'y touche pas.

## Méthode (par thème et par tour de +50 fiches)
1. `node tools/existant.js <domaine>` : résumé de l'existant (ne jamais lire data/*.json).
2. Choisir les sujets (catégories Wikipédia : `node tools/candidats.js …`, triés par popularité, sans les doublons avec les autres thèmes : vérifier avec une recherche dans data/fiches).
3. `node tools/dossier.js --liste <fichier>` pour construire les dossiers (corriger les titres introuvables ou en homonymie avec `node tools/wiki.js --chercher`).
4. Construire la carte des lots (sujet → titre Wikipédia → dossier → sous-thème), 14 à 18 sujets par lot (jamais plus de 20).
5. Lancer un agent Sonnet par lot (`run_in_background`) avec un prompt court + un fichier de consignes commun. Chaque agent écrit son fichier APRÈS LES 3 PREMIERS SUJETS puis le réécrit après chaque groupe de 3, travaille dans son propre sous-dossier de scratchpad, lance `controle.js` puis `fusion.js --essai`.
6. Relire chaque lot (anecdotes, questions, sensibilités), corriger, puis `fusion.js` sans `--essai`.
7. Chasse aux araignées : recherche des mots araign|arachn|scorpion|spider|acarien|mygale|tarentul|tique dans data/ (les mots de type « Antarctique » sont des faux positifs).
8. `node tools/verifier.js --liens`, mesure de qualité (voir ci-dessous), commit + push.
9. Si la session est coupée : les agents « failed » (rate_limit) se reprennent avec SendMessage ; vérifier d'abord quels fichiers `tools/propositions/D-*.json` existent.

## Mesure de qualité (à comparer aux 30 premières fiches de chaque thème)
Longueur moyenne du résumé, longueur moyenne de `details` (JSON), pourcentage de fiches avec anecdote. À ce jour, les nouvelles fiches sont toutes plus riches que les anciennes (détails 1 100 à 1 700 caractères, anecdotes 84 à 100 %). Si une série tombe sous le niveau des anciennes fiches, l'enrichir avant de publier.

## Fiches modèles (style à imiter)
À compléter à la prochaine session avec 2 ou 3 fiches choisies parmi les meilleures déjà produites (une fiche « personnage », une « classique », une « vocabulaire »), pour les donner en exemple à chaque agent.
