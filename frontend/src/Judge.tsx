import { useEffect, useRef, useState } from "react";

type Article = { file: string; title: string };
type Topic = { folder: string; articles: Article[] };
type Win = { index: number; previous: string | null; leading: string; next: string | null };
type Pair = { file: string; score: number; source: Win; other: Win; label: string | null };

const LABELS = ["duplicate", "fusion", "new", "delete"];

export default function Judge() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [folder, setFolder] = useState("");
  const [source, setSource] = useState("");
  const [others, setOthers] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [busy, setBusy] = useState("");
  const [model, setModel] = useState("");
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
      });
  }, []);

  const topic = topics.find((item) => item.folder === folder);
  const rest = topic?.articles.filter((article) => article.file !== source) ?? [];

  function pickFolder(name: string) {
    setFolder(name);
    setSource("");
    setOthers([]);
    setPairs([]);
  }

  function stop() {
    stopRef.current = true;
    abortRef.current?.abort();
  }

  async function loadPairs() {
    stopRef.current = false;
    abortRef.current = new AbortController();
    setBusy("pairs");
    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, source, others }),
        signal: abortRef.current.signal,
      });
      const data = await response.json();
      if (data.error) {
        setErr(data.error);
        setPairs([]);
      } else if (!stopRef.current) {
        setErr("");
        setPairs(data.pairs ?? []);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) throw err;
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
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") break;
        next[i] = { ...next[i], label: "?" };
        setPairs([...next]);
      }
    }
    if (!stopRef.current) {
      setBusy("report");
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, source, others, pairs: next, model }),
      });
      const data = await response.json();
      setReport(data.file ?? data.error ?? "");
    }
    setBusy("");
  }

  const labeled = pairs.filter((pair) => pair.label && LABELS.includes(pair.label));

  return (
    <div>
      <p>
        1-NN builds pairs (source window × other window) with a similarity score. The selected Ollama
        model assigns duplicate / fusion / new / delete. After classify, PDF in reports/.
      </p>
      <label>
        model
        <select value={model} onChange={(event) => setModel(event.target.value)}>
          {models.length === 0 && <option value={model}>{model || "none"}</option>}
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        folder
        <select value={folder} onChange={(event) => pickFolder(event.target.value)}>
          <option value="">select</option>
          {topics.map((item) => (
            <option key={item.folder} value={item.folder}>
              {item.folder} ({item.articles.length})
            </option>
          ))}
        </select>
      </label>
      {topic && (
        <label>
          source
          <select
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setOthers([]);
              setPairs([]);
            }}
          >
            <option value="">select</option>
            {topic.articles.map((article) => (
              <option key={article.file} value={article.file}>
                {article.file} - {article.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {source &&
        rest.map((article) => (
          <label key={article.file}>
            <input
              type="checkbox"
              checked={others.includes(article.file)}
              onChange={() =>
                setOthers((current) =>
                  current.includes(article.file)
                    ? current.filter((name) => name !== article.file)
                    : [...current, article.file],
                )
              }
            />
            {article.file} - {article.title}
          </label>
        ))}
      {err && <p>{err}</p>}
      {source && others.length > 0 && (
        <>
          <button disabled={!!busy} onClick={loadPairs}>
            {busy === "pairs" ? "computing pairs..." : "compute pairs"}
          </button>
          <button disabled={!!busy || pairs.length === 0} onClick={classifyAll}>
            {busy === "llm" ? "classifying..." : busy === "report" ? "saving report..." : "classify with llm"}
          </button>
          {busy && (
            <button type="button" onClick={stop}>
              stop
            </button>
          )}
        </>
      )}
      {labeled.length > 0 && <Counts pairs={labeled} />}
      {report && <p>{report}</p>}
      {pairs.length > 0 && (
        <table>
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
    <div>
      {LABELS.map((label) => {
        const scores = pairs.filter((pair) => pair.label === label).map((pair) => pair.score);
        if (scores.length === 0) return <div key={label}>{label}: 0</div>;
        return (
          <div key={label}>
            {label}: {scores.length} min {Math.min(...scores).toFixed(3)} max {Math.max(...scores).toFixed(3)}
          </div>
        );
      })}
    </div>
  );
}
