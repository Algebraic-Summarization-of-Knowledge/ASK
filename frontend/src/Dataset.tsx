import { useEffect, useState } from "react";
import ArticleFlow, { type ArticleWindows, type NamedArticle } from "./components/ArticleFlow";
import Select from "./components/Select";
import type { Match } from "./Stars";

type Topic = { folder: string; articles: NamedArticle[] };

export default function Dataset({ hidden = false }: { hidden?: boolean }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [folder, setFolder] = useState("");
  const [source, setSource] = useState("");
  const [others, setOthers] = useState<string[]>([]);
  const [windows, setWindows] = useState<ArticleWindows[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/topics")
      .then((response) => response.json())
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => setErr("Nie udało się wczytać zbiorów."));
  }, []);

  const topic = topics.find((item) => item.folder === folder);

  function clearResult() {
    setWindows([]);
    setMatches([]);
    setDone(false);
  }

  function pickFolder(name: string) {
    setFolder(name);
    setSource("");
    setOthers([]);
    clearResult();
    setErr("");
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

  async function process() {
    setBusy(true);
    setErr("");
    clearResult();
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, source, others }),
    });
    const data = await response.json();
    if (data.error) {
      setErr(data.error);
    } else {
      setWindows(data.articles ?? []);
      setMatches(data.matches ?? []);
      setDone(true);
    }
    setBusy(false);
  }

  return (
    <div className="panel" hidden={hidden}>
      <Select
        label="Wybierz zbiór"
        value={folder}
        placeholder="Wybierz"
        options={topics.map((item) => ({
          value: item.folder,
          label: `${item.folder} (${item.articles.length})`,
        }))}
        onChange={pickFolder}
      />
      {err && <p className="note">{err}</p>}
      <ArticleFlow
        articles={topic?.articles ?? []}
        source={source}
        others={others}
        onSource={pickSource}
        onToggle={toggleOther}
        onProcess={process}
        busy={busy}
        done={done}
        windows={windows}
        matches={matches}
      />
    </div>
  );
}
