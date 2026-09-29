import type { Match } from "../Stars";
import type { Window } from "../Windows";
import Button from "./Button";
import Checkbox from "./Checkbox";
import Results from "./Results";
import Select from "./Select";

export type NamedArticle = { file: string; title: string };
export type ArticleWindows = { file: string; windows: Window[] };

function labelOf(article: NamedArticle) {
  return article.title ? `${article.file} — ${article.title}` : article.file;
}

export function ArticlePick({
  articles,
  source,
  others,
  onSource,
  onToggle,
}: {
  articles: NamedArticle[];
  source: string;
  others: string[];
  onSource: (file: string) => void;
  onToggle: (file: string) => void;
}) {
  const rest = articles.filter((article) => article.file !== source);

  return (
    <>
      {articles.length > 0 && (
        <Select
          label="Wybierz source article"
          value={source}
          placeholder="Wybierz"
          options={articles.map((article) => ({ value: article.file, label: labelOf(article) }))}
          onChange={onSource}
        />
      )}

      {source && (
        <div className="field">
          <span className="field-label">Wybierz artykuły</span>
          {rest.length === 0 ? (
            <p className="note">Brak innych artykułów.</p>
          ) : (
            <div className="checks">
              {rest.map((article) => (
                <Checkbox
                  key={article.file}
                  checked={others.includes(article.file)}
                  label={labelOf(article)}
                  onChange={() => onToggle(article.file)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ArticleFlow({
  articles,
  source,
  others,
  onSource,
  onToggle,
  onProcess,
  busy,
  done,
  windows,
  matches,
}: {
  articles: NamedArticle[];
  source: string;
  others: string[];
  onSource: (file: string) => void;
  onToggle: (file: string) => void;
  onProcess: () => void;
  busy: boolean;
  done: boolean;
  windows: ArticleWindows[];
  matches: Match[];
}) {
  return (
    <>
      <ArticlePick
        articles={articles}
        source={source}
        others={others}
        onSource={onSource}
        onToggle={onToggle}
      />

      {source && (
        <Button active={others.length > 0} disabled={busy || others.length === 0} onClick={onProcess}>
          {busy ? "Przetwarzam…" : "Przetwarzaj"}
        </Button>
      )}

      {done && <Results source={source} windows={windows} matches={matches} />}
    </>
  );
}
