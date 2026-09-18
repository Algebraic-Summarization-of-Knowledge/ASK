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

export default function Windows({ windows }: { windows: Window[] }) {
  return windows.map((window) => (
    <pre key={window.index}>
      #{window.index}
      {"\n"}prev: {window.previous ?? "-"}
      {"\n"}lead: {window.leading}
      {"\n"}next: {window.next ?? "-"}
      {"\n"}prev emb: {vec(window.previous_embedding)}
      {"\n"}lead emb: {vec(window.leading_embedding)}
      {"\n"}next emb: {vec(window.next_embedding)}
    </pre>
  ));
}

export type { Window };
