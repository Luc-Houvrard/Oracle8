# 🎱 Oracle8

Oracle8 est une boule magique en ligne : tu poses une question et la boule te répond au hasard.

Projet full-stack : **React + TypeScript** pour le front, **Node.js + Express + TypeScript** pour le back, **MySQL** pour la base de données.

## ✨ Fonctionnalités

- Inscription et connexion (mots de passe hachés avec **bcrypt**, authentification par **JWT**)
- Questions à la boule avec une réponse tirée au hasard
- Secousse de la boule réglable (activation, intensité, vitesse, durée)
- Raccourcis clavier
- Historique des questions
- Gestion des accents et des emojis (UTF-8 / `utf8mb4`)

## 🛠️ Technologies

| Partie   | Technologies                                    |
|----------|-------------------------------------------------|
| Frontend | React, TypeScript, Vite                         |
| Backend  | Node.js, Express, TypeScript, ts-node-dev       |
| Base     | MySQL (mysql2)                                  |
| Sécurité | bcrypt, jsonwebtoken, dotenv, cors              |

## 📁 Structure

```
Oracle8/
├── backend/
│   ├── database/
│   │   └── schema.sql      # Création des tables
│   ├── src/
│   │   ├── index.ts        # Serveur Express et routes
│   │   └── db.ts           # Connexion MySQL
│   ├── .env                # Variables d'environnement (non versionné)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── App.css
│   └── package.json
└── README.md
```

## ✅ Prérequis

- [Node.js](https://nodejs.org/) v20 ou plus
- MySQL (ou WAMP, XAMPP, etc.)
- Git

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/<ton-pseudo>/Oracle8.git
cd Oracle8
```

### 2. Base de données

Crée la base, puis importe le schéma :

```sql
CREATE DATABASE oracle8 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Dans PowerShell :

```powershell
Get-Content backend/database/schema.sql | mysql -u root -p oracle8
```

Ensuite, ajoute des réponses dans la table `reponse`. Par exemple :

```sql
INSERT INTO reponse (texte) VALUES ('Oui.'), ('Non.'), ('Redemande plus tard.');
```

### 3. Backend

```bash
cd backend
npm install
```

Crée un fichier `backend/.env` :

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=oracle8
JWT_SECRET=une_longue_chaine_secrete_aleatoire
```

Lance le serveur :

```bash
npm run dev
```

Le serveur tourne sur http://localhost:3000. Tu peux le vérifier sur http://localhost:3000/api/health.

### 4. Frontend

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Ouvre ensuite http://localhost:5173.

## 🔌 Routes de l'API

| Méthode | Route            | Auth | Description                         |
|---------|------------------|------|-------------------------------------|
| GET     | `/api/health`    | ❌   | Vérifie que le serveur tourne       |
| GET     | `/api/reponses`  | ❌   | Liste les réponses de la boule      |
| POST    | `/api/register`  | ❌   | Inscription `{ pseudo, motdepasse }`|
| POST    | `/api/login`     | ❌   | Connexion, renvoie un token JWT     |
| POST    | `/api/questions` | ✅   | Pose une question `{ texte }`       |

Les routes protégées demandent cet en-tête : `Authorization: Bearer <token>`.

## 🗄️ Modèle de données

- **utilisateur** (`Id_utilisateur`, `pseudo` unique, `motdepasse` haché)
- **reponse** (`Id_Reponse`, `texte`)
- **question** (`Id_question`, `texte`, `Id_Reponse` → reponse, `Id_utilisateur` → utilisateur)

## 👤 Auteur

Luc Houvrard