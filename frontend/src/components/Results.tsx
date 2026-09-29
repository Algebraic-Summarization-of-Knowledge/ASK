import { useEffect, useRef, useState } from "react";
import Stars, { type Match } from "../Stars";
import { Embedding, Sentences, type Window } from "../Windows";
import ButtonBar from "./ButtonBar";

type ArticleWindows = { file: string; windows: Window[] };
type View = "embeddings" | "graphs" | "connections";

const VIEWS: { id: View; label: string }[] = [
  { id: "embeddings", label: "Wyświetl embeddings" },
  { id: "graphs", label: "Wyświetl grafy" },
  { id: "connections", label: "Wyświetl połączenia" },
];

function windowAt(articles: ArticleWindows[], file: string, index: number) {
  return articles.find((article) => article.file === file)?.windows.find((window) => window.index === index);
}

export default function Results({
  source,
  windows,
  matches,
}: {
  source: string;
  windows: ArticleWindows[];
  matches: Match[];
}) {
  const [view, setView] = useState<View>("connections");
  const ref = useRef<HTMLDivElement>(null);
  const linked = matches.filter((group) => group.assigned.length > 0);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <div className="results" ref={ref}>
      <ButtonBar value={view} options={VIEWS} onChange={setView} />
      {view === "embeddings" && <Embeddings windows={windows} />}
      {view === "graphs" && <Graphs matches={linked} />}
      {view === "connections" && <Connections source={source} windows={windows} matches={linked} />}
    </div>
  );
}

function Embeddings({ windows }: { windows: ArticleWindows[] }) {
  if (windows.length === 0) return <p className="note">Brak embeddingów.</p>;
  return (
    <div className="stack">
      {windows.map((article) => (
        <section className="stack" key={article.file}>
          <h2 className="file-name">{article.file}</h2>
          {article.windows.map((window) => (
            <Embedding key={window.index} window={window} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Graphs({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return <p className="note">Brak grafów.</p>;
  return (
    <div className="graphs">
      <Stars matches={matches} />
    </div>
  );
}

function Connections({
  source,
  windows,
  matches,
}: {
  source: string;
  windows: ArticleWindows[];
  matches: Match[];
}) {
  if (matches.length === 0) return <p className="note">Brak połączeń.</p>;
  return (
    <div className="stack">
      {matches.map((group) => {
        const origin = windowAt(windows, source, group.index);
        return (
          <section className="group" key={group.index}>
            {origin ? (
              <Sentences window={origin} caption={source} />
            ) : (
              <pre className="block">
                {source}
                {"\n"}#{group.index}
                {"\n"}lead: {group.leading}
              </pre>
            )}
            {group.assigned.map((item) => {
              const caption = `${item.file} #${item.index} · ${item.score.toFixed(3)}`;
              const other = windowAt(windows, item.file, item.index);
              return other ? (
                <Sentences key={`${item.file}-${item.index}`} window={other} caption={caption} />
              ) : (
                <pre className="block" key={`${item.file}-${item.index}`}>
                  {caption}
                  {"\n"}lead: {item.leading}
                </pre>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
