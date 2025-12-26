# 🚀 Guide de Déploiement WBOT

Ce guide vous accompagne pas à pas pour déployer votre bot WBOT avec interface web.

## Table des Matières
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Déploiement Local](#déploiement-local)
- [Déploiement Production](#déploiement-production)
- [Dépannage](#dépannage)

## Architecture

WBOT utilise une architecture à deux composants :

1.  **Frontend (Netlify)** : Interface web pour connecter WhatsApp
2.  **Backend (Render)** : Bot WhatsApp qui tourne 24/7

```
┌─────────────────┐        ┌──────────────────┐
│  WBOT Website   │◄──────►│  WBOT Bot API    │
│   (Netlify)     │  HTTP  │    (Render)      │
└─────────────────┘        └──────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │    WhatsApp     │
                            │  (Votre Phone)  │
                            └─────────────────┘
```

## Prérequis

- Compte GitHub
- Compte Netlify (gratuit)
- Compte Render (gratuit)
- Téléphone avec WhatsApp
- (Optionnel pour local) VPN si votre ISP bloque WhatsApp Web

## Déploiement Local

### 1. Installation

```bash
# Cloner le projet
git clone https://github.com/VOTRE_USERNAME/WBOT.git
cd WBOT

# Installer les dépendances
npm install
```

###2. Première Connexion

```bash
# Démarrer en mode API
npm start
```

Le serveur démarre sur `http://localhost:3000`

### 3. Générer SESSION_ID

1.  Ouvrez votre navigateur : `http://localhost:3000`
2.  Entrez votre numéro WhatsApp (format international, ex: `22963062969`)
3.  Choisissez "Code de Pairage"
4.  Un code à 8 chiffres s'affiche
5.  Sur votre téléphone :
    - WhatsApp → Paramètres → Appareils connectés
    - Tap "Connecter un appareil"
    - Choisissez "Connecter avec le numéro de téléphone"
    - Entrez le code
6.  ✅ Connexion réussie ! Vérifiez votre WhatsApp pour le message de configuration

### 4. Configuration Locale

Créez un fichier `.env` :

```env
SESSION_ID=WBOT_eyJjcmVkcy...  # Copiez depuis WhatsApp
OWNER_ID=22963062969            # Votre numéro
PREFIXE=.
NOM_OWNER=Luis-Orvann
```

Redémarrez :

```bash
npm start
```

Le bot devrait maintenant se connecter automatiquement !

## Déploiement Production

### Étape 1 : Préparer GitHub

```bash
# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit"

# Créer un repo sur GitHub, puis :
git remote add origin https://github.com/VOTRE_USERNAME/WBOT.git
git branch -M main
git push -u origin main
```

### Étape 2 : Déployer Frontend (Netlify)

1.  **Aller sur [Netlify](https://netlify.com)**
2.  **Cliquer "Add new site" → "Import an existing project"**
3.  **Connecter GitHub** et sélectionner votre repo WBOT
4.  **Configuration** :
    - Build command : *(laisser vide)*
    - Publish directory : `web`
    - Netlify détecte automatiquement `netlify.toml`
5.  **Déployer !**
6.  **Noter l'URL** : `https://votre-site.netlify.app`

### Étape 3 : Configurer le Frontend

1.  Ouvrir `web/app.js`
2.  Ligne 2, remplacer :
    ```javascript
    const API_BASE_URL = 'https://votre-app-render.onrender.com/api';
    ```
    *(Vous aurez cette URL à l'étape 5)*
3.  Commit et push :
    ```bash
    git add web/app.js
    git commit -m "Update API URL"
    git push
    ```

### Étape 4 : Déployer Backend (Render)

1.  **Aller sur [Render](https://render.com)**
2.  **Cliquer "New" → "Web Service"**
3.  **Connecter GitHub** et sélectionner WBOT
4.  **Configuration** :
    - Name : `wbot-bot` (ou autre)
    - Region : `Frankfurt` (ou le plus proche)
    - Branch : `main`
    - Build Command : *(vide, Docker utilisé)*
    - Start Command : *(vide, Docker utilisé)*
5.  **Environment Variables** :
    - `SESSION_ID` : *(laisser vide pour l'instant)*
    - `OWNER_ID` : Votre numéro
    - `PREFIXE` : `.`
    - `NOM_OWNER` : Votre nom
6.  **Create Web Service**

### Étape 5 : Première Connexion sur Render

1.  Une fois déployé, copier l'URL : `https://votre-app.onrender.com`
2.  Mettre à jour `web/app.js` avec cette URL (voir Étape 3)
3.  Aller sur votre site Netlify : `https://votre-site.netlify.app`
4.  Suivre le flow de connexion (numéro → code de pairage → WhatsApp)
5.  Récupérer le `SESSION_ID` du message WhatsApp

### Étape 6 : Finaliser Render

1.  Aller sur Render → Votre service → Environment
2.  Modifier `SESSION_ID` : coller la valeur reçue
3.  Sauvegarder → Render va redéployer automatiquement
4.  ✅ Votre bot est maintenant en ligne 24/7 !

## Vérification

Testez le bot :
1.  Envoyez `.help` sur WhatsApp au bot
2.  Vous devriez recevoir la liste des commandes
3.  Essayez `.ghost` pour activer le mode fantôme

## Dépannage

### Le bot ne répond pas

**Solution** : Vérifiez les logs Render
- Render Dashboard → Votre service → Logs
- Cherchez les erreurs

### Erreur "Session invalide"

**Solution** : Régénérez la session
1.  Supprimez `SESSION_ID` sur Render
2.  Redémarrez le service
3.  Reconnectez-vous via le site web
4.  Ajoutez le nouveau `SESSION_ID`

### Frontend ne charge pas

**Solution** : Clear cache
- Netlify Dashboard → Deploys → Trigger deploy → Clear cache and deploy

### API_BASE_URL incorrect

**Solution** : Vérifiez `web/app.js` ligne 2
- L'URL doit pointer vers votre backend Render

## Pour vos 15 Utilisateurs

Chaque utilisateur doit :
1.  Forker votre repo GitHub
2.  Déployer sur Netlify (leur frontend)
3.  Déployer sur Render (leur bot)
4.  Générer leur propre `SESSION_ID`

Vous pouvez créer un tutoriel vidéo en suivant ce guide !

## Support

Des questions ? Contactez Luis-Orvann ou ouvrez une issue GitHub.

---

**Bon déploiement ! 🚀**
