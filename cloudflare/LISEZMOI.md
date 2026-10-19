# Rappel quotidien : mise en place du Worker Cloudflare

Le site reste sur GitHub Pages. Le Worker est un petit serveur sans page web, qui envoie la notification de midi.
Code : `worker.js` (à coller dans l'éditeur Cloudflare). Testé en local : chiffrement, signature, déclenchement à midi (heure d'été et d'hiver), retrait des téléphones désabonnés.

1. Compte Cloudflare gratuit (dash.cloudflare.com).
2. Workers & Pages → Create → Worker → « Hello World » → nom `croc-savoir-rappel` → Deploy → Edit code → tout remplacer par `worker.js` → Deploy.
3. Storage & databases → KV → Create → nom `croc-abonnements`.
4. Worker → Settings → Bindings → Add → KV namespace → variable `ABOS` → espace `croc-abonnements` → Deploy.
5. Worker → Settings → Triggers → Cron Triggers → Add → `0 10,11 * * *`.
6. Donner l'adresse `https://croc-savoir-rappel.<ton-sous-domaine>.workers.dev` : elle se met dans `js/notifs.js` (constante `API`), puis push.

Modifier l'heure ou le texte : `HEURE` et `MESSAGE` en haut de `worker.js`, puis recoller le code dans Cloudflare.
