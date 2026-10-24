import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import ModelComparisonResearch from "./ModelComparisonResearch";

// Add each study here with its own report component.
const studies: {
  id: string;
  title: string;
  description: string;
  Report: ComponentType;
}[] = [
  {
    id: "model-comparison",
    title: "Porównanie modeli i analiza błędów",
    description:
      "Porównanie klasyfikacji par zdań z artykułów: wyniki benchmarku, przykłady pomyłek i wnioski z eksperymentu.",
    Report: ModelComparisonResearch,
  },
];

export default function Research() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = studies.find(study => study.id === selectedId);
  const panelRef = useRef<HTMLElement>(null);
  const lastOpenedId = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!lastOpenedId.current) return;
    if (selectedId) {
      panelRef.current?.querySelector<HTMLElement>("h2")?.focus();
    } else {
      panelRef.current?.querySelector<HTMLButtonElement>(
        `[data-study-id="${lastOpenedId.current}"]`,
      )?.focus();
    }
  }, [selectedId]);

  return (
    <section className="panel wide research" aria-labelledby="research-title" ref={panelRef}>
      {selected ? (
        <>
          <nav className="research-navigation" aria-label="Nawigacja badań">
            <button className="btn" onClick={() => setSelectedId(null)}>
              ← Wszystkie badania
            </button>
          </nav>
          <selected.Report />
        </>
      ) : (
        <>
          <header className="research-intro">
            <p className="research-eyebrow" id="research-title">ASK / badania</p>
          </header>
          <ul className="research-catalog" aria-label="Dostępne badania">
            {studies.map(study => (
              <li key={study.id}>
                <button
                  className="research-study"
                  data-study-id={study.id}
                  aria-label={`Otwórz badanie: ${study.title}`}
                  onClick={() => {
                    lastOpenedId.current = study.id;
                    setSelectedId(study.id);
                  }}
                >
                  <span className="research-study-copy">
                    <strong>{study.title}</strong>
                    <span>{study.description}</span>
                  </span>
                  <span className="research-study-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
