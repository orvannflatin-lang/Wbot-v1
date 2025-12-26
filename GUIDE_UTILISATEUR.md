# 🚀 WBOT - Déploiement en 3 Clics (Style OVL)

## ✨ Workflow Simple

1. 📱 **Visite le site** → Connecte WhatsApp → Récupère SESSION_ID
2. 🚀 **Va sur Render** → Déploie le repo GitHub → Ajoute SESSION_ID
3. ✅ **C'EST TOUT !**

---

## 📱 Étape 1 : Obtenir ton SESSION_ID

### 🌐 Visite le Site WBOT
👉 **https://wbot.netlify.app** *(ou ton URL)*

### 📞 Connecte WhatsApp
1. Entre ton numéro de téléphone
2. Choisis **"Code de Pairage"** ou **"QR Code"**
3. Connecte sur WhatsApp
4. ✅ **Tu reçois un message WhatsApp** avec ton SESSION_ID

### 📋 Copie ton SESSION_ID
Le message WhatsApp contient :
```
SESSION_ID=WBOT_eyJjcmVkcy...
OWNER_ID=22963062969
PREFIXE=.
NOM_OWNER=Luis-Orvann
```

**Copie tout ça quelque part !**

---

## 🚀 Étape 2 : Déployer sur Render

### 1️⃣ Va sur Render
👉 **[render.com](https://render.com)** → Connecte-toi (gratuit)

### 2️⃣ Click "New +" → "Web Service"

### 3️⃣ Configuration Rapide

**Public Git Repository :**
```
https://github.com/TON_USERNAME/WBOT
```

**Paramètres :**
- Name : `wbot-bot` (ou ce que tu veux)
- Region : **Frankfurt** (ou le plus proche)
- Branch : `main`
- Build/Start Command : *(laisser vide - Docker auto)*

### 4️⃣ Variables d'Environnement

Clique **"Add Environment Variable"** et ajoute :

| Clé | Valeur |
|-----|--------|
| `SESSION_ID` | `WBOT_eyJjcmVkcy...` *(colle depuis WhatsApp)* |
| `OWNER_ID` | `22963062969` *(ton numéro)* |
| `PREFIXE` | `.` |
| `NOM_OWNER` | `Ton Nom` |

### 5️⃣ Déployer !

**Click "Create Web Service"**

⏰ Attends 5-10 minutes...

✅ **Bot en ligne !**

---

## ✅ Vérification

Envoie `.help` sur WhatsApp → Le bot répond !

---

## 🎯 Commandes du Bot

| Commande | Description |
|----------|-------------|
| `.help` | Liste des commandes |
| `.ghost` | Mode fantôme ON/OFF |
| `.save` | Sauvegarder view-once *(réponds au message)* |
| `.dlstatus` | Télécharger statut *(réponds au statut)* |
| `.dl [url]` | Télécharger vidéo |
| `.schedule` | Programmer statut |

---

## ⚠️ Problèmes ?

### Bot ne répond pas
- Vérifie `SESSION_ID` sur Render
- Regarde les **Logs** sur Render

### SESSION_ID invalide
- Retourne sur le site web
- Reconnecte WhatsApp
- Copie le nouveau SESSION_ID

### Bot déconnecté
- Sur Render : Environment → Vérifie SESSION_ID
- Redéploie si besoin

---

## 📞 Support

Questions ? **Luis-Orvann** · GitHub Issues

---

✅ **C'est tout ! Profite de ton bot 24/7 !** 🤖
