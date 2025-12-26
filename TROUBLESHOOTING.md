# 🛠️ Guide de Dépannage WBOT

## ❌ Erreur 405 - Connection Failure

### Symptômes
```
❌ Connexion fermée
   Code erreur: 405
   Message: Connection Failure
```

### Causes Possibles

1. **Pare-feu / Antivirus**
   - Votre pare-feu bloque la connexion aux serveurs WhatsApp
   - Solution: Désactivez temporairement le pare-feu Windows ou ajoutez une exception pour Node.js

2. **Connexion Internet**
   - Problème de connexion réseau
   - Solution: Vérifiez votre connexion internet

3. **VPN/Proxy**
   - Un VPN/Proxy peut bloquer WhatsApp Web
   - Solution: Désactivez votre VPN

4. **Restrictions Réseau**
   - Votre réseau (entreprise, école) bloque WhatsApp
   - Solution: Utilisez un autre réseau

### Solutions à Essayer

#### Solution 1: Désactiver le Pare-feu Windows (Temporaire)
```powershell
# Ouvrir PowerShell en Administrateur et exécuter:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Relancer le bot:
npm start

# IMPORTANT: Réactiver après le test:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

#### Solution 2: Ajouter une Exception Pare-feu
```powershell
# PowerShell en Administrateur:
New-NetFirewallRule -DisplayName "Node.js WBOT" -Direction Outbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

#### Solution 3: Vérifier avec un Autre Bot
Testez si le problème vient de Baileys en essayant le bot OVL que vous avez déjà :
```bash
cd C:\Users\Administrateur\Desktop\WBOT\OVL-MD-V2-main\OVL-MD-V2-main
npm install
npm start
```
Si OVL fonctionne mais pas WBOT, c'est un problème de configuration Baileys.

#### Solution 4: Utiliser un Autre Réseau
- Partagez la connexion 4G/5G de votre téléphone
- Connectez-vous à un autre WiFi
- Utilisez un point d'accès mobile

#### Solution 5: Nettoyer et Relancer
```bash
cd C:\Users\Administrateur\Desktop\WBOT

# Supprimer l'ancien état d'authentification
Remove-Item -Recurse -Force auth_info

# Relancer
npm start
```

## ✅ Si le QR Code Apparaît

Une fois connecté, vous verrez:
```
📱 SCANNEZ CE QR CODE AVEC WHATSAPP:

█▀▀▀▀▀█ ▄▀ ▀▄ █▀▀▀▀▀█
█ ███ █ ██▄  ▄ █ ███ █
█ ▀▀▀ █ ▄█▀▄▄▀ █ ▀▀▀ █
...

✨ Instructions:
   1. Ouvrez WhatsApp sur votre téléphone
   2. Allez dans Paramètres > Appareils connectés
   3. Appuyez sur "Connecter un appareil"
   4. Scannez le QR code ci-dessus
```

## 📋 Tests à Effectuer Après Connexion

### 1. Test Commande Help
```
Envoyez dans votre chat WhatsApp:
.help
```
Vous devriez recevoir la liste des commandes.

### 2. Test Vue Unique (View Once)
1. Depuis un autre téléphone, envoyez-vous une photo en "Vue unique"
2. Répondez à cette photo avec: `.save`
3. Le bot devrait sauvegarder et vous renvoyer la photo en vue normale

### 3. Test Statut WhatsApp
1. Publiez un statut depuis un contact
2. Répondez à ce statut avec: `.dlstatus`
3. Le bot devrait vous transférer le statut

### 4. Test Mode Fantôme
```
.ghost on
```
Ensuite lisez des messages - les coches bleues ne devraient pas apparaître.

### 5. Test Téléchargement Vidéo
```
.dl https://www.tiktok.com/@user/video/1234567890
```

### 6. Test Planificateur
```
.schedule 2025-12-26 10:00 Test de statut programmé
```

## 🔍 Vérifier les Logs

Si un problème survient, consultez les messages d'erreur dans le terminal.

## 🆘 Problèmes Courants

### Le bot ne répond pas
- Vérifiez que vous utilisez le bon préfixe (`.` par défaut)
- Tapez `.status` pour voir l'état du bot

### Les vues uniques ne se sauvegardent pas
- Assurez-vous de répondre (reply) à la vue unique, pas d'envoyer un nouveau message
- Le préfixe doit être: `.save`

### Les vidéos ne se téléchargent pas
- TikTok est entièrement supporté
- Les autres plateformes peuvent nécessiter des APIs supplémentaires

## 📞 Support

- Documentation complète: `README.md`
- Code source: Dans `src/features/`
- Configuration: `.env`

---

**Astuce**: Une fois le bot connecté, il devrait rester stable. Le fichier d'authentification est dans `auth_info/`.
