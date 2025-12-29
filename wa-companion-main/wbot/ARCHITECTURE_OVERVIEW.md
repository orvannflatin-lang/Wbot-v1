# Vue d'ensemble de l'Architecture du Projet AMDA

## 1. Introduction
Ce document décrit l'architecture technique du projet **AMDA (Assistant WhatsApp Multifonctions)**. Il s'agit d'une application "Companion" qui permet de gérer et d'étendre les fonctionnalités d'un bot WhatsApp via une interface web moderne.

## 2. Structure Globale
Le projet est organisé sous forme de **monorepo** (ou structure hybride) contenant à la fois le frontend et le backend :

- **Racine (`wbot/`)** : Contient le Frontend (client web).
- **Backend (`wbot/backend/`)** : Contient l'API serveur et le Bot WhatsApp.

## 3. Composants Détaillés

### A. Frontend (Interface Utilisateur)
- **Technologie** : React avec Vite.
- **UI Framework** : Shadcn UI (basé sur Radix UI et Tailwind CSS) pour un design moderne et responsive.
- **PWA (Progressive Web App)** : Configuré via `vite-plugin-pwa` pour être installable sur mobile.
- **État & API** : Utilise `@tanstack/react-query` pour la gestion de l'état serveur et des appels API optimisés.
- **Rôle** :
    - Permet à l'utilisateur de scanner le QR Code pour connecter le bot.
    - Affiche le tableau de bord (statistiques, statuts, logs).
    - Permet de configurer les fonctionnalités (Mode Fantôme, Sauvegarde de statuts, etc.).
- **Point d'entrée** : `src/main.tsx` -> `src/App.tsx`.
- **Configuration API** : `src/lib/api.ts` gère la communication avec le backend (URL prod: `https://amda-backend-3aji.onrender.com`).

### B. Backend (Serveur & Bot)
- **Technologie** : Node.js avec TypeScript.
- **Framework Web** : Express.js pour servir l'API REST.
- **WhatsApp Engine** : `@whiskeysockets/baileys` pour la connexion au protocole WhatsApp Web.
- **Base de Données** : Supabase (PostgreSQL) via `@supabase/supabase-js`.
- **Cache / Session** : Redis (pour stocker l'état d'authentification WhatsApp et les sessions).
- **Stockage Média** : Cloudinary (pour stocker les images/vidéos des statuts et messages sauvegardés).
- **Notifications** : Firebase Admin SDK (pour envoyer des push notifications au frontend).
- **Tâches de fond** : `node-cron` et `bull` pour les tâches planifiées (ex: nettoyage, publication automatique).
- **Point d'entrée** : `backend/src/server.ts`.

## 4. Flux de Données Principal

1.  **Connexion** :
    - Le Frontend demande un QR Code à l'API (`/api/whatsapp/qr`).
    - Le Backend (Baileys) génère le QR.
    - L'utilisateur scanne via WhatsApp.
    - La session est établie et sauvegardée dans Redis/Supabase.

2.  **Gestion des Messages (Le "Cerveau")** :
    - Le Bot écoute les événements WhatsApp (nouveau message, statut, message supprimé).
    - **Mode Fantôme** : Si activé, le bot ne renvoie pas l'acquittement de lecture "Blue Tick", mais enregistre le message.
    - **Anti-Delete** : Si un message est révoqué (`protocolMessage`), le bot récupère le contenu original stocké en mémoire/cache et le sauvegarde en base de données ou le renvoie à l'utilisateur.

3.  **Statuts** :
    - Le bot détecte les nouveaux statuts.
    - Si configuré, il télécharge le média, l'upload sur Cloudinary, et enregistre l'entrée dans Supabase.
    - Le Frontend récupère cette liste via l'API pour affichage.

## 5. Déploiement
- Le projet est configuré pour être déployé sur **Render**.
- **Containerisation** : Utilise `Dockerfile` pour construire l'environnement Node.js complet.
- **Variables d'Environnement** : Gérées via `.env` (API Keys, URLs DB, etc.).

## 6. Comment Démarrer (Local)
Pour travailler sur le projet :

1.  **Frontend** :
    ```bash
    cd wbot
    npm run dev
    # Lance Vite (généralement http://localhost:8080)
    ```

2.  **Backend** :
    ```bash
    cd wbot/backend
    npm run dev
    # Lance Nodemon + ts-node (généralement http://localhost:3000)
    ```

*Note : Assurez-vous que les variables d'environnement (Supabase, Redis, Cloudinary) sont correctement configurées dans `wbot/backend/.env`.*
