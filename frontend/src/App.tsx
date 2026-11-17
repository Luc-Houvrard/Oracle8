import { useState, useEffect, useRef } from "react";
import Admin from "./Admin";
import "./App.css";

// Adresse du backend. Lue au moment du build : jamais de secret dans une variable VITE_
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface Historique {
  Id_question: number;
  question: string;
  reponse: string;
  date_creation: string;
}

function App() {
  // ---------- Authentification ----------
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [pseudoConnecte, setPseudoConnecte] = useState<string | null>(
    localStorage.getItem("pseudo"),
  );
  // Sert uniquement à afficher le lien "Administration" : le serveur revérifie le rôle
  const [role, setRole] = useState<string | null>(localStorage.getItem("role"));
  const [afficherAdmin, setAfficherAdmin] = useState(false);
  const [modeInscription, setModeInscription] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [authErreur, setAuthErreur] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // ---------- État de la boule ----------
  const [question, setQuestion] = useState("");
  const [reponse, setReponse] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  // ---------- Réglages du shake ----------
  const [shakeActif, setShakeActif] = useState(true);
  const [intensite, setIntensite] = useState(10); // en px
  const [vitesse, setVitesse] = useState(0.3); // en secondes
  const [duree, setDuree] = useState(1200); // en ms

  // ---------- Historique ----------
  const [historique, setHistorique] = useState<Historique[]>([]);
  const [afficherHistorique, setAfficherHistorique] = useState(false);
  const [chargementHisto, setChargementHisto] = useState(false);

  // Référence vers le champ de question
  const inputRef = useRef<HTMLInputElement>(null);

  const deconnexion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("pseudo");
    localStorage.removeItem("role");
    setToken(null);
    setPseudoConnecte(null);
    setRole(null);
    setAfficherAdmin(false);
    setReponse("");
    setQuestion("");
    setHistorique([]);
    setAfficherHistorique(false);
  };

  const chargerHistorique = async () => {
    setChargementHisto(true);
    try {
      const res = await fetch(`${API_URL}/api/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        deconnexion();
        setAuthErreur("Ta session a expiré, reconnecte-toi.");
        return;
      }
      if (!res.ok) throw new Error();
      setHistorique(await res.json());
    } catch {
      setErreur("Impossible de charger l'historique.");
    } finally {
      setChargementHisto(false);
    }
  };

  const basculerHistorique = () => {
    if (!afficherHistorique) chargerHistorique();
    setAfficherHistorique((v) => !v);
  };

  // ---------- Raccourcis clavier ----------
  // ⚠️ Les hooks doivent être AVANT le "if (!token) return ..."
  useEffect(() => {
    // Pas de raccourcis sur la page de connexion ni dans l'administration
    if (!token || afficherAdmin) return;

    const gererTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      const dansChamp =
        cible.tagName === "INPUT" &&
        (cible as HTMLInputElement).type === "text";

      // Échap : sortir du champ
      if (e.key === "Escape") {
        inputRef.current?.blur();
        return;
      }

      // Si on tape dans le champ, on ne déclenche pas les raccourcis
      if (dansChamp) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          inputRef.current?.focus();
          break;
        case "s":
        case "S":
          setShakeActif((v) => !v);
          break;
        case "h":
        case "H":
          basculerHistorique();
          break;
        case "ArrowUp":
          e.preventDefault();
          setIntensite((v) => Math.min(30, v + 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setIntensite((v) => Math.max(2, v - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setVitesse((v) => Math.min(1, Math.round((v + 0.05) * 100) / 100));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setVitesse((v) => Math.max(0.1, Math.round((v - 0.05) * 100) / 100));
          break;
      }
    };

    window.addEventListener("keydown", gererTouche);
    return () => window.removeEventListener("keydown", gererTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, afficherHistorique, afficherAdmin]);

  const gererAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErreur("");
    setAuthMessage("");

    const route = modeInscription ? "register" : "login";

    try {
      const res = await fetch(`${API_URL}/api/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, motdepasse }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthErreur(data.erreur || "Erreur inconnue");
        return;
      }

      if (modeInscription) {
        setAuthMessage("Compte créé ! Tu peux te connecter.");
        setModeInscription(false);
        setMotdepasse("");
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("pseudo", data.pseudo);
        localStorage.setItem("role", data.role);
        setToken(data.token);
        setPseudoConnecte(data.pseudo);
        setRole(data.role);
        setPseudo("");
        setMotdepasse("");
      }
    } catch {
      setAuthErreur("Impossible de joindre le serveur. Est-il lancé ?");
    }
  };

  const poserQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chargement) return;

    setChargement(true);
    setErreur("");
    setReponse("");

    try {
      const res = await fetch(`${API_URL}/api/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ texte: question }),
      });

      // Token expiré ou invalide -> retour à la connexion
      if (res.status === 401) {
        deconnexion();
        setAuthErreur("Ta session a expiré, reconnecte-toi.");
        setChargement(false);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();

      setTimeout(() => {
        setReponse(data.reponse);
        setChargement(false);
        if (afficherHistorique) chargerHistorique();
      }, duree);
    } catch {
      setErreur("La boule ne répond pas... Le serveur est-il lancé ?");
      setChargement(false);
    }
  };

  // ---------- Page de connexion / inscription ----------
  if (!token) {
    return (
      <div className="app">
        <h1>Oracle8</h1>

        <form className="auth" onSubmit={gererAuth}>
          <h2>{modeInscription ? "Créer un compte" : "Connexion"}</h2>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Pseudo"
            maxLength={50}
            required
          />
          <input
            type="password"
            value={motdepasse}
            onChange={(e) => setMotdepasse(e.target.value)}
            placeholder="Mot de passe (8 caractères min.)"
            required
          />
          <button type="submit">
            {modeInscription ? "S'inscrire" : "Se connecter"}
          </button>

          {authErreur && <p className="erreur">{authErreur}</p>}
          {authMessage && <p className="succes">{authMessage}</p>}

          <p className="bascule">
            {modeInscription ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              type="button"
              className="lien"
              onClick={() => {
                setModeInscription(!modeInscription);
                setAuthErreur("");
                setAuthMessage("");
              }}
            >
              {modeInscription ? "Se connecter" : "Créer un compte"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  // ---------- En-tête commun à la boule et à l'administration ----------
  const entete = (
    <header className="entete">
      <span>
        Connecté en tant que <strong>{pseudoConnecte}</strong>
      </span>
      <div>
        {!afficherAdmin && (
          <>
            <button className="lien" onClick={basculerHistorique}>
              {afficherHistorique ? "Masquer l'historique" : "Mes questions"}
            </button>
            {" · "}
          </>
        )}
        {role === "admin" && (
          <>
            <button
              className="lien"
              onClick={() => setAfficherAdmin((v) => !v)}
            >
              {afficherAdmin ? "Retour à la boule" : "Administration"}
            </button>
            {" · "}
          </>
        )}
        <button className="lien" onClick={deconnexion}>
          Se déconnecter
        </button>
      </div>
    </header>
  );

  // ---------- Page d'administration ----------
  if (afficherAdmin) {
    return (
      <div className="app">
        {entete}
        <h1>Oracle8</h1>
        <Admin apiUrl={API_URL} token={token} monPseudo={pseudoConnecte} />
      </div>
    );
  }

  // ---------- Page de la boule ----------
  return (
    <div className="app">
      {entete}

      <h1>Oracle8</h1>

      <form onSubmit={poserQuestion}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose ta question à la boule... (raccourci : /)"
          maxLength={500}
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
          Secousse activée (S)
        </label>

        <label>
          Intensité : {intensite}px (↑ ↓)
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
          Vitesse : {vitesse}s (← →)
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

      {afficherHistorique && (
        <section className="historique">
          <h2>Mes questions</h2>
          {chargementHisto && <p>Chargement...</p>}
          {!chargementHisto && historique.length === 0 && (
            <p>Tu n'as encore posé aucune question.</p>
          )}
          <ul>
            {historique.map((h) => (
              <li key={h.Id_question}>
                <span className="histo-date">
                  {new Date(h.date_creation).toLocaleString("fr-FR")}
                </span>
                <p className="histo-question">❓ {h.question}</p>
                <p className="histo-reponse">🎱 {h.reponse}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default App;
