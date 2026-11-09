import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

function App() {
  // ---------- Authentification ----------
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [pseudoConnecte, setPseudoConnecte] = useState<string | null>(
    localStorage.getItem("pseudo"),
  );
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

  // Référence vers le champ de question
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------- Raccourcis clavier ----------
  // ⚠️ Les hooks doivent être AVANT le "if (!token) return ..."
  useEffect(() => {
    // Pas de raccourcis sur la page de connexion
    if (!token) return;

    const gererTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      const dansUnChamp = ["INPUT", "TEXTAREA", "SELECT"].includes(
        cible.tagName,
      );

      // Échap : fonctionne partout
      if (e.key === "Escape") {
        setQuestion("");
        setReponse("");
        setErreur("");
        inputRef.current?.blur();
        return;
      }

      // Les autres raccourcis sont ignorés si on tape dans un champ
      if (dansUnChamp || e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault(); // évite d'écrire "/" dans le champ
          inputRef.current?.focus();
          break;
        case "s":
        case "S":
          setShakeActif((v) => !v);
          break;
        case "ArrowUp":
          e.preventDefault(); // évite de faire défiler la page
          setIntensite((v) => Math.min(v + 2, 30));
          break;
        case "ArrowDown":
          e.preventDefault();
          setIntensite((v) => Math.max(v - 2, 2));
          break;
        case "ArrowRight": // plus rapide = durée d'oscillation plus courte
          setVitesse((v) => Math.max(+(v - 0.05).toFixed(2), 0.1));
          break;
        case "ArrowLeft": // plus lent
          setVitesse((v) => Math.min(+(v + 0.05).toFixed(2), 1));
          break;
      }
    };

    window.addEventListener("keydown", gererTouche);
    return () => window.removeEventListener("keydown", gererTouche);
  }, [token]);

  const deconnexion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("pseudo");
    setToken(null);
    setPseudoConnecte(null);
    setReponse("");
    setQuestion("");
  };

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
        setToken(data.token);
        setPseudoConnecte(data.pseudo);
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

  // ---------- Page de la boule ----------
  return (
    <div className="app">
      <header className="entete">
        <span>
          Connecté en tant que <strong>{pseudoConnecte}</strong>
        </span>
        <button className="lien" onClick={deconnexion}>
          Se déconnecter
        </button>
      </header>

      <h1>Oracle8</h1>

      <form onSubmit={poserQuestion}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose ta question à la boule... (raccourci : /)"
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
          Secousse activée <kbd>S</kbd>
        </label>

        <label>
          Intensité : {intensite}px <kbd>↑</kbd>
          <kbd>↓</kbd>
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
          Vitesse : {vitesse}s <kbd>←</kbd>
          <kbd>→</kbd>
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

      <div className="aide-clavier">
        <span>
          <kbd>/</kbd> écrire
        </span>
        <span>
          <kbd>Entrée</kbd> demander
        </span>
        <span>
          <kbd>Échap</kbd> effacer
        </span>
        <span>
          <kbd>S</kbd> shake on/off
        </span>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> intensité
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> vitesse
        </span>
      </div>
    </div>
  );
}

export default App;
