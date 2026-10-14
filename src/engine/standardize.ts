import { cell, type NumericData } from './types.ts'

/** 在指定列上非常數（可用於選擇）的欄位。 */
export function usableColumns(data: NumericData, rows: ArrayLike<number>): number[] {
  const out: number[] = []
  for (let j = 0; j < data.p; j++) {
    const first = cell(data, rows[0], j)
    for (let i = 1; i < rows.length; i++) {
      if (cell(data, rows[i], j) !== first) {
        out.push(j)
        break
      }
    }
  }
  return out
}

export interface Standardized {
  /** 標準化後的特徵（欄主序 n × q），依 cols 順序。 */
  Xs: Float64Array
  /** 中心化後的 y。 */
  yc: Float64Array
  n: number
  q: number
  cols: number[]
  /** y 的母體標準差（ddof = 0）。 */
  yStd: number
}

/** 以這些列的平均數與母體標準差（ddof = 0，同 StandardScaler）標準化特徵，並中心化 y。 */
export function standardize(data: NumericData, rows: ArrayLike<number>, cols: number[]): Standardized {
  const n = rows.length
  const q = cols.length
  const Xs = new Float64Array(n * q)
  for (let j = 0; j < q; j++) {
    let mean = 0
    for (let i = 0; i < n; i++) mean += cell(data, rows[i], cols[j])
    mean /= n
    let v = 0
    for (let i = 0; i < n; i++) {
      const d = cell(data, rows[i], cols[j]) - mean
      v += d * d
    }
    const sd = Math.sqrt(v / n) || 1
    for (let i = 0; i < n; i++) Xs[i + j * n] = (cell(data, rows[i], cols[j]) - mean) / sd
  }
  let ym = 0
  for (let i = 0; i < n; i++) ym += data.y[rows[i]]
  ym /= n
  const yc = new Float64Array(n)
  let yv = 0
  for (let i = 0; i < n; i++) {
    yc[i] = data.y[rows[i]] - ym
    yv += yc[i] * yc[i]
  }
  return { Xs, yc, n, q, cols, yStd: Math.sqrt(yv / n) }
}

/** G = XsᵀXs（q × q 欄主序）與 c = Xsᵀyc。 */
export function gram(s: Standardized): { G: Float64Array; c: Float64Array; yy: number } {
  const { Xs, yc, n, q } = s
  const G = new Float64Array(q * q)
  const c = new Float64Array(q)
  for (let a = 0; a < q; a++) {
    for (let b = a; b < q; b++) {
      let sum = 0
      for (let i = 0; i < n; i++) sum += Xs[i + a * n] * Xs[i + b * n]
      G[a + b * q] = sum
      G[b + a * q] = sum
    }
    let sum = 0
    for (let i = 0; i < n; i++) sum += Xs[i + a * n] * yc[i]
    c[a] = sum
  }
  let yy = 0
  for (let i = 0; i < n; i++) yy += yc[i] * yc[i]
  return { G, c, yy }
}
