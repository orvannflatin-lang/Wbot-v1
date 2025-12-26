# 🧪 Guide de Test WBOT

Ce guide vous aide à tester toutes les fonctionnalités du bot une fois connecté à WhatsApp.

## Prérequis
- Bot WBOT démarré et connecté à WhatsApp (QR code scanné)
- WhatsApp installé sur votre téléphone principal
- Un deuxième téléphone ou compte WhatsApp pour tester

---

## ✅ Test 1: Vérification de Connexion

**Commande:** `.ping`

**Résultat attendu:**
```
🏓 Pong!
```

**Si ça ne marche pas:**
- Vérifiez que le bot est démarré (voir le terminal)
- Vérifiez le préfixe (par défaut: `.`)

---

## ✅ Test 2: Aide et Configuration

**Commande:** `.help`

**Résultat attendu:**
Le bot affiche la liste complète des commandes disponibles.

**Commande:** `.status`

**Résultat attendu:**
```
📊 *État du Bot WBOT*

👤 Utilisateur: 33xxxxxxx
⚙️ Préfixe: .
👻 Mode Fantôme: DÉSACTIVÉ ❌
🤖 Bot Version: 1.0.0
✅ Statut: En ligne
```

---

## ✅ Test 3: Sauvegarde Vue Unique (View Once) 🔒

### Étapes:
1. **Depuis un 2ème téléphone**, envoyez une photo **Vue unique** à votre numéro principal
2. Sur votre téléphone principal, vous recevrez la vue unique
3. **Répondez** (reply) à cette vue unique avec: `.save`

**Résultat attendu:**
- Confirmation: `✅ Vue unique sauvegardée et transférée dans votre messagerie!`
- Vous recevez la photo en **vue normale** dans votre chat
- La photo est sauvegardée dans `downloads/`

### Points de vérification:
- ✅ La vue unique a été capturée avant d'être vue
- ✅ La photo/vidéo est en qualité normale
- ✅ Le message contient les infos (De qui, Sauvegardée par qui)

---

## ✅ Test 4: Sauvegarde Statut WhatsApp 📸

### Étapes:
1. **Depuis un contact**, publiez un statut WhatsApp (photo, vidéo ou texte)
2. Allez voir ce statut
3. **Répondez** au statut avec: `.dlstatus`

**Résultat attendu:**
- Le statut est transféré dans votre messagerie personnelle
- Pour une photo/vidéo: vous recevez le média
- Pour du texte: vous recevez le texte
- Message contient: `📊 *Statut Sauvegardé*` avec les détails

### Points de vérification:
- ✅ Le média est de bonne qualité
- ✅ Le statut est bien sauvegardé dans `downloads/`

---

## ✅ Test 5: Mode Fantôme (Ghost Mode) 👻

### Activer le mode fantôme:
**Commande:** `.ghost on`

**Résultat attendu:**
```
👻 Mode Fantôme activé!

✅ Vous pouvez lire les messages sans coches bleues
✅ Vous voyez toujours qui vous lit
```

### Test du mode:
1. Demandez à un contact de vous envoyer un message
2. Lisez le message
3. Le contact **NE DOIT PAS** voir de coches bleues (seulement 2 coches grises)
4. Si quelqu'un lit votre message, **VOUS** voyez toujours ses coches bleues

### Désactiver:
**Commande:** `.ghost off`

**Résultat attendu:**
```
✅ Mode Fantôme désactivé.
```

### Points de vérification:
- ✅ Vos messages lus montrent seulement 2 coches grises
- ✅ Vous voyez toujours les coches bleues des autres

---

## ✅ Test 6: Téléchargeur Vidéos 📥

### Test TikTok:
**Commande:** `.dl https://www.tiktok.com/@username/video/1234567890`

**Résultat attendu:**
1. Message: `⏳ Téléchargement en cours...`
2. Vidéo téléchargée apparaît dans votre chat avec:
```
📥 *Vidéo Téléchargée*

🔗 Plateforme: TikTok
👤 Demandé par: @votre_numero
📝 Titre: [titre de la vidéo]
⏰ 25/12/2025 23:45:00
```

### Plateformes à tester:
- ✅ TikTok (100% fonctionnel)
- ⏸️ Instagram (API à configurer)
- ⏸️ YouTube (API à configurer)
- ⏸️ Facebook (API à configurer)

### Points de vérification:
- ✅ Vidéo téléchargée sans watermark (si possible)
- ✅ Qualité correcte
- ✅ Vidéo sauvegardée dans `downloads/`

---

## ✅ Test 7: Planificateur de Statuts ⏰

### Programmer un statut:
**Commande:** `.schedule 2025-12-26 14:30 Joyeux Noël ! 🎄`

**Résultat attendu:**
```
⏰ *Statut Programmé*

📅 Date: 26/12/2025
🕐 Heure: 14:30:00
📝 Contenu: Joyeux Noël ! 🎄
```

### Vérification:
1. Le statut est enregistré en base de données
2. À l'heure programmée (14:30), le statut est **automatiquement posté**
3. Vous recevez une confirmation: `✅ Votre statut programmé a été publié avec succès!`

### Points de vérification:
- ✅ Le statut est posté à l'heure exacte
- ✅ Le statut apparaît dans vos statuts WhatsApp
- ✅ Fonctionne même si vous n'êtes pas connecté au moment de la publication

---

## ✅ Test 8: Changement de Préfixe

**Commande:** `.setprefix !`

**Résultat attendu:**
```
✅ Préfixe changé en: !

Exemple: !help
```

### Test avec nouveau préfixe:
**Commande:** `!help`

Le bot doit répondre normalement.

### Revenir au préfixe par défaut:
**Commande:** `!setprefix .`

---

## 📊 Checklist de Test Complet

- [ ] ✅ Test 1: Ping (`.ping`)
- [ ] ✅ Test 2: Help (`.help`)
- [ ] ✅ Test 2: Status (`.status`)
- [ ] ✅ Test 3: Vue Unique (`.save` en reply)
- [ ] ✅ Test 4: Statut (`.dlstatus` en reply)
- [ ] ✅ Test 5: Ghost ON (`.ghost on`)
- [ ] ✅ Test 5: Ghost OFF (`.ghost off`)
- [ ] ✅ Test 6: Download TikTok (`.dl <lien>`)
- [ ] ✅ Test 7: Schedule (`.schedule YYYY-MM-DD HH:MM texte`)
- [ ] ✅ Test 8: Préfixe (`.setprefix !`)

---

## 🐛 Signaler un Bug

Si un test échoue:
1. Notez le message d'erreur dans le terminal
2. Vérifiez `TROUBLESHOOTING.md`
3. Consultez les logs du bot

---

## 🎉 Tous les Tests Réussis ?

Félicitations ! WBOT fonctionne parfaitement.

**Prochaine étape:** Intégrer WBOT à votre interface graphique !

Pour l'intégration:
- Le bot fonctionne de manière autonome
- Utilisez l'API ou intégrez directement le code
- La base de données SQLite (`wbot.db`) stocke toute la configuration

---

**Bon test ! 🚀**
