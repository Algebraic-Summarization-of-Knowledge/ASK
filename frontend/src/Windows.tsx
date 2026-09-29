type Window = {
  index: number;
  previous: string | null;
  leading: string;
  next: string | null;
  previous_embedding: number[] | null;
  leading_embedding: number[];
  next_embedding: number[] | null;
};

function vec(values: number[] | null) {
  return values ? values.map((n) => n.toFixed(3)).join(" ") : "-";
}

export function Sentences({ window, caption }: { window: Window; caption?: string }) {
  return (
    <pre className="block">
      {caption ? `${caption}\n` : ""}#{window.index}
      {"\n"}prev: {window.previous ?? "-"}
      {"\n"}lead: {window.leading}
      {"\n"}next: {window.next ?? "-"}
    </pre>
  );
}

export function Embedding({ window }: { window: Window }) {
  return (
    <pre className="block">
      #{window.index}
      {"\n"}lead: {window.leading}
      {"\n"}prev emb: {vec(window.previous_embedding)}
      {"\n"}lead emb: {vec(window.leading_embedding)}
      {"\n"}next emb: {vec(window.next_embedding)}
    </pre>
  );
}

export type { Window };
