# 📋 Avant de Publier sur GitHub

## ✅ Checklist Finale

- [x] Code complet et fonctionnel
- [x] `render.yaml` configuré pour deploy button
- [x] `README.md` avec instructions simples
- [x] `GUIDE_UTILISATEUR.md` style OVL
- [x] `.gitignore` propre

## 🚀 Publication GitHub

```bash
# 1. Créer repo sur GitHub (public)
# https://github.com/new

# 2. Commandes Git
git init
git add .
git commit -m "🤖 WBOT - WhatsApp Bot Release"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/WBOT.git
git push -u origin main
```

## 📢 Partage avec tes Utilisateurs

**Lien unique à partager :**
```
https://github.com/TON_USERNAME/WBOT
```

**Instructions pour eux :**
1. Visite https://wbot.netlify.app *(ton site)*
2. Connecte WhatsApp → Récupère SESSION_ID
3. Clique sur "Deploy to Render" button
4. Ajoute SESSION_ID
5. ✅ Bot en ligne !

## 🌐 Site Web (Netlify)

Déploie `web/` sur Netlify :
- Va sur netlify.com
- "Add new site" → "Deploy manually"
- Drag & drop le dossier `web/`
- ✅ Site en ligne !

Ou via GitHub :
- "Import from Git" → Sélectionne WBOT repo
- Build dir: `web`
- ✅ Auto-deploy activé !

---

✅ **Prêt pour la publication !**
