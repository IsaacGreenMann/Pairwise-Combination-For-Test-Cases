import { useState, useCallback } from 'react'
import {
  generatePairwise,
  getAllPairsToCover,
  countTotalPairs,
  getPairsCoveredByRow,
  verifyCoverage,
  formatPairKey,
  optimizeParameterOrder,
  getForbiddenPairKeys,
  validateConstraints,
  checkConstraintConflict,
  toPairKey,
} from './pairwise'
import './App.css'

const CHIPMUNK_EXAMPLE = [
  { name: 'Display Mode', values: ['full-graphics', 'text-only', 'limited-bandwidth'] },
  { name: 'Language', values: ['English', 'French', 'Spanish', 'Portuguese'] },
  { name: 'Fonts', values: ['Minimal', 'Standard', 'Document-loaded'] },
  { name: 'Color', values: ['Monochrome', 'Color-map', '16-bit', 'True-color'] },
  { name: 'Screen Size', values: ['Hand-held', 'Laptop', 'Full-size'] },
]

let idCounter = 0
function nextId() {
  return `${Date.now()}-${++idCounter}`
}

function parseBulkValues(str) {
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

export default function App() {
  const [params, setParams] = useState([])
  const [testCases, setTestCases] = useState([])
  const [paramNames, setParamNames] = useState([])
  const [totalPairs, setTotalPairs] = useState(0)
  const [totalPairsWithoutConstraints, setTotalPairsWithoutConstraints] = useState(0)
  const [forbiddenPairsCount, setForbiddenPairsCount] = useState(0)
  const [coverageOk, setCoverageOk] = useState(null)
  const [missingCount, setMissingCount] = useState(0)
  const [constraintValidation, setConstraintValidation] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editValues, setEditValues] = useState([])
  const [editValueInput, setEditValueInput] = useState('')
  const [editBulkInput, setEditBulkInput] = useState('')
  const [constraints, setConstraints] = useState([])
  const [constraintParamA, setConstraintParamA] = useState('')
  const [constraintValueA, setConstraintValueA] = useState('')
  const [constraintParamB, setConstraintParamB] = useState('')
  const [constraintValueB, setConstraintValueB] = useState('')
  const [highlightConstraintId, setHighlightConstraintId] = useState(null)

  const addParam = useCallback((name, values) => {
    const nameTrim = name.trim()
    if (!nameTrim) {
      setError('Parameter name is required.')
      return
    }
    if (!Array.isArray(values) || values.length < 2) {
      setError('Each parameter must have at least 2 values. Add values one by one.')
      return
    }
    if (params.some((p) => p.name.toLowerCase() === nameTrim.toLowerCase())) {
      setError('A parameter with this name already exists.')
      return
    }
    setParams((prev) => [...prev, { id: nextId(), name: nameTrim, values: [...values] }])
    setError('')
  }, [params])

  const removeParam = useCallback((id) => {
    const param = params.find((p) => p.id === id)
    setParams((prev) => prev.filter((p) => p.id !== id))
    setEditingId(null)
    if (param) {
      setConstraints((prev) => prev.filter((c) => c.paramA !== param.name && c.paramB !== param.name))
    }
  }, [params])

  const startEdit = useCallback((p) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditValues([...p.values])
    setEditValueInput('')
    setEditBulkInput('')
  }, [])

  const saveEdit = useCallback(() => {
    const nameTrim = editName.trim()
    if (!nameTrim || editValues.length < 2) {
      setError('Name required and at least 2 values.')
      return
    }
    const editedParam = params.find((p) => p.id === editingId)
    setParams((prev) =>
      prev.map((p) =>
        p.id === editingId ? { ...p, name: nameTrim, values: [...editValues] } : p
      )
    )
    if (editedParam) {
      const paramName = editedParam.name
      const newValuesSet = new Set(editValues)
      setConstraints((prev) =>
        prev.filter((c) => {
          if (c.paramA !== paramName && c.paramB !== paramName) return true
          if (c.paramA === paramName && !newValuesSet.has(c.valueA)) return false
          if (c.paramB === paramName && !newValuesSet.has(c.valueB)) return false
          return true
        })
      )
    }
    setEditingId(null)
    setEditValueInput('')
    setError('')
  }, [editingId, editName, editValues, params])

  const addValueToEdit = useCallback(() => {
    const v = editValueInput.trim()
    if (!v) return
    setEditValues((prev) => [...prev, v])
    setEditValueInput('')
  }, [editValueInput])

  const removeValueFromEdit = useCallback((index) => {
    setEditValues((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const reorderParams = useCallback((sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) return
    setParams((prev) => {
      const next = [...prev]
      ;[next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]]
      return next
    })
  }, [])

  const loadExample = useCallback(() => {
    setParams(
      CHIPMUNK_EXAMPLE.map((p) => ({ id: nextId(), name: p.name, values: [...p.values] }))
    )
    setTestCases([])
    setCoverageOk(null)
    setConstraintValidation(null)
    setConstraints([])
    setError('')
    setEditingId(null)
  }, [])

  const applyGenerate = useCallback((paramList, constraintList = []) => {
    const tableParamNames = paramList.map((p) => p.name)
    const totalWithout = countTotalPairs(paramList)
    const forbiddenSet = constraintList.length > 0 ? getForbiddenPairKeys(constraintList) : null
    const forbiddenCount = forbiddenSet ? forbiddenSet.size : 0
    const toCover = getAllPairsToCover(paramList, forbiddenSet)
    const effectiveCount = toCover.size
    setTotalPairsWithoutConstraints(totalWithout)
    setForbiddenPairsCount(forbiddenCount)
    setTotalPairs(effectiveCount)
    const rows = generatePairwise(paramList, constraintList)
    setTestCases(rows)
    setParamNames(tableParamNames)
    const covered = new Set()
    for (const row of rows) {
      for (const k of getPairsCoveredByRow(row, tableParamNames)) {
        covered.add(k)
      }
    }
    const { allCovered, missing } = verifyCoverage(toCover, covered)
    setCoverageOk(allCovered)
    setMissingCount(missing.length)
    const validation = validateConstraints(rows, tableParamNames, forbiddenSet)
    setConstraintValidation(validation.valid ? { valid: true } : { valid: false, violations: validation.violations })
  }, [])

  const generate = useCallback(() => {
    setError('')
    if (params.length < 2) {
      setError('Add at least 2 parameters.')
      return
    }
    const paramList = params.map((p) => ({ name: p.name, values: p.values }))
    const constraintList = constraints.map((c) => ({
      paramA: c.paramA,
      valueA: c.valueA,
      paramB: c.paramB,
      valueB: c.valueB,
    }))
    const conflict = checkConstraintConflict(paramList, constraintList)
    if (conflict.conflict) {
      setError(conflict.message)
      return
    }
    applyGenerate(paramList, constraintList)
  }, [params, constraints, applyGenerate])

  const optimizeOrder = useCallback(() => {
    setError('')
    if (params.length < 2) {
      setError('Add at least 2 parameters to optimize.')
      return
    }
    const paramList = params.map((p) => ({ name: p.name, values: p.values }))
    const constraintList = constraints.map((c) => ({ paramA: c.paramA, valueA: c.valueA, paramB: c.paramB, valueB: c.valueB }))
    const optimized = optimizeParameterOrder(paramList, constraintList)
    const newParams = optimized.map((opt) => params.find((p) => p.name === opt.name)).filter(Boolean)
    if (newParams.length !== params.length) return
    setParams(newParams)
    applyGenerate(optimized, constraintList)
  }, [params, constraints, applyGenerate])

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
  const [newValues, setNewValues] = useState([])
  const [newValueInput, setNewValueInput] = useState('')
  const [newBulkInput, setNewBulkInput] = useState('')

  const addValueToNew = useCallback(() => {
    const v = newValueInput.trim()
    if (!v) return
    setNewValues((prev) => [...prev, v])
    setNewValueInput('')
  }, [newValueInput])

  const removeValueFromNew = useCallback((index) => {
    setNewValues((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const bulkAddToNew = useCallback(() => {
    const values = parseBulkValues(newBulkInput)
    if (values.length === 0) return
    setNewValues((prev) => [...prev, ...values])
    setNewBulkInput('')
  }, [newBulkInput])

  const bulkAddToEdit = useCallback(() => {
    const values = parseBulkValues(editBulkInput)
    if (values.length === 0) return
    setEditValues((prev) => [...prev, ...values])
    setEditBulkInput('')
  }, [editBulkInput])

  const handleAdd = () => {
    addParam(newName, newValues)
    setNewName('')
    setNewValues([])
    setNewValueInput('')
    setNewBulkInput('')
  }

  const addConstraint = useCallback(() => {
    if (!constraintParamA || !constraintValueA || !constraintParamB || !constraintValueB) {
      setError('Select both parameters and values for the constraint.')
      return
    }
    if (constraintParamA === constraintParamB) {
      setError('Parameter A and Parameter B must be different.')
      return
    }
    const key = toPairKey(constraintParamA, constraintValueA, constraintParamB, constraintValueB)
    const isDup = constraints.some(
      (c) => toPairKey(c.paramA, c.valueA, c.paramB, c.valueB) === key
    )
    if (isDup) {
      setError('This constraint is already added.')
      return
    }
    setConstraints((prev) => [
      ...prev,
      {
        id: nextId(),
        paramA: constraintParamA,
        valueA: constraintValueA,
        paramB: constraintParamB,
        valueB: constraintValueB,
      },
    ])
    setConstraintParamA('')
    setConstraintValueA('')
    setConstraintParamB('')
    setConstraintValueB('')
    setError('')
  }, [constraintParamA, constraintValueA, constraintParamB, constraintValueB, constraints])

  const removeConstraint = useCallback((id) => {
    setConstraints((prev) => prev.filter((c) => c.id !== id))
    if (highlightConstraintId === id) setHighlightConstraintId(null)
  }, [highlightConstraintId])

  const paramListForConstraints = params.filter((p) => p.values.length >= 1)
  const valuesForParam = (paramName) => params.find((p) => p.name === paramName)?.values ?? []
  const otherParams = (excludeName) => paramListForConstraints.filter((p) => p.name !== excludeName)

  return (
    <div className="app">
      <header className="header">
        <h1>Pairwise Combination Testing</h1>
        <p className="tagline">Generate minimal test suites that cover all value-pairs across parameters.</p>
      </header>

      <div className="main">
        <section className="input-section">
          <h2>Parameters &amp; Values</h2>
          <p className="hint">Add at least 2 parameters; each needs at least 2 values. Add values one by one.</p>

          <div className="add-form add-form-structured">
            <input
              type="text"
              placeholder="Parameter name (e.g. Display Mode)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
            <div className="value-entry">
              <input
                type="text"
                placeholder="Add a value"
                value={newValueInput}
                onChange={(e) => setNewValueInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValueToNew())}
              />
              <button type="button" className="btn btn-small" onClick={addValueToNew}>
                Add value
              </button>
            </div>
            <div className="value-entry bulk-entry">
              <input
                type="text"
                placeholder="Bulk add: value1, value2, value3"
                value={newBulkInput}
                onChange={(e) => setNewBulkInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), bulkAddToNew())}
              />
              <button type="button" className="btn btn-small" onClick={bulkAddToNew}>
                Bulk add
              </button>
            </div>
            {newValues.length > 0 && (
              <div className="value-chips">
                {newValues.map((v, i) => (
                  <span key={i} className="value-chip">
                    {v}
                    <button type="button" className="value-chip-remove" onClick={() => removeValueFromNew(i)} aria-label="Remove value">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={!newName.trim() || newValues.length < 2}
            >
              Add Parameter
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="param-list">
            {params.map((p, paramIndex) => (
              <div
                key={p.id}
                className="param-card param-card-draggable"
                draggable
                data-param-index={paramIndex}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'param', index: paramIndex }))
                  e.dataTransfer.effectAllowed = 'move'
                  e.currentTarget.classList.add('dragging')
                }}
                onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  e.currentTarget.classList.add('drag-over')
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('drag-over')
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'))
                    if (data.type === 'param') {
                      const targetIndex = Number(e.currentTarget.dataset.paramIndex)
                      reorderParams(data.index, targetIndex)
                    }
                  } catch (_) {}
                }}
              >
                {editingId === p.id ? (
                  <div className="param-edit-form">
                    <div className="param-edit-menu">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                      />
                      <div className="value-entry">
                        <input
                          type="text"
                          placeholder="Add a value"
                          value={editValueInput}
                          onChange={(e) => setEditValueInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValueToEdit())}
                        />
                        <button type="button" className="btn btn-small" onClick={addValueToEdit}>
                          Add value
                        </button>
                      </div>
                      <div className="value-entry bulk-entry">
                        <input
                          type="text"
                          placeholder="Bulk add: value1, value2, value3"
                          value={editBulkInput}
                          onChange={(e) => setEditBulkInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), bulkAddToEdit())}
                        />
                        <button type="button" className="btn btn-small" onClick={bulkAddToEdit}>
                          Bulk add
                        </button>
                      </div>
                      <div className="param-actions">
                        <button type="button" className="btn btn-small" onClick={saveEdit} disabled={editValues.length < 2}>
                          Save
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div className="param-edit-values">
                      <span className="param-edit-values-label">Values</span>
                      {editValues.length > 0 ? (
                        <ul className="value-list">
                          {editValues.map((val, i) => (
                            <li key={i} className="value-list-item">
                              <span className="value-chip">{val}</span>
                              <button type="button" className="value-chip-remove" onClick={() => removeValueFromEdit(i)} aria-label="Remove value">
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="param-edit-values-empty">No values yet. Add one above.</p>
                      )}
                    </div>
                  </div>
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

          <div className="constraints-section">
            <h2>Constraints</h2>
            <p className="hint">Forbidden value pairs that must not appear together in any test case.</p>
            <div className="constraint-form">
              <select
                value={constraintParamA}
                onChange={(e) => {
                  setConstraintParamA(e.target.value)
                  setConstraintValueA('')
                }}
                className="constraint-select"
                aria-label="Parameter A"
              >
                <option value="">Parameter A</option>
                {paramListForConstraints.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <select
                value={constraintValueA}
                onChange={(e) => setConstraintValueA(e.target.value)}
                className="constraint-select"
                disabled={!constraintParamA}
                aria-label="Value A"
              >
                <option value="">Value A</option>
                {valuesForParam(constraintParamA).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <span className="constraint-sep" aria-hidden="true">✕</span>
              <select
                value={constraintParamB}
                onChange={(e) => {
                  setConstraintParamB(e.target.value)
                  setConstraintValueB('')
                }}
                className="constraint-select"
                aria-label="Parameter B"
              >
                <option value="">Parameter B</option>
                {otherParams(constraintParamA).map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <select
                value={constraintValueB}
                onChange={(e) => setConstraintValueB(e.target.value)}
                className="constraint-select"
                disabled={!constraintParamB}
                aria-label="Value B"
              >
                <option value="">Value B</option>
                {valuesForParam(constraintParamB).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-small btn-constraint-add"
                onClick={addConstraint}
                disabled={!constraintParamA || !constraintValueA || !constraintParamB || !constraintValueB}
              >
                Add Constraint
              </button>
            </div>
            {constraints.length > 0 && (
              <ul className="constraint-list">
                {constraints.map((c) => (
                  <li
                    key={c.id}
                    className={`constraint-pill ${highlightConstraintId === c.id ? 'constraint-pill-highlight' : ''}`}
                    onMouseEnter={() => setHighlightConstraintId(c.id)}
                    onMouseLeave={() => setHighlightConstraintId(null)}
                  >
                    <span className="constraint-pill-text">
                      {c.paramA}: {c.valueA} <span className="constraint-x">✕</span> {c.paramB}: {c.valueB}
                    </span>
                    <button
                      type="button"
                      className="constraint-pill-remove"
                      onClick={() => removeConstraint(c.id)}
                      aria-label={`Remove constraint ${c.paramA} ${c.valueA} with ${c.paramB} ${c.valueB}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="action-row">
            <button type="button" className="btn btn-secondary" onClick={loadExample}>
              Load Example (From the Slides)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={optimizeOrder}
              disabled={params.length < 2}
              title="Reorder parameters to minimize the number of test cases"
            >
              Optimize order
            </button>
            <button
              type="button"
              className="btn btn-primary btn-large btn-generate"
              onClick={generate}
              disabled={params.length < 2}
            >
              Generate Test Cases
              {constraints.length > 0 && (
                <span className="generate-badge">({constraints.length} constraint{constraints.length !== 1 ? 's' : ''} active)</span>
              )}
            </button>
          </div>
        </section>

        <section className="output-section">
          <div className="summary-bar">
            <span>Parameters: <strong>{params.length}</strong></span>
            {forbiddenPairsCount > 0 ? (
              <>
                <span>Total pairs (no constraints): <strong>{totalPairsWithoutConstraints}</strong></span>
                <span>Forbidden pairs: <strong>{forbiddenPairsCount}</strong></span>
                <span>Effective to cover: <strong>{totalPairs}</strong></span>
              </>
            ) : (
              <span>Pairs to cover: <strong>{totalPairs}</strong></span>
            )}
            <span>Test cases: <strong>{testCases.length}</strong></span>
            {coverageOk !== null && (
              <span className={coverageOk ? 'coverage-ok' : 'coverage-fail'}>
                {coverageOk ? `✅ All ${totalPairs} pairs covered` : `❌ ${missingCount} pairs missing`}
              </span>
            )}
            {constraintValidation !== null && forbiddenPairsCount > 0 && (
              <span className={constraintValidation.valid ? 'coverage-ok' : 'coverage-fail'}>
                {constraintValidation.valid ? '✅ No forbidden pairs in test cases' : '❌ Constraint violation in test cases'}
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
            {(() => {
              const PAIR_SEP = '\x00'
              const pairsSeenSoFar = new Set()
              const firstTimeKeysByRow = []
              const neededParamValuesByRow = []
              for (let idx = 0; idx < testCases.length; idx++) {
                const row = testCases[idx]
                const pairsThisRow = getPairsCoveredByRow(row, paramNames)
                const firstTimeInThisRow = pairsThisRow.filter((k) => {
                  if (pairsSeenSoFar.has(k)) return false
                  pairsSeenSoFar.add(k)
                  return true
                })
                firstTimeKeysByRow[idx] = firstTimeInThisRow
                const needed = new Set()
                for (const key of firstTimeInThisRow) {
                  const parts = key.split(PAIR_SEP)
                  if (parts.length === 4) {
                    needed.add(parts[0] + PAIR_SEP + parts[1])
                    needed.add(parts[2] + PAIR_SEP + parts[3])
                  }
                }
                neededParamValuesByRow[idx] = needed
              }
              return (
                <>
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
                        {testCases.map((row, idx) => {
                          const highlightedConstraint = highlightConstraintId ? constraints.find((c) => c.id === highlightConstraintId) : null
                          const rowAffectedByConstraint = highlightedConstraint && (
                            row[highlightedConstraint.paramA] === highlightedConstraint.valueA ||
                            row[highlightedConstraint.paramB] === highlightedConstraint.valueB
                          )
                          return (
                          <tr key={idx} className={rowAffectedByConstraint ? 'row-constraint-highlight' : ''}>
                            <td className="col-num">Test {idx + 1}</td>
                            {paramNames.map((n) => {
                              const value = row[n]
                              const needed = neededParamValuesByRow[idx] && neededParamValuesByRow[idx].has(n + PAIR_SEP + value)
                              return (
                                <td key={n} className={needed ? '' : 'cell-dont-care'}>
                                  {needed ? value : '–'}
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="pairs-panel">
                    <h3>Unique pairs per test case</h3>
                    {testCases.map((row, idx) => {
                      const uniqueToThisRow = [...firstTimeKeysByRow[idx]].sort()
                      return (
                        <div key={idx} className="row-pairs">
                          <div className="row-pairs-label">Test case {idx + 1}</div>
                          <ul className="pairs-list-unique">
                            {uniqueToThisRow.length > 0 ? (
                              uniqueToThisRow.map((k) => (
                                <li key={k}>{formatPairKey(k)}</li>
                              ))
                            ) : (
                              <li className="pairs-none">(no new pairs)</li>
                            )}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
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
