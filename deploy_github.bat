@echo off
echo 🚀 PREPARATION DU DEPLOIEMENT GITHUB...
echo ---------------------------------------

:: Initialiser Git si nécessaire
if not exist .git (
    git init
    echo ✅ Git Initialisé
)

:: Ajouter tous les fichiers
git add .
echo ✅ Fichiers ajoutés

:: Commit
git commit -m "🚀 Deployment V1 (Render Ready) - Logic via Agent"
echo ✅ Commit effectué

:: Branch main
git branch -M main

:: Remote
git remote remove origin 2>nul
git remote add origin https://github.com/orvannflatin-lang/Wbot-v1.git
echo ✅ Remote configuré: https://github.com/orvannflatin-lang/Wbot-v1.git

:: Push
echo.
echo 📤 PUSH VERS GITHUB EN COURS...
echo (Une fenêtre de connexion peut s'ouvrir)
echo.
git push -u origin main

echo.
echo ---------------------------------------
echo ✅ TERMINE ! Si le push a réussi, allez sur Render.
pause
