import { useEffect, useState } from "react";
import Windows, { type Window } from "./Windows";

type Article = { file: string; title: string };
type Topic = { folder: string; articles: Article[] };
type ArticleWindows = { file: string; windows: Window[] };
type Match = {
  index: number;
  leading: string;
  assigned: { file: string; index: number; leading: string; score: number }[];
};

export default function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [folder, setFolder] = useState("");
  const [source, setSource] = useState("");
  const [others, setOthers] = useState<string[]>([]);
  const [articles, setArticles] = useState<ArticleWindows[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/topics")
      .then((response) => response.json())
      .then((data) => setTopics(data.topics ?? []));
  }, []);

  const topic = topics.find((item) => item.folder === folder);
  const rest = topic?.articles.filter((article) => article.file !== source) ?? [];

  function windowsFor(file: string) {
    return articles.find((article) => article.file === file)?.windows;
  }

  function reset() {
    setArticles([]);
    setMatches([]);
  }

  function pickFolder(name: string) {
    setFolder(name);
    setSource("");
    setOthers([]);
    reset();
  }

  function toggleOther(file: string) {
    setOthers((current) =>
      current.includes(file) ? current.filter((name) => name !== file) : [...current, file],
    );
  }

  async function convert() {
    setBusy(true);
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, source, others }),
    });
    const data = await response.json();
    setArticles(data.articles ?? []);
    setMatches(data.matches ?? []);
    setBusy(false);
  }

  return (
    <div>
      <label>
        folder
        <select value={folder} onChange={(event) => pickFolder(event.target.value)}>
          <option value="">wybierz</option>
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
              reset();
            }}
          >
            <option value="">wybierz</option>
            {topic.articles.map((article) => (
              <option key={article.file} value={article.file}>
                {article.file} - {article.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {source && windowsFor(source) && <Windows windows={windowsFor(source)!} />}

      {source &&
        rest.map((article) => (
          <div key={article.file}>
            <label>
              <input
                type="checkbox"
                checked={others.includes(article.file)}
                onChange={() => toggleOther(article.file)}
              />
              {article.file} - {article.title}
            </label>
            {windowsFor(article.file) && <Windows windows={windowsFor(article.file)!} />}
          </div>
        ))}

      {source && (
        <button disabled={busy} onClick={convert}>
          {busy ? "licze..." : "konwertuj"}
        </button>
      )}

      {matches.map((group) => (
        <div key={group.index}>
          <b>
            source #{group.index}: {group.leading}
          </b>
          {group.assigned.length === 0
            ? <div>brak dopasowan</div>
            : group.assigned.map((item) => (
                <div key={`${item.file}-${item.index}`}>
                  {item.file} #{item.index} ({item.score.toFixed(3)}) {item.leading}
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}
