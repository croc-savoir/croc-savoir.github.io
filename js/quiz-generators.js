/* ===================== Helpers de génération / correction de quiz ===================== */
const QuizGen = (() => {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalize(str) {
    return (str || '')
      .toString()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function fuzzyMatch(guess, answer) {
    const g = normalize(guess);
    const a = normalize(answer);
    if (!g) return false;
    if (g === a) return true;
    // petite faute de frappe sur la réponse complète
    if (levenshtein(g, a) <= Math.max(1, Math.floor(a.length * 0.15))) return true;
    // tolère un article ou mot manquant
    if (a.includes(g) && g.length >= Math.max(3, a.length - 3)) return true;
    // on répond souvent juste par le nom le plus connu ("Keynes" pour
    // "John Maynard Keynes") : ça compte si ça matche un mot significatif.
    const aTokens = a.split(' ').filter(t => t.length >= 3);
    const gTokens = g.split(' ').filter(t => t.length >= 3);
    const candidates = gTokens.length ? gTokens : [g];
    for (const tok of candidates) {
      for (const aTok of aTokens) {
        if (tok === aTok) return true;
        if (tok.length >= 3 && levenshtein(tok, aTok) <= (aTok.length > 5 ? 2 : 1)) return true;
      }
    }
    return false;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[m][n];
  }

  return { shuffle, normalize, fuzzyMatch };
})();
