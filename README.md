# WBOT - WhatsApp Bot Multi-Features

Bot WhatsApp multifonctionnel avec intelligence artificielle, téléchargement de médias, gestion de groupes et bien plus.

## 🚀 Fonctionnalités Principales

- **Anti-Delete** : Récupère les messages supprimés (texte + média)
- **Téléchargement** : YouTube, TikTok, Instagram, Facebook
- **IA Gemini** : Conversation et analyse d'images
- **Auto-Like Statuts** : Like automatique des statuts WhatsApp
- **Planification** : Programmation de messages
- **Confession Anonyme** : Messages anonymes dans les groupes
- **Voice Changer** : Modification d'effets vocaux

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Créez un fichier `.env` avec :

```env
SESSION_ID=your_session_id
OWNER_ID=22900000000
PREFIXE=.
NOM_OWNER=Admin
GEMINI_API_KEY=your_key_here
```

## 🔧 Démarrage

```bash
npm start
```

## 📝 Commandes Principales

- `.menu` - Afficher le menu
- `.dl <lien>` - Télécharger une vidéo
- `.gemini <question>` - Discuter avec l'IA
- `.save` - Sauvegarder un statut
- `.confess <message>` - Confession anonyme
- `.voice <effet>` - Modifier une voix

## 🌐 Déploiement Render

1. Fork ce repo
2. Créer un nouveau Web Service sur Render
3. Connecter votre repo
4. Ajouter les variables d'environnement
5. Déployer !

## 📄 Licence

MIT
