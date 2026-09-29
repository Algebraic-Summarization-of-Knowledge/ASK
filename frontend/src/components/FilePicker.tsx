export default function FilePicker({
  label,
  files,
  busy,
  onChange,
}: {
  label: string;
  files: File[];
  busy: boolean;
  onChange: (files: File[]) => void;
}) {
  const names = files.map((file) => file.name).join(", ");
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <label className="file-box">
        <span>{busy ? "Odczytuję PDF…" : names || "Wybierz pliki"}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busy}
          onChange={(event) => onChange([...(event.target.files ?? [])])}
        />
      </label>
    </div>
  );
}
