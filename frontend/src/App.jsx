import { useMemo, useState } from 'react'
import './App.css'

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

function parseResultJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function normalizeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function buildInitialCollections() {
  const corpusFiles = import.meta.glob('../../corpus/*/*.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  const folders = new Map()

  for (const [path, rawValue] of Object.entries(corpusFiles)) {
    const match = path.match(/\/corpus\/([^/]+)\/([^/]+\.json)$/)
    if (!match) {
      continue
    }

    const [, folderName, fileName] = match
    const raw = typeof rawValue === 'string' ? rawValue : ''

    if (!folders.has(folderName)) {
      folders.set(folderName, {
        id: folderName,
        label: folderName,
        articles: [],
        results: [],
      })
    }

    const collection = folders.get(folderName)
    const fileEntry = {
      id: normalizeId(`${folderName}-${fileName}`),
      folder: fileName.startsWith('article_') ? 'articles' : 'results',
      name: fileName,
      kind: fileName.startsWith('article_') ? 'article' : 'result',
      data: fileName.startsWith('article_') ? parseRelaxedArticleJson(raw) : parseResultJson(raw),
    }

    if (fileEntry.kind === 'article') {
      collection.articles.push(fileEntry)
    } else {
      collection.results.push(fileEntry)
    }
  }

  const collections = Array.from(folders.values())
    .map((collection) => ({
      ...collection,
      articles: collection.articles.sort((a, b) => a.name.localeCompare(b.name)),
      results: collection.results.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return collections
}

const INITIAL_COLLECTIONS = buildInitialCollections()

const DEFAULT_ANALYSIS_PARAMS = {
  threshold: 0.58,
  conflictThreshold: 0.35,
}

function getFirstFileId(collection, section) {
  const files = collection?.[section] ?? []
  return files[0]?.id ?? null
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
  const [collectionsState, setCollectionsState] = useState(INITIAL_COLLECTIONS)
  const [activeCollectionId, setActiveCollectionId] = useState(INITIAL_COLLECTIONS[0]?.id ?? null)
  const [activeSection, setActiveSection] = useState('articles')
  const [activeFileId, setActiveFileId] = useState(
    getFirstFileId(INITIAL_COLLECTIONS[0], 'articles')
  )
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [analysisParams, setAnalysisParams] = useState(DEFAULT_ANALYSIS_PARAMS)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const activeCollection = useMemo(() => {
    return (
      collectionsState.find((item) => item.id === activeCollectionId) ?? collectionsState[0]
    )
  }, [activeCollectionId, collectionsState])

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

  const analysisArticles = useMemo(() => {
    const articles = activeCollection?.articles ?? []
    if (articles.length < 2) {
      return null
    }

    return {
      sourceA: articles[0],
      sourceB: articles[1],
    }
  }, [activeCollection])

  const isAutomatedWithoutLlmSelected =
    activeSection === 'results' && selectedFile?.name === 'automated_without_llm.json'

  const selectCollection = (collectionId) => {
    const nextCollection =
      collectionsState.find((item) => item.id === collectionId) ?? collectionsState[0]
    const nextActiveFileId = getFirstFileId(nextCollection, activeSection)

    setActiveCollectionId(nextCollection.id)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
    setAnalysisError('')
  }

  const selectSection = (sectionId) => {
    const nextActiveFileId = getFirstFileId(activeCollection, sectionId)

    setActiveSection(sectionId)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
    setAnalysisError('')
  }

  const selectFile = (fileId) => {
    setActiveFileId(fileId)
    setCompareEnabled(false)
    setCompareFileId(null)
  }

  const updateAnalysisParam = (paramName, rawValue) => {
    const parsed = Number.parseFloat(rawValue)
    setAnalysisParams((prev) => ({
      ...prev,
      [paramName]: Number.isFinite(parsed) ? parsed : prev[paramName],
    }))
  }

  const runAnalysis = async () => {
    if (!analysisArticles || !isAutomatedWithoutLlmSelected) {
      return
    }

    setAnalysisLoading(true)
    setAnalysisError('')

    try {
      const response = await fetch('/api/analyze-without-llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceA: analysisArticles.sourceA?.data?.text ?? '',
          sourceB: analysisArticles.sourceB?.data?.text ?? '',
          threshold: analysisParams.threshold,
          conflictThreshold: analysisParams.conflictThreshold,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Nie udało się wykonać analizy.')
      }

      const savedResult = payload?.savedResult ?? payload?.result
      if (!savedResult || typeof savedResult !== 'object') {
        throw new Error('Nieprawidłowy format odpowiedzi analizy.')
      }

      setCollectionsState((prevCollections) =>
        prevCollections.map((collection) => {
          if (collection.id !== activeCollectionId) {
            return collection
          }

          return {
            ...collection,
            results: collection.results.map((file) =>
              file.id === selectedFile?.id ? { ...file, data: savedResult } : file
            ),
          }
        })
      )
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Nieznany błąd analizy.')
    } finally {
      setAnalysisLoading(false)
    }
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
          {collectionsState.map((collection) => (
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
              {isAutomatedWithoutLlmSelected && analysisArticles ? (
                <button
                  type="button"
                  className="compare-toggle"
                  onClick={runAnalysis}
                  disabled={analysisLoading}
                >
                  {analysisLoading ? 'analiza...' : 'analizuj'}
                </button>
              ) : null}
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

          {isAutomatedWithoutLlmSelected ? (
            <section className="analysis-params">
              <h3>Parametry analizy bez LLM</h3>
              <div className="analysis-params-grid">
                <label htmlFor="threshold-input">
                  Threshold silnych dopasowan (0-1)
                  <input
                    id="threshold-input"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={analysisParams.threshold}
                    onChange={(event) => updateAnalysisParam('threshold', event.target.value)}
                  />
                </label>
                <label htmlFor="conflict-threshold-input">
                  Threshold konfliktow (0-1)
                  <input
                    id="conflict-threshold-input"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={analysisParams.conflictThreshold}
                    onChange={(event) =>
                      updateAnalysisParam('conflictThreshold', event.target.value)
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {isAutomatedWithoutLlmSelected && analysisError ? (
            <p className="analysis-error">Blad analizy: {analysisError}</p>
          ) : null}

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
