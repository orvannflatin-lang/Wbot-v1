# 🤖 WBOT - Bot WhatsApp Multi-Fonctions

Bot WhatsApp avec sauvegarde vue unique, statuts, mode fantôme, téléchargeur vidéos et bien plus.

## ✨ Fonctionnalités

- 📸 **Sauvegarde Vues Uniques** - Récupérez les messages view-once
- 📱 **Téléchargement Statuts** - Sauvegardez les statuts WhatsApp
- 👻 **Mode Fantôme** - Lisez sans coches bleues
- 📹 **Téléchargeur Vidéos** - TikTok, Instagram, YouTube, etc.
- ⏰ **Programmation Statuts** - Publiez des statuts automatiquement
- 🗑️ **Anti-Suppression** - Récupérez les messages supprimés
- 🤖 **IA Gemini** - Intelligence artificielle intégrée

---

## 🚀 Déploiement Rapide (5 minutes)

### Étape 1: Obtenir votre SESSION_ID

1. **Aller sur:** https://wbotv1.netlify.app/
2. **Entrer** votre numéro WhatsApp (format international)
3. **Choisir** QR Code ou Pairing Code
4. **Se connecter** sur WhatsApp
5. **Recevoir** votre SESSION_ID automatiquement sur WhatsApp 📱

### Étape 2: Déployer votre Bot sur Render

1. **Aller sur** https://render.com et se connecter (gratuit)
2. **Cliquer** "New +" → "Web Service"
3. **Sélectionner** "Public Git repository"
4. **Coller** cette URL:
   ```
   https://github.com/VOTRE_USERNAME/WBOT
   ```
5. **Configuration:**
   - Name: `mon-wbot` (ou autre)
   - Environment: `Docker`
   - Plan: `Free`

6. **Ajouter les variables d'environnement:**
   ```
   SESSION_ID=WBOT_... (celui reçu sur WhatsApp)
   OWNER_ID=22963062969 (votre numéro)
   PREFIXE=.
   NOM_OWNER=VotreNom
   ```

7. **Cliquer** "Create Web Service"
8. **Attendre** 5-10 minutes
9. ✅ **Votre bot est en ligne 24/7 !**

---

## 📱 Commandes Disponibles

### Commandes de Base
- `.help` - Afficher l'aide
- `.ping` - Tester le bot

### Sauvegarde
- `.save` (répondre à vue unique) - Sauvegarder message view-once
- `.dlstatus` (répondre à statut) - Télécharger un statut

### Mode Fantôme
- `.ghost on` - Activer le mode fantôme
- `.ghost off` - Désactiver le mode fantôme

### Anti-Suppression
- `.antidelete all` - Activer pour tous les messages
- `.antidelete pm` - Activer pour messages privés uniquement
- `.antidelete gc` - Activer pour groupes uniquement
- `.antidelete status` - Activer pour statuts uniquement
- `.antidelete off` - Désactiver

### Téléchargeur
- `.dl <url>` - Télécharger vidéo (TikTok, Instagram, YouTube, etc.)

### Programmation
- `.schedule` - Programmer un statut (suivre les instructions)

### IA
- `.ai <question>` - Poser une question à l'IA Gemini

---

## 🔧 Configuration Avancée

### Variables d'Environnement

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `SESSION_ID` | Session WhatsApp encodée | ✅ Oui |
| `OWNER_ID` | Votre numéro WhatsApp | ✅ Oui |
| `PREFIXE` | Préfixe des commandes (défaut: `.`) | ❌ Non |
| `NOM_OWNER` | Votre nom | ❌ Non |
| `SUPABASE_URL` | URL Supabase (optionnel) | ❌ Non |
| `SUPABASE_ANON_KEY` | Clé Supabase (optionnel) | ❌ Non |

---

## ❓ FAQ

### Comment obtenir mon SESSION_ID ?
Allez sur https://wbotv1.netlify.app/, suivez les étapes, et vous le recevrez sur WhatsApp.

### Le bot ne répond pas ?
Vérifiez que votre `SESSION_ID` est correct et que le bot est bien déployé sur Render.

### Puis-je utiliser plusieurs bots ?
Oui ! Chaque utilisateur peut avoir son propre bot avec son propre SESSION_ID.

### C'est gratuit ?
Oui, complètement gratuit avec Render (plan Free).

---

## 🛠️ Support

Pour toute question ou problème, contactez le développeur.

---

## 📄 Licence

MIT License - Développé par Luis-Orvann

---

## 🎉 Profitez de WBOT !

Votre bot WhatsApp est maintenant prêt à l'emploi. Amusez-vous bien ! 🤖✨
