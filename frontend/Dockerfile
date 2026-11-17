# Recette du conteneur frontend, en 2 étapes ("multi-stage build").
# Étape 1 : Node.js construit le site. Étape 2 : nginx le sert.
# L'image finale ne garde que l'étape 2 : pas de Node.js ni de node_modules en production.

# ---------- Étape 1 : construction ----------
FROM node:22-slim AS construction
WORKDIR /app

# Même astuce de cache que pour le backend : les dépendances d'abord, le code ensuite
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Adresse du backend, donnée par docker-compose.yml au moment du build.
# Vite la copie dans le JavaScript : elle est donc publique, jamais de secret ici.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Vérifie les types TypeScript puis produit le site final dans dist/ (HTML, CSS, JS)
RUN npm run build

# ---------- Étape 2 : service ----------
# nginx est un serveur web très léger : il envoie simplement les fichiers au navigateur
FROM nginx:1.27-alpine

# On récupère uniquement le dossier dist/ produit à l'étape 1
COPY --from=construction /app/dist /usr/share/nginx/html

# nginx écoute sur le port 80 et démarre tout seul (commande prévue par l'image)
EXPOSE 80
