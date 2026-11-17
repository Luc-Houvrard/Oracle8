# 🎱 Oracle8

Oracle8 est une boule magique en ligne : tu poses une question et la boule te répond au hasard.

Projet full-stack : **React + TypeScript** pour le front, **Node.js + Express + TypeScript** pour le back, **MySQL** pour la base de données.

## ✨ Fonctionnalités

- Inscription et connexion (mots de passe hachés avec **bcrypt**, authentification par **JWT**)
- Questions à la boule avec une réponse tirée au hasard
- Secousse de la boule réglable (activation, intensité, vitesse, durée)
- Raccourcis clavier
- Historique des questions
- Administration : gestion des réponses de la boule et des utilisateurs (rôle `admin`)
- Gestion des accents et des emojis (UTF-8 / `utf8mb4`)

## 🛠️ Technologies

| Partie   | Technologies                                    |
|----------|-------------------------------------------------|
| Frontend | React, TypeScript, Vite                         |
| Backend  | Node.js, Express, TypeScript, tsx               |
| Base     | MySQL (mysql2)                                  |
| Sécurité | bcrypt, jsonwebtoken, dotenv, cors              |

## 📁 Structure

```
Oracle8/
├── backend/
│   ├── database/
│   │   ├── schema.sql      # Création des tables
│   │   ├── migration_001_role.sql  # Ajout du rôle sur une base existante
│   │   └── seed.sql        # Réponses de départ de la boule
│   ├── src/
│   │   ├── index.ts        # Serveur Express et routes
│   │   └── db.ts           # Connexion MySQL
│   ├── .env                # Variables d'environnement (non versionné)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Connexion et boule
│   │   ├── Admin.tsx       # Page d'administration
│   │   └── App.css
│   └── package.json
└── readme.md
```

## ✅ Prérequis

- [Node.js](https://nodejs.org/) v20 ou plus
- MySQL (ou WAMP, XAMPP, etc.)
- Git

## 🐳 Lancement rapide avec Docker

Une seule commande lance la base, le backend et le frontend :

```bash
cp .env.example .env      # puis remplis DB_PASSWORD et JWT_SECRET
sudo docker compose up -d --build
```

Ouvre ensuite http://localhost:8080. Pour mettre l'application en ligne sur un serveur (HTTPS, sauvegardes, mises à jour), voir [`docs/deploiement.md`](docs/deploiement.md).

Les tests tournent automatiquement sur GitHub à chaque push (onglet **Actions**), et en local avec `cd backend && npm test` (voir [`backend/test/README.md`](backend/test/README.md)).

## 🚀 Installation sans Docker

### 1. Cloner le projet

```bash
git clone https://github.com/Luc-Houvrard/Oracle8.git
cd Oracle8
```

### 2. Base de données

Crée la base :

```sql
CREATE DATABASE oracle8 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Importe ensuite le schéma, puis les réponses de départ.

Dans PowerShell :

```powershell
Get-Content backend/database/schema.sql | mysql -u root -p oracle8
Get-Content backend/database/seed.sql | mysql -u root -p oracle8
```

Sous Linux ou macOS :

```bash
mysql -u root -p oracle8 < backend/database/schema.sql
mysql -u root -p oracle8 < backend/database/seed.sql
```

> ⚠️ `schema.sql` supprime les tables existantes avant de les recréer : le réimporter efface les comptes et les questions.

Sans `seed.sql`, la table `reponse` est vide et la boule ne peut pas répondre. Tu peux aussi y ajouter tes propres réponses :

```sql
INSERT INTO reponse (texte) VALUES ('Oui.'), ('Non.'), ('Redemande plus tard.');
```

### 3. Backend

```bash
cd backend
npm install
```

Crée le fichier `backend/.env` à partir du modèle, puis remplis au moins `JWT_SECRET` (la commande pour le générer est dans le fichier) :

```bash
cp .env.example .env
```

| Variable | Rôle | Par défaut |
|---|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connexion à MySQL | — |
| `JWT_SECRET` | Clé qui signe les tokens (**obligatoire**, secrète) | — |
| `PORT` | Port du backend | `3000` |
| `CORS_ORIGIN` | Adresse du frontend autorisée, sans `/` final | `http://localhost:5173` |
| `LIMITE_TENTATIVES` | Tentatives par quart d'heure et par IP (mettre `1000` pour les tests) | `10` |
| `ADMIN_PSEUDO`, `ADMIN_MOTDEPASSE` | Compte admin créé au démarrage s'il n'existe pas (un compte existant n'est jamais modifié) | aucun |

Le backend ne lit `.env` qu'au démarrage : redémarre-le après chaque modification.

Lance le serveur :

```bash
npm run dev
```

Le serveur tourne sur http://localhost:3000. Tu peux le vérifier sur http://localhost:3000/api/health.

### 4. Frontend

Le frontend appelle le backend sur `http://localhost:3000`. Pour une autre adresse, copie `frontend/.env.example` en `frontend/.env` et change `VITE_API_URL`. Cette valeur est visible par tous les visiteurs : jamais de secret dedans.

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Ouvre ensuite http://localhost:5173.

## 🛡️ Administration

Un compte a le rôle `user` par défaut. Il n'existe volontairement aucune route pour se donner le rôle `admin` : il s'attribue directement en base.

```sql
UPDATE utilisateur SET role = 'admin' WHERE pseudo = 'ton_pseudo';
```

Reconnecte-toi ensuite : le lien **Administration** apparaît en haut de la page. Un administrateur peut :

- ajouter, modifier et supprimer les réponses de la boule (une réponse déjà présente dans l'historique ne peut qu'être modifiée) ;
- voir la liste des utilisateurs et supprimer un compte, avec ses questions (pas le sien).

Si ta base a été créée avant l'ajout de l'administration, ajoute la colonne `role` sans perdre tes données :

```bash
mysql -u root -p oracle8 < backend/database/migration_001_role.sql
```

## 🔌 Routes de l'API

| Méthode | Route            | Auth | Description                         |
|---------|------------------|------|-------------------------------------|
| GET     | `/api/health`    | ❌   | Vérifie que le serveur tourne       |
| GET     | `/api/reponses`  | ❌   | Liste les réponses de la boule      |
| POST    | `/api/register`  | ❌   | Inscription `{ pseudo, motdepasse }`|
| POST    | `/api/login`     | ❌   | Connexion, renvoie un token JWT     |
| POST    | `/api/questions` | ✅   | Pose une question `{ texte }`       |
| GET     | `/api/questions` | ✅   | Historique : tes 50 dernières questions |
| POST    | `/api/admin/reponses` | 🛡️ | Ajoute une réponse `{ texte }` |
| PUT     | `/api/admin/reponses/:id` | 🛡️ | Modifie une réponse `{ texte }` |
| DELETE  | `/api/admin/reponses/:id` | 🛡️ | Supprime une réponse (`409` si elle est dans l'historique) |
| GET     | `/api/admin/utilisateurs` | 🛡️ | Liste les utilisateurs et leur nombre de questions |
| DELETE  | `/api/admin/utilisateurs/:id` | 🛡️ | Supprime un utilisateur et ses questions |

🛡️ = token d'un compte `admin` obligatoire (`401` sans token, `403` sans le rôle).

Les routes protégées demandent cet en-tête : `Authorization: Bearer <token>`. Le token expire au bout de 2 heures.

Limites des champs (au-delà, l'API répond `400`) :

- `pseudo` : 1 à 50 caractères
- `motdepasse` : 8 caractères minimum, 72 octets maximum
- `texte` d'une question : 1 à 500 caractères
- `texte` d'une réponse : 1 à 40 caractères (au-delà, le texte déborde de la boule)

## 🗄️ Modèle de données

- **utilisateur** (`Id_utilisateur`, `pseudo` unique, `motdepasse` haché, `role` : `user` ou `admin`)
- **reponse** (`Id_Reponse`, `texte`)
- **question** (`Id_question`, `texte`, `Id_Reponse` → reponse, `Id_utilisateur` → utilisateur)

## 👤 Auteur

Luc Houvrard