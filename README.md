# ASK

ASK porównuje kilka artykułów o tym samym wydarzeniu. Obieramy jeden artykuł jako source article. Artykuły są cięte na zdania, każde zdanie dostaje okno kontekstowe (zdanie przed i po), okna zamieniają się w embeddingi MiniLM, a każde okno z pozostałych artykułów (poza source article) ląduje przy najbliższym oknie source (1-NN). UI rysuje to jako grafy-gwiazdy.

Osobno: fuzja zdań i analyze - sędzia LLM (`duplicate` / `fusion` / `new` / `delete`) obsługiwany przez Ollama. Zakładka **import** bierze PDF-y z warstwą tekstową i puszcza je tą samą ścieżką, bez zapisu do `corpus/`.

## Instalacja

Python 3, Node.js, oraz [Ollama](https://ollama.com) na `http://127.0.0.1:11434` (fuzja i sędzia). Embeddingi, grafy i import PDF działają bez Ollamy.

```bash
python3 -m venv .venv
source .venv/bin/activate          # fish: source .venv/bin/activate.fish
pip install -r backend/requirements.txt
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
python download_diversesumm.py
python convert_diversesumm.py
ollama pull qwen3:8b              # model tymczasowy, bo okazuje sie troche za mały
```

`download_diversesumm.py` ściąga [DiverseSumm](https://github.com/salesforce/DiverseSumm) do `data/diversesumm/`. `convert_diversesumm.py` czyści `corpus/` i zapisuje 50 tematów, po 3–5 artykułów (`article_*.json`, tekst co najmniej 2000 znaków). `data/` i `corpus/` są w `.gitignore`.

### Uruchomienie

Terminal 1:

```bash
source .venv/bin/activate
cd backend
PYTHONUNBUFFERED=1 python api_server.py
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

API: `http://127.0.0.1:8000`. UI: [http://localhost:5173](http://localhost:5173). Vite przekierowuje `/api` na API.

| adres | co jest |
| --- | --- |
| `#/` | ask: folder, source, embeddingi, gwiazdy, fuzja |
| `#/analysis` | pary 1-NN i etykiety sędziego, na końcu PDF w `reports/` |
| `#/import` | PDF -> JSON -> ten sam pipeline co ask |

## Struktura

```text
ASK/
  download_diversesumm.py    DiverseSumm -> data/diversesumm/
  convert_diversesumm.py     data -> corpus/<temat>/article_*.json
  download_wcep.py           opcjonalny stary zbiór WCEP
  convert_wcep.py            WCEP -> corpus/ (kasuje to, co jest)
  run_judge.py               1-NN + sędzia + PDF w terminalu, bez UI
  README.md                  ten plik
  dokumentacja.md            pełny opis zachowania
  STEP_BY_STEP.md            pipeline od zbioru do artykułu
  ROADMAP.md                 kamienie milowe i to, czego nie ma
  NASTEPNE_KROKI.md          co robić dalej
  corpus/<temat>/            artykuły JSON, lokalnie
  data/                      surowe zbiory, lokalnie
  reports/                   PDF po classify, lokalnie
  import/
    pdf.py                   PDF z tekstem -> {title, text}
    convert.py               te artykuły -> analyze()
  backend/
    api_server.py            HTTP
    analyze.py               zdania -> okna -> wektory -> 1-NN
    context_windows.py       zdania i okna
    embeddings.py            MiniLM
    assign_windows.py        1-NN
    fusion.py                fuzja zdań
    judge.py                 etykiety par
    llm.py                   Ollama
    report.py                PDF raportu
    run_example.py           stary przebieg w terminalu
    requirements.txt
  frontend/
    vite.config.ts           dev server, proxy /api
    src/main.tsx             nawigacja ask | analysis | import
    src/App.tsx              strona ask
    src/Fusion.tsx           ręczne scalanie zdań
    src/Judge.tsx            strona analysis
    src/Import.tsx           strona import
    src/Windows.tsx          dump okna i wektora
    src/Stars.tsx            graf-gwiazda
```

Artykuł w korpusie to JSON `{ "title", "text" }`.

## Kluczowe funkcje

Przepływ po **konwertuj** (`POST /api/convert`): `analyze` woła resztę.

| funkcja | plik | rola |
| --- | --- | --- |
| `split_sentences` | `backend/context_windows.py` | tnie tekst na zdania; chroni skróty (`U.S.`, `Dr.`) i inicjały |
| `sentences_from_json` | `backend/context_windows.py` | czyta pole `text` z JSON artykułu |
| `make_context_windows` | `backend/context_windows.py` | dla zdania `Sn` robi okno `(Sn-1, Sn, Sn+1)`; na brzegu sąsiad to `None` |
| `embed_windows` | `backend/embeddings.py` | `all-MiniLM-L6-v2`, wektor 384-d, znormalizowany; brak sąsiada zostaje `None` |
| `assign_windows_to_source` | `backend/assign_windows.py` | każde okno z others -> najbliższe okno source |
| `analyze` | `backend/analyze.py` | składa okna, dopasowania i pary do UI |
| `fuse` | `backend/fusion.py` | co najmniej dwa zdania + master prompt -> jeden tekst (fakty zostają, nic nowego) |
| `pairs_from_groups` | `backend/judge.py` | z grup 1-NN robi pary source × other |
| `classify` | `backend/judge.py` | `duplicate` / `fusion` / `new` / `delete`; najpierw heurystyki, potem LLM |
| `generate` | `backend/llm.py` | wołanie Ollamy; domyślny model `qwen3:8b` |
| `save_report` | `backend/report.py` | po classify zapisuje PDF do `reports/` |
| `articles_from_files` | `import/pdf.py` | PDF (base64) -> artykuły JSON; skleja łamanie wierszy |
| `convert_articles` | `import/convert.py` | artykuły z importu -> `analyze`, pliki tylko w katalogu tymczasowym |

Podobieństwo okna w `assign_windows_to_source`: `0.7` zdanie wiodące, `0.15` poprzednie, `0.15` następne. Sąsiad wchodzi do wyniku tylko wtedy, gdy mają go oba okna. Nie ma progu: słaba para i tak dostaje jakieś source.

### API

| metoda | ścieżka | woła |
| --- | --- | --- |
| GET | `/api/topics` | lista `corpus/` |
| GET | `/api/labels` | etykiety sędziego, prompt, modele Ollamy |
| POST | `/api/convert` | `analyze` |
| POST | `/api/fusion` | `fuse` |
| POST | `/api/judge` | `classify` |
| POST | `/api/report` | `save_report` |
| POST | `/api/import/extract` | `articles_from_files` |
| POST | `/api/import/convert` | `convert_articles` |
