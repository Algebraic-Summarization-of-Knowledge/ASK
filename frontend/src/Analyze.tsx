import { useEffect, useRef, useState } from "react";
import { ArticlePick, type NamedArticle } from "./components/ArticleFlow";
import Button from "./components/Button";
import FilePicker from "./components/FilePicker";
import Select from "./components/Select";

type Topic = { folder: string; articles: NamedArticle[] };
type Article = NamedArticle & { text: string };
type Win = { index: number; previous: string | null; leading: string; next: string | null };
type Pair = { file: string; score: number; source: Win; other: Win; label: string | null };
type From = "dataset" | "import";

const LABELS = ["duplicate", "fusion", "new", "delete"];

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Analyze({ hidden = false, from }: { hidden?: boolean; from: From }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [folder, setFolder] = useState("");
  const [picked, setPicked] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<Article[]>([]);
  const [source, setSource] = useState("");
  const [importSource, setImportSource] = useState("");
  const [others, setOthers] = useState<string[]>([]);
  const [importOthers, setImportOthers] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState("");
  const [err, setErr] = useState("");
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/topics")
      .then((response) => response.json())
      .then((data) => {
        setTopics(data.topics ?? []);
        const names: string[] = data.models ?? [];
        setModels(names);
        setModel((current) => current || data.model || names[0] || "");
      })
      .catch(() => setErr("Nie udało się wczytać zbiorów."));
  }, []);

  const fromRef = useRef(from);
  useEffect(() => {
    if (fromRef.current === from) return;
    fromRef.current = from;
    setPairs([]);
    setReport("");
    setErr("");
  }, [from]);

  const topic = topics.find((item) => item.folder === folder);
  const articles = from === "dataset" ? (topic?.articles ?? []) : uploaded;
  const currentSource = from === "dataset" ? source : importSource;
  const currentOthers = from === "dataset" ? others : importOthers;
  const labeled = pairs.filter((pair) => pair.label && LABELS.includes(pair.label));

  function clearResult() {
    setPairs([]);
    setReport("");
  }

  function pickFolder(name: string) {
    setFolder(name);
    setSource("");
    setOthers([]);
    clearResult();
    setErr("");
  }

  function pickSource(file: string) {
    if (from === "dataset") {
      setSource(file);
      setOthers([]);
    } else {
      setImportSource(file);
      setImportOthers([]);
    }
    clearResult();
  }

  function toggleOther(file: string) {
    const update = (current: string[]) =>
      current.includes(file) ? current.filter((name) => name !== file) : [...current, file];
    if (from === "dataset") setOthers(update);
    else setImportOthers(update);
    clearResult();
  }

  function stop() {
    stopRef.current = true;
    abortRef.current?.abort();
  }

  async function extract(files: File[]) {
    setPicked(files);
    setUploaded([]);
    setImportSource("");
    setImportOthers([]);
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
      if (data.error) setErr(data.error);
      else setUploaded(data.articles ?? []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Nie udało się odczytać PDF");
    }
    setBusy("");
  }

  async function loadPairs() {
    stopRef.current = false;
    abortRef.current = new AbortController();
    setBusy("pairs");
    setErr("");
    clearResult();
    try {
      const response = await fetch(from === "dataset" ? "/api/convert" : "/api/import/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          from === "dataset"
            ? { folder, source, others }
            : { articles: uploaded, source: importSource, others: importOthers },
        ),
        signal: abortRef.current.signal,
      });
      const data = await response.json();
      if (data.error) {
        setErr(data.error);
      } else if (!stopRef.current) {
        setPairs(data.pairs ?? []);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErr(error instanceof Error ? error.message : "Nie udało się policzyć par");
      }
    }
    setBusy("");
  }

  async function classifyAll() {
    stopRef.current = false;
    setBusy("llm");
    setReport("");
    const next = [...pairs];
    for (let i = 0; i < next.length; i++) {
      if (stopRef.current) break;
      if (next[i].label) continue;
      abortRef.current = new AbortController();
      try {
        const response = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: next[i].source, other: next[i].other, model }),
          signal: abortRef.current.signal,
        });
        const data = await response.json();
        if (stopRef.current) break;
        next[i] = { ...next[i], label: data.label ?? data.error ?? "?" };
        setPairs([...next]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") break;
        next[i] = { ...next[i], label: "?" };
        setPairs([...next]);
      }
    }
    if (!stopRef.current) {
      setBusy("report");
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: from === "dataset" ? folder : "import",
          source: currentSource,
          others: currentOthers,
          pairs: next,
          model,
        }),
      });
      const data = await response.json();
      setReport(data.file ?? data.error ?? "");
    }
    setBusy("");
  }

  const running = busy === "pairs" || busy === "llm" || busy === "report";

  return (
    <div className="panel wide" hidden={hidden}>
      <Select
        label="Model"
        value={model}
        placeholder="Wybierz"
        options={(models.length ? models : [model].filter(Boolean)).map((name) => ({
          value: name,
          label: name,
        }))}
        onChange={setModel}
      />
      {from === "dataset" ? (
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
      ) : (
        <FilePicker label="Wgraj PDF" files={picked} busy={busy === "pdf"} onChange={extract} />
      )}
      {err && <p className="note">{err}</p>}
      <ArticlePick
        articles={articles}
        source={currentSource}
        others={currentOthers}
        onSource={pickSource}
        onToggle={toggleOther}
      />
      {currentSource && currentOthers.length > 0 && (
        <div className="actions">
          <Button active={!running} disabled={running} onClick={loadPairs}>
            {busy === "pairs" ? "Przetwarzam…" : "Przetwarzaj"}
          </Button>
          <Button active={pairs.length > 0 && !running} disabled={running || pairs.length === 0} onClick={classifyAll}>
            {busy === "llm" ? "Klasyfikuję…" : busy === "report" ? "Zapisuję…" : "Klasyfikuj"}
          </Button>
          {running && <Button onClick={stop}>Stop</Button>}
        </div>
      )}
      {report && <p className="note">{report}</p>}
      {labeled.length > 0 && <Counts pairs={labeled} />}
      {pairs.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>score</th>
              <th>label</th>
              <th>file</th>
              <th>source</th>
              <th>other</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, i) => (
              <tr key={`${pair.file}-${pair.other.index}-${i}`}>
                <td>{pair.score.toFixed(3)}</td>
                <td>{pair.label ?? "-"}</td>
                <td>
                  {pair.file} #{pair.other.index}
                </td>
                <td>{pair.source.leading}</td>
                <td>{pair.other.leading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Counts({ pairs }: { pairs: Pair[] }) {
  return (
    <table className="grid summary">
      <thead>
        <tr>
          <th>label</th>
          <th>n</th>
          <th>min</th>
          <th>max</th>
        </tr>
      </thead>
      <tbody>
        {LABELS.map((label) => {
          const scores = pairs.filter((pair) => pair.label === label).map((pair) => pair.score);
          const min = scores.length ? Math.min(...scores).toFixed(3) : "-";
          const max = scores.length ? Math.max(...scores).toFixed(3) : "-";
          return (
            <tr key={label}>
              <td>{label}</td>
              <td>{scores.length}</td>
              <td>{min}</td>
              <td>{max}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
