// Tests de l'API Oracle8.
// Prérequis : MySQL et le backend tournent (npm run dev).
// Lancement : npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://localhost:3000/api";

// ---------- Compte de test partagé ----------

// Un seul compte pour tous les tests qui en ont besoin : chaque inscription compte
// dans la limite de tentatives (10 par quart d'heure)
const pseudo = `test_${Date.now()}`;
const motdepasse = "motdepasse123";

// Envoie une requête JSON à l'API, avec le token si on en donne un
function appeler(methode: string, route: string, corps?: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API}${route}`, {
    method: methode,
    headers,
    body: corps && JSON.stringify(corps),
  });
}

// Se connecte avec le compte de test et renvoie le token
async function connexion(): Promise<string> {
  const res = await appeler("POST", "/login", { pseudo, motdepasse });
  return (await res.json()).token;
}

// Préparer : exécuté une seule fois, avant tous les tests du fichier
before(async () => {
  const res = await appeler("POST", "/register", { pseudo, motdepasse });
  assert.equal(res.status, 201, "l'inscription du compte de test a échoué");
});

// ---------- Tests ----------

// Un test = 3 étapes : préparer, agir, vérifier.
test("GET /health répond ok", async () => {
  // Agir : on envoie la requête
  const res = await fetch(`${API}/health`);

  // Vérifier : le code HTTP et le contenu sont ceux attendus
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("POST /login avec un mauvais mot de passe renvoie 401", async () => {
  // Agir : le compte de test existe, mais le mot de passe est faux
  const res = await appeler("POST", "/login", { pseudo, motdepasse: "mauvais-mdp" });

  // Vérifier : la connexion est refusée
  assert.equal(res.status, 401);
});

test("POST inscription avec un pseudo et mot de passe valide", async () => {

  const res = await fetch(`${API}/register`,{
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({pseudo: `test_${Date.now()}`, motdepasse: "motdepasse3"}),
  });

  assert.equal(res.status, 201);
});

test("POST /login avec les bons identifiants renvoie 200 et un token", async () => {
  const res = await appeler("POST", "/login", { pseudo, motdepasse });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.token, "la réponse ne contient pas de token");
  assert.equal(data.pseudo, pseudo);
});

test("POST /questions sans token renvoie 401", async () => {
  const res = await appeler("POST", "/questions", { texte: "Ça marche ?" });

  assert.equal(res.status, 401);
});

test("POST /questions avec un token renvoie 201 et une réponse", async () => {
  const token = await connexion();

  const res = await appeler("POST", "/questions", { texte: "Vais-je réussir ?" }, token);

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.question, "Vais-je réussir ?");
  assert.equal(typeof data.reponse, "string");
});

test("GET /questions contient la question qu'on vient de poser", async () => {
  const token = await connexion();
  const texte = `Question d'historique ${Date.now()}`;
  await appeler("POST", "/questions", { texte }, token);

  const res = await appeler("GET", "/questions", undefined, token);

  assert.equal(res.status, 200);
  const historique = await res.json();
  // L'historique est trié du plus récent au plus ancien
  assert.equal(historique[0].question, texte);
});

test("GET /admin/utilisateurs avec un compte normal renvoie 403", async () => {
  const token = await connexion();

  const res = await appeler("GET", "/admin/utilisateurs", undefined, token);

  assert.equal(res.status, 403);
});
