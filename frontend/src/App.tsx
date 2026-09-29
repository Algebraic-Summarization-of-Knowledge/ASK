import { useState, type ReactNode } from "react";
import ButtonBar from "./components/ButtonBar";
import Analyze from "./Analyze";
import Dataset from "./Dataset";
import Fusion from "./Fusion";
import Import from "./Import";

type Page = "dataset" | "import" | "analyze" | "fusion";
type Source = "dataset" | "import";

const PAGES: { id: Page; label: ReactNode; menu?: { id: Source; label: string }[] }[] = [
  {
    id: "dataset",
    label: (
      <span className="btn-label">
        Dataset
        <small>DiverseSumm</small>
      </span>
    ),
  },
  { id: "import", label: "Import" },
  {
    id: "analyze",
    label: "Analyze",
    menu: [
      { id: "import", label: "Import" },
      { id: "dataset", label: "Dataset" },
    ],
  },
  { id: "fusion", label: "Fuzja" },
];

export default function App() {
  const [page, setPage] = useState<Page>("dataset");
  const [analyzeFrom, setAnalyzeFrom] = useState<Source>("dataset");

  return (
    <div className="app">
      <h1>ASK</h1>
      <ButtonBar
        value={page}
        menuValue={analyzeFrom}
        options={PAGES}
        onChange={setPage}
        onMenu={(_id, item) => {
          if (item === "dataset" || item === "import") setAnalyzeFrom(item);
        }}
      />
      <Dataset hidden={page !== "dataset"} />
      <Import hidden={page !== "import"} />
      <Analyze hidden={page !== "analyze"} from={analyzeFrom} />
      <Fusion hidden={page !== "fusion"} />
    </div>
  );
}
