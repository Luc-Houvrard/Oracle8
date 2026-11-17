# Tests de l'API Oracle8

Ce dossier contient les tests automatisés du backend : `api.test.ts`.

## 1. À quoi sert un test ?

Un test est un petit programme qui utilise l'API **comme le ferait le frontend**, puis vérifie que la réponse est celle attendue.

Sans tests, après chaque modification du code, il faut tout réessayer à la main dans le navigateur (inscription, connexion, question, historique…), et on oublie toujours un cas.

Avec les tests, une seule commande vérifie tout en une seconde. Si une modification casse une route, le test concerné passe en `not ok` immédiatement.

## 2. Lancer les tests

**Prérequis** : MySQL et le backend doivent tourner.

```bash
sudo systemctl start docker && sudo docker start oracle8-db   # la base
cd backend && npm run dev                                     # le backend (dans un terminal)
```

**Lancement**, dans un autre terminal :

```bash
cd backend
npm test
```

**Lire le résultat** :

```
ok 1 - GET /health répond ok                 ← le test a réussi
not ok 3 - POST inscription ...              ← le test a échoué
  expected: 201                              ← ce qu'on attendait
  actual: 409                                ← ce que l'API a vraiment répondu
# pass 7                                     ← nombre de tests réussis
# fail 1                                     ← nombre de tests échoués
```

Par défaut, les tests appellent `http://localhost:3000/api`. Pour viser un autre serveur, on utilise la variable `API_URL` :

```bash
API_URL=http://localhost:3001/api npm test
```

## 3. Les outils utilisés

| Outil | Rôle |
|---|---|
| `node:test` | L'outil de test **intégré à Node.js**. Aucun paquet à installer. Fournit `test()` et `before()`. |
| `node:assert/strict` | Les fonctions de vérification : `assert.equal`, `assert.deepEqual`, `assert.ok`. |
| `fetch` | Envoie une requête HTTP, exactement comme le frontend. Intégré à Node.js. |
| `tsx` | Permet de lancer directement un fichier TypeScript (`.ts`). Déjà utilisé par `npm run dev`. |

La commande `npm test` correspond au script de `backend/package.json` :

```json
"test": "tsx --test test/*.test.ts"
```

`--test` dit à Node de lancer tous les fichiers qui finissent par `.test.ts` du dossier `test/`.

## 4. La structure d'un test : préparer, agir, vérifier

Tous les tests suivent les mêmes 3 étapes :

1. **Préparer** : mettre en place ce dont le test a besoin (un compte, un token…).
2. **Agir** : envoyer la requête à l'API.
3. **Vérifier** : comparer la réponse à ce qu'on attend.

Exemple avec le test le plus simple :

```ts
test("GET /health répond ok", async () => {
  // Agir
  const res = await fetch(`${API}/health`);

  // Vérifier
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});
```

Ligne par ligne :

- `test("...", async () => { ... })` déclare un test. Le texte entre guillemets est son nom, affiché dans le résultat.
- `async` / `await` : une requête HTTP prend du temps. `await` attend la réponse avant de passer à la ligne suivante.
- `res.status` est le code HTTP de la réponse (`200`, `401`, …).
- `assert.equal(a, b)` vérifie que `a` vaut `b`. Sinon, le test échoue et affiche `expected` / `actual`.
- `assert.deepEqual(a, b)` fait la même chose pour un objet entier : ici, le JSON doit être exactement `{ status: "ok" }`.
- `assert.ok(valeur)` vérifie qu'une valeur existe (n'est pas vide, `undefined` ou `null`).

### Les codes HTTP qu'on vérifie

| Code | Signification | Exemple dans Oracle8 |
|---|---|---|
| `200` | OK | Connexion réussie |
| `201` | Créé | Compte ou question créé |
| `400` | Requête invalide | Mot de passe trop court |
| `401` | Non authentifié | Mauvais mot de passe, ou pas de token |
| `403` | Interdit | Compte normal sur une route admin |
| `409` | Conflit | Pseudo déjà pris |
| `429` | Trop de requêtes | Limite de tentatives atteinte |

## 5. Plan de tests

| # | Ce qu'on vérifie | Requête | Résultat attendu | Pourquoi c'est important |
|---|---|---|---|---|
| 1 | Le serveur répond | `GET /api/health` | `200`, `{ status: "ok" }` | Si ce test échoue, le serveur est arrêté : inutile de chercher plus loin. |
| 2 | Un mauvais mot de passe est refusé | `POST /api/login` (compte de test partagé, faux mot de passe) | `401` | Sécurité : personne ne doit entrer dans un compte sans le bon mot de passe. |
| 3 | L'inscription fonctionne | `POST /api/register` (pseudo unique) | `201` | Sans inscription, personne ne peut utiliser l'application. |
| 4 | La connexion fonctionne | `POST /api/login` (bons identifiants) | `200`, un `token`, le bon `pseudo` | Le token est indispensable pour toutes les routes protégées. |
| 5 | On ne pose pas de question sans être connecté | `POST /api/questions` sans token | `401` | Sécurité : la route est bien protégée. |
| 6 | Poser une question fonctionne | `POST /api/questions` avec token | `201`, la question et une réponse | C'est la fonctionnalité principale de la boule. |
| 7 | L'historique fonctionne | `POST` puis `GET /api/questions` | `200`, la question posée en premier | L'utilisateur retrouve bien ses questions, de la plus récente à la plus ancienne. |
| 8 | Un compte normal n'accède pas à l'admin | `GET /api/admin/utilisateurs` avec un token `user` | `403` | Sécurité : seuls les administrateurs gèrent les comptes et les réponses. |

Les tests 1 et 3 sont écrits « à la main » avec `fetch`. Les autres utilisent les fonctions utilitaires décrites ci-dessous.

## 6. Les fonctions utilitaires

### Un compte partagé

```ts
const pseudo = `test_${Date.now()}`;
const motdepasse = "motdepasse123";
```

`Date.now()` renvoie le nombre de millisecondes écoulées depuis 1970 : un nombre différent à chaque lancement. Le pseudo est donc unique, et l'inscription ne tombe jamais sur « pseudo déjà pris ».

Un seul compte sert à tous ces tests, au lieu d'un compte par test : chaque inscription compte dans la limite de tentatives (10 par quart d'heure).

### `appeler()` : envoyer une requête

```ts
function appeler(methode, route, corps?, token?) { ... }
```

Elle évite de recopier le même `fetch` (méthode, en-têtes, corps JSON) dans chaque test. Si on lui donne un `token`, elle ajoute l'en-tête `Authorization: Bearer <token>`, comme le frontend.

Exemple : `appeler("POST", "/questions", { texte: "Ça marche ?" }, token)`.

Le `?` après `corps` et `token` veut dire que ces paramètres sont **facultatifs**.

### `connexion()` : obtenir un token

```ts
async function connexion(): Promise<string> { ... }
```

Elle se connecte avec le compte partagé et renvoie le token. Chaque test qui a besoin d'être connecté commence par `const token = await connexion();`.

Les connexions réussies ne comptent pas dans la limite de tentatives, donc on peut l'appeler autant qu'on veut.

### `before()` : préparer une seule fois

```ts
before(async () => {
  const res = await appeler("POST", "/register", { pseudo, motdepasse });
  assert.equal(res.status, 201, "l'inscription du compte de test a échoué");
});
```

`before()` s'exécute **une seule fois, avant tous les tests du fichier**, même s'il est écrit après certains d'entre eux. Il crée le compte partagé. Si l'inscription échoue, le message `"l'inscription du compte de test a échoué"` s'affiche : on sait tout de suite que le problème vient de la préparation, pas du test lui-même.

### Pourquoi ne pas utiliser un compte qui existe déjà ?

1. On ne peut pas connaître son mot de passe : la base ne stocke qu'un hash bcrypt, et aucune route ne le renvoie.
2. Un test doit fonctionner sur une **base vide** : sur ta machine, sur celle du jury, ou dans l'intégration continue. S'il dépend de données déjà présentes, il échoue dès que la base change.

C'est pour ça que le test 2 utilise le compte partagé, et pas un compte comme `test2` : sur une base neuve (celle de la CI, par exemple), `test2` n'existe pas, et le test vérifierait « pseudo inconnu » au lieu de « mauvais mot de passe ».

## 7. Erreurs rencontrées en écrivant les tests

| Erreur | Symptôme | Cause | Correction |
|---|---|---|---|
| `Date.now` sans parenthèses | `409` au 2ᵉ lancement | Sans `()`, la fonction n'est pas appelée : le pseudo vaut `test_function now() { [native code] }`, identique à chaque fois. | `Date.now()` |
| Pseudo `test1` | Le test passe, mais teste la mauvaise chose | `test1` n'existe pas : on testait « pseudo inconnu » et pas « mauvais mot de passe ». | Utiliser un pseudo qui existe |
| Trop de lancements | `429` au lieu de `201` | La limite de tentatives (10 inscriptions par quart d'heure) est atteinte. | Redémarrer le backend (les compteurs sont en mémoire), ou régler `LIMITE_TENTATIVES` |

À retenir de la 2ᵉ ligne : **un test qui passe ne prouve rien s'il ne teste pas ce que dit son titre.**

## 8. Limites connues

- **Les tests demandent un backend et une base qui tournent.** Ce sont des tests d'intégration : ils testent l'ensemble API + base de données, pas une fonction isolée.
- **Chaque lancement crée 2 comptes `test_...`** et quelques questions dans la base. On peut les supprimer depuis la page d'administration.
- **Blocage `429` possible** après environ 5 lancements en 15 minutes, tant que la variable `LIMITE_TENTATIVES` n'est pas en place.