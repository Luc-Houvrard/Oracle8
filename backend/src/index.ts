import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool } from "./db";

// ---------- Configuration ----------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET manquant dans le fichier .env");
}

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ---------- Middleware d'authentification ----------
interface AuthRequest extends Request {
  userId?: number;
}

function verifierToken(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization; // "Bearer xxxxx"
  const token = header?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ erreur: "Tu dois être connecté" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as { id: number };
    req.userId = payload.id;
    next();
  } catch {
    return res.status(401).json({ erreur: "Token invalide ou expiré" });
  }
}

// ---------- Limite de tentatives (par adresse IP) ----------
// ponytail: compteurs en mémoire, remis à zéro au redémarrage et propres à un seul
// processus. Passer à un store partagé (Redis) si le serveur tourne en plusieurs instances.
// Derrière un reverse proxy, régler aussi app.set("trust proxy", ...) pour voir la vraie IP.
const QUINZE_MINUTES = 15 * 60 * 1000;
const tropDeTentatives = {
  erreur: "Trop de tentatives. Réessaie dans quelques minutes.",
};

// Connexion : 10 échecs maximum par quart d'heure (les connexions réussies ne comptent pas)
const limiteLogin = rateLimit({
  windowMs: QUINZE_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  message: tropDeTentatives,
});

// Inscription : 10 demandes maximum par quart d'heure
const limiteRegister = rateLimit({
  windowMs: QUINZE_MINUTES,
  limit: 10,
  message: tropDeTentatives,
});

// ---------- Validation ----------
// Vrai si v est un texte non vide d'au plus `max` caractères
function estTexte(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

// ---------- Routes ----------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/reponses", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM reponse");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Inscription
app.post("/api/register", limiteRegister, async (req, res) => {
  const { pseudo, motdepasse } = req.body ?? {};

  if (!pseudo || !motdepasse) {
    return res
      .status(400)
      .json({ erreur: "Pseudo et mot de passe obligatoires" });
  }
  if (!estTexte(pseudo, 50)) {
    return res
      .status(400)
      .json({ erreur: "Le pseudo doit faire entre 1 et 50 caractères" });
  }
  if (typeof motdepasse !== "string" || motdepasse.length < 8) {
    return res
      .status(400)
      .json({ erreur: "Le mot de passe doit faire au moins 8 caractères" });
  }
  // bcrypt ignore tout ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence
  if (Buffer.byteLength(motdepasse) > 72) {
    return res
      .status(400)
      .json({ erreur: "Le mot de passe est trop long (72 octets max.)" });
  }

  try {
    const hash = await bcrypt.hash(motdepasse, 10);
    const [result]: any = await pool.query(
      "INSERT INTO utilisateur (pseudo, motdepasse) VALUES (?, ?)",
      [pseudo, hash],
    );
    res
      .status(201)
      .json({ message: "Compte créé", Id_utilisateur: result.insertId });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ erreur: "Ce pseudo est déjà pris" });
    }
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Connexion
app.post("/api/login", limiteLogin, async (req, res) => {
  const { pseudo, motdepasse } = req.body ?? {};

  if (!pseudo || !motdepasse) {
    return res
      .status(400)
      .json({ erreur: "Pseudo et mot de passe obligatoires" });
  }
  // Un pseudo ou un mot de passe mal formé ne peut correspondre à aucun compte
  if (!estTexte(pseudo, 50) || typeof motdepasse !== "string") {
    return res.status(401).json({ erreur: "Identifiants incorrects" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT Id_utilisateur, pseudo, motdepasse, role FROM utilisateur WHERE pseudo = ?",
      [pseudo],
    );
    const user = rows[0];

    // Même message dans les deux cas : on ne révèle pas si le pseudo existe
    if (!user || !(await bcrypt.compare(motdepasse, user.motdepasse))) {
      return res.status(401).json({ erreur: "Identifiants incorrects" });
    }

    const token = jwt.sign({ id: user.Id_utilisateur }, JWT_SECRET as string, {
      expiresIn: "2h",
    });
    // Le rôle sert seulement à afficher le lien "Administration" :
    // les routes /api/admin le revérifient en base à chaque requête
    res.json({ token, pseudo: user.pseudo, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Poser une question (protégé : l'id vient du token, plus du body)
app.post("/api/questions", verifierToken, async (req: AuthRequest, res) => {
  const { texte } = req.body ?? {};

  if (!texte) {
    return res
      .status(400)
      .json({ erreur: "Le texte de la question est obligatoire" });
  }
  if (!estTexte(texte, 500)) {
    return res
      .status(400)
      .json({ erreur: "La question doit faire entre 1 et 500 caractères" });
  }

  try {
    const [reponses]: any = await pool.query(
      "SELECT Id_Reponse, texte FROM reponse ORDER BY RAND() LIMIT 1",
    );
        const reponse = reponses[0];

        if (!reponse) {
          return res
            .status(500)
            .json({
              erreur:
                "Aucune réponse en base. Ajoute des réponses dans la table reponse.",
            });
        }

    const [result]: any = await pool.query(
      "INSERT INTO question (texte, Id_Reponse, Id_utilisateur) VALUES (?, ?, ?)",
      [texte, reponse.Id_Reponse, req.userId],
    );

    res.status(201).json({
      Id_question: result.insertId,
      question: texte,
      reponse: reponse.texte,
    });
  } catch (err: any) {
    // Le token est encore valide mais le compte a été supprimé par un admin
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(401).json({ erreur: "Ce compte n'existe plus" });
    }
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Historique des questions de l'utilisateur connecté
app.get("/api/questions", verifierToken, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT q.Id_question, q.texte AS question, r.texte AS reponse, q.date_creation
       FROM question q
       JOIN reponse r ON r.Id_Reponse = q.Id_Reponse
       WHERE q.Id_utilisateur = ?
       ORDER BY q.date_creation DESC, q.Id_question DESC
       LIMIT 50`,
      [req.userId],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// ---------- Administration ----------
// Le rôle est relu en base à chaque requête (et pas stocké dans le token) :
// retirer le rôle admin à quelqu'un prend effet tout de suite.
async function verifierAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM utilisateur WHERE Id_utilisateur = ?",
      [req.userId],
    );
    if (rows[0]?.role !== "admin") {
      return res
        .status(403)
        .json({ erreur: "Accès réservé aux administrateurs" });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
}

// Toutes les routes /api/admin demandent un token valide ET le rôle admin
app.use("/api/admin", verifierToken, verifierAdmin);

// Renvoie l'identifiant de l'URL s'il est un entier positif, sinon null
function lireId(v: unknown): number | null {
  const id = Number(v);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const TEXTE_REPONSE_INVALIDE = {
  erreur: "La réponse doit faire entre 1 et 40 caractères",
};

// Ajouter une réponse
app.post("/api/admin/reponses", async (req, res) => {
  const { texte } = req.body ?? {};
  // 40 caractères : au-delà, le texte déborde de la fenêtre de la boule
  if (!estTexte(texte, 40)) {
    return res.status(400).json(TEXTE_REPONSE_INVALIDE);
  }

  try {
    const [result]: any = await pool.query(
      "INSERT INTO reponse (texte) VALUES (?)",
      [texte],
    );
    res.status(201).json({ Id_Reponse: result.insertId, texte });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Modifier une réponse
app.put("/api/admin/reponses/:id", async (req, res) => {
  const id = lireId(req.params.id);
  const { texte } = req.body ?? {};
  if (!id) {
    return res.status(400).json({ erreur: "Identifiant invalide" });
  }
  // 40 caractères : au-delà, le texte déborde de la fenêtre de la boule
  if (!estTexte(texte, 40)) {
    return res.status(400).json(TEXTE_REPONSE_INVALIDE);
  }

  try {
    const [result]: any = await pool.query(
      "UPDATE reponse SET texte = ? WHERE Id_Reponse = ?",
      [texte, id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ erreur: "Réponse introuvable" });
    }
    res.json({ Id_Reponse: id, texte });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Supprimer une réponse
app.delete("/api/admin/reponses/:id", async (req, res) => {
  const id = lireId(req.params.id);
  if (!id) {
    return res.status(400).json({ erreur: "Identifiant invalide" });
  }

  try {
    const [result]: any = await pool.query(
      "DELETE FROM reponse WHERE Id_Reponse = ?",
      [id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ erreur: "Réponse introuvable" });
    }
    res.json({ message: "Réponse supprimée" });
  } catch (err: any) {
    // La clé étrangère de la table question protège l'historique des utilisateurs
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        erreur:
          "Cette réponse apparaît dans l'historique : modifie-la au lieu de la supprimer",
      });
    }
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Lister les utilisateurs (sans les mots de passe)
app.get("/api/admin/utilisateurs", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.Id_utilisateur, u.pseudo, u.role, COUNT(q.Id_question) AS nb_questions
       FROM utilisateur u
       LEFT JOIN question q ON q.Id_utilisateur = u.Id_utilisateur
       GROUP BY u.Id_utilisateur
       ORDER BY u.pseudo`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Supprimer un utilisateur (ses questions partent avec lui : ON DELETE CASCADE)
app.delete("/api/admin/utilisateurs/:id", async (req: AuthRequest, res) => {
  const id = lireId(req.params.id);
  if (!id) {
    return res.status(400).json({ erreur: "Identifiant invalide" });
  }
  if (id === req.userId) {
    return res
      .status(400)
      .json({ erreur: "Tu ne peux pas supprimer ton propre compte" });
  }

  try {
    const [result]: any = await pool.query(
      "DELETE FROM utilisateur WHERE Id_utilisateur = ?",
      [id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ erreur: "Utilisateur introuvable" });
    }
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Problème avec la base de données" });
  }
});

// Toujours à la fin du fichier
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
