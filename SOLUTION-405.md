# 🔧 Solution Erreur 405 - Connection Failure

## 📋 Étapes à suivre (dans l'ordre)

### 1️⃣ **Ouvrir PowerShell en Administrateur**
- Clic droit sur PowerShell → "Exécuter en tant qu'administrateur"

### 2️⃣ **Exécuter le script de diagnostic**
```powershell
cd C:\Users\Administrateur\Desktop\WBOT
.\fix-connection.ps1
```

Ce script va :
- ✅ Arrêter les processus Node.js actifs
- ✅ Nettoyer les sessions
- ✅ Vérifier le pare-feu
- ✅ Tester la connexion
- ✅ Ajouter une exception au pare-feu si nécessaire

### 3️⃣ **Tester avec la config minimale**
```powershell
node test-minimal.js
```

Si le QR code apparaît → Le problème vient de la config du bot principal
Si l'erreur 405 persiste → Problème réseau/antivirus

### 4️⃣ **Si l'erreur persiste - Solutions avancées**

#### A. Désactiver temporairement l'antivirus
- Windows Defender : Paramètres → Sécurité → Protection contre les virus → Désactiver temporairement
- Autres antivirus : Cherchez dans les paramètres

#### B. Utiliser un VPN
- Activez un VPN (comme ProtonVPN, NordVPN, etc.)
- Relancez le bot

#### C. Utiliser le partage de connexion téléphone
- Partagez la connexion 4G/5G de votre téléphone
- Connectez l'ordinateur à ce réseau
- Relancez le bot

#### D. Vérifier les DNS
```powershell
# Dans PowerShell en Administrateur
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "8.8.8.8","8.8.4.4"
```

#### E. Tester avec OVL
```powershell
cd C:\Users\Administrateur\Desktop\WBOT\OVL-MD-V2-main\OVL-MD-V2-main
npm install
node Ovl.js
```

Si OVL fonctionne mais pas WBOT → Problème de configuration Baileys
Si OVL ne fonctionne pas non plus → Problème réseau global

### 5️⃣ **Si OVL fonctionne**
Cela signifie que la connexion est possible, mais que notre configuration WBOT a un problème.
Dans ce cas, contactez-moi et je modifierai la configuration pour qu'elle corresponde à celle d'OVL.

---

## 🆘 Résumé Rapide

1. **PowerShell Admin** → `.\fix-connection.ps1`
2. **Tester** → `node test-minimal.js`
3. **Si erreur** → VPN ou réseau 4G
4. **Si toujours erreur** → Tester OVL

---

**Note importante :** L'erreur 405 signifie que la connexion WebSocket à WhatsApp est bloquée. Puisque WhatsApp Web fonctionne dans votre navigateur, le problème vient probablement d'un blocage spécifique pour Node.js (antivirus, pare-feu, proxy).




