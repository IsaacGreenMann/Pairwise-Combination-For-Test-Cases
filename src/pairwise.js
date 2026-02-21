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
function toPairKey(paramA, valueA, paramB, valueB) {
  if (paramA < paramB) {
    return `${paramA}${PAIR_SEP}${valueA}${PAIR_SEP}${paramB}${PAIR_SEP}${valueB}`;
  }
  return `${paramB}${PAIR_SEP}${valueB}${PAIR_SEP}${paramA}${PAIR_SEP}${valueA}`;
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
 */
export function getAllPairsToCover(params) {
  const keys = new Set();
  const n = params.length;
  for (const [i, j] of paramPairIndices(n)) {
    const nameA = params[i].name;
    const nameB = params[j].name;
    const valuesA = params[i].values;
    const valuesB = params[j].values;
    for (const va of valuesA) {
      for (const vb of valuesB) {
        keys.add(toPairKey(nameA, va, nameB, vb));
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
 * Format a pair key for display.
 */
export function formatPairKey(key) {
  const parts = key.split(PAIR_SEP);
  if (parts.length !== 4) return key;
  const [p1, v1, p2, v2] = parts;
  return `(${p1}: ${v1}, ${p2}: ${v2})`;
}

// --- IPO test case generation ---

function addVerticalRows(params, names, rows, covered, pIdx) {
  const pName = names[pIdx];
  const pValues = params[pIdx].values;
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
          const newRow = { [pName]: v, [otherName]: otherVal };
          for (let j = 0; j < pIdx; j++) {
            if (names[j] === otherName) continue;
            newRow[names[j]] = params[j].values[0];
          }
          rows.push(newRow);
          const newKeys = getPairsCoveredByRow(newRow, names.slice(0, pIdx + 1));
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

export function generatePairwiseSimple(params) {
  if (params.length === 0) return [];
  if (params.length === 1) {
    return params[0].values.map((v) => ({ [params[0].name]: v }));
  }

  const names = params.map((p) => p.name);
  const rows = [];

  // First two parameters: full Cartesian product
  for (const v0 of params[0].values) {
    for (const v1 of params[1].values) {
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

    // Horizontal: extend each row with a value that covers the most new pairs
    for (const row of rows) {
      let bestValue = pValues[0];
      let bestCount = -1;
      for (const v of pValues) {
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
      row[pName] = bestValue;
      for (let i = 0; i < pIdx; i++) {
        covered.add(toPairKey(names[i], row[names[i]], pName, row[pName]));
      }
    }

    addVerticalRows(params, names, rows, covered, pIdx);
  }

  return rows;
}

export function generatePairwise(params) {
  return generatePairwiseSimple(params);
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
 * (generatePairwise(order).length). For n <= MAX_PERMUTE uses full permutation search;
 * for larger n uses a heuristic (sort by value count ascending).
 */
export function optimizeParameterOrder(params) {
  if (params.length < 2) return params.map((p) => ({ name: p.name, values: [...p.values] }));
  const n = params.length;

  if (n <= MAX_PERMUTE) {
    let bestOrder = null;
    let bestCount = Infinity;
    permuteIndices(n, (indices) => {
      const ordered = indices.map((i) => params[i]);
      const rows = generatePairwise(ordered);
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
