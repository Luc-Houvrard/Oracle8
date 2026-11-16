import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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
app.post("/api/register", async (req, res) => {
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
app.post("/api/login", async (req, res) => {
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
      "SELECT Id_utilisateur, pseudo, motdepasse FROM utilisateur WHERE pseudo = ?",
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
    res.json({ token, pseudo: user.pseudo });
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
  } catch (err) {
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

// Toujours à la fin du fichier
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
