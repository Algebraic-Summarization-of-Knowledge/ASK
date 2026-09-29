import { useState } from "react";
import ArticleFlow, { type ArticleWindows } from "./components/ArticleFlow";
import FilePicker from "./components/FilePicker";
import type { Match } from "./Stars";

type Article = { file: string; title: string; text: string };

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Import({ hidden = false }: { hidden?: boolean }) {
  const [picked, setPicked] = useState<File[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [source, setSource] = useState("");
  const [others, setOthers] = useState<string[]>([]);
  const [windows, setWindows] = useState<ArticleWindows[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  function clearResult() {
    setWindows([]);
    setMatches([]);
    setDone(false);
  }

  function pickSource(file: string) {
    setSource(file);
    setOthers([]);
    clearResult();
  }

  function toggleOther(file: string) {
    setOthers((current) =>
      current.includes(file) ? current.filter((name) => name !== file) : [...current, file],
    );
    clearResult();
  }

  async function extract(files: File[]) {
    setPicked(files);
    setArticles([]);
    setSource("");
    setOthers([]);
    clearResult();
    setErr("");
    if (files.length === 0) return;
    setBusy("pdf");
    try {
      const payload = await Promise.all(
        files.map(async (file) => ({ name: file.name, data: await readBase64(file) })),
      );
      const response = await fetch("/api/import/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload }),
      });
      const data = await response.json();
      if (data.error) {
        setErr(data.error);
      } else {
        setArticles(data.articles ?? []);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Nie udało się odczytać PDF");
    }
    setBusy("");
  }

  async function process() {
    setBusy("run");
    setErr("");
    clearResult();
    const response = await fetch("/api/import/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles, source, others }),
    });
    const data = await response.json();
    if (data.error) {
      setErr(data.error);
    } else {
      setWindows(data.articles ?? []);
      setMatches(data.matches ?? []);
      setDone(true);
    }
    setBusy("");
  }

  return (
    <div className="panel" hidden={hidden}>
      <FilePicker label="Wgraj PDF" files={picked} busy={busy === "pdf"} onChange={extract} />
      {err && <p className="note">{err}</p>}
      <ArticleFlow
        articles={articles}
        source={source}
        others={others}
        onSource={pickSource}
        onToggle={toggleOther}
        onProcess={process}
        busy={busy !== ""}
        done={done}
        windows={windows}
        matches={matches}
      />
    </div>
  );
}
