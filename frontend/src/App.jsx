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

function stripCategoryPrefix(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.replace(/^Kategoria:\s*/i, '').trim()
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenizeText(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 2)
}

function normalizeSourceKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '')
}

function pickPairedValues(item, sourceKeyA, sourceKeyB) {
  const entries = Object.entries(item).filter(([, value]) => typeof value === 'string')
  const normalizedA = normalizeSourceKey(sourceKeyA)
  const normalizedB = normalizeSourceKey(sourceKeyB)

  const matchByKey = (target, key) => {
    if (!key) {
      return null
    }

    const normalizedKey = normalizeSourceKey(key)
    if (!normalizedKey) {
      return null
    }

    const entry = target.find(([entryKey]) => {
      const normalizedEntry = normalizeSourceKey(entryKey)
      return normalizedEntry === normalizedKey ||
        normalizedEntry.includes(normalizedKey) ||
        normalizedKey.includes(normalizedEntry)
    })

    return entry ? entry[1] : null
  }

  const aValue = matchByKey(entries, sourceKeyA)
  const bValue = matchByKey(entries, sourceKeyB)

  if ((aValue || bValue) && entries.length > 1) {
    const remaining = entries.find(([, value]) => value !== aValue && value !== bValue)
    return {
      aValue: aValue ?? remaining?.[1] ?? '',
      bValue: bValue ?? remaining?.[1] ?? '',
    }
  }

  if (aValue || bValue) {
    return {
      aValue: aValue ?? '',
      bValue: bValue ?? '',
    }
  }

  if (!entries.length) {
    return { aValue: '', bValue: '' }
  }

  return {
    aValue: entries[0]?.[1] ?? '',
    bValue: entries[1]?.[1] ?? entries[0]?.[1] ?? '',
  }
}

function splitIntoSentences(text) {
  if (typeof text !== 'string') {
    return []
  }

  const normalized = text.replace(/\r/g, ' ').replace(/\n+/g, ' ').trim()
  const matches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  return matches ? matches.map((item) => item.trim()).filter(Boolean) : []
}

function getCategoryMarkers(resultData, sourceKeys) {
  if (!resultData || typeof resultData !== 'object') {
    return null
  }

  const sourceKeyA = sourceKeys?.a ?? ''
  const sourceKeyB = sourceKeys?.b ?? ''

  const overlapItems = Array.isArray(resultData['Informacje powielajace sie'])
    ? resultData['Informacje powielajace sie']
    : Array.isArray(resultData['Informacje powielajace się'])
      ? resultData['Informacje powielajace się']
      : Array.isArray(resultData['Informacje powielające się'])
        ? resultData['Informacje powielające się']
        : []

  const diffContainer =
    resultData[
      'Roznice/doprecyzowanie informacji/pojawiajace sie w A, niepojawiajace sie w B'
    ] ??
    resultData[
      'Różnice/doprecyzowanie informacji/pojawiające się w A, niepojawiające się w B'
    ]

  const conflictItems = Array.isArray(resultData['Konflikty/sprzeczne fakty?'])
    ? resultData['Konflikty/sprzeczne fakty?']
    : []

  const overlapA = []
  const overlapB = []
  for (const item of overlapItems) {
    if (typeof item === 'string') {
      const cleaned = stripCategoryPrefix(item)
      overlapA.push({ text: cleaned, key: '' })
      overlapB.push({ text: cleaned, key: '' })
      continue
    }

    if (item && typeof item === 'object') {
      const { aValue, bValue } = pickPairedValues(item, sourceKeyA, sourceKeyB)
      const cleanedA = stripCategoryPrefix(aValue)
      const cleanedB = stripCategoryPrefix(bValue)
      const key = cleanedA && cleanedB ? `overlap-${overlapA.length}` : ''
      if (cleanedA) {
        overlapA.push({ text: cleanedA, key })
      }
      if (cleanedB) {
        overlapB.push({ text: cleanedB, key })
      } else if (cleanedA) {
        overlapB.push({ text: cleanedA, key })
      }
    }
  }

  const diffArrays = diffContainer && typeof diffContainer === 'object'
    ? Object.values(diffContainer).filter(Array.isArray)
    : []

  const uniqueA = (diffArrays[0] ?? [])
    .map(stripCategoryPrefix)
    .filter(Boolean)
    .map((text) => ({ text, key: '' }))
  const uniqueB = (diffArrays[1] ?? [])
    .map(stripCategoryPrefix)
    .filter(Boolean)
    .map((text) => ({ text, key: '' }))

  const conflictA = []
  const conflictB = []
  for (const item of conflictItems) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const trimmedItem = Object.fromEntries(
      Object.entries(item).filter(
        ([key, value]) =>
          typeof value === 'string' &&
          !['temat', 'explanation'].includes(key.toLowerCase())
      )
    )

    const { aValue, bValue } = pickPairedValues(trimmedItem, sourceKeyA, sourceKeyB)
    const cleanedA = stripCategoryPrefix(aValue)
    const cleanedB = stripCategoryPrefix(bValue)
    const key = cleanedA && cleanedB ? `conflict-${conflictA.length}` : ''
    if (cleanedA) {
      conflictA.push({ text: cleanedA, key })
    }
    if (cleanedB) {
      conflictB.push({ text: cleanedB, key })
    } else if (cleanedA) {
      conflictB.push({ text: cleanedA, key })
    }
  }

  if (
    !overlapA.length &&
    !overlapB.length &&
    !uniqueA.length &&
    !uniqueB.length &&
    !conflictA.length &&
    !conflictB.length
  ) {
    return null
  }

  return {
    overlapA,
    overlapB,
    uniqueA,
    uniqueB,
    conflictA,
    conflictB,
  }
}

function buildTaggedSentences(text, markers) {
  const sentences = splitIntoSentences(text)
  if (!markers) {
    return sentences.map((sentence) => ({ sentence, tag: '' }))
  }

  const normalizeItems = (items) =>
    items
      .map((item) => ({
        text: normalizeText(item.text),
        key: item.key,
        tokens: tokenizeText(item.text),
      }))
      .filter((item) => item.text)

  const overlap = normalizeItems(markers.overlap)
  const unique = normalizeItems(markers.unique)
  const conflict = normalizeItems(markers.conflict)

  const markerGroups = {
    conflict,
    overlap,
    unique,
  }

  const isLooseMatch = (sentenceValue, markerValue) =>
    sentenceValue.includes(markerValue) || markerValue.includes(sentenceValue)

  const hasTokenOverlap = (sentenceTokens, marker) => {
    if (!marker.tokens.length || !sentenceTokens.length) {
      return false
    }

    const markerSet = new Set(marker.tokens)
    const intersection = sentenceTokens.reduce(
      (count, token) => (markerSet.has(token) ? count + 1 : count),
      0
    )
    const ratio = intersection / marker.tokens.length
    const minOverlap = marker.tokens.length < 4 ? 2 : 3
    return intersection >= minOverlap && ratio >= 0.35
  }

  const sentenceData = sentences.map((sentence) => ({
    sentence,
    normalized: normalizeText(sentence),
    tokens: tokenizeText(sentence),
  }))

  const scoreMatch = (sentenceInfo, marker) => {
    if (!marker.text) {
      return 0
    }

    if (isLooseMatch(sentenceInfo.normalized, marker.text)) {
      return 1
    }

    if (!marker.tokens.length || !sentenceInfo.tokens.length) {
      return 0
    }

    const markerSet = new Set(marker.tokens)
    const intersection = sentenceInfo.tokens.reduce(
      (count, token) => (markerSet.has(token) ? count + 1 : count),
      0
    )
    return intersection / marker.tokens.length
  }

  const assignBestMatches = (items, tag, minScore) => {
    const assignments = []
    items.forEach((marker) => {
      let bestIndex = -1
      let bestScore = 0

      sentenceData.forEach((sentenceInfo, index) => {
        const score = scoreMatch(sentenceInfo, marker)
        if (score > bestScore) {
          bestScore = score
          bestIndex = index
        }
      })

      if (bestIndex >= 0 && bestScore >= minScore) {
        assignments.push({ index: bestIndex, tag, key: marker.key })
      }
    })

    return assignments
  }

  const assignments = [
    ...assignBestMatches(markerGroups.conflict, 'conflict', 0.22),
    ...assignBestMatches(markerGroups.overlap, 'overlap', 0.18),
    ...assignBestMatches(markerGroups.unique, 'unique', 0.18),
  ]

  const priority = { conflict: 3, overlap: 2, unique: 1 }
  const bySentence = new Map()
  assignments.forEach((assignment) => {
    const current = bySentence.get(assignment.index)
    if (!current || priority[assignment.tag] > priority[current.tag]) {
      bySentence.set(assignment.index, assignment)
      return
    }

    if (current.tag === assignment.tag && !current.key && assignment.key) {
      bySentence.set(assignment.index, assignment)
    }
  })

  return sentenceData.map((sentenceInfo, index) => {
    const assignment = bySentence.get(index)
    return {
      sentence: sentenceInfo.sentence,
      tag: assignment?.tag ?? '',
      key: assignment?.key ?? '',
    }
  })
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
  const [activeHighlightKey, setActiveHighlightKey] = useState('')

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

  const categoryMarkers = useMemo(() => {
    if (activeSection !== 'results' || !selectedFile?.data) {
      return null
    }

    const sourceKeys = {
      a: analysisArticles?.sourceA?.data?.source ?? '',
      b: analysisArticles?.sourceB?.data?.source ?? '',
    }

    return getCategoryMarkers(selectedFile.data, sourceKeys)
  }, [activeSection, selectedFile, analysisArticles])

  const showCategoryResults = Boolean(categoryMarkers && analysisArticles)

  const selectCollection = (collectionId) => {
    const nextCollection =
      collectionsState.find((item) => item.id === collectionId) ?? collectionsState[0]
    const nextActiveFileId = getFirstFileId(nextCollection, activeSection)

    setActiveCollectionId(nextCollection.id)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
    setAnalysisError('')
    setActiveHighlightKey('')
  }

  const selectSection = (sectionId) => {
    const nextActiveFileId = getFirstFileId(activeCollection, sectionId)

    setActiveSection(sectionId)
    setActiveFileId(nextActiveFileId)
    setCompareEnabled(false)
    setCompareFileId(null)
    setAnalysisError('')
    setActiveHighlightKey('')
  }

  const selectFile = (fileId) => {
    setActiveFileId(fileId)
    setCompareEnabled(false)
    setCompareFileId(null)
    setActiveHighlightKey('')
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

  const toggleHighlight = (key) => {
    if (!key) {
      return
    }

    setActiveHighlightKey((prev) => (prev === key ? '' : key))
  }

  const noFilesMessage =
    activeSection === 'articles'
      ? 'Brak artykulow dla tej kolekcji.'
      : 'Brak wynikow dla tej kolekcji.'

  const articleParagraphs =
    selectedFile?.kind === 'article' && selectedFile?.data?.text
      ? selectedFile.data.text.split('\n').filter((line) => line.trim().length > 0)
      : []

  const sourceAText = analysisArticles?.sourceA?.data?.text ?? ''
  const sourceBText = analysisArticles?.sourceB?.data?.text ?? ''
  const sourceASentences = useMemo(() => {
    if (!showCategoryResults) {
      return []
    }

    return buildTaggedSentences(sourceAText, {
      overlap: categoryMarkers.overlapA,
      unique: categoryMarkers.uniqueA,
      conflict: categoryMarkers.conflictA,
    })
  }, [categoryMarkers, showCategoryResults, sourceAText])

  const sourceBSentences = useMemo(() => {
    if (!showCategoryResults) {
      return []
    }

    return buildTaggedSentences(sourceBText, {
      overlap: categoryMarkers.overlapB,
      unique: categoryMarkers.uniqueB,
      conflict: categoryMarkers.conflictB,
    })
  }, [categoryMarkers, showCategoryResults, sourceBText])

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">ASK</p>
        <h1>Algebraic Summarization of Knowledge</h1>
        <p className="header-subtitle">
          Porownuj zrodla, sprawdzaj zgodnosc i szybko wychwytuj konflikty.
        </p>
      </header>

      <main className="workspace">
        <section className="content">
          <div className="app-topbar">
            <div className="toolbar-group">
              <label className="toolbar-field">
                Kolekcja
                <select
                  value={activeCollectionId ?? ''}
                  onChange={(event) => selectCollection(event.target.value)}
                >
                  {collectionsState.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="toolbar-segment">
                <button
                  type="button"
                  className={`segment ${activeSection === 'articles' ? 'active' : ''}`}
                  onClick={() => selectSection('articles')}
                >
                  artykuly
                </button>
                <button
                  type="button"
                  className={`segment ${activeSection === 'results' ? 'active' : ''}`}
                  onClick={() => selectSection('results')}
                >
                  wyniki
                </button>
              </div>

              <label className="toolbar-field">
                Plik
                <select
                  value={selectedFile?.id ?? ''}
                  onChange={(event) => selectFile(event.target.value)}
                  disabled={!visibleFiles.length}
                >
                  {visibleFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="toolbar-actions">
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

          <div className="content-title-row">
            <h2>{selectedFile?.name ?? 'Brak pliku'}</h2>
            <p className="title-meta">
              {activeCollection?.label ?? 'Brak kolekcji'}
            </p>
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

              {showCategoryResults ? (
                <section className="category-results">
                  <div className="legend">
                    <span className="legend-item overlap">Powielajace sie</span>
                    <span className="legend-item unique">Dodatkowe / unikalne</span>
                    <span className="legend-item conflict">Konflikt</span>
                  </div>

                  <div className="side-by-side">
                    <article className="source-panel">
                      <header>
                        <h3>{analysisArticles.sourceA?.data?.source || 'Zrodlo A'}</h3>
                        <p>{analysisArticles.sourceA?.data?.title}</p>
                      </header>
                      <p className="article-text">
                        {sourceASentences.map((item, index) => (
                          <span
                            key={`a-${index}`}
                            className={`sentence ${item.tag} ${
                              item.key && item.key === activeHighlightKey ? 'active' : ''
                            } ${item.key ? 'pairable' : ''}`}
                            onClick={item.key ? () => toggleHighlight(item.key) : undefined}
                            role={item.key ? 'button' : undefined}
                            tabIndex={item.key ? 0 : undefined}
                            onKeyDown={
                              item.key
                                ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      toggleHighlight(item.key)
                                    }
                                  }
                                : undefined
                            }
                          >
                            {item.sentence}{' '}
                          </span>
                        ))}
                      </p>
                    </article>

                    <article className="source-panel">
                      <header>
                        <h3>{analysisArticles.sourceB?.data?.source || 'Zrodlo B'}</h3>
                        <p>{analysisArticles.sourceB?.data?.title}</p>
                      </header>
                      <p className="article-text">
                        {sourceBSentences.map((item, index) => (
                          <span
                            key={`b-${index}`}
                            className={`sentence ${item.tag} ${
                              item.key && item.key === activeHighlightKey ? 'active' : ''
                            } ${item.key ? 'pairable' : ''}`}
                            onClick={item.key ? () => toggleHighlight(item.key) : undefined}
                            role={item.key ? 'button' : undefined}
                            tabIndex={item.key ? 0 : undefined}
                            onKeyDown={
                              item.key
                                ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      toggleHighlight(item.key)
                                    }
                                  }
                                : undefined
                            }
                          >
                            {item.sentence}{' '}
                          </span>
                        ))}
                      </p>
                    </article>
                  </div>
                </section>
              ) : compareEnabled && comparedFile ? (
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
