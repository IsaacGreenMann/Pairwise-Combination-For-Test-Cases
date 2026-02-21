import { useState, useCallback } from 'react'
import {
  generatePairwise,
  getAllPairsToCover,
  countTotalPairs,
  getPairsCoveredByRow,
  verifyCoverage,
  formatPairKey,
} from './pairwise'
import './App.css'

const CHIPMUNK_EXAMPLE = [
  { name: 'Display Mode', values: ['full-graphics', 'text-only', 'limited-bandwidth'] },
  { name: 'Language', values: ['English', 'French', 'Spanish', 'Portuguese'] },
  { name: 'Fonts', values: ['Minimal', 'Standard', 'Document-loaded'] },
  { name: 'Color', values: ['Monochrome', 'Color-map', '16-bit', 'True-color'] },
  { name: 'Screen Size', values: ['Hand-held', 'Laptop', 'Full-size'] },
]

function parseValues(str) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function nextId() {
  return String(Date.now())
}

export default function App() {
  const [params, setParams] = useState([])
  const [testCases, setTestCases] = useState([])
  const [paramNames, setParamNames] = useState([])
  const [totalPairs, setTotalPairs] = useState(0)
  const [coverageOk, setCoverageOk] = useState(null)
  const [missingCount, setMissingCount] = useState(0)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editValues, setEditValues] = useState('')

  const addParam = useCallback((name, valuesStr) => {
    const nameTrim = name.trim()
    const values = parseValues(valuesStr)
    if (!nameTrim) {
      setError('Parameter name is required.')
      return
    }
    if (values.length < 2) {
      setError('Each parameter must have at least 2 values (comma-separated).')
      return
    }
    if (params.some((p) => p.name.toLowerCase() === nameTrim.toLowerCase())) {
      setError('A parameter with this name already exists.')
      return
    }
    setParams((prev) => [...prev, { id: nextId(), name: nameTrim, values }])
    setError('')
  }, [params])

  const removeParam = useCallback((id) => {
    setParams((prev) => prev.filter((p) => p.id !== id))
    setEditingId(null)
  }, [])

  const startEdit = useCallback((p) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditValues(p.values.join(', '))
  }, [])

  const saveEdit = useCallback(() => {
    const nameTrim = editName.trim()
    const values = parseValues(editValues)
    if (!nameTrim || values.length < 2) {
      setError('Name required and at least 2 values.')
      return
    }
    setParams((prev) =>
      prev.map((p) =>
        p.id === editingId ? { ...p, name: nameTrim, values } : p
      )
    )
    setEditingId(null)
    setError('')
  }, [editingId, editName, editValues])

  const loadExample = useCallback(() => {
    setParams(
      CHIPMUNK_EXAMPLE.map((p) => ({ id: nextId(), name: p.name, values: [...p.values] }))
    )
    setTestCases([])
    setCoverageOk(null)
    setError('')
    setEditingId(null)
  }, [])

  const generate = useCallback(() => {
    setError('')
    if (params.length < 2) {
      setError('Add at least 2 parameters.')
      return
    }
    const paramList = params.map((p) => ({ name: p.name, values: p.values }))
    const total = countTotalPairs(paramList)
    setTotalPairs(total)
    const rows = generatePairwise(paramList)
    setTestCases(rows)
    setParamNames(paramList.map((p) => p.name))
    const toCover = getAllPairsToCover(paramList)
    const covered = new Set()
    for (const row of rows) {
      for (const k of getPairsCoveredByRow(row, paramList.map((p) => p.name))) {
        covered.add(k)
      }
    }
    const { allCovered, missing } = verifyCoverage(toCover, covered)
    setCoverageOk(allCovered)
    setMissingCount(missing.length)
  }, [params])

  const exportCsv = useCallback(() => {
    if (testCases.length === 0) return
    const headers = paramNames.join(',')
    const lines = [headers, ...testCases.map((row) => paramNames.map((n) => row[n]).join(','))]
    const csv = lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pairwise-test-cases.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [testCases, paramNames])

  const [newName, setNewName] = useState('')
  const [newValues, setNewValues] = useState('')

  const handleAdd = () => {
    addParam(newName, newValues)
    setNewName('')
    setNewValues('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Pairwise Combination Testing</h1>
        <p className="tagline">Generate minimal test suites that cover all value-pairs across parameters.</p>
      </header>

      <div className="main">
        <section className="input-section">
          <h2>Parameters &amp; Values</h2>
          <p className="hint">Add at least 2 parameters; each needs at least 2 values (comma-separated).</p>

          <div className="add-form">
            <input
              type="text"
              placeholder="Parameter name (e.g. Display Mode)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              type="text"
              placeholder="Values: value1, value2, value3"
              value={newValues}
              onChange={(e) => setNewValues(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" className="btn btn-primary" onClick={handleAdd}>
              Add Parameter
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="param-list">
            {params.map((p) => (
              <div key={p.id} className="param-card">
                {editingId === p.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                    />
                    <input
                      value={editValues}
                      onChange={(e) => setEditValues(e.target.value)}
                      placeholder="Values, comma-separated"
                    />
                    <div className="param-actions">
                      <button type="button" className="btn btn-small" onClick={saveEdit}>
                        Save
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="param-info">
                      <strong>{p.name}</strong>
                      <span className="param-values">{p.values.join(', ')}</span>
                    </div>
                    <div className="param-actions">
                      <button type="button" className="btn btn-small" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => removeParam(p.id)}>
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={loadExample}>
              Load Example (Chipmunk)
            </button>
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={generate}
              disabled={params.length < 2}
            >
              Generate Test Cases
            </button>
          </div>
        </section>

        <section className="output-section">
          <div className="summary-bar">
            <span>Parameters: <strong>{params.length}</strong></span>
            <span>Pairs to cover: <strong>{totalPairs}</strong></span>
            <span>Test cases: <strong>{testCases.length}</strong></span>
            {coverageOk !== null && (
              <span className={coverageOk ? 'coverage-ok' : 'coverage-fail'}>
                {coverageOk ? '✅ All pairs covered' : `❌ ${missingCount} pairs missing`}
              </span>
            )}
          </div>

          {testCases.length > 0 && (
            <div className="export-row">
              <button type="button" className="btn btn-small" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
          )}

          <div className="results-layout">
            <div className="table-wrap">
              <table className="test-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    {paramNames.map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((row, idx) => (
                    <tr key={idx}>
                      <td className="col-num">Test {idx + 1}</td>
                      {paramNames.map((n) => (
                        <td key={n}>{row[n]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pairs-panel">
              <h3>Pairs covered per row</h3>
              {testCases.map((row, idx) => {
                const keys = getPairsCoveredByRow(row, paramNames)
                return (
                  <div key={idx} className="row-pairs">
                    <div className="row-pairs-label">Test case {idx + 1}</div>
                    <ul>
                      {keys.map((k) => (
                        <li key={k}>{formatPairKey(k)}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {testCases.length > 0 && (
            <p className="test-count-msg">
              <strong>{testCases.length}</strong> test cases generated.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
