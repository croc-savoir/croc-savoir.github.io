@echo off
rem Lance l'appli en local pour la tester (ordinateur ET telephone sur le meme Wi-Fi).
rem Double-clique sur ce fichier. Garde la fenetre noire ouverte pendant le test ; ferme-la pour arreter.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe ou introuvable. Installe-le depuis https://nodejs.org puis relance.
  pause
  exit /b 1
)
echo.
echo ===== Croc'Savoir : serveur de test =====
echo Sur ce PC : http://localhost:8765
echo Sur le telephone, tape l'adresse "Sur le telephone" affichee ci-dessous.
echo (Si Windows demande une autorisation reseau, clique sur Autoriser.)
echo.
start "" http://localhost:8765
node tools\serveur-local.js
pause
