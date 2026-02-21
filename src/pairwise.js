/**
 * Pairwise (IPO - In-Parameter-Order) test case generation.
 * Params: array of { name: string, values: string[] }
 * Returns: { rows: array of Record<paramName, value>, totalPairs, coveredSet }
 */

function pairKey(paramA, valueA, paramB, valueB) {
  const [p1, v1, p2, v2] =
    paramA < paramB ? [paramA, valueA, paramB, valueB] : [paramB, valueB, paramA, valueA];
  return `${p1}\t${v1}\t${p2}\t${v2}`;
}

/** Compute all pairs that must be covered. Returns Set of pairKey strings. */
export function getAllPairsToCover(params) {
  const set = new Set();
  for (let i = 0; i < params.length; i++) {
    for (let j = i + 1; j < params.length; j++) {
      const nameA = params[i].name;
      const nameB = params[j].name;
      for (const va of params[i].values) {
        for (const vb of params[j].values) {
          set.add(pairKey(nameA, va, nameB, vb));
        }
      }
    }
  }
  return set;
}

/** Count total pairs to cover (same as getAllPairsToCover(params).size). */
export function countTotalPairs(params) {
  let total = 0;
  for (let i = 0; i < params.length; i++) {
    for (let j = i + 1; j < params.length; j++) {
      total += params[i].values.length * params[j].values.length;
    }
  }
  return total;
}

/** From a full row (Record<paramName, value>), get all pair keys that this row covers. */
export function getPairsCoveredByRow(row, paramNames) {
  const keys = [];
  const names = paramNames || Object.keys(row);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      if (row[a] != null && row[b] != null) {
        keys.push(pairKey(a, row[a], b, row[b]));
      }
    }
  }
  return keys;
}

/** Verify that all pairs in toCover are present in coveredSet. Returns { allCovered, missing }. */
export function verifyCoverage(toCover, coveredSet) {
  const missing = [];
  for (const key of toCover) {
    if (!coveredSet.has(key)) missing.push(key);
  }
  return { allCovered: missing.length === 0, missing };
}

/**
 * Simpler vertical extension: repeatedly add a row that covers some uncovered pair
 * for the new parameter, filling the rest arbitrarily (or to maximize coverage).
 */
function addVerticalRows(params, names, rows, covered, pIdx) {
  const pName = names[pIdx];
  const pValues = params[pIdx].values;
  let added = true;
  while (added) {
    added = false;
    for (const v of pValues) {
      for (let i = 0; i < pIdx; i++) {
        const otherName = names[i];
        for (const otherVal of params[i].values) {
          const key = pairKey(otherName, otherVal, pName, v);
          if (covered.has(key)) continue;
          const newRow = { [pName]: v, [otherName]: otherVal };
          for (let j = 0; j < pIdx; j++) {
            if (names[j] === otherName) continue;
            newRow[names[j]] = params[j].values[0];
          }
          rows.push(newRow);
          for (const k of getPairsCoveredByRow(newRow, names.slice(0, pIdx + 1))) covered.add(k);
          added = true;
          break;
        }
        if (added) break;
      }
      if (added) break;
    }
  }
}

/**
 * IPO with simpler vertical extension: when extending by parameter pIdx,
 * after horizontal extension, add new rows one at a time, each covering
 * one uncovered pair (new param vs previous), filling the rest with first value.
 */
export function generatePairwiseSimple(params) {
  if (params.length === 0) return [];
  if (params.length === 1) {
    return params[0].values.map((v) => ({ [params[0].name]: v }));
  }

  const names = params.map((p) => p.name);
  let rows = [];
  for (const v0 of params[0].values) {
    for (const v1 of params[1].values) {
      rows.push({ [names[0]]: v0, [names[1]]: v1 });
    }
  }
  const covered = new Set();
  for (const row of rows) {
    for (const k of getPairsCoveredByRow(row, names)) covered.add(k);
  }

  for (let pIdx = 2; pIdx < params.length; pIdx++) {
    const pName = names[pIdx];
    const pValues = params[pIdx].values;

    for (const row of rows) {
      let bestValue = pValues[0];
      let bestCount = -1;
      for (const v of pValues) {
        let newPairs = 0;
        for (let i = 0; i < pIdx; i++) {
          const key = pairKey(names[i], row[names[i]], pName, v);
          if (!covered.has(key)) newPairs++;
        }
        if (newPairs > bestCount) {
          bestCount = newPairs;
          bestValue = v;
        }
      }
      row[pName] = bestValue;
      for (let i = 0; i < pIdx; i++) {
        covered.add(pairKey(names[i], row[names[i]], pName, row[pName]));
      }
    }

    addVerticalRows(params, names, rows, covered, pIdx);
  }

  return rows;
}

/** Format a pair key for display: (ParamA: ValueA, ParamB: ValueB) */
export function formatPairKey(key) {
  const [p1, v1, p2, v2] = key.split('\t');
  return `(${p1}: ${v1}, ${p2}: ${v2})`;
}

/** Main entry: IPO pairwise generator (uses simple vertical extension). */
export function generatePairwise(params) {
  return generatePairwiseSimple(params);
}
