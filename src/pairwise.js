/**
 * Pairwise (IPO - In-Parameter-Order) test case generation.
 *
 * Parameter order: The order of the params array is the canonical order (same as
 * table column order). All pair enumeration uses this order: pairs are (params[i], params[j])
 * for i < j. Callers must pass the same order to getPairsCoveredByRow via paramNames.
 *
 * A "pair" is one value for parameter A and one value for parameter B (unordered).
 * We use a canonical string key so the same pair is always represented the same way.
 * All pair aggregation uses Sets or Set-derived arrays so no duplicate pair keys occur.
 *
 * Params: array of { name: string, values: string[] }
 */

/** Delimiter for pair keys. Must not appear in parameter names or values. */
const PAIR_SEP = '\x00';

/**
 * Build a canonical key for the pair (paramA, valueA) × (paramB, valueB).
 * Order is normalized by parameter name so (A, vA, B, vB) and (B, vB, A, vA) yield the same key.
 */
export function toPairKey(paramA, valueA, paramB, valueB) {
  if (paramA < paramB) {
    return `${paramA}${PAIR_SEP}${valueA}${PAIR_SEP}${paramB}${PAIR_SEP}${valueB}`;
  }
  return `${paramB}${PAIR_SEP}${valueB}${PAIR_SEP}${paramA}${PAIR_SEP}${valueA}`;
}

/** Constraint: { paramA, valueA, paramB, valueB } — this pair must not appear in any test case. */
function constraintToPairKey(c) {
  return toPairKey(c.paramA, c.valueA, c.paramB, c.valueB);
}

/**
 * Build the set of forbidden pair keys from a list of constraints.
 * @param constraints { Array<{ paramA, valueA, paramB, valueB }> }
 */
export function getForbiddenPairKeys(constraints) {
  const set = new Set();
  if (!constraints || constraints.length === 0) return set;
  for (const c of constraints) {
    set.add(constraintToPairKey(c));
  }
  return set;
}

/**
 * Enumerate all unordered pairs of parameter indices (i, j) with i < j.
 */
function* paramPairIndices(n) {
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      yield [i, j];
    }
  }
}

/**
 * Compute the set of all pairs that must be covered.
 * Uses params array order: pairs are (params[i], params[j]) for i < j (table column order).
 * If forbiddenSet is provided, pairs in it are excluded (constraint feature).
 */
export function getAllPairsToCover(params, forbiddenSet = null) {
  const keys = new Set();
  const n = params.length;
  for (const [i, j] of paramPairIndices(n)) {
    const nameA = params[i].name;
    const nameB = params[j].name;
    const valuesA = params[i].values;
    const valuesB = params[j].values;
    for (const va of valuesA) {
      for (const vb of valuesB) {
        const key = toPairKey(nameA, va, nameB, vb);
        if (forbiddenSet && forbiddenSet.has(key)) continue;
        keys.add(key);
      }
    }
  }
  return keys;
}

/**
 * Count how many pairs must be covered (without building the set).
 * Uses same params array order as getAllPairsToCover.
 */
export function countTotalPairs(params) {
  let total = 0;
  const n = params.length;
  for (const [i, j] of paramPairIndices(n)) {
    total += params[i].values.length * params[j].values.length;
  }
  return total;
}

/**
 * From one test row (paramName -> value), compute all pair keys that this row covers.
 * Returns a unique list (no pair key repeated).
 * paramNames must be the parameter order (table column order); same order as params array
 * used for getAllPairsToCover and generatePairwise.
 */
export function getPairsCoveredByRow(row, paramNames) {
  if (!paramNames || paramNames.length === 0) return [];
  const keys = new Set();
  const n = paramNames.length;
  for (const [i, j] of paramPairIndices(n)) {
    const a = paramNames[i];
    const b = paramNames[j];
    const va = row[a];
    const vb = row[b];
    if (va != null && vb != null) {
      keys.add(toPairKey(a, va, b, vb));
    }
  }
  return Array.from(keys);
}

/**
 * Check that every required pair is in the covered set.
 * Returns { allCovered: boolean, missing: string[] }.
 * missing has no duplicate keys.
 */
export function verifyCoverage(requiredPairs, coveredSet) {
  const missingSet = new Set();
  for (const key of requiredPairs) {
    if (!coveredSet.has(key)) {
      missingSet.add(key);
    }
  }
  return {
    allCovered: missingSet.size === 0,
    missing: Array.from(missingSet),
  };
}

/**
 * Check that no test case row contains a forbidden pair.
 * Returns { valid: boolean, violations: Array<{ rowIndex, pairKey }> }.
 */
export function validateConstraints(testCases, paramNames, forbiddenSet) {
  if (!forbiddenSet || forbiddenSet.size === 0) {
    return { valid: true, violations: [] };
  }
  const violations = [];
  for (let rowIndex = 0; rowIndex < testCases.length; rowIndex++) {
    const row = testCases[rowIndex];
    const keys = getPairsCoveredByRow(row, paramNames);
    for (const key of keys) {
      if (forbiddenSet.has(key)) {
        violations.push({ rowIndex, pairKey: key });
      }
    }
  }
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Detect if constraints make generation impossible: some value of a parameter
 * has no valid pairing with any value of another parameter (all pairs forbidden).
 * Returns { conflict: boolean, message?: string }.
 */
export function checkConstraintConflict(params, constraints) {
  const forbidden = getForbiddenPairKeys(constraints);
  if (forbidden.size === 0) return { conflict: false };
  const names = params.map((p) => p.name);
  for (const c of constraints) {
    const paramA = params.find((p) => p.name === c.paramA);
    const paramB = params.find((p) => p.name === c.paramB);
    if (!paramA || !paramB) continue;
    // For value c.valueA in paramA, count how many paramB values are allowed
    let allowedB = 0;
    for (const vb of paramB.values) {
      const key = toPairKey(c.paramA, c.valueA, c.paramB, vb);
      if (!forbidden.has(key)) allowedB++;
    }
    if (allowedB === 0) {
      return {
        conflict: true,
        message: `Constraint conflict: ${c.paramA}: ${c.valueA} has no valid pairing with any value of ${c.paramB}.`,
      };
    }
    let allowedA = 0;
    for (const va of paramA.values) {
      const key = toPairKey(c.paramA, va, c.paramB, c.valueB);
      if (!forbidden.has(key)) allowedA++;
    }
    if (allowedA === 0) {
      return {
        conflict: true,
        message: `Constraint conflict: ${c.paramB}: ${c.valueB} has no valid pairing with any value of ${c.paramA}.`,
      };
    }
  }
  return { conflict: false };
}

/**
 * Format a pair key for display.
 */
export function formatPairKey(key) {
  const parts = key.split(PAIR_SEP);
  if (parts.length !== 4) return key;
  const [p1, v1, p2, v2] = parts;
  return `(${p1}: ${v1}, ${p2}: ${v2})`;
}

// --- IPO test case generation (with optional constraints) ---

function isForbiddenWithRow(forbiddenSet, row, pName, value, namesUpToP) {
  if (!forbiddenSet || forbiddenSet.size === 0) return false;
  for (let i = 0; i < namesUpToP.length; i++) {
    const otherName = namesUpToP[i];
    const otherVal = row[otherName];
    if (otherVal == null) continue;
    const key = toPairKey(otherName, otherVal, pName, value);
    if (forbiddenSet.has(key)) return true;
  }
  return false;
}

function addVerticalRows(params, names, rows, covered, pIdx, forbiddenSet) {
  const pName = names[pIdx];
  const pValues = params[pIdx].values;
  const namesUpToP = names.slice(0, pIdx + 1);
  let added = true;
  while (added) {
    added = false;
    for (const v of pValues) {
      for (let i = 0; i < pIdx; i++) {
        const otherName = names[i];
        const otherValues = params[i].values;
        for (const otherVal of otherValues) {
          const key = toPairKey(otherName, otherVal, pName, v);
          if (covered.has(key)) continue;
          if (forbiddenSet && forbiddenSet.has(key)) continue;
          const newRow = { [pName]: v, [otherName]: otherVal };
          for (let j = 0; j < pIdx; j++) {
            if (names[j] === otherName) continue;
            const colName = names[j];
            const colValues = params[j].values;
            let chosen = null;
            for (const cv of colValues) {
              if (isForbiddenWithRow(forbiddenSet, newRow, colName, cv, names.slice(0, pIdx + 1))) continue;
              chosen = cv;
              break;
            }
            newRow[names[j]] = chosen != null ? chosen : colValues[0];
          }
          rows.push(newRow);
          const newKeys = getPairsCoveredByRow(newRow, namesUpToP);
          for (const k of newKeys) covered.add(k);
          added = true;
          break;
        }
        if (added) break;
      }
      if (added) break;
    }
  }
}

export function generatePairwiseSimple(params, constraints = null) {
  if (params.length === 0) return [];
  if (params.length === 1) {
    return params[0].values.map((v) => ({ [params[0].name]: v }));
  }

  const forbiddenSet = constraints && constraints.length > 0 ? getForbiddenPairKeys(constraints) : null;
  const names = params.map((p) => p.name);
  const rows = [];

  // First two parameters: Cartesian product excluding forbidden pairs
  for (const v0 of params[0].values) {
    for (const v1 of params[1].values) {
      const key = toPairKey(names[0], v0, names[1], v1);
      if (forbiddenSet && forbiddenSet.has(key)) continue;
      rows.push({ [names[0]]: v0, [names[1]]: v1 });
    }
  }

  const covered = new Set();
  for (const row of rows) {
    for (const k of getPairsCoveredByRow(row, names)) covered.add(k);
  }

  // Extend by one parameter at a time (IPO horizontal then vertical)
  for (let pIdx = 2; pIdx < params.length; pIdx++) {
    const pName = names[pIdx];
    const pValues = params[pIdx].values;
    const namesUpToP = names.slice(0, pIdx);

    // Horizontal: extend each row with a value that covers the most new pairs and respects constraints
    for (const row of rows) {
      let bestValue = null;
      let bestCount = -1;
      for (const v of pValues) {
        if (isForbiddenWithRow(forbiddenSet, row, pName, v, namesUpToP)) continue;
        let newPairs = 0;
        for (let i = 0; i < pIdx; i++) {
          const key = toPairKey(names[i], row[names[i]], pName, v);
          if (!covered.has(key)) newPairs++;
        }
        if (newPairs > bestCount) {
          bestCount = newPairs;
          bestValue = v;
        }
      }
      if (bestValue != null) {
        row[pName] = bestValue;
        for (let i = 0; i < pIdx; i++) {
          covered.add(toPairKey(names[i], row[names[i]], pName, row[pName]));
        }
      } else {
        row[pName] = pValues[0];
        for (let i = 0; i < pIdx; i++) {
          covered.add(toPairKey(names[i], row[names[i]], pName, row[pName]));
        }
      }
    }

    addVerticalRows(params, names, rows, covered, pIdx, forbiddenSet);
  }

  return rows;
}

export function generatePairwise(params, constraints = null) {
  return generatePairwiseSimple(params, constraints);
}

const MAX_PERMUTE = 8;

function permuteIndices(n, tryOrder) {
  const arr = Array.from({ length: n }, (_, i) => i);
  function recurse(start) {
    if (start === n) {
      tryOrder(arr.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      recurse(start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }
  recurse(0);
}

/**
 * Returns a reordered copy of params that minimizes the number of test cases
 * (generatePairwise(order, constraints).length). For n <= MAX_PERMUTE uses full
 * permutation search; for larger n uses a heuristic (sort by value count ascending).
 * Constraints are respected when evaluating each order.
 */
export function optimizeParameterOrder(params, constraints = null) {
  if (params.length < 2) return params.map((p) => ({ name: p.name, values: [...p.values] }));
  const n = params.length;

  if (n <= MAX_PERMUTE) {
    let bestOrder = null;
    let bestCount = Infinity;
    permuteIndices(n, (indices) => {
      const ordered = indices.map((i) => params[i]);
      const rows = generatePairwise(ordered, constraints);
      if (rows.length < bestCount) {
        bestCount = rows.length;
        bestOrder = ordered;
      }
    });
    return bestOrder.map((p) => ({ name: p.name, values: [...p.values] }));
  }

  // Heuristic: order by ascending value count (smaller first often reduces IPO size)
  const sorted = [...params].sort((a, b) => a.values.length - b.values.length);
  return sorted.map((p) => ({ name: p.name, values: [...p.values] }));
}
