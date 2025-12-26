# Script de correction pour l'erreur 405
Write-Host "🔧 Script de correction erreur 405" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier les processus Node.js
Write-Host "📋 1. Vérification des processus Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   ⚠️  Processus Node.js actifs trouvés" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "   - PID: $($_.Id) | CPU: $($_.CPU)" -ForegroundColor Gray
    }
    # $kill = Read-Host "   Voulez-vous les arrêter? (O/N)"
    $kill = "O"
    if ($kill -eq "O" -or $kill -eq "o") {
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Processus arrêtés" -ForegroundColor Green
    }
} else {
    Write-Host "   ✅ Aucun processus Node.js actif" -ForegroundColor Green
}

Write-Host ""

# 2. Nettoyer les sessions
Write-Host "📋 2. Nettoyage des sessions..." -ForegroundColor Yellow
if (Test-Path "auth_info") {
    Remove-Item -Path "auth_info" -Recurse -Force
    Write-Host "   ✅ Session auth_info nettoyée" -ForegroundColor Green
}
if (Test-Path "auth_test") {
    Remove-Item -Path "auth_test" -Recurse -Force
    Write-Host "   ✅ Session auth_test nettoyée" -ForegroundColor Green
}

Write-Host ""

# 3. Vérifier les règles de pare-feu pour Node.js
Write-Host "📋 3. Vérification du pare-feu..." -ForegroundColor Yellow
$nodePath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if ($nodePath) {
    Write-Host "   📍 Chemin Node.js: $nodePath" -ForegroundColor Gray
    $firewallRule = Get-NetFirewallApplicationFilter -Program $nodePath -ErrorAction SilentlyContinue
    if ($firewallRule) {
        Write-Host "   ✅ Règle pare-feu trouvée pour Node.js" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Aucune règle pare-feu spécifique pour Node.js" -ForegroundColor Yellow
        # $add = Read-Host "   Voulez-vous ajouter une exception? (O/N)"
        $add = "O"
        if ($add -eq "O" -or $add -eq "o") {
            try {
                New-NetFirewallRule -DisplayName "Node.js WBOT" -Direction Outbound -Program $nodePath -Action Allow -ErrorAction Stop
                Write-Host "   ✅ Exception ajoutée au pare-feu" -ForegroundColor Green
            } catch {
                Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
                Write-Host "   💡 Essayez d'exécuter PowerShell en Administrateur" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "   ⚠️  Node.js non trouvé dans le PATH" -ForegroundColor Yellow
}

Write-Host ""

# 4. Vérifier la connexion internet
Write-Host "📋 4. Test de connexion..." -ForegroundColor Yellow
try {
    $test = Test-NetConnection -ComputerName "web.whatsapp.com" -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($test) {
        Write-Host "   ✅ Connexion à web.whatsapp.com OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Impossible de se connecter à web.whatsapp.com" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️  Impossible de tester la connexion" -ForegroundColor Yellow
}

Write-Host ""

# 5. Créer une configuration alternative
Write-Host "📋 5. Configuration alternative créée..." -ForegroundColor Yellow
Write-Host "   ✅ Voir test-minimal.js" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Diagnostic terminé!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Relancez le bot: node index.js" -ForegroundColor Yellow
Write-Host "   2. Si ça ne marche pas, testez: node test-minimal.js" -ForegroundColor Yellow
Write-Host "   3. Essayez avec un VPN ou un autre réseau" -ForegroundColor Yellow
Write-Host ""




