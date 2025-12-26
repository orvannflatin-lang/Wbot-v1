# Script de démarrage pour WBOT
Write-Host "🤖 Démarrage de WBOT..." -ForegroundColor Green
Write-Host ""

# Vérifier si node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Lancer le bot
Write-Host "🚀 Lancement du bot..." -ForegroundColor Cyan
Write-Host "📱 Le QR code va apparaître ci-dessous. Scannez-le avec WhatsApp!" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

node index.js

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "❌ Le bot s'est arrêté. Appuyez sur une touche pour fermer..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")




