import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Judge from "./Judge";
import "./index.css";

function Pages() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <nav>
        <a href="#/">ask</a>
        <a href="#/analysis">analysis</a>
      </nav>
      {hash === "#/analysis" ? <Judge /> : <App />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Pages />);
