import express from "express";
import cors from "cors";
import { pool } from "./db";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
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


app.post("/api/questions", async (req, res) => {
  const { texte, Id_utilisateur } = req.body;

  if (!texte || !Id_utilisateur) {
    return res
      .status(400)
      .json({ erreur: "texte et Id_utilisateur sont obligatoires" });
  }

  try {
    // 1. Tirer une réponse au hasard
    const [reponses]: any = await pool.query(
      "SELECT Id_Reponse, texte FROM reponse ORDER BY RAND() LIMIT 1",
    );
    const reponse = reponses[0];

    // 2. Enregistrer la question
    const [result]: any = await pool.query(
      "INSERT INTO question (texte, Id_Reponse, Id_utilisateur) VALUES (?, ?, ?)",
      [texte, reponse.Id_Reponse, Id_utilisateur],
    );

    // 3. Renvoyer la réponse au front
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