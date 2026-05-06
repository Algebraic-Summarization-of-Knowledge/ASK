import { useMemo, useState } from 'react'
import './App.css'

import bbcArticleRaw from '../../corpus/russian_invasion_on_ukraine_24_02_2022/bbc.json?raw'
import aljaazeraArticleRaw from '../../corpus/russian_invasion_on_ukraine_24_02_2022/aljaazera.json?raw'
import handmadeResult from '../../corpus/russian_invasion_on_ukraine_24_02_2022/handmade.json'
import automatedWithoutLlmResult from '../../corpus/russian_invasion_on_ukraine_24_02_2022/automated_without_llm.json'
import automatedResult from '../../corpus/russian_invasion_on_ukraine_24_02_2022/automated.json'

function parseRelaxedArticleJson(raw) {
  const result = {}

  for (const key of ['title', 'publishedAt', 'url', 'source']) {
    const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"([^\\n\\r]*)"`))
    if (match) {
      result[key] = match[1]
    }
  }

  const textKeyIndex = raw.indexOf('"text"')
  if (textKeyIndex >= 0) {
    const colonIndex = raw.indexOf(':', textKeyIndex)
    const startQuoteIndex = raw.indexOf('"', colonIndex + 1)
    let endQuoteIndex = raw.lastIndexOf('"\n}')

    if (endQuoteIndex === -1) {
      endQuoteIndex = raw.lastIndexOf('"\r\n}')
    }

    if (startQuoteIndex >= 0 && endQuoteIndex > startQuoteIndex) {
      result.text = raw.slice(startQuoteIndex + 1, endQuoteIndex)
    }
  }

  return result
}

const bbcArticle = parseRelaxedArticleJson(bbcArticleRaw)
const aljaazeraArticle = parseRelaxedArticleJson(aljaazeraArticleRaw)

const russianArticles = [
  {
    id: 'russian-bbc',
    folder: 'articles',
    name: 'bbc.json',
    kind: 'article',
    data: bbcArticle,
  },
  {
    id: 'russian-aljaazera',
    folder: 'articles',
    name: 'aljaazera.json',
    kind: 'article',
    data: aljaazeraArticle,
  },
]

const russianResults = [
  {
    id: 'russian-handmade',
    folder: 'results',
    name: 'handmade.json',
    kind: 'result',
    data: handmadeResult,
  },
  {
    id: 'russian-automated_without_llm',
    folder: 'results',
    name: 'automated_without_llm.json',
    kind: 'result',
    data: automatedWithoutLlmResult,
  },
  {
    id: 'russian-automated',
    folder: 'results',
    name: 'automated.json',
    kind: 'result',
    data: automatedResult,
  },
]

const collections = [
  {
    id: 'covid19_articles',
    label: 'covid19_articles',
    articles: [],
    results: [],
  },
  {
    id: 'russian_invasion_on_ukraine_24_02_2022',
    label: 'russian_invasion_on_ukraine',
    articles: russianArticles,
    results: russianResults,
  },
  {
    id: 'charlie_kirk_articles',
    label: 'charlie_kirk_articles',
    articles: [],
    results: [],
  },
]

function getFirstFileId(collection, section) {
  const files = collection?.[section] ?? []
  return files[0]?.id ?? null
}

function formatDate(value) {
  if (!value) {
    return 'brak'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('pl-PL')
}

function JsonText({ value, depth = 0 }) {
  if (value === null || value === undefined) {
    return <span className="json-muted">brak</span>
  }

  if (typeof value === 'string') {
    return <span>{value}</span>
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="json-muted">(pusta lista)</span>
    }

    return (
      <ul className="json-list">
        {value.map((item, index) => (
          <li key={`item-${depth}-${index}`}>
            <JsonText value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    )
  }

  const entries = Object.entries(value)
  if (!entries.length) {
    return <span className="json-muted">(pusty obiekt)</span>
  }

  return (
    <div className="json-object">
      {entries.map(([key, item]) => (
        <div key={`${depth}-${key}`} className="json-row">
          <h4>{key}</h4>
          <JsonText value={item} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

function App() {
  const [activeCollectionId, setActiveCollectionId] = useState(
    'russian_invasion_on_ukraine_24_02_2022'
  )
  const [activeSection, setActiveSection] = useState('articles')
  const [activeFileId, setActiveFileId] = useState('russian-bbc')
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)

  const activeCollection = useMemo(() => {
    return collections.find((item) => item.id === activeCollectionId) ?? collections[0]
  }, [activeCollectionId])

  const visibleFiles = useMemo(() => {
    return activeCollection?.[activeSection] ?? []
  }, [activeCollection, activeSection])

  const selectedFile = useMemo(() => {
    return visibleFiles.find((file) => file.id === activeFileId) ?? visibleFiles[0] ?? null
  }, [activeFileId, visibleFiles])

  const compareCandidates = useMemo(() => {
    if (activeSection !== 'results' || !selectedFile) {
      return []
    }

    return visibleFiles.filter((file) => file.id !== selectedFile.id)
  }, [activeSection, selectedFile, visibleFiles])

  const comparedFile = useMemo(() => {
    return compareCandidates.find((file) => file.id === compareFileId) ?? compareCandidates[0] ?? null
  }, [compareCandidates, compareFileId])

  const selectCollection = (collectionId) => {
    const nextCollection = collections.find((item) => item.id === collectionId) ?? collections[0]
    const nextActiveFileId = getFirstFileId(nextCollection, activeSection)

    setActiveCollectionId(nextCollection.id)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
  }

  const selectSection = (sectionId) => {
    const nextActiveFileId = getFirstFileId(activeCollection, sectionId)

    setActiveSection(sectionId)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
  }

  const selectFile = (fileId) => {
    setActiveFileId(fileId)
    setCompareEnabled(false)
    setCompareFileId(null)
  }

  const toggleCompare = () => {
    if (compareEnabled) {
      setCompareEnabled(false)
      return
    }

    const defaultCompareId = compareCandidates[0]?.id ?? null
    setCompareEnabled(true)
    setCompareFileId(defaultCompareId)
  }

  const noFilesMessage =
    activeSection === 'articles'
      ? 'Brak artykulow dla tej kolekcji.'
      : 'Brak wynikow dla tej kolekcji.'

  const articleParagraphs =
    selectedFile?.kind === 'article' && selectedFile?.data?.text
      ? selectedFile.data.text.split('\n').filter((line) => line.trim().length > 0)
      : []

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">ASK</p>
        <h1>Algebraic Summarization of Knowledge</h1>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <h2>Folders</h2>
          <button type="button" className="folder active">
            corpus
          </button>

          <h3>Collections</h3>
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              className={`file ${activeCollectionId === collection.id ? 'active' : ''}`}
              onClick={() => selectCollection(collection.id)}
            >
              {collection.label}
            </button>
          ))}

          <h3>Category</h3>
          <div className="section-switch">
            <button
              type="button"
              className={`folder ${activeSection === 'articles' ? 'active' : ''}`}
              onClick={() => selectSection('articles')}
            >
              articles
            </button>
            <button
              type="button"
              className={`folder ${activeSection === 'results' ? 'active' : ''}`}
              onClick={() => selectSection('results')}
            >
              results
            </button>
          </div>

          <h3>Files</h3>
          <div className="file-list">
            {visibleFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                className={`file ${selectedFile?.id === file.id ? 'active' : ''}`}
                onClick={() => selectFile(file.id)}
              >
                {file.name}
              </button>
            ))}
            {!visibleFiles.length ? <p className="empty-message">{noFilesMessage}</p> : null}
          </div>
        </aside>

        <section className="content">
          <div className="content-title-row">
            <h2>{selectedFile?.name ?? 'Brak pliku'}</h2>
            <div className="title-actions">
              {activeSection === 'results' && selectedFile ? (
                <button
                  type="button"
                  className={`compare-toggle ${compareEnabled ? 'active' : ''}`}
                  onClick={toggleCompare}
                  disabled={!compareCandidates.length}
                >
                  compare
                </button>
              ) : null}
              <span className="badge">{activeSection}</span>
            </div>
          </div>

          {!selectedFile ? (
            <section className="result-body">
              <p className="json-muted">{noFilesMessage}</p>
            </section>
          ) : selectedFile.kind === 'article' ? (
            <article>
              <div className="meta-grid">
                <p>
                  <span>Tytul</span>
                  {selectedFile.data.title}
                </p>
                <p>
                  <span>Zrodlo</span>
                  {selectedFile.data.source}
                </p>
                <p>
                  <span>Data publikacji</span>
                  {formatDate(selectedFile.data.publishedAt)}
                </p>
                <p>
                  <span>URL</span>
                  <a href={selectedFile.data.url} target="_blank" rel="noreferrer">
                    {selectedFile.data.url}
                  </a>
                </p>
              </div>

              <div className="article-body">
                {articleParagraphs.map((paragraph, index) => (
                  <p key={`p-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          ) : (
            <>
              {compareEnabled && comparedFile ? (
                <div className="compare-controls">
                  <label htmlFor="compare-select">Porownaj z:</label>
                  <select
                    id="compare-select"
                    value={comparedFile.id}
                    onChange={(event) => setCompareFileId(event.target.value)}
                  >
                    {compareCandidates.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {compareEnabled && comparedFile ? (
                <div className="compare-grid">
                  <section className="result-body">
                    <h3>{selectedFile.name}</h3>
                    <JsonText value={selectedFile.data} />
                  </section>
                  <section className="result-body">
                    <h3>{comparedFile.name}</h3>
                    <JsonText value={comparedFile.data} />
                  </section>
                </div>
              ) : (
                <section className="result-body">
                  <JsonText value={selectedFile.data} />
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
