import { useEffect, useState } from "react";

interface Reponse {
  Id_Reponse: number;
  texte: string;
}

interface Utilisateur {
  Id_utilisateur: number;
  pseudo: string;
  role: string;
  nb_questions: number;
}

interface Props {
  apiUrl: string;
  token: string;
  monPseudo: string | null;
}

// Page d'administration : réponses de la boule et utilisateurs.
// Les droits sont vérifiés par le serveur ; cette page ne fait qu'afficher.
function Admin({ apiUrl, token, monPseudo }: Props) {
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState("");

  // Appelle l'API. Renvoie les données, ou null après avoir affiché l'erreur.
  const appeler = async (methode: string, chemin: string, corps?: object) => {
    try {
      const res = await fetch(`${apiUrl}/api/${chemin}`, {
        method: methode,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: corps && JSON.stringify(corps),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.erreur || "Erreur inconnue");
        return null;
      }
      return data;
    } catch {
      setErreur("Impossible de joindre le serveur.");
      return null;
    }
  };

  const charger = async () => {
    const r = await appeler("GET", "reponses");
    if (r) setReponses(r);
    const u = await appeler("GET", "admin/utilisateurs");
    if (u) setUtilisateurs(u);
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lance une action puis recharge les listes si elle a réussi
  const agir = async (methode: string, chemin: string, corps?: object) => {
    setErreur("");
    const ok = await appeler(methode, chemin, corps);
    if (ok) await charger();
    return ok;
  };

  const ajouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await agir("POST", "admin/reponses", { texte: nouveau })) {
      setNouveau("");
    }
  };

  const modifier = async (r: Reponse, champ: HTMLInputElement) => {
    if (champ.value === r.texte) return;
    const ok = await agir("PUT", `admin/reponses/${r.Id_Reponse}`, {
      texte: champ.value,
    });
    // Modification refusée : on remet l'ancien texte dans le champ
    if (!ok) champ.value = r.texte;
  };

  const supprimerUtilisateur = (u: Utilisateur) => {
    if (
      confirm(
        `Supprimer le compte « ${u.pseudo} » et ses ${u.nb_questions} question(s) ?`,
      )
    ) {
      agir("DELETE", `admin/utilisateurs/${u.Id_utilisateur}`);
    }
  };

  return (
    <section className="admin">
      <h2>Administration</h2>
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}

      <h3>Réponses de la boule ({reponses.length})</h3>
      <form onSubmit={ajouter}>
        <input
          type="text"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder="Nouvelle réponse"
          aria-label="Nouvelle réponse"
          maxLength={200}
          required
        />
        <button type="submit">Ajouter</button>
      </form>
      <p className="aide">
        Pour modifier une réponse : change le texte, puis appuie sur Entrée ou
        clique ailleurs.
      </p>
      <ul>
        {reponses.map((r) => (
          <li key={r.Id_Reponse}>
            <input
              type="text"
              defaultValue={r.texte}
              aria-label={`Réponse ${r.Id_Reponse}`}
              maxLength={200}
              onBlur={(e) => modifier(r, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <button
              className="danger"
              onClick={() => agir("DELETE", `admin/reponses/${r.Id_Reponse}`)}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>Utilisateurs ({utilisateurs.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Pseudo</th>
            <th>Rôle</th>
            <th>Questions</th>
            <th aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          {utilisateurs.map((u) => (
            <tr key={u.Id_utilisateur}>
              <td>{u.pseudo}</td>
              <td>{u.role}</td>
              <td>{u.nb_questions}</td>
              <td>
                <button
                  className="danger"
                  disabled={u.pseudo === monPseudo}
                  onClick={() => supprimerUtilisateur(u)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default Admin;
