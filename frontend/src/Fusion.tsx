import { useState } from "react";

export default function Fusion() {
  const [open, setOpen] = useState(false);
  const [sentences, setSentences] = useState(["", ""]);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  function setSentence(index: number, value: string) {
    setSentences((current) => current.map((text, i) => (i === index ? value : text)));
  }

  async function run() {
    setBusy(true);
    setResult("");
    const response = await fetch("/api/fusion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences }),
    });
    const data = await response.json();
    setResult(data.text || data.error || "");
    setBusy(false);
  }

  return (
    <div>
      <button onClick={() => setOpen((value) => !value)}>fuzja</button>
      {open && (
        <>
          {sentences.map((text, index) => (
            <textarea
              key={index}
              value={text}
              placeholder={`zdanie ${index + 1}`}
              onChange={(event) => setSentence(index, event.target.value)}
            />
          ))}
          <button onClick={() => setSentences((current) => [...current, ""])}>dodaj zdanie</button>
          <button disabled={busy} onClick={run}>
            {busy ? "scalam..." : "scal"}
          </button>
          {result && <pre>{result}</pre>}
        </>
      )}
    </div>
  );
}
