# Recette du conteneur backend. Chaque ligne est une étape, exécutée dans l'ordre.

# 1. Image de départ : un Linux minimal avec Node.js 22 déjà installé
FROM node:22-slim

# 2. Dossier de travail dans le conteneur : toutes les commandes suivantes s'y exécutent
WORKDIR /app

# 3. On copie d'abord SEULEMENT la liste des dépendances, puis on les installe.
#    Docker garde chaque étape en cache : tant que package.json ne change pas,
#    il ne réinstalle pas les dépendances, et la reconstruction est bien plus rapide.
#    npm ci installe exactement les versions de package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci

# 4. On copie le code, on le compile (TypeScript -> JavaScript dans dist/),
#    puis on retire les outils de développement (typescript, tsx...) devenus inutiles
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# 5. Mode production, et le port sur lequel le serveur écoute
ENV NODE_ENV=production
EXPOSE 3000

# 6. Sécurité : on ne lance pas le serveur en root, mais avec l'utilisateur "node"
#    prévu par l'image. Si quelqu'un trouvait une faille, il aurait moins de droits.
USER node

# 7. La commande lancée au démarrage du conteneur
CMD ["node", "dist/index.js"]
