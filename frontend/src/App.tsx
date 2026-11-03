import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

function App() {
  // État de la boule
  const [question, setQuestion] = useState("");
  const [reponse, setReponse] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  // Réglages du shake
  const [shakeActif, setShakeActif] = useState(true);
  const [intensite, setIntensite] = useState(10); // en px
  const [vitesse, setVitesse] = useState(0.3); // en secondes
  const [duree, setDuree] = useState(1200); // en ms

  const poserQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chargement) return;

    setChargement(true);
    setErreur("");
    setReponse("");

    try {
      const res = await fetch(`${API_URL}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: question, Id_utilisateur: 1 }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      setTimeout(() => {
        setReponse(data.reponse);
        setChargement(false);
      }, duree);
    } catch {
      setErreur("La boule ne répond pas... Le serveur est-il lancé ?");
      setChargement(false);
    }
  };

  return (
    <div className="app">
      <h1>Oracle8</h1>

      <form onSubmit={poserQuestion}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose ta question à la boule..."
        />
        <button type="submit" disabled={chargement}>
          {chargement ? "La boule réfléchit..." : "Demander"}
        </button>
      </form>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="scene">
        <div className="shadow"></div>
        <div
          className={`eball ${chargement && shakeActif ? "secoue" : ""} ${reponse ? "revele" : ""}`}
          style={
            {
              "--amplitude": `${intensite}px`,
              "--rotation": `${intensite * 0.3}deg`,
              "--vitesse": `${vitesse}s`,
            } as React.CSSProperties
          }
        >
          <div className="egrad"></div>
          <div className="ewin">
            <div className="triangle"></div>
            <div className="textbox">{reponse}</div>
          </div>
        </div>
      </div>

      <div className="reglages">
        <label>
          <input
            type="checkbox"
            checked={shakeActif}
            onChange={(e) => setShakeActif(e.target.checked)}
          />
          Secousse activée
        </label>

        <label>
          Intensité : {intensite}px
          <input
            type="range"
            min="2"
            max="30"
            step="1"
            value={intensite}
            disabled={!shakeActif}
            onChange={(e) => setIntensite(Number(e.target.value))}
          />
        </label>

        <label>
          Vitesse : {vitesse}s
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={vitesse}
            disabled={!shakeActif}
            onChange={(e) => setVitesse(Number(e.target.value))}
          />
        </label>

        <label>
          Durée : {duree / 1000}s
          <input
            type="range"
            min="300"
            max="4000"
            step="100"
            value={duree}
            onChange={(e) => setDuree(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

export default App;
