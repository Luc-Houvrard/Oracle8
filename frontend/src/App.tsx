import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("chargement...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setMessage(JSON.stringify(data)))
      .catch(() => setMessage("erreur : backend injoignable"));
  }, []);

  return (
    <div>
      <h1>Oracle8 🎱</h1>
      <p>Backend : {message}</p>
    </div>
  );
}

export default App;
