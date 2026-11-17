# Déploiement d'Oracle8 en production

Ce document explique comment mettre Oracle8 en ligne sur un serveur, le mettre à jour, le sauvegarder et revenir en arrière en cas de problème.

> **État** : la configuration Docker et la procédure locale sont testées (sur un poste de développement et dans l'intégration continue). La sauvegarde et la restauration (section 6) ont été testées le 17/11/2026 : une donnée ajoutée après la sauvegarde a bien disparu à la restauration, accents intacts. La partie serveur (sections 2 à 4 : domaine, HTTPS) n'a pas encore été déroulée sur un vrai serveur.

## 1. Vue d'ensemble

```
Internet ──HTTPS──▶ Caddy (proxy, port 443) ──▶ frontend : nginx        127.0.0.1:8080
                                            └─▶ backend  : Node.js      127.0.0.1:3000 ──▶ db : MySQL (réseau Docker interne)
```

| Composant | Rôle | Accessible depuis Internet ? |
|---|---|---|
| **Caddy** | Reçoit les visiteurs en HTTPS (certificat gratuit Let's Encrypt, renouvelé tout seul) et transmet aux conteneurs | Oui, ports 80 et 443 |
| **frontend** | Sert le site (HTML, CSS, JS) | Non, seulement via Caddy |
| **backend** | L'API | Non, seulement via Caddy |
| **db** | La base MySQL | Non, seulement par le backend |

Les 3 conteneurs sont décrits dans `docker-compose.yml`. Caddy est installé directement sur le serveur.

## 2. Prérequis

- **Un serveur Linux** (Ubuntu 24.04 ou Debian 12), avec un accès SSH et `sudo`. 1 Go de RAM suffit.
- **Un nom de domaine**, avec deux enregistrements DNS de type `A` qui pointent vers l'adresse IP du serveur :
  - `oracle8.exemple.fr` pour le site ;
  - `api.oracle8.exemple.fr` pour l'API.

  Remplace `oracle8.exemple.fr` par ton domaine partout dans ce document.
- **Docker** et **Docker Compose** sur le serveur :
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  ```
- **Caddy** :
  ```bash
  sudo apt install caddy
  ```
- **Git** : `sudo apt install git`

### Pare-feu

On n'ouvre que SSH (22) et le web (80, 443) :

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

⚠️ Docker contourne `ufw` pour les ports qu'il publie. C'est pour ça que `docker-compose.yml` publie le backend et le frontend sur `127.0.0.1` seulement : ils ne sont joignables que depuis le serveur lui-même, donc par Caddy. La base n'est publiée nulle part.

## 3. Installation

### 3.1 Récupérer le code

```bash
git clone https://github.com/Luc-Houvrard/Oracle8.git
cd Oracle8
```

### 3.2 Créer le fichier `.env`

```bash
cp .env.example .env
chmod 600 .env        # lisible seulement par toi : il contient les secrets
nano .env
```

Valeurs pour la production :

| Variable | Valeur | Comment l'obtenir |
|---|---|---|
| `DB_PASSWORD` | Un mot de passe long et aléatoire | `openssl rand -hex 24` |
| `JWT_SECRET` | Une clé longue et aléatoire | `openssl rand -hex 32` |
| `LIMITE_TENTATIVES` | `10` | — |
| `CORS_ORIGIN` | `https://oracle8.exemple.fr` | Adresse du site, **sans `/` final** |
| `VITE_API_URL` | `https://api.oracle8.exemple.fr` | Adresse de l'API |
| `TRUST_PROXY` | `1` | Caddy est devant le backend |
| `ADMIN_PSEUDO`, `ADMIN_MOTDEPASSE` | Ton compte admin | Mot de passe d'au moins 8 caractères |

Pourquoi `TRUST_PROXY=1` : derrière Caddy, le backend voit la même adresse IP pour tous les visiteurs (celle de Caddy). Sans ce réglage, la limite de tentatives compterait les erreurs de tout le monde ensemble, et bloquerait tous les visiteurs après 10 erreurs au total.

⚠️ Ne jamais réutiliser les secrets de développement en production.

### 3.3 Lancer l'application

```bash
sudo docker compose up -d --build
```

`-d` lance les conteneurs en arrière-plan. Au premier démarrage, la base importe `schema.sql` et `seed.sql`, et le compte admin est créé.

### 3.4 Configurer Caddy (HTTPS)

Remplace le contenu de `/etc/caddy/Caddyfile` par :

```
oracle8.exemple.fr {
	reverse_proxy 127.0.0.1:8080
}

api.oracle8.exemple.fr {
	reverse_proxy 127.0.0.1:3000
}
```

Puis recharge Caddy :

```bash
sudo systemctl reload caddy
```

Caddy obtient tout seul les certificats HTTPS auprès de Let's Encrypt, et les renouvelle. Il faut pour ça que les enregistrements DNS pointent déjà vers le serveur et que les ports 80 et 443 soient ouverts.

## 4. Vérifier que tout marche

1. **Les conteneurs tournent** :
   ```bash
   sudo docker compose ps
   ```
   Les 3 services doivent être `running`, et `db` doit être `healthy`.
2. **L'API répond** :
   ```bash
   curl https://api.oracle8.exemple.fr/api/health
   ```
   Réponse attendue : `{"status":"ok"}`.
3. **Le site** : ouvre `https://oracle8.exemple.fr`, connecte-toi avec le compte admin, pose une question, puis ouvre l'administration.

Ne lance pas `npm test` contre la production : les tests créent des comptes `test_...` dans la base. Les tests tournent déjà dans l'intégration continue (onglet **Actions** sur GitHub) avant chaque déploiement.

En cas de problème, les journaux :

```bash
sudo docker compose logs backend      # ou db, frontend
sudo docker compose logs -f           # en direct (Ctrl+C pour quitter)
```

## 5. Mettre à jour

1. **Vérifier que la CI est verte** ✅ sur GitHub pour la version à déployer.
2. **Faire une sauvegarde de la base** (section 6).
3. **Récupérer la nouvelle version et relancer** :
   ```bash
   git pull
   sudo docker compose up -d --build
   ```
   Docker reconstruit seulement ce qui a changé, et recrée les conteneurs concernés. Les données de la base sont conservées, car elles sont dans le volume `donnees-mysql`.
4. **Vérifier** (section 4).

### Si la mise à jour change la structure de la base

`schema.sql` n'est exécuté qu'au **tout premier démarrage**, quand la base est vide. Une modification de la structure sur une base existante passe par un fichier de migration, appliqué une seule fois à la main. Exemple avec `migration_001_role.sql` :

```bash
sudo docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" oracle8' < backend/database/migration_001_role.sql
```

`migration_001_role.sql` est déjà inclus dans `schema.sql` : il ne sert que pour une base créée avant l'ajout de l'administration.

### Changer une variable du `.env`

```bash
sudo docker compose up -d --build
```

`--build` est indispensable si tu changes `VITE_API_URL`, car cette valeur est écrite dans le JavaScript au moment de la construction du frontend.

## 6. Sauvegarder et restaurer la base

### Sauvegarder

```bash
sudo docker compose exec -T db sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --no-tablespaces --default-character-set=utf8mb4 oracle8' > sauvegarde-$(date +%F).sql
```

Le fichier `sauvegarde-AAAA-MM-JJ.sql` contient toute la base : comptes, réponses, questions. Il contient les mots de passe hachés : garde-le en lieu sûr, jamais sur GitHub.

`--no-tablespaces` évite une erreur de droits : le compte `oracle8` n'a volontairement pas les droits d'administration de MySQL.

### Sauvegarde automatique chaque nuit

```bash
sudo crontab -e
```

Ajoute cette ligne (à adapter : chemin du projet et dossier de sauvegarde) :

```
0 3 * * * cd /home/ubuntu/Oracle8 && docker compose exec -T db sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --no-tablespaces --default-character-set=utf8mb4 oracle8' > /home/ubuntu/sauvegardes/oracle8-$(date +\%F).sql
```

Une sauvegarde qui reste sur le même serveur disparaît avec lui : copie-les régulièrement ailleurs.

### Restaurer

⚠️ La restauration **remplace** le contenu actuel de la base.

```bash
sudo docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" oracle8' < sauvegarde-2026-11-17.sql
```

## 7. Revenir à la version précédente

Chaque version mise en production reçoit une **étiquette Git** (tag), pour pouvoir y revenir :

```bash
git tag -a v1.0 -m "Version 1.0"
git push origin v1.0
```

Si une mise à jour casse le site :

```bash
git checkout v1.0                     # la dernière version qui marchait
sudo docker compose up -d --build
```

Si la mise à jour avait aussi modifié la structure de la base, restaure en plus la sauvegarde faite juste avant (section 6).

Une fois le problème corrigé, on revient sur la branche principale : `git checkout main`.

## 8. Sécurité en production

- [ ] HTTPS partout (Caddy) : les mots de passe et les tokens ne circulent jamais en clair.
- [ ] `.env` avec des secrets **propres à la production**, en `chmod 600`, jamais commité.
- [ ] Pare-feu : seuls les ports 22, 80 et 443 sont ouverts.
- [ ] Backend et frontend publiés sur `127.0.0.1` uniquement, base non publiée.
- [ ] L'application utilise le compte MySQL `oracle8`, limité à sa base, et pas `root`.
- [ ] Le backend tourne avec l'utilisateur `node` et non `root` dans son conteneur.
- [ ] `TRUST_PROXY=1`, pour que la limite de tentatives fonctionne par visiteur.
- [ ] Sauvegardes régulières, copiées hors du serveur.
- [ ] Le serveur reçoit les mises à jour de sécurité : `sudo apt update && sudo apt upgrade`.

## 9. Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| Le site s'affiche, mais la connexion échoue avec « Impossible de joindre le serveur » | `CORS_ORIGIN` ne correspond pas exactement à l'adresse du site (souvent un `/` final en trop) ou `VITE_API_URL` est faux | Corriger `.env`, puis `sudo docker compose up -d --build` |
| Les accents s'affichent mal (`TrÃ¨s`) | La base a été initialisée avec un fichier SQL sans `SET NAMES utf8mb4` | Corriger le fichier, puis repartir d'une base neuve (`sudo docker compose down -v`, ⚠️ efface les données) ou restaurer une sauvegarde |
| Tout le monde reçoit « Trop de tentatives » (`429`) | `TRUST_PROXY` n'est pas défini : tous les visiteurs partagent le même compteur | `TRUST_PROXY=1` dans `.env`, puis `sudo docker compose up -d` |
| Le backend ne démarre pas, `JWT_SECRET manquant` ou `required variable ... is missing` | Variable absente du `.env` | Compléter `.env` (section 3.2) |
| `port is already allocated` | Un autre programme utilise déjà le port 3000 ou 8080 | `sudo ss -ltnp \| grep -E ':(3000\|8080)'` pour le trouver, puis l'arrêter |
| Une modification du `.env` n'a aucun effet | Les conteneurs n'ont pas été recréés | `sudo docker compose up -d` (et `--build` pour `VITE_API_URL`) |
| Caddy n'obtient pas de certificat HTTPS | DNS pas encore propagé, ou ports 80/443 fermés | Vérifier le DNS (`dig oracle8.exemple.fr`) et le pare-feu, puis `sudo journalctl -u caddy` |
