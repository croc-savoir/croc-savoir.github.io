/* ===================== style-toggle.js =====================
 * Bouton « Style » en bas de l'accueil : bascule entre le mode néon (par défaut) et le mode cartoon.
 * Le choix est gardé sur l'appareil. La classe « style-cartoon » est posée sur <html> très tôt
 * (petit script dans <head> de index.html) pour éviter un clignotement au démarrage.
 * Pour retirer ce mode : supprimer ce fichier, css/cartoon.css et leurs lignes dans index.html.
 * ========================================================= */
(() => {
  const KEY = 'croc-style';
  const root = document.documentElement;
  const btn = document.getElementById('btn-style');
  if (!btn) return;
  const isCartoon = () => root.classList.contains('style-cartoon');
  const label = () => {
    btn.textContent = isCartoon() ? '🎨 Style cartoon · passer au néon' : '🎨 Style néon · passer au cartoon';
    btn.setAttribute('aria-pressed', isCartoon() ? 'true' : 'false');
  };
  btn.addEventListener('click', () => {
    root.classList.toggle('style-cartoon');
    try { localStorage.setItem(KEY, isCartoon() ? 'cartoon' : 'neon'); } catch (e) { /* stockage indisponible */ }
    label();
    if (window.App && App.toast) App.toast(isCartoon() ? 'Style cartoon activé' : 'Style néon activé');
  });
  label();
})();
