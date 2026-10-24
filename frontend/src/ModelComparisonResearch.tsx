import { useState } from "react";

const LABELS = ["duplicate", "fusion", "new", "delete"] as const;
type ContextWindow = {
  index: number;
  previous: string | null;
  leading: string;
  next: string | null;
};

export default function ModelComparisonResearch() {
  return (
    <>
      <header className="research-intro">
        <p className="research-eyebrow">ASK / badania</p>
        <h2 id="research-title" tabIndex={-1}>Porównanie modeli i analiza błędów</h2>
        <p>
          Sprawdzamy, który model najtrafniej przypisuje <code>duplicate</code>,{" "}
          <code>fusion</code>, <code>new</code> i <code>delete</code> do par zdań
          z artykułów. Poniżej wyniki aktualnego benchmarku, przykłady niezgodności i plan dalszego badania.
        </p>
      </header>

      <ResearchResults />

      <section className="research-section" aria-labelledby="research-new-delete-conclusion">
        <h3 id="research-new-delete-conclusion">Wnioski z porównania</h3>
        <p>Najczęstsze pomyłki w badanym zestawie dotyczą rozróżnienia new i delete.
          Trudność polega na ustaleniu, czy zdanie wnosi nową informację o tym samym konkretnym
          wydarzeniu, czy jedynie dotyczy podobnego tematu. Szczególnie niejednoznaczne są
          informacje stanowiące tło oraz opisy różnych działań w ramach szerszego procesu,
          na przykład wojny lub kryzysu bankowego.</p>
        <p>Ta granica sprawia trudność również przy ręcznym oznaczaniu. Część niezgodności
          może więc wynikać z różnego rozumienia zakresu wydarzenia, a nie wyłącznie z błędów
          modeli. Przed kolejnym eksperymentem należy doprecyzować, jakie przyczyny, skutki,
          reakcje i informacje kontekstowe zaliczamy do tego samego wydarzenia, oraz uzupełnić
          instrukcję o przykłady graniczne. Wspólna osoba, organizacja lub tematyka nie powinny
          same przesądzać o etykiecie new.</p>
        <p>Ocenę klasy fusion ogranicza mała liczba przykładów: w badanym zestawie było tylko
          6 takich par. Pojedyncze pomyłki mają więc duży wpływ na wynik
          tej klasy, kolejny zbiór powinien zawierać więcej przykładów fusion
          z różnych wydarzeń, aby sprawdzić, czy obserwowane różnice między modelami się utrzymują.</p>
      </section>

      <section className="research-section" aria-labelledby="research-next-experiments">
        <h3 id="research-next-experiments">Przyszłe eksperymenty</h3>
        <article className="research-experiment">
          <h4>Wpływ kontekstu</h4>
          <p>Porównamy wyniki tego samego modelu na tych samych parach w dwóch wariantach:
            z samymi zdaniami lead oraz z prev i next po obu stronach. Spodziewamy się,
            że kontekst pomoże ustalić, o kim i o jakim wydarzeniu jest mowa.
            Sprawdzimy zmianę macro-F1 oraz konkretne przypadki, w których dodanie kontekstu
            poprawia odpowiedź albo prowadzi do pomyłki.</p>
        </article>
        <article className="research-experiment">
          <h4>Koszt klasyfikacji</h4>
          <p>Rozszerzymy zapis wyników o zużycie tokenów wejściowych i wyjściowych oraz koszt
            wywołań, sprawdzimy, ile kosztuje wzrost jakości
            przy wyborze innego modelu lub dodaniu kontekstu.</p>
        </article>
        <article className="research-experiment">
          <h4>Dobieranie par: 1-NN a k-NN</h4>
          <p>Zamiast jednego dopasowania do zdania OTHER sprawdzimy też trzy i pięć najbardziej
            podobnych zdań SOURCE. Porównamy, czy pozwala to znaleźć więcej poprawnych par fusion
            oraz o ile zwiększa czas i koszt klasyfikacji.</p>
        </article>
      </section>

    </>
  );
}

const percent = (value: number) => `${(100 * value).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const decimal = (value: number, digits = 4) => value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const curated = ["pair_005", "pair_040", "pair_006", "pair_035", "pair_066"];
const explanations: Record<string, { title: string; text: string }> = {
  pair_005: {
    title: "Tło opóźnionej wizyty",
    text: "SOURCE zapowiada spotkanie Bidena i Trudeau w Kanadzie. OTHER podaje zwyczajowy termin takich wizyt, a next wyjaśnia, dlaczego wizyta Bidena nastąpiła później. Oczekiwana etykieta to new, ponieważ ta informacja stanowi tło konkretnej wizyty. Model mini zwrócił delete, natomiast modele nano i Terra zwróciły new.",
  },
  pair_040: {
    title: "Postulat i statystyka to różne twierdzenia",
    text: "SOURCE wyraża żądanie zakończenia nielegalnych przekroczeń granicy. OTHER podaje liczbę osób przekraczających ją w poprzednim roku. Dotyczą tej samej sprawy, ale statystyka nie jest szczegółem tego samego postulatu. Oczekiwana etykieta to new, a model mini zwrócił fusion.",
  },
  pair_006: {
    title: "Zapowiedź spotkania i temat rozmów",
    text: "SOURCE zapowiada spotkanie i przemówienie podczas wizyty Bidena w Kanadzie, a OTHER wskazuje jeden z tematów rozmów z Trudeau. To odrębna informacja o tej samej wizycie, dlatego oczekiwana etykieta to new. Model nano zwrócił delete, natomiast modele mini i Terra zwróciły new. Ocenny język OTHER nie zmienia tego, jaką rozmowę ono zapowiada.",
  },
  pair_035: {
    title: "Dwa różne kontakty dyplomatyczne",
    text: "Kontekst SOURCE wskazuje planowaną rozmowę Xi z Zełenskim. OTHER dotyczy zaproszenia premiera Japonii Kishidy do Kijowa. Wspólny rozmówca i temat wojny nie oznaczają tego samego wydarzenia. Oczekiwana etykieta to delete. Model mini zwrócił new, a modele nano i Terra zwróciły delete.",
  },
  pair_066: {
    title: "Informacja o zaopatrzeniu podczas tej samej bitwy",
    text: "SOURCE opisuje walki o Bachmut. OTHER przedstawia przypuszczenia żołnierzy o gromadzeniu amunicji i pogorszeniu morale w kontekście tych walk. Oczekiwana etykieta to new, ponieważ jest to odrębne twierdzenie o tej samej bitwie. Model Terra zwrócił delete, natomiast modele mini i nano zwróciły new. Wypowiedź żołnierzy pozostaje przypuszczeniem, a nie potwierdzonym faktem.",
  },
};

function Context({ title, window }: { title: string; window: ContextWindow }) {
  return <article className="benchmark-context">
    <h3>{title}</h3>
    <div className="benchmark-lead"><small>lead · zdanie oceniane</small><p>{window.leading}</p></div>
    <details className="research-case-context">
      <summary>Pokaż prev / next</summary>
      <small>prev</small><p>{window.previous ?? "Brak poprzedniego zdania."}</p>
      <small>next</small><p>{window.next ?? "Brak następnego zdania."}</p>
    </details>
  </article>;
}

function ResearchResults() {
  const [matrixModel, setMatrixModel] = useState(data.models[0].model);
  const [errorModel, setErrorModel] = useState("all");
  const [errorType, setErrorType] = useState("all");
  const selected = data.models.find(model => model.model === matrixModel)!;
  const leader = data.models[0];
  const runnerUp = data.models[1];
  const cases = data.cases
    .filter(item => curated.includes(item.pair_id))
    .sort((left, right) => curated.indexOf(left.pair_id) - curated.indexOf(right.pair_id))
    .filter(item => {
    const wrong = item.predictions.filter(p => !p.correct && (errorModel === "all" || p.model === errorModel));
    if (!wrong.length) return false;
    if (errorType === "common") return item.all_models_wrong;
    if (errorType === "new-delete") return wrong.some(p => [item.reference_label, p.label].sort().join("/") === "delete/new");
    if (errorType === "fusion-new") return wrong.some(p => [item.reference_label, p.label].sort().join("/") === "fusion/new");
    return true;
  });

  return <>
    <section className="research-section" aria-labelledby="research-ranking">
      <h3 id="research-ranking">Porównanie jakości i czasu</h3>
      <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Tabela wyników modeli">
        <table className="grid research-results-table">
          <caption>Te same pary, etykiety, prompt i mechanizm judge.classify()</caption>
          <thead><tr><th scope="col">Model</th><th scope="col">Trafienia</th><th scope="col">Accuracy</th><th scope="col">Macro-F1</th><th scope="col">Mediana / parę</th></tr></thead>
          <tbody>{data.models.map(model => <tr key={model.model}>
            <th scope="row">{model.model}</th><td>{model.correct}/{model.all.count}</td>
            <td>{percent(model.all.accuracy)}</td><td><strong>{decimal(model.all.macro_f1)}</strong></td>
            <td>{decimal(model.all.median_seconds, 2)} s</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p><strong>Najwyższa zgodność: {leader.model}.</strong> Ma o {leader.correct - runnerUp.correct} trafień więcej niż {runnerUp.model},
        a przewaga macro-F1 wynosi {decimal(leader.all.macro_f1 - runnerUp.all.macro_f1)}.
        Mediana czasu jest około {decimal(leader.all.median_seconds / runnerUp.all.median_seconds, 1)} razy większa.</p>
    </section>

    <section className="research-section" aria-labelledby="research-class-results">
      <h3 id="research-class-results">F1 dla poszczególnych klas</h3>
      <div className="research-table-scroll" tabIndex={0} role="region" aria-label="Wyniki poszczególnych klas">
        <table className="grid research-results-table">
          <caption>Liczebności: duplicate 5 · fusion 6 · new 37 · delete 46</caption>
          <thead><tr><th scope="col">Model</th>{LABELS.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{data.models.map(model => <tr key={model.model}><th scope="row">{model.model}</th>
            {LABELS.map(label => <td key={label}>{decimal(model.all.per_class[label].f1)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>Mini znalazło wszystkie 6 par z oczekiwaną etykietą fusion, ale oznaczyło tak też 9 innych par: precision tej klasy to 40%.
        Nano nie miało fałszywych fusion, ale rozpoznało tylko 3 z 6, czyli recall 50%.
        Terra uzyskała precision i recall po 83,33%.</p>
      <p>Wśród 5 par duplicate były 3 pary z identycznymi zdaniami. Program przypisał im etykietę automatycznie,
        bez wywoływania modelu. Każdy model poprawnie oznaczył pozostałe 2 pary.</p>
    </section>

    <section className="research-section" aria-labelledby="research-confusion">
      <h3 id="research-confusion">Gdzie model się myli?</h3>
      <label className="research-control">Model
        <select value={matrixModel} onChange={event => setMatrixModel(event.target.value)}>
          {data.models.map(model => <option key={model.model}>{model.model}</option>)}
        </select>
      </label>
      <div className="research-table-scroll" tabIndex={0} role="region" aria-label={`Macierz pomyłek ${matrixModel}`}>
        <table className="grid research-results-table research-matrix">
          <caption>Wiersz = oczekiwana etykieta · kolumna = odpowiedź modelu · liczby oznaczają pary</caption>
          <thead><tr><th scope="col">Oczekiwana ↓ / model →</th>{LABELS.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{LABELS.map(reference => <tr key={reference}><th scope="row">{reference}</th>{LABELS.map(predicted => {
            const count = selected.all.confusion_matrix[reference][predicted];
            return <td key={predicted} className={reference === predicted ? "research-matrix-correct" : count ? "research-matrix-error" : ""}>
              {count}{reference !== predicted && count > 0 && <small>pomyłka</small>}
            </td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      <p>Dla {matrixModel}: {selected.all.confusion_matrix.new.delete} par new trafiło do delete,
        a {selected.all.confusion_matrix.delete.new} par delete do new.
        W pierwszym przypadku model odrzuca informację z oczekiwaną etykietą new.
        W drugim zachowuje informację oznaczoną w benchmarku jako niepowiązana lub nieużyteczna.</p>
    </section>

    <section className="research-section" aria-labelledby="research-error-examples">
      <h3 id="research-error-examples">Przykładowe błędne wyniki</h3>
      <div className="research-error-filters">
        <label className="research-control">Błędy modelu
          <select value={errorModel} onChange={event => setErrorModel(event.target.value)}>
            <option value="all">Dowolnego modelu</option>{data.models.map(model => <option key={model.model}>{model.model}</option>)}
          </select>
        </label>
        <label className="research-control">Rodzaj
          <select value={errorType} onChange={event => setErrorType(event.target.value)}>
            <option value="all">Wszystkie pomyłki</option><option value="new-delete">new ↔ delete</option>
            <option value="fusion-new">fusion ↔ new</option><option value="common">Wszystkie modele wybrały inną etykietę</option>
          </select>
        </label>
      </div>
      <p role="status">Pasujących przykładów: {cases.length} / {curated.length}.</p>
      {cases.map(item => <article className="research-error-case" key={item.pair_id}>
        <header><h4>{item.pair_id} · {explanations[item.pair_id]?.title ?? "Inna etykieta niż oczekiwana"}</h4>
          <p>Oczekiwana etykieta: <strong>{item.reference_label}</strong>{item.all_models_wrong ? " · wszystkie trzy modele odpowiedziały inaczej" : ""}</p>
        </header>
        <div className="research-case-predictions">{item.predictions.map(prediction => <div key={prediction.model} className={!prediction.correct ? "research-prediction-error" : ""}>
          <small>{prediction.model}</small><strong>{prediction.label}</strong><span>{prediction.correct ? "zgodna z oczekiwaną" : "inna niż oczekiwana"}</span>
        </div>)}</div>
        <div className="benchmark-columns"><Context title="SOURCE" window={item.source} /><Context title="OTHER" window={item.other} /></div>
        {explanations[item.pair_id] && <p>{explanations[item.pair_id].text}</p>}
      </article>)}
    </section>

  </>;
}

// Snapshot of reports/benchmark_95_recomputed; no API calls.
const data = {
  "report_directory": "reports/benchmark_95_recomputed",
  "recomputed_utc": "2026-10-18T21:25:02.564050+00:00",
  "benchmark_pairs": 95,
  "evaluated_pairs": 94,
  "unlabeled_pair_ids": [
    "pair_018"
  ],
  "corpus_pairs": 92,
  "generated_pairs": 3,
  "models": [
    {
      "model": "gpt-5.6-terra",
      "correct": 83,
      "all": {
        "count": 94,
        "errors": 0,
        "accuracy": 0.8829787234042553,
        "macro_f1": 0.896941391941392,
        "macro_f1_labels": [
          "duplicate",
          "fusion",
          "new",
          "delete"
        ],
        "per_class": {
          "duplicate": {
            "support": 5,
            "precision": 1.0,
            "recall": 1.0,
            "f1": 1.0
          },
          "fusion": {
            "support": 6,
            "precision": 0.8333333333333334,
            "recall": 0.8333333333333334,
            "f1": 0.8333333333333334
          },
          "new": {
            "support": 37,
            "precision": 0.8421052631578947,
            "recall": 0.8648648648648649,
            "f1": 0.8533333333333334
          },
          "delete": {
            "support": 46,
            "precision": 0.9111111111111111,
            "recall": 0.8913043478260869,
            "f1": 0.9010989010989011
          }
        },
        "confusion_matrix": {
          "duplicate": {
            "duplicate": 5,
            "fusion": 0,
            "new": 0,
            "delete": 0,
            "error": 0
          },
          "fusion": {
            "duplicate": 0,
            "fusion": 5,
            "new": 1,
            "delete": 0,
            "error": 0
          },
          "new": {
            "duplicate": 0,
            "fusion": 1,
            "new": 32,
            "delete": 4,
            "error": 0
          },
          "delete": {
            "duplicate": 0,
            "fusion": 0,
            "new": 5,
            "delete": 41,
            "error": 0
          }
        },
        "confusion_rows": "reference",
        "confusion_columns": "predicted",
        "information_loss_count": 4,
        "information_loss_rate": 0.09302325581395349,
        "median_seconds": 1.351336949999677,
        "p95_seconds": 2.3195458400034115,
        "total_seconds": 133.16521569990437,
        "routes": {
          "llm": 90,
          "same_lead_heuristic": 3,
          "junk_lead_heuristic": 1
        },
        "generate_calls": 90,
        "repair_attempts": 0
      }
    },
    {
      "model": "gpt-5.4-nano",
      "correct": 75,
      "all": {
        "count": 94,
        "errors": 0,
        "accuracy": 0.7978723404255319,
        "macro_f1": 0.8115000941087898,
        "macro_f1_labels": [
          "duplicate",
          "fusion",
          "new",
          "delete"
        ],
        "per_class": {
          "duplicate": {
            "support": 5,
            "precision": 1.0,
            "recall": 1.0,
            "f1": 1.0
          },
          "fusion": {
            "support": 6,
            "precision": 1.0,
            "recall": 0.5,
            "f1": 0.6666666666666666
          },
          "new": {
            "support": 37,
            "precision": 0.725,
            "recall": 0.7837837837837838,
            "f1": 0.7532467532467533
          },
          "delete": {
            "support": 46,
            "precision": 0.8260869565217391,
            "recall": 0.8260869565217391,
            "f1": 0.8260869565217391
          }
        },
        "confusion_matrix": {
          "duplicate": {
            "duplicate": 5,
            "fusion": 0,
            "new": 0,
            "delete": 0,
            "error": 0
          },
          "fusion": {
            "duplicate": 0,
            "fusion": 3,
            "new": 3,
            "delete": 0,
            "error": 0
          },
          "new": {
            "duplicate": 0,
            "fusion": 0,
            "new": 29,
            "delete": 8,
            "error": 0
          },
          "delete": {
            "duplicate": 0,
            "fusion": 0,
            "new": 8,
            "delete": 38,
            "error": 0
          }
        },
        "confusion_rows": "reference",
        "confusion_columns": "predicted",
        "information_loss_count": 8,
        "information_loss_rate": 0.18604651162790697,
        "median_seconds": 0.6749931000013021,
        "p95_seconds": 0.904215264999948,
        "total_seconds": 65.29227959999116,
        "routes": {
          "llm": 90,
          "same_lead_heuristic": 3,
          "junk_lead_heuristic": 1
        },
        "generate_calls": 93,
        "repair_attempts": 3
      }
    },
    {
      "model": "gpt-5.4-mini",
      "correct": 67,
      "all": {
        "count": 94,
        "errors": 0,
        "accuracy": 0.7127659574468085,
        "macro_f1": 0.7383147931303669,
        "macro_f1_labels": [
          "duplicate",
          "fusion",
          "new",
          "delete"
        ],
        "per_class": {
          "duplicate": {
            "support": 5,
            "precision": 1.0,
            "recall": 1.0,
            "f1": 1.0
          },
          "fusion": {
            "support": 6,
            "precision": 0.4,
            "recall": 1.0,
            "f1": 0.5714285714285714
          },
          "new": {
            "support": 37,
            "precision": 0.75,
            "recall": 0.4864864864864865,
            "f1": 0.5901639344262295
          },
          "delete": {
            "support": 46,
            "precision": 0.76,
            "recall": 0.8260869565217391,
            "f1": 0.7916666666666666
          }
        },
        "confusion_matrix": {
          "duplicate": {
            "duplicate": 5,
            "fusion": 0,
            "new": 0,
            "delete": 0,
            "error": 0
          },
          "fusion": {
            "duplicate": 0,
            "fusion": 6,
            "new": 0,
            "delete": 0,
            "error": 0
          },
          "new": {
            "duplicate": 0,
            "fusion": 7,
            "new": 18,
            "delete": 12,
            "error": 0
          },
          "delete": {
            "duplicate": 0,
            "fusion": 2,
            "new": 6,
            "delete": 38,
            "error": 0
          }
        },
        "confusion_rows": "reference",
        "confusion_columns": "predicted",
        "information_loss_count": 12,
        "information_loss_rate": 0.27906976744186046,
        "median_seconds": 0.6723224999950617,
        "p95_seconds": 1.1178070050002133,
        "total_seconds": 69.29556190002768,
        "routes": {
          "llm": 90,
          "same_lead_heuristic": 3,
          "junk_lead_heuristic": 1
        },
        "generate_calls": 91,
        "repair_attempts": 1
      }
    }
  ],
  "cases": [
    {
      "pair_id": "pair_002",
      "reference_label": "delete",
      "source": {
        "index": 4,
        "previous": "The changes won a surprising supporter: liberal former congressman Barney Frank.",
        "leading": "Frank was a primary architect of the Wall Street Reform and Consumer Protection Act, better known as Dodd-Frank.",
        "next": "But since his retirement in 2013, he had repeatedly voiced support for softening one of the law's key planks: that any bank with more than $50 billion in assets should face especially intensive federal supervision."
      },
      "other": {
        "index": 10,
        "previous": "FRANK: No, I disagree.",
        "leading": "I didn't like that whole bill because there were parts of it in the housing discrimination and the like.",
        "next": "But, no, I don't think there is any sign that the rollback caused the problem in the first place."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_003",
      "reference_label": "new",
      "source": {
        "index": 40,
        "previous": "\"We know that Iraq and al-Qaida have had high-level contacts that go back a decade.\" Neither Bush nor senior administration officials directly linked Iraq or its leader to the planning or execution of the 9/11 attacks.",
        "leading": "Yet a sizable majority of Americans believed that Hussein aided the terrorist attacks that took nearly 3,000 lives.",
        "next": "The same month that Congress approved the use of force resolution against Iraq, 66% of the public said that \"Saddam Hussein helped the terrorists in the September 11th attacks\"; just 21% said he was not involved in 9/11."
      },
      "other": {
        "index": 76,
        "previous": "When the invasion began, in March 2003, little went according to plan.",
        "leading": "Many in the administration and the media were surprised.",
        "next": "Not Landay, Strobel, Galloway, or me."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_004",
      "reference_label": "new",
      "source": {
        "index": 27,
        "previous": "The bank knew that \"women entrepreneurs are a massive market opportunity and they were very bullish on trying to engage with our community in various ways,\" said Karen Cahn, the CEO of iFundWomen, a funding marketplace for women-led start-ups and small businesses.",
        "leading": "But last week, SVB's appetite for risk and a serious miscalculation of the changing economic climate led to its demise.",
        "next": "SVB failed to act quickly when a confluence of rising interest rates and diminished funding in start-ups, the bulk of SVB's business, led founders to start pulling cash from their accounts."
      },
      "other": {
        "index": 11,
        "previous": "If anything, it shows just how connected the startup ecosystem really is.",
        "leading": "Annie Njanja and Tage Kene-Okafor got the scoop on African companies affected by the SVB collapse.",
        "next": "For example, they spoke to Nala, a mobile money transfer startup, which was able to pull its funds out of SVB before it collapsed."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_005",
      "reference_label": "new",
      "source": {
        "index": 8,
        "previous": "Canada is one of the United States' closest allies and friends, and has been now for more than 150 years.",
        "leading": "This will be the first true in-person bilateral meeting between the two leaders in Canada since 2009.\" Here's what we've confirmed with senior government officials, and what the official White House program details about what is on the agenda, and what key players are saying about the upcoming visit.",
        "next": "THURSDAY, MARCH 23: BIDEN ARRIVES The Bidens and the delegation travelling with the president will be landing in Ottawa on Air Force One on Thursday evening, currently scheduled for around 6:25 p.m. All times to follow are local."
      },
      "other": {
        "index": 3,
        "previous": "Every president since Franklin Roosevelt, apart from Gerald Ford and Jimmy Carter, has visited Canada during their time in office.",
        "leading": "Traditionally, the visit happens within the first few months of the president taking office.",
        "next": "But COVID-19 restrictions and the war in Ukraine has delayed Mr. Biden's Canadian visit until more than two years into his term."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_006",
      "reference_label": "new",
      "source": {
        "index": 1,
        "previous": "U.S. President Joe Biden is coming to Canada tonight, kicking off his short but long-awaited overnight official visit to Canada.",
        "leading": "During his stay in the nation's capital, Biden will meet with Prime Minister Justin Trudeau, and deliver an address to Parliament on Friday.",
        "next": "But, he and first lady of the United States Jill Biden have some other events on their itineraries, where key Canada-U.S. issues and shared priorities will be discussed."
      },
      "other": {
        "index": 9,
        "previous": "With their continuous escalation of the conflict and repeated assertions that there can be no end to the conflict short of a Ukraine- (in reality, NATO-) dictated \"peace,\" the imperialist powers are risking a nuclear exchange that would threaten the lives of hundreds of millions of people.",
        "leading": "Biden and Trudeau will also discuss deepening their collaboration in the aggressive incitement of military tensions and economic warfare with China, under conditions in which leading US military figures have warned that a war with Beijing could begin as soon as 2025.",
        "next": "One of the most important tasks falling to Canada in these war preparations is the modernization of the bilateral North American aerospace and maritime defence command (NORAD), which is seen by military planners and security policy experts as essential to keeping China out of the Arctic and waging a \"winnable\" nuclear war."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_007",
      "reference_label": "delete",
      "source": {
        "index": 33,
        "previous": "Fearing the bank's collapse after the Treasury bonds were sold, depositors withdrew their money before they lost it.",
        "leading": "That sent the bank into free fall, and the federal government stepped in.",
        "next": "On Monday, President Joe Biden announced that depositors will be made whole, whether or not all of their money was insured."
      },
      "other": {
        "index": 36,
        "previous": "The conventional wisdom at the time, and still today, was that the government bailed out Wall Street while screwing Main Street.",
        "leading": "But the reason the government bailed out Wall Street was to prevent the banking crisis from turning into a second Great Depression that really would have screwed Main Street.",
        "next": "The financial rescues of 2008 all helped stabilize the system; the fall of Lehman, which the government failed to rescue, is what nearly dragged the system into the abyss."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_009",
      "reference_label": "delete",
      "source": {
        "index": 70,
        "previous": "What we've learned about Fox, and what the consequences could be The documents surfaced in this lawsuit's discovery process provide a remarkably illuminating glimpse into how Fox News operates.",
        "leading": "First, they confirm that Fox News is not simply a business or a news reporting operation -- that, instead, it is operated with explicit political goals in mind, often dictated from the Murdoch family downward.",
        "next": "After the 2020 election, for instance, Murdoch said in an email to Fox News CEO Suzanne Scott that he wanted Fox News to \"concentrate on Georgia helping any way we can,\" referencing the two Senate runoff contests that would determine control of the chamber."
      },
      "other": {
        "index": 7,
        "previous": "There was panic.",
        "leading": "From the chairman of Fox Corp.",
        "next": "on down, executives scrambled as they tried to keep viewers tuned in, believing they were facing a crisis."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": true
    },
    {
      "pair_id": "pair_013",
      "reference_label": "new",
      "source": {
        "index": 58,
        "previous": "There is no doubt that China wants to see a ceasefire because China's interests were damaged in Europe.",
        "leading": "Because of China's neutrality, China's relations with Western capitals have soured.",
        "next": "This is ludicrous because China has nothing to do with this war."
      },
      "other": {
        "index": 7,
        "previous": "Second, if Xi cannot get a lasting peace effort, or ceasefire, it will at least think that it will win plaudits in the global south, and perhaps even Europe, just for trying.",
        "leading": "In what it sees as an increasingly polarised world, China hopes to pull off elements of the global south and even Europe, away from the U.S. led Western alliance by marketing itself as a global peacemaker and neutral arbiter (even though it clearly is not).",
        "next": "Third, again, if Xi cannot secure a peace agreement, he will at least want to enforce guardrails on Putin to limit risks of escalation in the conflict away from anything which can destabilise the global economy."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_019",
      "reference_label": "delete",
      "source": {
        "index": 4,
        "previous": "All of them in the one year since Russia's invasion began in February 2022.",
        "leading": "It has been reported that the average life span of a Ukrainian soldier deployed to the frontlines is four hours.",
        "next": "Meanwhile, some eight million refugees have fled Ukraine, and millions more have been internally displaced."
      },
      "other": {
        "index": 10,
        "previous": "Ukrainian defense officials did not respond to requests for comment, as their troops fight on, staving off a rout of Bakhmut, for now.",
        "leading": "Ukrainian servicemen who recently returned from the trenches of Bakhmut walk on a street in Chasiv Yar March 8.",
        "next": "(Evgeniy Maloletka/AP) Six miles from the front Chasiv Yar, a small town about six miles west of the besieged city, hosts an unknown number of Ukrainian artillery pieces hidden throughout the town, their blasts of fire reverberating through the nearly empty streets, in support of Ukrainian forces miles away."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_021",
      "reference_label": "new",
      "source": {
        "index": 10,
        "previous": "One person was injured.",
        "leading": "A statement by the intelligence directorate of Ukraine's Defence Ministry said: \"An explosion in Dzhankoi city in the north of temporarily occupied Crimea destroyed Russian Kalibr-KN cruise missiles as they were being transported by rail\".",
        "next": "The statement on social media said the missiles, designed to be launched from surface ships in Russia's Black Sea fleet, had an operational range of more than 2,500 kms (1,550 mile) on land and 375 kms (233 miles) at sea."
      },
      "other": {
        "index": 9,
        "previous": "None of the statements could be independently verified.",
        "leading": "Throughout the current war, reports have surfaced of attacks on Russian military bases and other infrastructure in Crimea, with Ukraine rarely explicitly claiming responsibility but greeting the incidents with jubilation.",
        "next": "In August, powerful explosions rocked a Russian air base in western Crimea, with Ukraine later saying nine warplanes were destroyed."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_026",
      "reference_label": "new",
      "source": {
        "index": 3,
        "previous": "But, he and first lady of the United States Jill Biden have some other events on their itineraries, where key Canada-U.S. issues and shared priorities will be discussed.",
        "leading": "With many layers of preparation underway--from major security precautions and an increased presence of police, including U.S. Secret Service, RCMP, and provincial and local officers, as well as military aircraft in the skies, to extensive road closures--Biden's brief trip will be a significant event in the cross-border relationship.",
        "next": "U.S. flags have been hung up throughout downtown, manhole covers have been forced shut, and the city is bracing for an influx of high-profile visitors."
      },
      "other": {
        "index": 35,
        "previous": "But a senior Canadian official said the conversation is 'between friends and partners and allies.",
        "leading": "There's no anger or upset or sense of crisis.' 'The issue of the Chinese spy balloon was a good reminder for all of us that we need to continue to make sure that, when it comes to our defensive capabilities, particularly our air defensive capabilities that we are at the cutting edge all the time,' National Security Council spokesman John Kirby said on Wednesday.",
        "next": "'So modernization of air defense capabilities and certainly in NORAD, specifically, is something that we never take for granted or we're always looking to improve that."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": true
    },
    {
      "pair_id": "pair_029",
      "reference_label": "new",
      "source": {
        "index": 1,
        "previous": "U.S. President Joe Biden is coming to Canada tonight, kicking off his short but long-awaited overnight official visit to Canada.",
        "leading": "During his stay in the nation's capital, Biden will meet with Prime Minister Justin Trudeau, and deliver an address to Parliament on Friday.",
        "next": "But, he and first lady of the United States Jill Biden have some other events on their itineraries, where key Canada-U.S. issues and shared priorities will be discussed."
      },
      "other": {
        "index": 1,
        "previous": "Toronto Police Service and Ontario Provincial Police (OPP) vehicles are seen on Wellington Street in preparation of U.S. President Joe Biden's visit in Ottawa, on March 22.Spencer Colby/The Canadian Press The Canadian and U.S. governments are signalling that there may be movement on the thorny issue of irregular migration going in both directions across the border, a day before President Joe Biden arrives in Ottawa for meetings with Prime Minister Justin Trudeau.",
        "leading": "In Ottawa on Wednesday, Mr. Trudeau and Immigration Minister Sean Fraser both dropped hints that there will be an announcement on the matter as part of Mr. Biden's two-day working trip in the capital.",
        "next": "The President will arrive with First Lady Jill Biden on Thursday afternoon."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_030",
      "reference_label": "new",
      "source": {
        "index": 25,
        "previous": "\"If Taiwan can maintain its diplomatic ties with Honduras for a period of time, it would mean the US still has considerable influence in the region, but it really depends on how much help the US is willing to invest in this relationship,\" said Da-Jung Li from Tamkang University in Taiwan.",
        "leading": "Bernhard from the Atlantic Council added that the US could support Taiwan by offering \"meaningful investment alternatives,\" but cautioned that Washington should avoid letting the support be viewed as efforts to counter China's growing investment and influence in Central America.",
        "next": "She said that any such support \"should also be framed as an alternative that can exist on its own.\" Taiwanese President Tsai Ing-wei will be travelling to Latin America and the US in March Image: picture alliance/AP/Chiang Ying-ying 'Official and unofficial relations can complement one another' In Taiwan, the Honduran president's announcement has rekindled the debate about whether Taipei should maintain relations with its remaining diplomatic allies, which are mostly small and impoverished countries."
      },
      "other": {
        "index": 30,
        "previous": "SUBSCRIBE Some of the diplomatic wranglers themselves are mealy-mouthed about their reasoning: 'We're not looking to break our relationship with the United States', Honduras' foreign minister, Enrique Reina, told a local TV station this week.",
        "leading": "'We're looking at how to make the most of being a sovereign nation that can benefit from a relationship with continental China'.",
        "next": "Perhaps squeezing every penny from both superpowers along the way is the plan?"
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_032",
      "reference_label": "delete",
      "source": {
        "index": 12,
        "previous": "\"For a long time, Taiwan was effective at integrating itself into regional institutions, but that's more of a stopgap over time as pressure from China increases,\" he said, adding that the number of states in the region that recognized Taiwan had gone from seven to three -- Belize and Guatemala, as well as Honduras -- in a few decades.",
        "leading": "Since Taiwanese President Tsai Ing-wen took office in 2016, Panama, Dominican Republic, El Salvador and Nicaragua have all switched their allegiances to Beijing.",
        "next": "But Kung Kwo-Wei from Tamkang University in Taiwan said that relations with other Latin American allies remained very stable, particularly Paraguay and Guatemala."
      },
      "other": {
        "index": 19,
        "previous": "Despite China's campaign of isolation, Taiwan retains robust informal ties with more than 100 other countries.",
        "leading": "Earlier this month, Micronesian President David Panuelo accused China of \"political warfare\" in a letter to other national leaders and discussed switching diplomatic allegiance from China to Taiwan in exchange for $50 million to recharge the tiny Pacific island nation's trust fund.",
        "next": "Panuelo said China had been spying on Micronesia, offering bribes and acting in a threatening manner in an effort to ensure that if it goes to war with Taiwan, Micronesia would be aligned with China, or at least abstain from taking sides."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": true
    },
    {
      "pair_id": "pair_033",
      "reference_label": "delete",
      "source": {
        "index": 9,
        "previous": "A Russia-installed official in the peninsula, which was annexed by Moscow in 2014, said the blast was caused by drones laced with sharpnel and explosives and targeted civilian sites.",
        "leading": "One person was injured.",
        "next": "A statement by the intelligence directorate of Ukraine's Defence Ministry said: \"An explosion in Dzhankoi city in the north of temporarily occupied Crimea destroyed Russian Kalibr-KN cruise missiles as they were being transported by rail\"."
      },
      "other": {
        "index": 28,
        "previous": "Local Gov. Petro Kyrylenko on Tuesday said on Ukrainian television that Russian shelling there over the previous day killed one civilian and wounded another.",
        "leading": "Kyrylenko added that a further civilian died and two more suffered wounds in Avdiivka, another place that routinely comes under heavy fire.",
        "next": "Ukrainian authorities have reported on civilian deaths in Bakhmut on a near-daily basis since Moscow's grinding push to take the city began months ago."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_035",
      "reference_label": "delete",
      "source": {
        "index": 4,
        "previous": "On March 20, President Xi Jinping arrived in Moscow, where he discussed the situation in Ukraine with Vladimir Putin.",
        "leading": "A phone call with Ukraine's President Zelensky is expected soon, perhaps this week.",
        "next": "In our interview, Senior Colonel Zhou Bo spoke with refreshing candor about what the \"watershed moment\" means for China and the world."
      },
      "other": {
        "index": 41,
        "previous": "U.S. President Joe Biden took a similar route to visit Kyiv last month, just before the first anniversary of Russia's invasion.",
        "leading": "Kishida, Japan's first postwar leader to enter a war zone, was invited by Zelenskyy in January to visit Kyiv.",
        "next": "Due to its pacifist principles, Japan's support for Ukraine has been limited to equipment such as helmets, bulletproof vests and drones, and humanitarian supplies including generators."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_039",
      "reference_label": "new",
      "source": {
        "index": 8,
        "previous": "2:14am: Ukraine says explosion in Crimea destroyed Russian missiles Ukraine's defence ministry said on Monday that an explosion in Dzhankoi in the north of the Crimean peninsula destroyed Russian cruise missiles intended for use by Russia's Black Sea fleet.",
        "leading": "A Russia-installed official in the peninsula, which was annexed by Moscow in 2014, said the blast was caused by drones laced with sharpnel and explosives and targeted civilian sites.",
        "next": "One person was injured."
      },
      "other": {
        "index": 4,
        "previous": "Speaking on Ukrainian TV, Humeniuk pointed out Dzhankoi's importance as a railway junction and said that \"right now, the way ahead [for Russian forces in Crimea] is clear -- they need to make their way out by rail already.\" A vague statement by Ukraine's military-intelligence agency on Monday said that multiple missiles carried by rail and destined for submarine launch had been destroyed, without saying outright that Ukraine was responsible or what weapon had been used.",
        "leading": "However, the agency implied that Kyiv was behind the blast, saying it furthers \"the process of Russia's demilitarization, and prepares the Ukrainian peninsula of Crimea for de-occupation.\" Moscow-installed authorities in Crimea on Tuesday offered a different version of events, saying that Ukrainian drones attacked civilian facilities in Dzhankoi.",
        "next": "Sergei Aksenov, the Kremlin-appointed head of Crimea, said that the attack left one civilian wounded, but caused \"no serious damage.\" Aksenov's adviser, Oleg Kryuchkov, rejected Ukraine's claims and said that Ukrainian drones had targeted residential areas rather than the railway."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_040",
      "reference_label": "new",
      "source": {
        "index": 60,
        "previous": "We want an end to 'Buy-America' so that our construction workers get powerful paycheques ...",
        "leading": "We want an end to the illegal border crossings at Roxham Road, and across the country...",
        "next": "We will stand with the Americans for a stronger military and stronger continental defense to keep all of our people safe,\" Poilievre said on his way into a Wednesday caucus meeting."
      },
      "other": {
        "index": 20,
        "previous": "In conjunction with that work, he said, Ottawa is committed to addressing broader issues of irregular migration, which is dramatically more pronounced for the U.S. on its southern border with Mexico.",
        "leading": "Last year nearly 40,000 people crossed into Canada through Roxham Road.",
        "next": "Hundreds of thousands of people cross into the U.S. from Mexico each month."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_044",
      "reference_label": "new",
      "source": {
        "index": 21,
        "previous": "\"The Iraqi regime has plotted to develop anthrax and nerve gas, and nuclear weapons, for over a decade.\" Iraq was one of three countries, along with Iran and North Korea, that constituted an \"axis of evil,\" according to Bush.",
        "leading": "But Iraq drew much more attention from the former president than did those countries.",
        "next": "\"This is a regime that has something to hide from the civilized world,\" Bush said."
      },
      "other": {
        "index": 40,
        "previous": "The occupation stoked a stubborn guerrilla resistance, bitter fights for control of the countryside and cities, a protracted civil war, and the rise of the Islamic State group that spread terror beyond Iraq and Syria, throughout the Middle East, Africa, Asia and Europe.",
        "leading": "The long, staggeringly costly experience in Iraq exposed the limitations of America's ability to export democracy and chastened Washington's approach to foreign engagements, at least temporarily.",
        "next": "In Iraq, its democracy is yet to be defined."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_045",
      "reference_label": "fusion",
      "source": {
        "index": 53,
        "previous": "The war intensifies A year after the Russian invasion, there is no end in sight, as both sides dig in for a war of attrition.",
        "leading": "The focus of a lot of attention is the siege of Bakmuth, in the southeast, which the Russians are determined to take and the Ukrainians are determined to keep.",
        "next": "One Ukrainian volunteer described the situation for the Guardian thus: \"It's like the first world war...."
      },
      "other": {
        "index": 23,
        "previous": "Russian manpower reserves are, if not of a high caliber, deep.",
        "leading": "Armed with little more than assault rifles and ammunition, waves of recently mobilized Russians bellycrawl from their lines through crater-pocked no-man's land toward Ukrainian forces arrayed in and around the beleaguered city.",
        "next": "Alexsander added that Russian and Ukrainian forces sometimes fire at each other at point-blank range, directly \"shooting from trenches,\" which is a very different battle than during last summer, when troops often fought each other from a greater distance."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_048",
      "reference_label": "delete",
      "source": {
        "index": 149,
        "previous": "Homebuilders and some medical products makers also are acting well.",
        "leading": "But leadership is narrow.",
        "next": "Ultimately, a divided market rally cannot stand."
      },
      "other": {
        "index": 3,
        "previous": "This is the biggest wipeout yet for Europe's AT1 market, overshadowing the only other write-down of this type of security -- a $1.45 billion loss for bondholders of Spanish lender Banco Popular in 2017, when it was taken over by Banco Santander to prevent a Credit Suisse-like collapse.",
        "leading": "But there is a crucial difference.",
        "next": "In the Banco Popular case, alongside bonds, equity was also written off; the Credit Suisse-UBS deal brokered by the Swiss financial regulator FINMA entails a complete write-down of the bank's AT1 bonds, even as equity shareholders are set to receive about 3 billion Swiss francs."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_050",
      "reference_label": "new",
      "source": {
        "index": 58,
        "previous": "One recent source of growth was cryptocurrencies; starting in 2018, the bank had been among the few lenders to accept deposits in the form of crypto assets.",
        "leading": "By Friday, concerns about the bank's exposure to cryptocurrencies had set off a deadly run on its deposits.",
        "next": "Frank, who received more than $2.4 million in cash and stock from Signature during his seven-plus years on the board, left the job Sunday as regulators dissolved the board."
      },
      "other": {
        "index": 29,
        "previous": "I'm curious here if you see more failures coming given what you've just said.",
        "leading": "Or was there something specific about Signature that made it vulnerable to a situation like this, which you were saying you believe is largely because of cryptocurrency, which some would consider a risky bet?",
        "next": "FRANK: No. In the first place, I think you're going to see what the FDIC has done is to remove the two top operating officers of Signature and one semi-retired officer and left everybody else in place."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"junk\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": true
    },
    {
      "pair_id": "pair_051",
      "reference_label": "new",
      "source": {
        "index": 11,
        "previous": "He told DW that Beijing was providing larger assistance packages and using better economic opportunities and access to the Chinese market as ways to lure Taiwan's allies.",
        "leading": "\"For a long time, Taiwan was effective at integrating itself into regional institutions, but that's more of a stopgap over time as pressure from China increases,\" he said, adding that the number of states in the region that recognized Taiwan had gone from seven to three -- Belize and Guatemala, as well as Honduras -- in a few decades.",
        "next": "Since Taiwanese President Tsai Ing-wen took office in 2016, Panama, Dominican Republic, El Salvador and Nicaragua have all switched their allegiances to Beijing."
      },
      "other": {
        "index": 19,
        "previous": "Latin America has been a source of tensions between Beijing and Taipei.",
        "leading": "Aligned with Washington, all Central American countries had maintained ties with Taiwan for decades.",
        "next": "But with Honduras switching to Beijing, now only Guatemala and Paraguay have formal relations with Taipei."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_056",
      "reference_label": "new",
      "source": {
        "index": 53,
        "previous": "The war intensifies A year after the Russian invasion, there is no end in sight, as both sides dig in for a war of attrition.",
        "leading": "The focus of a lot of attention is the siege of Bakmuth, in the southeast, which the Russians are determined to take and the Ukrainians are determined to keep.",
        "next": "One Ukrainian volunteer described the situation for the Guardian thus: \"It's like the first world war...."
      },
      "other": {
        "index": 13,
        "previous": "Sergey Chaus, the head of Chasiv Yar's civilian and military administration, bluntly described the situation in the town as \"stably fucked.\" Speaking frankly about the military situation, he reflected on the town's importance to the operation around Bakhmut.",
        "leading": "The town is essential \"because it's practically the only road into Bakhmut\" and would be an important lifeline to safety should Ukrainian forces pull back westward.",
        "next": "With Russians focusing on Bakhmut, Chasiv Yar is spared from the volume of shelling that Bakhmut withstands, though the city is far from safe."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_057",
      "reference_label": "new",
      "source": {
        "index": 63,
        "previous": "Richardson (1995), a news report that repeats false allegations is not unlawful, so long as the report \"made it sufficiently apparent to the reasonable reader that its contents represented the opinion of the author and that its specific charges about [a] plaintiff were allegations and not demonstrable fact.\" Fox relies heavily on this Brian decision in its briefing.",
        "leading": "It is far from clear that Fox \"made it sufficiently apparent to the reasonable [viewer]\" that all the allegations it covered were just that, and not facts.",
        "next": "In other words, Brian might not save Fox from liability for at least some of the allegedly defamatory statements that it chose to broadcast."
      },
      "other": {
        "index": 21,
        "previous": "Grossberg told CNN that she filed her lawsuit in hopes that it will spur change at the network and because she believed it \"was the only step\" she had to regain her pride and save her career.",
        "leading": "Grossberg said she wanted to \"expose the lies and deceit\" that she \"witnessed for years\" on two of Fox News' biggest shows.",
        "next": "\"I've covered many stories while I have been there,\" Grossberg told CNN."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_058",
      "reference_label": "fusion",
      "source": {
        "index": 40,
        "previous": "WHAT ARE THE BIG ISSUES SET TO COME UP?",
        "leading": "Without diving into the nitty gritty of all the outstanding trade, economic, and cross-border irritants that could come up during the visit, the broad stroke topics that officials say will be discussed during the visit include: North American continental and Arctic defence and related spending Trade, supply chains, and the state of CUSMA/USMCA Irregular migration and modernizing the Safe Third Country Agreement Climate change and investing in the clean automotive sector Addressing inflation and driving growth to create jobs Threats to democracy such as domestic and foreign interference Further support for Haiti and Ukraine It remains to be seen how substantive of progress will be made on these issues, but typically visits of this sort conclude with some form of joint statement outlining any commitments made.",
        "next": "\"The Canada-U.S. partnership is forged by shared geography, similar values, common interests, deep personal connections, and powerful economic ties that are critical for so many jobs and businesses in both of our countries,\" said a senior Canadian government official."
      },
      "other": {
        "index": 11,
        "previous": "The officials stressed the warm \"Justin and Joe\" relationship between the President and Prime Minister.",
        "leading": "They said they expect the visit to be substantive, and to cover issues like the scale and speed of the modernization of North American air defences and the humanitarian, political and security crises gripping Haiti.",
        "next": "The Globe is not identifying the officials, who spoke on the condition that they not be named."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "fusion",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_060",
      "reference_label": "delete",
      "source": {
        "index": 68,
        "previous": "From Putin's perspective, if he retreats from Ukraine, that will be seen as a sign of weakness that will only whet the West's appetite to bring Ukraine into the NATO fold.",
        "leading": "He thinks that the West has failed in its efforts to isolate Russia politically and economically, which is true.",
        "next": "He feels that he can eventually outlast the West's resolve to drive Russia out of the Ukraine."
      },
      "other": {
        "index": 15,
        "previous": "A lieutenant on Facebook noted: \"There is a catastrophic shortage of shells.\" He said the Russians were well dug in and it was taking five to seven rounds to hit an enemy position.",
        "leading": "He complained of equipment challenges, saying \"Improvements -- improvements have already been promised, because everyone who has a mouth makes promises.\" But he cautioned his remarks shouldn't be taken as a plea for a retreat.",
        "next": "\"WE WILL FULFILL OUR DUTY UNTIL THE END, WHATEVER IT IS!\" he concluded ruefully."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_065",
      "reference_label": "delete",
      "source": {
        "index": 60,
        "previous": "The first and foremost point is the surrender or withdrawal of Russian occupation forces from (Ukrainian territory) in accordance with international law and the UN Charter,\" the secretary of Ukraine's National Security and Defence Council, Oleksiy Danilov, wrote on Twitter.",
        "leading": "8:00am: Putin to welcome Xi to Moscow under shadow of Ukraine war Russian President Vladimir Putin will expect Chinese President Xi Jinping to show solidarity against Western hegemony when he arrives in Moscow on Monday, while Xi will present China as a global peacemaker intent on brokering an end to the Ukraine war.",
        "next": "Xi will be the first world leader to shake Putin's hand since the International Criminal Court (ICC) issued an arrest warrant for the Russian leader on Friday over the deportation of Ukrainian children to Russia since the start of the war."
      },
      "other": {
        "index": 16,
        "previous": "These incidents in Crimea, as well as reported drone attacks on Russian territory far from the war's front lines, have exposed major weaknesses in Moscow's defenses and embarrassed Russian President Vladimir Putin, who reportedly believed the invasion of Ukraine would be quick and easy.",
        "leading": "See: Putin sticks to protocol during Chinese leader Xi's visit Also: Japan's Kishida heading to Ukraine for talks with Zelensky In other developments: * Ukraine's human-rights chief on Tuesday said that Kyiv has brought back 15 more Ukrainian children deported by Russian forces from the country's south and northeast, where Moscow held large swaths of territory earlier in the war.",
        "next": "Dmytro Lubinets spoke just days after the International Criminal Court issued an arrest warrant for Russian President Vladimir Putin, accusing him of bearing personal responsibility for the abductions of children from Ukraine."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"new\",\"label\":\"delete\"}",
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_066",
      "reference_label": "new",
      "source": {
        "index": 53,
        "previous": "The war intensifies A year after the Russian invasion, there is no end in sight, as both sides dig in for a war of attrition.",
        "leading": "The focus of a lot of attention is the siege of Bakmuth, in the southeast, which the Russians are determined to take and the Ukrainians are determined to keep.",
        "next": "One Ukrainian volunteer described the situation for the Guardian thus: \"It's like the first world war...."
      },
      "other": {
        "index": 7,
        "previous": "Troops complain that they have so little ammunition that artillery units are forced to pick and choose which fellow troops under fire to help.",
        "leading": "The soldiers said Ukraine's military leadership may be hoarding shells for the upcoming larger offensive, griping that shows plummeting morale.",
        "next": "That frustration is what drove troops to speak out, most only giving first names or asking to remain anonymous, for fear their commanders would censure them for their criticism."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_067",
      "reference_label": "new",
      "source": {
        "index": 18,
        "previous": "Yet some of the banks now facing crises of confidence are the same ones that in recent years were telling lawmakers and others that they were sufficiently safe and that they should not be the focus of zealous federal supervision.",
        "leading": "Many of those banks argued that onerous federal regulations would make it harder for them to serve as alternatives to giants like Bank of America, JPMorgan Chase and Wells Fargo.",
        "next": "Yet those behemoths are now likely to see an influx of deposits as skittish customers rush for safety."
      },
      "other": {
        "index": 58,
        "previous": "FRANK: What I want is - yes.",
        "leading": "First of all, I think we need to strengthen the regulations on crypto not just in banking but through the SEC.",
        "next": "Secondly, I think it's important for the stability of the country, economically and for fairness to workers, not banks, to make sure that companies can have insurance sufficient to cover their payrolls."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_068",
      "reference_label": "new",
      "source": {
        "index": 23,
        "previous": "In January, the US invited Taiwan to participate in a project to rebuild schools in Honduras after the Honduran president's husband said publicly that Honduras should establish diplomatic ties with China.",
        "leading": "Ahead of the 2021 Honduran presidential election, a US delegation was able to convince Honduras not to switch its diplomatic recognition to China and there is some hope that this might be possible again.",
        "next": "\"If Taiwan can maintain its diplomatic ties with Honduras for a period of time, it would mean the US still has considerable influence in the region, but it really depends on how much help the US is willing to invest in this relationship,\" said Da-Jung Li from Tamkang University in Taiwan."
      },
      "other": {
        "index": 8,
        "previous": "\"Taiwan is a sincere and reliable ally.",
        "leading": "Our country has always assisted Honduras in its national development to the best of our capabilities.",
        "next": "China's only goal in developing relations with Honduras is to shrink our country's international space, it has no sincere intentions to cooperate for the good of the Honduran people,\" the ministry said in a statement."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_069",
      "reference_label": "new",
      "source": {
        "index": 163,
        "previous": "There's a strong case for waiting for a follow-through day.",
        "leading": "Even then, investors should move in gradually, especially with the bank crisis hanging over financial markets.",
        "next": "But investors need to be ready."
      },
      "other": {
        "index": 86,
        "previous": "But the tech crowd is pretty resourceful and innovative, and we are certain they could craft a solution if pointed in the right direction.",
        "leading": "Perhaps risk-tech is the opportunity that emerges from bank run crises.",
        "next": "Was Silicon Valley Bank ruined by diversity?"
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_072",
      "reference_label": "delete",
      "source": {
        "index": 33,
        "previous": "Fearing the bank's collapse after the Treasury bonds were sold, depositors withdrew their money before they lost it.",
        "leading": "That sent the bank into free fall, and the federal government stepped in.",
        "next": "On Monday, President Joe Biden announced that depositors will be made whole, whether or not all of their money was insured."
      },
      "other": {
        "index": 40,
        "previous": "The CEOs lost their jobs.",
        "leading": "The government put a lot of tax money at risk, but it all got paid back with interest.",
        "next": "And under President Barack Obama, Washington passed a separate $800 billion economic stimulus bill for Main Street, another subject I've spent too much time thinking about, that helped end the recession in a hurry."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_073",
      "reference_label": "new",
      "source": {
        "index": 3,
        "previous": "The war began March 19, 2003, with an overwhelming show of American military might, described by the unforgettable phrase \"shock and awe.\" Within weeks, the United States achieved the primary objective of Operation Iraqi Freedom, as the military operation was called, ousting the regime of dictator Saddam Hussein.",
        "leading": "Yet the military campaign that began so auspiciously ended up deeply dividing Americans and alienating key U.S. allies.",
        "next": "As Americans looked back on the war four years ago, 62% said it was not worth fighting."
      },
      "other": {
        "index": 24,
        "previous": "It tried to work through the United Nations to obtain legal authorization for the attack on Iraq, and when it went to war, it did so with a coalition of allies and partners.",
        "leading": "Nevertheless, choosing to invade Iraq over the objections of a powerful group of nations that included not only Russia and China, but also close U.S. allies France and Germany, violated the spirit of multilateralism, and eventually the letter of international law.",
        "next": "A greater effort to address the concerns of these nations would have greatly reduced the diplomatic, bureaucratic, financial, and military costs of the war, and perhaps prevented it altogether."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_081",
      "reference_label": "new",
      "source": {
        "index": 53,
        "previous": "The war intensifies A year after the Russian invasion, there is no end in sight, as both sides dig in for a war of attrition.",
        "leading": "The focus of a lot of attention is the siege of Bakmuth, in the southeast, which the Russians are determined to take and the Ukrainians are determined to keep.",
        "next": "One Ukrainian volunteer described the situation for the Guardian thus: \"It's like the first world war...."
      },
      "other": {
        "index": 3,
        "previous": "But Ukraine's high command refuses to abandon the city, counting on the grinding warfare to bleed Russian manpower and materiel, kneecapping any wider Russian spring offensive.",
        "leading": "Indeed, the Institute for the Study of War, a Washington-based think tank, reports that Russian forces haven't even managed to cross the river that partitions Bakhmut, and nor do Russians appear to have the combat power to expand further westward beyond the besieged city.",
        "next": "\"Bakhmut must stand\" said Sam, a 37-year-old former U.S. Marine gunner with tours in Iraq and Afghanistan, echoing determined Ukrainian officials."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_087",
      "reference_label": "fusion",
      "source": {
        "index": 15,
        "previous": "Honduras plans to end diplomatic ties with Taiwan To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video Taiwan provides humanitarian aid Isabel Bernhard, assistant director of the Adrienne Arsht Latin America Center at the Atlantic Council, said that Central American countries, including Honduras, were still very aware of the benefits of relations with Taiwan and that the island's long-term standing in the region would not suffer too much.",
        "leading": "She explained that Taipei had built up a strong reputation as \"a provider of humanitarian assistance, digital aid, and educational diplomacy\" in the region over the past 10 years.",
        "next": "\"There could be a window for Taiwan to conduct informal engagement with [former diplomatic allies] as it leaves the door open if a former ally ever decides to switch back one day,\" she said."
      },
      "other": {
        "index": 12,
        "previous": "However, China, which is building a massive dam in Honduras, generally uses trade and investment as incentives for switching ties, as it has done successfully with Costa Rica, Panama, El Salvador, Nicaragua and, most recently, South Pacific nations including the Solomon Islands.",
        "leading": "Taiwan supplies its dwindling number of formal diplomatic partners with agricultural experts, vocational training programs and other forms of economic aid.",
        "next": "However, budgetary restraints imposed by the democratically elected legislature prevent it from splashing out on sports stadiums, conference halls and government buildings as China does."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "fusion",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "fusion",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"same\",\"label\":\"fusion\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_088",
      "reference_label": "new",
      "source": {
        "index": 70,
        "previous": "What we've learned about Fox, and what the consequences could be The documents surfaced in this lawsuit's discovery process provide a remarkably illuminating glimpse into how Fox News operates.",
        "leading": "First, they confirm that Fox News is not simply a business or a news reporting operation -- that, instead, it is operated with explicit political goals in mind, often dictated from the Murdoch family downward.",
        "next": "After the 2020 election, for instance, Murdoch said in an email to Fox News CEO Suzanne Scott that he wanted Fox News to \"concentrate on Georgia helping any way we can,\" referencing the two Senate runoff contests that would determine control of the chamber."
      },
      "other": {
        "index": 21,
        "previous": "\"We are incredibly proud of our team of journalists who continue to deliver breaking news from around the world.\" Fox News probably won't be expelled from journalism organizations Bill McCarren, executive director of the National Press Club, called the revelations in the Dominion lawsuit \"extremely disappointing.\" \"Journalism receives significant protections from the First Amendment and with those protections come profound responsibilities,\" McCarren told Insider.",
        "leading": "\"It appears that some at Fox have not lived up to those responsibilities in this case.\" But the National Press Club isn't membership-based.",
        "next": "A representative for the Society of Professional Journalists -- which welcomed \"all journalists\" to participate in professional development programs -- said that Fox News wasn't an organizational member and that people named in the lawsuit weren't individual members."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_091",
      "reference_label": "delete",
      "source": {
        "index": 56,
        "previous": "Russia is our largest neighbour, and Ukraine is an important trade partner, it is difficult for China to make a choice.",
        "leading": "Besides, the all-out support in the West for Ukraine makes things more complicated.",
        "next": "There is no doubt that China wants to see a ceasefire because China's interests were damaged in Europe."
      },
      "other": {
        "index": 43,
        "previous": "Due to its pacifist principles, Japan's support for Ukraine has been limited to equipment such as helmets, bulletproof vests and drones, and humanitarian supplies including generators.",
        "leading": "Japan has contributed more than $7 billion to Ukraine, and accepted more than 2,000 displaced Ukrainians and helped them with housing assistance and support for jobs and education, a rare move in a country that is known for its strict immigration policy.",
        "next": "Tokyo joined the U.S. and European nations in sanctioning Russia over its invasion and providing humanitarian and economic support for Ukraine."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"delete\"}"
          ]
        }
      ],
      "all_models_wrong": false
    },
    {
      "pair_id": "pair_092",
      "reference_label": "delete",
      "source": {
        "index": 126,
        "previous": "People have their own sources too to prove that, so the allegation is gone.",
        "leading": "What are the lessons and consequences for the Taiwan question?",
        "next": "This is a ridiculous question."
      },
      "other": {
        "index": 15,
        "previous": "Beijing's view, he says, is that China and the United States \"are clearly on a collision course, so we will need Russia.\" If U.S.-China relations worsen further, Beijing's incentives to draw closer to Russia and possibly provide weapons and other military assistance - albeit as covertly as possible - will also mount.",
        "leading": "\"The most likely issue which might lead to further deterioration is obviously Taiwan,\" says Chen Cheng, professor of political science at the University at Albany, SUNY.",
        "next": "A senior Chinese official recently drew a rare direct comparison with Taiwan while underscoring how Beijing views Ukraine through the lens of regional competition with America."
      },
      "predictions": [
        {
          "model": "gpt-5.6-terra",
          "label": "delete",
          "correct": true,
          "raw_responses": [
            "{\"claim\":\"junk\",\"label\":\"delete\"}"
          ]
        },
        {
          "model": "gpt-5.4-nano",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        },
        {
          "model": "gpt-5.4-mini",
          "label": "new",
          "correct": false,
          "raw_responses": [
            "{\"claim\":\"diff\",\"label\":\"new\"}"
          ]
        }
      ],
      "all_models_wrong": false
    }
  ]
};
