import { cholesky, firstDeficientColumn, leastSquares, qrDecompose, solveLower } from '../linalg.ts'
import { designMatrix } from '../ols.ts'
import { gram, standardize } from '../standardize.ts'
import type { NumericData } from '../types.ts'

export const TIE_REL = 1e-12

/** a 是否嚴格優於 b（RSS 較小，且差距超過相對平手容差）。 */
export function betterRss(a: number, b: number): boolean {
  if (b === Infinity) return a < b
  return a < b - TIE_REL * Math.abs(b)
}

/**
 * 預先計算一個訓練集的 Gram 矩陣，之後可用 Cholesky 快速求任意子集（含截距）的 RSS。
 * 子集以 cols 內的「位置」表示。
 */
export class SubsetRss {
  private readonly G: Float64Array
  private readonly c: Float64Array
  private readonly yy: number
  private readonly q: number
  private readonly data: NumericData
  private readonly rows: ArrayLike<number>
  readonly cols: number[]

  constructor(data: NumericData, rows: ArrayLike<number>, cols: number[]) {
    const s = standardize(data, rows, cols)
    const g = gram(s)
    this.G = g.G
    this.c = g.c
    this.yy = g.yy
    this.q = s.q
    this.data = data
    this.rows = rows
    this.cols = cols
  }

  /** 子集（位置陣列）的 RSS；完全共線時回傳 Infinity。 */
  rss(subset: number[]): number {
    const m = subset.length
    const g = new Float64Array(m * m)
    const b = new Float64Array(m)
    for (let a = 0; a < m; a++) {
      b[a] = this.c[subset[a]]
      for (let d = 0; d < m; d++) g[a + d * m] = this.G[subset[a] + subset[d] * this.q]
    }
    const l = cholesky(g, m)
    if (!l) return this.rssByQr(subset)
    const z = solveLower(l, m, b)
    let zz = 0
    for (let i = 0; i < m; i++) zz += z[i] * z[i]
    return Math.max(0, this.yy - zz)
  }

  private rssByQr(subset: number[]): number {
    const cols = subset.map((i) => this.cols[i])
    const n = this.rows.length
    const a = designMatrix(this.data, this.rows, cols)
    const d = qrDecompose(a, n, cols.length + 1)
    if (firstDeficientColumn(d) >= 0) return Infinity
    const y = new Float64Array(n)
    for (let i = 0; i < n; i++) y[i] = this.data.y[this.rows[i]]
    const beta = leastSquares(d, y)
    let s = 0
    for (let i = 0; i < n; i++) {
      let yhat = 0
      for (let j = 0; j <= cols.length; j++) yhat += a[i + j * n] * beta[j]
      s += (y[i] - yhat) ** 2
    }
    return s
  }
}
