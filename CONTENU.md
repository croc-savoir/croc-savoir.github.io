# Ajouter du contenu — guide rapide

Pour ajouter un lot de fiches ou de quiz, tu n'as **jamais besoin de toucher au code**.
Il suffit de compléter (ou remplacer) les fichiers JSON dans `data/fiches/` et `data/quiz/`.

## Convention de fichiers

- `data/fiches/<domainId>.json` → tableau de fiches pour ce domaine
- `data/quiz/<domainId>.json` → tableau de questions pour ce domaine
- Un fichier absent = simplement 0 contenu pour ce domaine (pas d'erreur).
- Les ids des domaines sont dans `data/domains.json`. Pour ajouter un domaine :
  ajoute une entrée dans `domains.json` (`id`, `label`, `emoji`), puis crée les deux
  fichiers JSON correspondants.

## Format d'une fiche

```json
{
  "id": "histoire-042",
  "domain": "histoire",
  "subtheme": "Révolution française",
  "type": "personnage",
  "title": "Titre affiché",
  "subtitle": "Optionnel, courte accroche",
  "summary": "Résumé ~30 secondes (2-4 phrases). \\n = saut de paragraphe.",
  "details": { "...": "voir ci-dessous selon le type" },
  "source": "À vérifier"
}
```

- `id` : unique dans toute l'appli, convention `<domainId>-<numéro>`.
- `subtheme` : texte libre, sert juste à regrouper dans Fiches → Par thème.
  Garde le même libellé exact pour les fiches d'un même sous-thème.
- `source` : mets `"À vérifier"` si une date/un chiffre n'est pas certain.
  L'appli l'affiche avec un ⚠️ au lieu d'un 📎.

### `details` selon `type`

| type | champs de `details` |
|---|---|
| `personnage` | `epoque`, `pourquoiCelebre`, `ideesClefs: [string]`, `liens: [{nom, relation}]` |
| `date` | `contexte`, `causes`, `deroulement`, `consequences`, `frise: [{annee, evenement}]` |
| `animal-rare` | `habitat`, `causesDeclin`, `statutConservation`, `actionsProtection` |
| `vocabulaire` | `definition`, `exemple`, `confusions: [{mot, explication}]` |
| `classique` | `sections: [{titre, texte}]` |

Tous les champs de `details` sont optionnels — mets juste ceux que tu as.

### Champs « Approfondir » communs à tous les types

Ces champs s'ajoutent à ceux du type et s'affichent après eux :

| champ | contenu |
|---|---|
| `sections` | `[{titre, texte}]` — paragraphes détaillés (pour `classique`, ce sont les sections principales) |
| `chiffres` | `[{valeur, label}]` — affichés en tuiles « En chiffres » |
| `anecdotes` | `[string]` — rubrique « Le saviez-vous ? » |
| `wikipedia` | titre exact de l'article fr.wikipedia (ex. `"Jules César"`) → lien direct ; sinon, lien de recherche sur le titre de la fiche |
Si `details` est vide ou absent, le bouton "Approfondir" n'apparaît pas.

## Format d'une question de quiz

```json
{
  "id": "q-histoire-042",
  "domain": "histoire",
  "format": "qcm",
  "explication": "Affiché après la réponse.",
  "source": "À vérifier"
}
```

### Champs spécifiques par `format`

| format | champs |
|---|---|
| `qcm` / `difference` | `question`, `choix: [string]`, `bonneReponse` (index 0-based) |
| `vrai-faux` | `affirmation`, `reponse` (`true`/`false`) |
| `associer` | `question` (optionnel), `paires: [{gauche, droite}]` (3-6) |
| `frise` | `question` (optionnel), `evenements: [{label, annee}]` (4-6). `annee` doit être lisible par `parseFloat` → utilise des négatifs pour l'avant J.-C. (`"-776"`). |
| `qui-suis-je` | `indices: [string]` (4-6, **du plus difficile au plus facile**), `reponse` (texte exact, la comparaison tolère accents/casse/petites fautes) |

## Règle absolue

**Aucun contenu, question ou exemple sur les araignées/arachnides** (scorpions, tiques,
acariens...), dans aucun domaine, y compris en filigrane (mythologie, fiction,
exemples de classification zoologique). C'est une phobie réelle — à vérifier
toi-même si tu relis un lot généré par une IA.

## Après avoir ajouté un lot

Rien à reconstruire : recharge juste l'appli avec le réseau actif une fois
(le service worker mettra le nouveau JSON en cache automatiquement pour l'usage
hors-ligne suivant). Vérifie juste que le JSON est valide (pas de virgule finale,
guillemets doubles) — un fichier invalide est ignoré silencieusement (= 0 fiche
pour ce domaine), donc si un domaine semble vide après un ajout, c'est le premier
réflexe à avoir.

## Exemple de prompt pour générer un lot

> Génère 20 fiches JSON pour le domaine "philosophie", sous-thème "Philosophie
> antique", en respectant exactement le schéma décrit dans CONTENU.md de ce
> projet (types personnage/vocabulaire/classique, champ source, règle sur les
> araignées). Retourne uniquement le tableau JSON, prêt à coller dans
> data/fiches/philosophie.json (en fusionnant avec l'existant).
