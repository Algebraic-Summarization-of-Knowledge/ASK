import { useState } from "react";
import Button from "./components/Button";

export default function Fusion({ hidden = false }: { hidden?: boolean }) {
  const [sentences, setSentences] = useState(["", ""]);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = sentences.filter((text) => text.trim()).length >= 2;

  function setSentence(index: number, value: string) {
    setSentences((current) => current.map((text, i) => (i === index ? value : text)));
  }

  async function run() {
    setBusy(true);
    setResult("");
    setErr("");
    const response = await fetch("/api/fusion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences }),
    });
    const data = await response.json();
    if (data.error) setErr(data.error);
    else setResult(data.text ?? "");
    setBusy(false);
  }

  return (
    <div className="panel" hidden={hidden}>
      {sentences.map((text, index) => (
        <textarea
          key={index}
          className="field"
          value={text}
          placeholder={`Zdanie ${index + 1}`}
          onChange={(event) => setSentence(index, event.target.value)}
        />
      ))}
      <div className="actions">
        <Button onClick={() => setSentences((current) => [...current, ""])}>Dodaj zdanie</Button>
        <Button active={ready} disabled={busy || !ready} onClick={run}>
          {busy ? "Scalam…" : "Scal"}
        </Button>
      </div>
      {err && <p className="note">{err}</p>}
      {result && <pre className="block">{result}</pre>}
    </div>
  );
}
